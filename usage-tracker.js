/**
 * 使用行为埋点 (Usage Tracker)
 * ---------------------------------------------------------------
 * 只为「登录用户」记录访问与停留，用于会员管理台的运营看板：
 *   - 每次打开/续用 → 一条 session（kind='visit'）
 *   - 发生真正的登录动作 → 新 session（kind='login'）
 *   - 停留时长 = 最后一次心跳 - 会话开始（服务端算，客户端改不了）
 *
 * 隐私与边界：
 *   - 未登录用户不记录（没有邮箱，统计无意义，也不该悄悄记）
 *   - 只记录「谁、什么时候、待了多久」，不记录任何页面内容或复盘数据
 *   - 表对客户端完全封闭，写入只能通过 record_visit 函数
 *
 * 不影响任何既有界面与逻辑；任何失败都静默，绝不打扰用户。
 */

(function () {
    'use strict';

    const CLOUD_CONFIG = {
        endpoint: window.location.origin + '/cb',
        publishableKey: 'wbpk_EyygHhJU0gq4U5gWEdwZqs_5dtxmQDkuDiGlQ1oSQGQAJIzWXRZrN4W'
    };

    const HEARTBEAT_MS = 45000;      // 心跳间隔
    const IDLE_MS = 5 * 60 * 1000;   // 超过 5 分钟无操作视为离开
    const SESSION_TTL_MS = 30 * 60 * 1000; // 会话有效期，超过则开新会话
    const SID_KEY = 'ira_usage_sid';
    const SID_TS_KEY = 'ira_usage_sid_ts';

    let cloud = null;
    let sessionId = null;
    let started = false;
    let timer = null;
    let lastActivity = Date.now();
    let writing = false;

    function log() {
        console.log.apply(console, ['[Usage]'].concat(Array.prototype.slice.call(arguments)));
    }

    function initCloud() {
        if (cloud) return cloud;
        if (typeof WorkBuddyCloud === 'undefined' || !WorkBuddyCloud.createWorkBuddyCloud) return null;
        cloud = WorkBuddyCloud.createWorkBuddyCloud({
            endpoint: CLOUD_CONFIG.endpoint,
            publishableKey: CLOUD_CONFIG.publishableKey
        });
        return cloud;
    }

    function device() {
        return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') ? 'mobile' : 'desktop';
    }

    function newSession() {
        sessionId = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        try {
            sessionStorage.setItem(SID_KEY, sessionId);
            sessionStorage.setItem(SID_TS_KEY, String(Date.now()));
        } catch (e) { /* 隐私模式下 sessionStorage 可能不可用，不影响功能 */ }
        return sessionId;
    }

    /** 复用当前标签页的会话；超过 TTL 或不存在则新建 */
    function currentSession() {
        try {
            const sid = sessionStorage.getItem(SID_KEY);
            const ts = Number(sessionStorage.getItem(SID_TS_KEY) || 0);
            if (sid && ts && Date.now() - ts < SESSION_TTL_MS) {
                sessionId = sid;
                return sid;
            }
        } catch (e) { /* 忽略 */ }
        return sessionId || newSession();
    }

    function authStatus() {
        return window.AuthState && typeof window.AuthState.getState === 'function'
            ? window.AuthState.getState().status
            : 'unknown';
    }

    async function beat(kind) {
        if (writing) return;
        if (document.hidden) return;
        if (authStatus() !== 'signed-in') return;
        // 人已离开（超过 5 分钟无操作）就停止心跳，避免把离开的时间算成停留
        if (Date.now() - lastActivity > IDLE_MS) return;

        const c = initCloud();
        if (!c) return;

        writing = true;
        try {
            const res = await c.database.rpc('record_visit', {
                p_session_id: currentSession(),
                p_kind: kind || 'visit',
                p_device: device()
            });
            if (res && res.error) {
                log('心跳失败:', res.error.message || res.error.code);
            } else {
                try { sessionStorage.setItem(SID_TS_KEY, String(Date.now())); } catch (e) { /* 忽略 */ }
            }
        } catch (e) {
            log('心跳异常:', e && e.message);
        } finally {
            writing = false;
        }
    }

    function markActivity() {
        const gap = Date.now() - lastActivity;
        lastActivity = Date.now();
        // 离开过又回来：算作一次新的访问，不要让空档时间滚进停留时长
        if (gap > IDLE_MS && authStatus() === 'signed-in') {
            newSession();
            beat('visit');
        }
    }

    function startTimer() {
        if (timer) return;
        timer = setInterval(function () {
            beat('visit');
        }, HEARTBEAT_MS);
    }

    function onSignedIn(isLogin) {
        if (isLogin) newSession();          // 真正的登录 → 新会话，计入「登录次数」
        lastActivity = Date.now();
        beat(isLogin ? 'login' : 'visit');
        startTimer();
    }

    function boot() {
        if (started) return;
        started = true;

        ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (ev) {
            try { window.addEventListener(ev, markActivity, { passive: true }); } catch (e) { /* 忽略 */ }
        });

        // 页面隐藏时补一次心跳，尽量把最后一段停留记下来
        try {
            document.addEventListener('visibilitychange', function () {
                if (document.hidden) beat('visit');
            });
            window.addEventListener('pagehide', function () { beat('visit'); });
        } catch (e) { /* 忽略 */ }

        if (!window.AuthState || typeof window.AuthState.subscribe !== 'function') {
            // 没有认证单例就不埋点（宁可少数据，也不要记错人）
            log('无 AuthState，跳过埋点');
            return;
        }

        let lastStatus = authStatus();
        window.AuthState.subscribe(function (snap) {
            if (!snap) return;
            const prev = lastStatus;
            lastStatus = snap.status;
            if (snap.status !== 'signed-in') return;
            // 只有「从已登出变成已登录」才算一次登录；
            // 页面加载时恢复的会话（INITIAL_SESSION / 同一用户重复下发）只算访问
            const isLogin = snap.lastEvent === 'SIGNED_IN' && prev === 'signed-out';
            onSignedIn(isLogin);
        });

        // 页面加载时若已登录，直接记一次访问
        if (authStatus() === 'signed-in') onSignedIn(false);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.UsageTracker = {
        flush: function () { return beat('visit'); },
        get sessionId() { return sessionId; }
    };
})();
