/**
 * 云同步模块 (Cloud Sync)
 * ---------------------------------------------------------------
 * 设计原则：
 *  1. 只新增逻辑，不改动任何现有界面/布局/DOM 结构。
 *  2. 本地 localStorage 仍是唯一读写入口（保证离线可用、老代码零改动），
 *     本模块在后台把数据镜像到云端，并在登录后从云端拉取合并。
 *  3. 未登录时完全静默（同以前行为一致），不打扰用户。
 *  4. 任何失败都不阻塞主流程，只记录日志 + 轻量提示。
 *
 * 依赖：
 *  - WorkBuddy Cloud SDK (CDN 全局 WorkBuddyCloud)
 *  - 需要 publicConfig（endpoint + publishableKey）
 */

(function () {
    'use strict';

    // ---- 云服务配置（来自 workbuddy_cloud_service 的 publicConfig）----
    const CLOUD_CONFIG = {
        // 同源代理：云端只认注册域名，自定义域名站点须经 Vercel 代理转发
        endpoint: window.location.origin + '/api/cloud',
        publishableKey: 'wbpk_EyygHhJU0gq4U5gWEdwZqs_5dtxmQDkuDiGlQ1oSQGQAJIzWXRZrN4W'
    };

    // ---- 本地存储键（与主程序保持一致，不得改动）----
    const STORAGE_KEY_REVIEWS = 'smart_review_assistant_reviews';
    const STORAGE_KEY_PLANS = 'smart_review_assistant_plans';
    const STORAGE_KEY_SETTINGS = 'smart_review_assistant_settings';

    // ---- 模块状态 ----
    const state = {
        cloud: null,
        ready: false,
        userId: null,
        syncing: false,
        lastSyncAt: 0
    };

    // ---- 内部工具：安全日志（绝不打印邮箱、token、正文数据）----
    function log() {
        const args = Array.prototype.slice.call(arguments);
        console.log.apply(console, ['[CloudSync]'].concat(args));
    }

    // ---- 内部工具：轻提示（不打断用户操作）----
    function notify(message, type) {
        try {
            if (typeof showNotification === 'function') {
                showNotification(message, type || 'info');
            }
        } catch (e) {
            console.warn('[CloudSync] 提示失败:', e && e.message);
        }
    }

    // ---- 内部工具：从本地读取数据（与主程序同一份数据）----
    function readLocal(key) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.warn('[CloudSync] 本地数据解析失败:', key, e && e.message);
            return [];
        }
    }

    function readLocalObject(key) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object') ? parsed : null;
        } catch (e) {
            console.warn('[CloudSync] 本地对象解析失败:', key, e && e.message);
            return null;
        }
    }

    // ---- 初始化 SDK ----
    function initClient() {
        if (state.cloud) return state.cloud;
        if (typeof WorkBuddyCloud === 'undefined' || !WorkBuddyCloud.createWorkBuddyCloud) {
            console.warn('[CloudSync] Cloud SDK 未加载，云同步不可用（不影响本地使用）');
            return null;
        }
        try {
            state.cloud = WorkBuddyCloud.createWorkBuddyCloud({
                endpoint: CLOUD_CONFIG.endpoint,
                publishableKey: CLOUD_CONFIG.publishableKey
            });
            log('客户端初始化成功');
            return state.cloud;
        } catch (e) {
            console.error('[CloudSync] 客户端初始化失败:', e && e.message);
            return null;
        }
    }

    // ============================================================
    //  上传：本地 -> 云端（按日期 upsert，天然去重）
    // ============================================================

    /**
     * 上传复盘数据。
     * 复用主程序的数据结构：每条形如 { date: 'YYYY-MM-DD', ... }
     * 云端表 reviews 以 (owner_id, review_date) 唯一，同日自动覆盖。
     */
    async function uploadReviews() {
        const cloud = state.cloud;
        if (!cloud || !state.userId) return { ok: false, reason: 'not-ready' };

        const reviews = readLocal(STORAGE_KEY_REVIEWS);
        if (!reviews.length) return { ok: true, count: 0 };

        const rows = [];
        for (const r of reviews) {
            const date = r && (r.date || r.reviewDate);
            if (!date) continue; // 无日期无法定位，跳过（不猜、不伪造）
            rows.push({
                review_date: String(date),
                payload: r
            });
        }
        if (!rows.length) return { ok: true, count: 0 };

        const { error } = await cloud.database
            .from('reviews')
            .upsert(rows, { onConflict: 'owner_id,review_date' });

        if (error) {
            console.error('[CloudSync] 复盘上传失败:', error.code || error.message);
            return { ok: false, error };
        }
        log('复盘已上传:', rows.length, '条');
        return { ok: true, count: rows.length };
    }

    async function uploadPlans() {
        const cloud = state.cloud;
        if (!cloud || !state.userId) return { ok: false, reason: 'not-ready' };

        const plans = readLocal(STORAGE_KEY_PLANS);
        if (!plans.length) return { ok: true, count: 0 };

        const rows = [];
        for (const p of plans) {
            const date = p && (p.date || p.planDate);
            if (!date) continue;
            rows.push({
                plan_date: String(date),
                payload: p
            });
        }
        if (!rows.length) return { ok: true, count: 0 };

        const { error } = await cloud.database
            .from('plans')
            .upsert(rows, { onConflict: 'owner_id,plan_date' });

        if (error) {
            console.error('[CloudSync] 规划上传失败:', error.code || error.message);
            return { ok: false, error };
        }
        log('规划已上传:', rows.length, '条');
        return { ok: true, count: rows.length };
    }

    async function uploadSettings() {
        const cloud = state.cloud;
        if (!cloud || !state.userId) return { ok: false, reason: 'not-ready' };

        const settings = readLocalObject(STORAGE_KEY_SETTINGS);
        if (!settings) return { ok: true, count: 0 };

        const { error } = await cloud.database
            .from('user_settings')
            .upsert({ payload: settings }, { onConflict: 'owner_id' });

        if (error) {
            console.error('[CloudSync] 设置上传失败:', error.code || error.message);
            return { ok: false, error };
        }
        return { ok: true, count: 1 };
    }

    // ============================================================
    //  下载：云端 -> 本地（合并策略：按日期，本地为准，缺失才补）
    // ============================================================

    /**
     * 合并云端数据到本地。
     * 合并策略（重要）：
     *   - 同一天的数据：保留本地版本（用户刚在本机编辑的更可信），不覆盖。
     *   - 云端有、本地没有的日期：补进来（这就是“换设备能看到老数据”）。
     * 这样既实现跨设备同步，又不会丢用户当前的编辑。
     */
    function mergeByDate(localArr, cloudArr) {
        const map = new Map();
        // 先放云端
        for (const item of cloudArr) {
            if (item && item.date) map.set(String(item.date), item);
        }
        // 再用本地覆盖（本地优先）
        for (const item of localArr) {
            if (item && item.date) map.set(String(item.date), item);
        }
        return Array.from(map.values()).sort(function (a, b) {
            return String(a.date) < String(b.date) ? -1 : 1;
        });
    }

    async function downloadAndMerge() {
        const cloud = state.cloud;
        if (!cloud || !state.userId) return { ok: false, reason: 'not-ready' };

        try {
            const [reviewsRes, plansRes] = await Promise.all([
                cloud.database.from('reviews').select('review_date,payload').order('review_date', { ascending: true }),
                cloud.database.from('plans').select('plan_date,payload').order('plan_date', { ascending: true })
            ]);

            let mergedCount = 0;

            // --- 复盘 ---
            if (reviewsRes.error) {
                console.error('[CloudSync] 复盘下载失败:', reviewsRes.error.code || reviewsRes.error.message);
            } else {
                const cloudReviews = (reviewsRes.data || [])
                    .map(function (row) { return row && row.payload; })
                    .filter(function (x) { return x && x.date; });
                const localReviews = readLocal(STORAGE_KEY_REVIEWS);
                const merged = mergeByDate(localReviews, cloudReviews);
                if (merged.length !== localReviews.length) {
                    localStorage.setItem(STORAGE_KEY_REVIEWS, JSON.stringify(merged));
                    mergedCount += merged.length - localReviews.length;
                }
            }

            // --- 规划 ---
            if (plansRes.error) {
                console.error('[CloudSync] 规划下载失败:', plansRes.error.code || plansRes.error.message);
            } else {
                const cloudPlans = (plansRes.data || [])
                    .map(function (row) { return row && row.payload; })
                    .filter(function (x) { return x && x.date; });
                const localPlans = readLocal(STORAGE_KEY_PLANS);
                const merged = mergeByDate(localPlans, cloudPlans);
                if (merged.length !== localPlans.length) {
                    localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(merged));
                    mergedCount += merged.length - localPlans.length;
                }
            }

            if (mergedCount > 0) {
                log('已从云端补充', mergedCount, '条数据');
                refreshUIAfterSync();
            }
            return { ok: true, added: mergedCount };
        } catch (e) {
            console.error('[CloudSync] 下载合并异常:', e && e.message);
            return { ok: false, error: e };
        }
    }

    // 同步后刷新界面（调用主程序已有函数，不自己造 UI）
    function refreshUIAfterSync() {
        try {
            if (typeof updateMonthlyInvestment === 'function') updateMonthlyInvestment();
            if (typeof updateDataInsight === 'function') updateDataInsight();
            if (typeof renderReviewHistory === 'function') renderReviewHistory();
            if (typeof updateTimeStatistics === 'function') updateTimeStatistics();
        } catch (e) {
            console.warn('[CloudSync] 界面刷新跳过:', e && e.message);
        }
    }

    // ============================================================
    //  对外主入口
    // ============================================================

    /** 全量同步：先拉取合并，再上传本地 */
    async function syncAll(opts) {
        if (state.syncing) return { ok: false, reason: 'busy' };
        state.syncing = true;
        try {
            const down = await downloadAndMerge();
            const upR = await uploadReviews();
            const upP = await uploadPlans();
            await uploadSettings();
            state.lastSyncAt = Date.now();

            const quiet = opts && opts.quiet;
            if (!quiet) {
                const added = (down && down.added) || 0;
                if (added > 0) {
                    notify('已同步 ' + added + ' 条云端记录', 'success');
                } else {
                    notify('数据已同步到云端', 'success');
                }
            }
            log('全量同步完成');
            return { ok: true, downloaded: down, uploaded: { reviews: upR, plans: upP } };
        } catch (e) {
            console.error('[CloudSync] 同步失败:', e && e.message);
            return { ok: false, error: e };
        } finally {
            state.syncing = false;
        }
    }

    /**
     * 监听本地数据变化，自动上传（防抖）。
     * 用轮询比对而非覆写主程序函数，避免与现有逻辑耦合。
     */
    let lastSnapshot = '';
    function startAutoSync() {
        setInterval(async function () {
            if (!state.ready || !state.cloud || !state.userId) return;
            if (state.syncing) return;

            const snapshot = [
                localStorage.getItem(STORAGE_KEY_REVIEWS) || '',
                localStorage.getItem(STORAGE_KEY_PLANS) || ''
            ].join('|');

            if (snapshot === lastSnapshot) return;
            const isFirst = lastSnapshot === '';
            lastSnapshot = snapshot;
            if (isFirst) return; // 首次跳过，避免刚加载就触发

            log('检测到本地数据变化，自动上传…');
            state.syncing = true;
            try {
                await uploadReviews();
                await uploadPlans();
            } finally {
                state.syncing = false;
            }
        }, 8000);
    }

    /** 登录后绑定用户并触发首次同步 */
    async function onSignedIn(user) {
        state.userId = (user && (user.id || user.email)) || null;
        state.ready = true;
        log('用户已登录，开始首次同步');
        await syncAll({ quiet: true });
        notify('云端同步已开启', 'success');
    }

    /** 退出登录 */
    function onSignedOut() {
        state.userId = null;
        state.ready = false;
        lastSnapshot = '';
        log('用户已退出，云同步暂停（本地数据保留）');
    }

    // ---- 暴露给主程序（以及控制台调试）----
    window.CloudSync = {
        config: CLOUD_CONFIG,
        init: initClient,
        syncAll: syncAll,
        uploadReviews: uploadReviews,
        uploadPlans: uploadPlans,
        downloadAndMerge: downloadAndMerge,
        onSignedIn: onSignedIn,
        onSignedOut: onSignedOut,
        getState: function () {
            return { ready: state.ready, userId: state.userId, syncing: state.syncing, lastSyncAt: state.lastSyncAt };
        }
    };

    // ---- 自动启动 ----
    function boot() {
        initClient();
        startAutoSync();
        log('模块已加载（等待登录）');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
