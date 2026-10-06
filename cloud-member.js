/**
 * 会员模块 (Cloud Member)
 * ---------------------------------------------------------------
 * 把原来的「本地假会员」换成「云端真会员」：
 *  1. 会员状态存在云端 memberships 表。客户端只能读自己的记录、只能插入
 *     「非会员」行（RLS 强制 is_premium=false / vip_type IS NULL），
 *     因此**前端无法给自己开通会员**，改会员必须由服务端完成。
 *  2. 支付弹窗的「我已支付，点击解锁」不再直接解锁，而是创建一条待确认
 *     订单（orders 表，status=pending），由管理员确认到账后开通。
 *  3. 未登录用户沿用原有本地 7 天试用；登录后一律以云端状态为准。
 *  4. 不新增/改动任何界面元素与布局，只接管已有函数的行为。
 *
 * 依赖：WorkBuddy Cloud SDK（全局 WorkBuddyCloud）
 *      cloud-auth.js（负责登录态，登录/退出时会回调本模块）
 */

(function () {
    'use strict';

    const CLOUD_CONFIG = {
        // 同源代理：云端只认注册域名，自定义域名站点须经 Vercel 代理转发
        endpoint: window.location.origin + '/cb',
        publishableKey: 'wbpk_EyygHhJU0gq4U5gWEdwZqs_5dtxmQDkuDiGlQ1oSQGQAJIzWXRZrN4W'
    };

    const TRIAL_MS = 7 * 24 * 60 * 60 * 1000; // 免费试用 7 天

    const MEMBERSHIP_COLUMNS = 'vip_type,is_premium,expires_at,trial_start';

    let cloud = null;
    let submittingOrder = false;

    const state = {
        userId: null,
        loaded: false,     // 是否已从云端读到（或确认无）记录；未登录时恒为 false
        vipType: null,
        expiresAt: null,
        trialEnd: null,
        isPremium: false,
        trialActive: false,
        lastSyncError: null
    };

    function log() {
        console.log.apply(console, ['[CloudMember]'].concat(Array.prototype.slice.call(arguments)));
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
            console.error('[CloudMember] 初始化失败:', e && e.message);
            return null;
        }
    }

    // ============================================================
    //  状态计算
    // ============================================================

    function resetState() {
        state.vipType = null;
        state.expiresAt = null;
        state.trialEnd = null;
        state.isPremium = false;
        state.trialActive = false;
    }

    /** 用一行 memberships 记录刷新本地状态 */
    function applyRow(row) {
        resetState();
        state.loaded = true;
        if (!row) return;

        const now = Date.now();
        const vipType = row.vip_type || null;
        const exp = row.expires_at ? new Date(row.expires_at) : null;
        const ts = row.trial_start ? new Date(row.trial_start) : null;

        state.vipType = vipType;
        state.expiresAt = exp;
        state.trialEnd = ts ? new Date(ts.getTime() + TRIAL_MS) : null;

        const isLifetime = vipType === 'lifetime';
        state.isPremium = row.is_premium === true && (isLifetime || (!!exp && exp.getTime() > now));
        state.trialActive = !state.isPremium && !!state.trialEnd && state.trialEnd.getTime() > now;
    }

    /** 未登录时沿用的本地试用（与主程序同一把钥匙） */
    function localTrialMs() {
        try {
            const key = (typeof TRIAL_CONFIG !== 'undefined' && TRIAL_CONFIG.storageKey) || 'vip_trial_start_time';
            const start = parseInt(localStorage.getItem(key) || '0', 10);
            if (!start || isNaN(start)) return 0;
            return Math.max(0, TRIAL_MS - (Date.now() - start));
        } catch (e) {
            return 0;
        }
    }

    /** 是否拥有高级权限（AI 分析 / 云同步等） */
    function hasPremiumAccess() {
        if (state.loaded) return state.isPremium || state.trialActive;
        return localTrialMs() > 0;
    }

    function remainingMs() {
        if (state.loaded) {
            if (state.isPremium) return 0;
            if (state.trialEnd) return Math.max(0, state.trialEnd.getTime() - Date.now());
            return 0;
        }
        return localTrialMs();
    }

    function getStatus() {
        const ms = remainingMs();
        return {
            loaded: state.loaded,
            isPremium: state.isPremium,
            vipType: state.vipType,
            trialActive: state.trialActive,
            expiresAt: state.expiresAt ? state.expiresAt.toISOString() : null,
            remainingDays: Math.floor(ms / 86400000),
            remainingHours: Math.floor((ms % 86400000) / 3600000),
            remainingMinutes: Math.floor((ms % 3600000) / 60000),
            hasPremiumAccess: hasPremiumAccess()
        };
    }

    // ============================================================
    //  云端读写
    // ============================================================

    /** 登录后加载会员状态；首次登录顺带建立试用记录 */
    async function loadFromCloud() {
        const c = initCloud();
        const user = window.currentUser;
        if (!c || !user) {
            state.userId = null;
            state.loaded = false;
            resetState();
            return { ok: false, reason: 'not-signed-in' };
        }
        state.userId = user.email || user.id || null;

        try {
            const res = await c.database.from('memberships').select(MEMBERSHIP_COLUMNS);
            if (res.error) {
                // 读取失败时保留上一次结果，避免网络抖动把会员误降级
                console.error('[CloudMember] 会员状态读取失败:', res.error.code || res.error.message);
                state.lastSyncError = res.error;
                return { ok: false, error: res.error };
            }
            state.lastSyncError = null;
            let row = (res.data && res.data[0]) || null;

            // 首次登录：建一条试用记录。
            // 只写默认值——owner_id 由服务端 DEFAULT auth.uid() 决定，
            // trial_start 取数据库 now()；会员字段交给服务端，客户端写不了。
            if (!row) {
                const ins = await c.database.from('memberships').insert([{}]).select(MEMBERSHIP_COLUMNS);
                if (ins.error) {
                    const again = await c.database.from('memberships').select(MEMBERSHIP_COLUMNS);
                    row = (again.data && again.data[0]) || null;
                    if (!row) {
                        console.error('[CloudMember] 建立试用记录失败:', ins.error.code || ins.error.message);
                        state.lastSyncError = ins.error;
                        return { ok: false, error: ins.error };
                    }
                } else {
                    row = (ins.data && ins.data[0]) || null;
                }
            }

            applyRow(row);
            log('会员状态已加载', {
                isPremium: state.isPremium,
                vipType: state.vipType,
                trialActive: state.trialActive
            });
            return { ok: true, row: row };
        } catch (e) {
            console.error('[CloudMember] 会员状态加载异常:', e && e.message);
            state.lastSyncError = e;
            return { ok: false, error: e };
        }
    }

    /** 创建待确认订单（用户在支付弹窗点「我已支付」时调用） */
    async function createOrder(plan, contact) {
        const c = initCloud();
        if (!c) return { ok: false, reason: 'cloud-unavailable' };
        const res = await c.database.from('orders').insert([{
            plan_id: String(plan.id),
            plan_name: String(plan.name),
            amount: Number(plan.price),
            contact: contact || null
        }]).select('id,plan_name,amount,status,created_at');
        if (res.error) {
            console.error('[CloudMember] 订单创建失败:', res.error.code || res.error.message);
            return { ok: false, error: res.error };
        }
        return { ok: true, order: (res.data && res.data[0]) || null };
    }

    // ============================================================
    //  接管原函数
    // ============================================================

    /**
     * 接管 checkTrialStatus：原实现只读本地 localStorage，
     * 这里改为「登录后以云端为准，未登录沿用本地试用」。
     * 返回值结构保持不变，避免影响调用方。
     */
    function takeOverTrialStatus() {
        const original = window.checkTrialStatus;
        window.checkTrialStatus = function () {
            if (!state.loaded) {
                if (typeof original === 'function') {
                    try {
                        const r = original.apply(this, arguments);
                        // 原文案依赖 remaining*，这里只用它保留本地试用行为
                        return {
                            isLocked: false,
                            isPremium: !!(r && r.isPremium) || localTrialMs() > 0,
                            remainingDays: (r && r.remainingDays) || 0,
                            remainingHours: (r && r.remainingHours) || 0,
                            remainingMinutes: (r && r.remainingMinutes) || 0
                        };
                    } catch (e) {
                        // 落回下面的统一分支
                    }
                }
            }
            const s = getStatus();
            // isPremium 表示「当前是否享有完整权益」——会员或试用期内
            return {
                isLocked: false,
                isPremium: s.hasPremiumAccess,
                remainingDays: s.remainingDays,
                remainingHours: s.remainingHours,
                remainingMinutes: s.remainingMinutes
            };
        };
    }

    /**
     * 接管「我已支付，点击解锁」。
     * 旧实现直接 localStorage.setItem('is_premium','true') —— 不付款即解锁。
     * 新实现：校验登录 -> 创建待确认订单 -> 提示等待到账确认。
     */
    function takeOverUnlockButtons() {
        const handlers = [
            ['vip-unlock-btn', handleClaimPaid],   // 会员中心支付弹窗
            ['payment-confirm', handleClaimPaid]   // 旧版支付弹窗（保留兜底）
        ];
        for (const pair of handlers) {
            const btn = document.getElementById(pair[0]);
            if (!btn) continue;
            // 克隆替换：旧代码 addEventListener 绑定的是「当时的函数引用」，
            // 事后覆盖 window 上的同名函数换不掉它，只能换节点。
            const fresh = btn.cloneNode(true);
            btn.parentNode.replaceChild(fresh, btn);
            fresh.addEventListener('click', pair[1]);
            log(pair[0] + ' 已接管');
        }
    }

    /** 用户声明「我已支付」——创建订单，不直接解锁 */
    async function handleClaimPaid(e) {
        if (e && e.preventDefault) e.preventDefault();
        if (submittingOrder) return;

        const plan = window.currentSelectedPlan;
        if (!plan) {
            alert('请先选择套餐');
            return;
        }

        const user = window.currentUser;
        if (!user) {
            alert('请先登录后再开通会员，这样权益才能跟着你的账号走。');
            return;
        }

        submittingOrder = true;
        try {
            const res = await createOrder(plan, user.email || null);
            if (!res.ok) {
                alert('订单提交失败：' + ((res.error && res.error.message) || '网络异常，请稍后重试'));
                return;
            }

            if (typeof closeVipPaymentModal === 'function') closeVipPaymentModal();
            if (typeof closeVipCenter === 'function') closeVipCenter();

            const orderId = res.order && res.order.id ? res.order.id : '';
            alert(
                '订单已提交' + (orderId ? '（编号 ' + orderId + '）' : '') + '\n\n' +
                '套餐：' + plan.name + '　金额：¥' + plan.price + '\n' +
                '我们确认到账后会为你开通会员，开通后刷新页面即可生效。\n\n' +
                '如已付款而未开通，请联系客服微信：JQJSBXXZI'
            );
        } finally {
            submittingOrder = false;
        }
    }

    // ============================================================
    //  登录态回调（由 cloud-auth.js 调用）
    // ============================================================

    async function onSignedIn() {
        await loadFromCloud();
        refreshMemberUI();
    }

    function onSignedOut() {
        state.userId = null;
        state.loaded = false;
        resetState();
        refreshMemberUI();
    }

    /** 让界面上的会员状态跟着刷新（复用主程序已有函数） */
    function refreshMemberUI() {
        try {
            if (typeof updateMemberUI === 'function') updateMemberUI();
        } catch (e) {
            console.warn('[CloudMember] 界面刷新跳过:', e && e.message);
        }
    }

    // ============================================================
    //  对外接口
    // ============================================================

    window.CloudMember = {
        config: CLOUD_CONFIG,
        init: initCloud,
        refresh: loadFromCloud,
        hasPremiumAccess: hasPremiumAccess,
        getStatus: getStatus,
        onSignedIn: onSignedIn,
        onSignedOut: onSignedOut
    };

    // ============================================================
    //  高级功能门禁（AI 复盘 / AI 规划）
    // ============================================================

    /** 需要会员权限的功能入口（这些按钮由 AI 脚本动态创建） */
    const PREMIUM_ENTRY_SELECTORS = ['.ai-review-entry', '.ai-plan-entry'];

    /**
     * 用文档级「捕获阶段」监听拦下未授权的点击。
     * 捕获先于按钮自身的冒泡监听执行，因此能可靠阻止原逻辑运行，
     * 且不必与 AI 脚本内部实现耦合（它们的函数在自己的闭包里）。
     */
    function installPremiumGate() {
        document.addEventListener('click', function (e) {
            const target = e.target;
            if (!target || typeof target.closest !== 'function') return;
            const hit = PREMIUM_ENTRY_SELECTORS.some(function (sel) {
                return target.closest(sel);
            });
            if (!hit) return;
            if (hasPremiumAccess()) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            showUpgradePrompt();
        }, true);
    }

    function showUpgradePrompt() {
        if (state.loaded) {
            alert('AI 功能属于会员权益，你的免费试用已结束。\n\n开通会员即可继续使用 AI 复盘与 AI 规划。');
        } else {
            alert('AI 功能属于会员权益。\n\n登录后即可获得 7 天免费试用。');
        }
        try {
            if (typeof openVipCenter === 'function') openVipCenter();
        } catch (e) { /* 会员中心不可用时忽略 */ }
    }

    // ============================================================
    //  启动
    // ============================================================

    function boot() {
        if (!initCloud()) {
            console.warn('[CloudMember] 云服务不可用，会员判定保持原有本地逻辑');
        }
        takeOverTrialStatus();
        takeOverUnlockButtons();
        installPremiumGate();

        // 若已有登录会话（cloud-auth.js 会先恢复），这里兜底再拉一次状态
        setTimeout(function () {
            if (window.currentUser) {
                loadFromCloud().then(refreshMemberUI);
            }
        }, 800);

        log('模块已加载');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); });
    } else {
        setTimeout(boot, 0);
    }
})();
