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
 *     会员中心顶部的「试用剩余 X天Y小时Z分钟」在原模板里是写死的，这里在渲染
 *     结果插入 DOM 前按云端真实状态改写那一行（会员显示有效期，试用显示倒计时）。
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

    /** 会员类型 -> 展示名（与主程序 VIP_PLANS 的文案保持一致） */
    const VIP_TYPE_LABEL = {
        monthly: '月度会员',
        yearly: '年度会员',
        yearly_challenge: '年度会员+挑战',
        lifetime: '终身会员'
    };

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

    /**
     * 接管会员中心顶部的状态条。
     *
     * 会员中心模板里那行「⏱️ 试用剩余 X天Y小时Z分钟」是**写死**的，没有任何
     * 会员态分支——正式会员也会看到「试用剩余 0天0小时0分钟」，用户会误以为
     * 会员没开通。这里不改模板、不改样式，只在渲染结果插入 DOM 之后按真实
     * 云端状态修正那一行文字（节点还是原来那个节点，样式沿用原来的）。
     */
    function takeOverVipCenter() {
        const original = window.renderVipCenter;
        if (typeof original !== 'function') return;

        window.renderVipCenter = function (isForced, days, hours, minutes) {
            const html = original.call(this, isForced, days, hours, minutes);
            let out = html;
            try {
                out = patchVipBanner(out, days || 0, hours || 0, minutes || 0);
            } catch (e) {
                console.warn('[CloudMember] 会员中心状态条修正跳过:', e && e.message);
            }
            try {
                out = patchLegalLinks(out);
            } catch (e) {
                console.warn('[CloudMember] 合规链接注入跳过:', e && e.message);
            }
            return out;
        };
    }

    /**
     * 在会员中心底部注入一行合规链接（用户协议 / 隐私政策 / 退款说明）。
     *
     * 只新增一个 div，不改模板、不改样式、不动任何原有节点——主站布局零改动。
     * 做成独立一步（而不是塞进 patchVipBanner）是因为后者有两个 return 出口，
     * 塞进去容易漏；这里只在最后一步统一注入，两个出口都能覆盖到。
     * 幂等：同一份 HTML 重复调用不会叠加。
     */
    const LEGAL_LINKS_ATTR = 'data-legal-links';
    function patchLegalLinks(html) {
        if (typeof html !== 'string' || !html) return html;
        if (html.indexOf(LEGAL_LINKS_ATTR) !== -1) return html;

        // 锚点取「底部保障信息」那一栏的收尾，把链接插在它下面
        const anchor = '即时开通使用</span>';
        const i = html.indexOf(anchor);
        if (i === -1) return html;              // 模板结构变了就放弃，不猜
        const j = html.indexOf('</div>', i);
        if (j === -1) return html;

        const linkStyle = 'color:rgba(255,255,255,0.42);font-size:0.78em;text-decoration:none;';
        const block = '<div ' + LEGAL_LINKS_ATTR + '="1" style="display:flex;justify-content:center;gap:18px;flex-wrap:wrap;padding-top:12px;position:relative;z-index:1;">' +
            '<a href="/terms.html" target="_blank" rel="noopener" style="' + linkStyle + '">用户协议</a>' +
            '<a href="/privacy.html" target="_blank" rel="noopener" style="' + linkStyle + '">隐私政策</a>' +
            '<a href="/refund.html" target="_blank" rel="noopener" style="' + linkStyle + '">退款说明</a>' +
            '</div>';
        return html.slice(0, j + 6) + block + html.slice(j + 6);
    }

    /** 把渲染出的 HTML 中「试用剩余」那一行替换成当前真实状态 */
    function patchVipBanner(html, days, hours, minutes) {
        if (typeof html !== 'string' || html.indexOf('试用剩余') === -1) return html;

        const s = getStatus();
        const cur = {
            d: s.remainingDays, h: s.remainingHours, m: s.remainingMinutes
        };
        let label;
        let matched;

        if (s.isPremium) {
            const typeName = VIP_TYPE_LABEL[s.vipType] || '会员';
            label = s.vipType === 'lifetime'
                ? '✅ ' + typeName + ' · 永久有效'
                : '✅ ' + typeName + '有效期至 ' + formatDate(s.expiresAt);
        } else if (s.loaded) {
            // 已登录：以云端状态为准（试用中 / 试用已结束）
            label = (cur.d === 0 && cur.h === 0 && cur.m === 0)
                ? '⏱️ 免费试用已结束'
                : '⏱️ 试用剩余 ' + cur.d + '天' + cur.h + '小时' + cur.m + '分钟';
        } else {
            // 未登录：沿用主程序传入的本地试用倒计时
            label = '⏱️ 试用剩余 ' + (days || 0) + '天' + (hours || 0) + '小时' + (minutes || 0) + '分钟';
        }

        // renderVipCenter 返回的是**已求值**的 HTML，模板里的 ${days} 早变成了数字，
        // 所以只能按「渲染时实际传入的数值」定位那一行，不能按 ${days} 字面量匹配。
        const rendered = '⏱️ 试用剩余 ' + (days || 0) + '天' + (hours || 0) + '小时' + (minutes || 0) + '分钟';
        if (html.indexOf(rendered) !== -1) {
            return html.split(rendered).join(label);
        }

        // 兜底：传入值与渲染值不一致时（理论上不会发生），用正则匹配任意数字形态
        matched = html.match(/⏱️ 试用剩余 \d+天\d+小时\d+分钟/);
        if (!matched) return html; // 模板已变，放弃（不猜）
        return html.split(matched[0]).join(label);
    }

    /** 把云端返回的 ISO 日期格式化成主程序同一风格 YYYY/MM/DD */
    function formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.getFullYear() + '/' +
            String(d.getMonth() + 1).padStart(2, '0') + '/' +
            String(d.getDate()).padStart(2, '0');
    }

    /** 用户声明「我已支付」——创建订单，不直接解锁 */
    async function handleClaimPaid(e) {
        if (e && e.preventDefault) e.preventDefault();
        if (submittingOrder) return;

        // 套餐来源兜底：会员中心入口写 window.currentSelectedPlan，
        // 但右下角商业化悬浮球的订阅入口只写 commercialSystem.selectedPlan，
        // 不兜底会弹「请先选择套餐」或记错套餐金额。
        let plan = window.currentSelectedPlan;
        if (!plan && window.commercialSystem && window.commercialSystem.selectedPlan) {
            plan = window.commercialSystem.selectedPlan;
            window.currentSelectedPlan = plan; // 统一回写，后续逻辑共用
            log('套餐取自商业化系统:', plan.id);
        }
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
                '套餐：' + plan.name + '　应付金额：¥' + plan.price + '\n\n' +
                '⚠️ 重要：收款码为个人收款码，转账金额由付款方填写。\n' +
                '请务必按 ¥' + plan.price + ' 全额支付，金额不符将无法开通。\n' +
                '转账时请在备注/说明里填写你的注册邮箱，方便核对到账。\n\n' +
                '我们核对实际到账金额后会为你开通会员，开通后刷新页面即可生效。\n' +
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
        // 会员中心若正开着，用最新状态重渲染一次（内部走已被接管的 renderVipCenter）
        try {
            if (document.getElementById('vip-center-overlay') && typeof window.renderVipCenter === 'function') {
                const s = getStatus();
                document.body.insertAdjacentHTML('beforeend', window.renderVipCenter(false, s.remainingDays, s.remainingHours, s.remainingMinutes));
                const old = document.getElementById('vip-center-overlay');
                if (old) {
                    // 新节点在末尾，删掉把「会员中心」按钮插进 DOM 时生成的那个旧节点
                    const all = document.querySelectorAll('#vip-center-overlay');
                    if (all.length > 1) all[0].remove();
                }
            }
        } catch (e) {
            console.warn('[CloudMember] 会员中心刷新跳过:', e && e.message);
        }
    }

    /**
     * 供其他模块（AI 规划 / AI 复盘）取请求用的鉴权头。
     *
     * 服务端接口会校验调用者会员身份，前端必须把会话 token 带上，
     * 否则付费用户自己也会被 401 拦掉。这里统一从 SDK 会话取，
     * 失败返回空对象（调用方仍可发请求，由服务端裁决）。
     */
    async function getAuthHeader() {
        try {
            const c = initCloud();
            if (!c) return {};
            const res = await c.auth.getSession();
            const session = res && res.data;
            const token = session && (session.accessToken || (session.session && session.session.accessToken));
            if (!token) return {};
            return { Authorization: 'Bearer ' + token };
        } catch (e) {
            console.warn('[CloudMember] 取会话令牌失败:', e && e.message);
            return {};
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
        getAuthHeader: getAuthHeader,
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
        takeOverVipCenter();
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
