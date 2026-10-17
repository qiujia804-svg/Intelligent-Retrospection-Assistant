/**
 * 认证状态单例 (Auth State)
 * ---------------------------------------------------------------
 * 全站唯一的登录状态真相源。
 *
 * 设计目标（解决「界面说已登录、门禁说未登录」这类反复出现的 Bug）：
 *  1. 只认云端会话，不再用本地缓存的 currentUser 判断登录。
 *  2. 通过 SDK 的 onAuthStateChange 订阅会话变化（INITIAL_SESSION / SIGNED_IN /
 *     SIGNED_OUT / TOKEN_REFRESHED），不靠 setTimeout 猜时序。
 *  3. 状态未确定时对外暴露 'unknown'，调用方不得把它当成「未登录」去拦人。
 *  4. 会话失效时统一清理本地残留登录态，让界面与真相保持一致。
 *
 * 对外接口：
 *  - getState()            同步取快照 { status, session, user, checkedAt, lastEvent }
 *  - whenReady()           首次状态确定后 resolve（含超时兜底）
 *  - subscribe(fn)         订阅状态变化，返回取消订阅函数
 *  - isSignedIn()
 *  - revalidate()          主动回云端核验一次，返回 'signed-in' | 'signed-out'
 *  - authHeader()          取 Authorization 头（无会话返回 {}）
 *  - onUnauthorized()      API 返回 401 时调用：核验 + 清理 + 返回统一文案
 *  - message401()          统一 401 提示文案
 */

(function () {
    'use strict';

    const CLOUD_CONFIG = {
        // 同源代理：云端只认注册域名，自定义域名站点须经 Vercel 代理转发
        endpoint: window.location.origin + '/cb',
        publishableKey: 'wbpk_EyygHhJU0gq4U5gWEdwZqs_5dtxmQDkuDiGlQ1oSQGQAJIzWXRZrN4W'
    };

    // 首次状态确定的兜底超时：超时仍无事件则按未登录处理（宁可显示未登录，也不假装已登录）
    const READY_TIMEOUT_MS = 8000;

    const state = {
        status: 'unknown',   // unknown | signed-in | signed-out
        session: null,
        user: null,          // { id, name, email }
        checkedAt: 0,
        lastEvent: null
    };

    let cloud = null;
    let unsubscribe = null;
    let readySettled = false;
    let readyResolve = null;
    const readyPromise = new Promise(function (resolve) { readyResolve = resolve; });
    const listeners = [];

    function log() {
        console.log.apply(console, ['[AuthState]'].concat(Array.prototype.slice.call(arguments)));
    }

    function initCloud() {
        if (cloud) return cloud;
        if (typeof WorkBuddyCloud === 'undefined' || !WorkBuddyCloud.createWorkBuddyCloud) {
            return null;
        }
        try {
            cloud = WorkBuddyCloud.createWorkBuddyCloud({
                endpoint: CLOUD_CONFIG.endpoint,
                publishableKey: CLOUD_CONFIG.publishableKey
            });
            return cloud;
        } catch (e) {
            console.error('[AuthState] 初始化失败:', e && e.message);
            return null;
        }
    }

    function snapshot() {
        return {
            status: state.status,
            session: state.session,
            user: state.user,
            checkedAt: state.checkedAt,
            lastEvent: state.lastEvent
        };
    }

    function notify() {
        const snap = snapshot();
        listeners.slice().forEach(function (fn) {
            try {
                fn(snap);
            } catch (e) {
                console.warn('[AuthState] 订阅者异常:', e && e.message);
            }
        });
    }

    function settleReady() {
        if (readySettled) return;
        readySettled = true;
        try { readyResolve(snapshot()); } catch (e) { /* 忽略 */ }
    }

    function normalizeUser(user) {
        if (!user) return null;
        return {
            id: user.id || null,
            name: user.name || null,
            email: user.email || null
        };
    }

    /** 异步补全邮箱：SDK 的 session.user 不含 email，需走 /user/me */
    function enrichUser() {
        const c = initCloud();
        if (!c || state.status !== 'signed-in') return;
        Promise.resolve()
            .then(function () { return c.auth.getUser(); })
            .then(function (me) {
                if (state.status !== 'signed-in') return;
                const data = me && me.data;
                if (!data || !data.email) return;
                const next = Object.assign({}, state.user || {}, {
                    id: data.id || (state.user && state.user.id) || null,
                    name: data.name || (state.user && state.user.name) || null,
                    email: data.email
                });
                if (!state.user || state.user.email !== next.email) {
                    state.user = next;
                    notify();
                }
            })
            .catch(function (e) {
                log('补全邮箱失败（不影响登录判定）:', e && e.message);
            });
    }

    function applySession(session, eventName) {
        state.lastEvent = eventName || null;
        state.checkedAt = Date.now();

        if (session && (session.user || session.accessToken)) {
            state.status = 'signed-in';
            state.session = session;
            state.user = normalizeUser(session.user);
            log('已登录', eventName || '', state.user && (state.user.email || state.user.id));
            enrichUser();
        } else {
            state.status = 'signed-out';
            state.session = null;
            state.user = null;
            log('未登录', eventName || '');
        }

        settleReady();
        notify();
    }

    /** 清除本地残留的旧登录态（本文件不负责刷新界面，由调用方决定） */
    function clearStaleLocalUser() {
        try { localStorage.removeItem('currentUser'); } catch (e) { /* 忽略 */ }
        try { sessionStorage.removeItem('currentUser'); } catch (e) { /* 忽略 */ }
        try { window.currentUser = null; } catch (e) { /* 忽略 */ }
        try {
            // 主程序的顶层 let（不挂 window），同一全局词法环境内可直接赋值
            if (typeof currentUser !== 'undefined') currentUser = null;
        } catch (e) { /* 忽略 */ }
    }

    function boot() {
        const c = initCloud();
        if (!c) {
            // SDK 未加载：按未登录处理，但明确标记为「无法核验」
            state.status = 'signed-out';
            state.checkedAt = Date.now();
            state.lastEvent = 'SDK_UNAVAILABLE';
            console.warn('[AuthState] 云 SDK 未加载，按未登录处理');
            settleReady();
            notify();
            return;
        }

        try {
            unsubscribe = c.auth.onAuthStateChange(function (event, session) {
                applySession(session, event);
            });
            log('已订阅会话变更');
        } catch (e) {
            console.error('[AuthState] 订阅会话变更失败:', e && e.message);
            applySession(null, 'SUBSCRIBE_FAILED');
        }

        // 兜底：SDK 迟迟不发 INITIAL_SESSION 时，不能让界面永远停在 unknown
        setTimeout(function () {
            if (!readySettled) {
                console.warn('[AuthState] 会话事件超时，按未登录处理');
                if (state.status !== 'signed-in') {
                    state.status = 'signed-out';
                    state.checkedAt = Date.now();
                    state.lastEvent = 'READY_TIMEOUT';
                }
                settleReady();
                notify();
            }
        }, READY_TIMEOUT_MS);
    }

    // ============================================================
    //  对外接口
    // ============================================================

    function getState() {
        return snapshot();
    }

    function whenReady() {
        return readyPromise.then(function () { return snapshot(); });
    }

    function subscribe(fn) {
        if (typeof fn !== 'function') return function () {};
        listeners.push(fn);
        return function () {
            const i = listeners.indexOf(fn);
            if (i >= 0) listeners.splice(i, 1);
        };
    }

    function isSignedIn() {
        return state.status === 'signed-in';
    }

    /** 主动回云端核验一次会话 */
    async function revalidate() {
        const c = initCloud();
        if (!c) {
            applySession(null, 'REVALIDATE_NO_SDK');
            return 'signed-out';
        }
        try {
            const res = await c.auth.getSession();
            const session = res && res.data;
            if (res && res.error) {
                applySession(null, 'REVALIDATE_FAILED');
                return 'signed-out';
            }
            if (!session || (!session.user && !session.accessToken)) {
                applySession(null, 'REVALIDATE_EMPTY');
                return 'signed-out';
            }
            applySession(session, 'REVALIDATE_OK');
            return 'signed-in';
        } catch (e) {
            log('会话核验异常:', e && e.message);
            applySession(null, 'REVALIDATE_ERROR');
            return 'signed-out';
        }
    }

    /** 取请求鉴权头；无会话返回空对象（由服务端最终裁决） */
    async function authHeader() {
        const c = initCloud();
        if (!c) return {};
        try {
            const res = await c.auth.getSession();
            const session = res && res.data;
            const token = session && (session.accessToken || (session.session && session.session.accessToken));
            if (!token) return {};
            return { Authorization: 'Bearer ' + token };
        } catch (e) {
            return {};
        }
    }

    /** 统一 401 文案：先分清「没登录」还是「登录已过期」 */
    function message401() {
        return '登录状态已失效，请重新登录后再试。';
    }

    function messageGuest() {
        return '请先登录后再使用 AI 功能。';
    }

    /**
     * API 返回 401 时调用：核验会话 → 若确认失效则清理本地残留登录态。
     * 返回 { status, message, cleared }
     */
    async function onUnauthorized() {
        const wasSignedIn = state.status === 'signed-in';
        const status = await revalidate();
        if (status === 'signed-out') {
            const hadLocalUser = (function () {
                try { return !!localStorage.getItem('currentUser'); } catch (e) { return false; }
            })();
            clearStaleLocalUser();
            try { if (typeof updateMemberUI === 'function') updateMemberUI(); } catch (e) { /* 忽略 */ }
            if (window.CloudMember && typeof window.CloudMember.onSignedOut === 'function') {
                try { window.CloudMember.onSignedOut(); } catch (e) { /* 忽略 */ }
            }
            return {
                status: 'signed-out',
                message: (wasSignedIn || hadLocalUser) ? message401() : messageGuest(),
                cleared: true
            };
        }
        return {
            status: 'signed-in',
            message: '当前账号没有 AI 使用权限，请检查会员状态。',
            cleared: false
        };
    }

    window.AuthState = {
        config: CLOUD_CONFIG,
        init: initCloud,
        getState: getState,
        whenReady: whenReady,
        subscribe: subscribe,
        isSignedIn: isSignedIn,
        revalidate: revalidate,
        authHeader: authHeader,
        onUnauthorized: onUnauthorized,
        message401: message401,
        messageGuest: messageGuest,
        clearStaleLocalUser: clearStaleLocalUser
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); });
    } else {
        setTimeout(boot, 0);
    }
})();
