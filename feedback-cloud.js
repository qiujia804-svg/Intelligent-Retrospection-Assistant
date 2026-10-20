/**
 * 用户反馈上云模块 (Feedback Cloud)
 * ---------------------------------------------------------------
 * 解决的问题：
 *   原来的「客服反馈」只写进提交者自己浏览器的 localStorage，
 *   管理台读的是管理员自己浏览器的 localStorage —— 两台设备，数据永远不通。
 *
 * 本模块把用户提交的反馈真正写进云端 feedbacks 表：
 *   - 游客（未登录）也能提交，表上只开放 INSERT，任何人都读不到别人的反馈
 *   - 管理员通过 SECURITY DEFINER 函数读取（函数内校验 auth.uid() === ADMIN_ID）
 *   - 失败不阻塞原有流程：本地仍然留一份，并通过返回值告诉调用方
 *
 * 依赖：WorkBuddy Cloud SDK（全局 WorkBuddyCloud）
 * 不影响任何既有界面、布局与本地存储逻辑。
 */

(function () {
    'use strict';

    const CLOUD_CONFIG = {
        // 同源代理：云端只认注册域名，自定义域名站点须经 Vercel 代理转发
        endpoint: window.location.origin + '/cb',
        publishableKey: 'wbpk_EyygHhJU0gq4U5gWEdwZqs_5dtxmQDkuDiGlQ1oSQGQAJIzWXRZrN4W'
    };

    const TABLE = 'feedbacks';
    const MAX_LEN = 2000;
    const TIMEOUT_MS = 8000;

    let cloud = null;

    function log() {
        console.log.apply(console, ['[FeedbackCloud]'].concat(Array.prototype.slice.call(arguments)));
    }

    function initCloud() {
        if (cloud) return cloud;
        if (typeof WorkBuddyCloud === 'undefined' || !WorkBuddyCloud.createWorkBuddyCloud) {
            return null;
        }
        cloud = WorkBuddyCloud.createWorkBuddyCloud({
            endpoint: CLOUD_CONFIG.endpoint,
            publishableKey: CLOUD_CONFIG.publishableKey
        });
        return cloud;
    }

    /** 带超时的提交：网络卡住时不能把按钮一直挂着 */
    function withTimeout(promise, ms) {
        return new Promise(function (resolve, reject) {
            const timer = setTimeout(function () {
                reject(new Error('提交超时，请检查网络后重试'));
            }, ms);
            promise.then(function (v) { clearTimeout(timer); resolve(v); },
                         function (e) { clearTimeout(timer); reject(e); });
        });
    }

    /**
     * 提交一条反馈到云端。
     * @param {{type?:string, content:string, contact?:string, page?:string}} data
     * @returns {Promise<{ok:boolean, error?:string}>}
     *          只返回结果，不抛异常 —— 调用方据此决定提示文案，绝不因反馈失败阻断用户操作。
     */
    async function submit(data) {
        const content = String((data && data.content) || '').trim();
        if (!content) return { ok: false, error: '内容为空' };
        if (content.length > MAX_LEN) return { ok: false, error: '内容超过 ' + MAX_LEN + ' 字' };

        const c = initCloud();
        if (!c) return { ok: false, error: '云服务不可用' };

        const row = {
            type: String((data && data.type) || 'other').slice(0, 20),
            content: content,
            contact: String((data && data.contact) || '').slice(0, 100) || null,
            page: String((data && data.page) || (window.location.pathname + window.location.search)).slice(0, 200)
        };

        try {
            const res = await withTimeout(c.database.from(TABLE).insert([row]), TIMEOUT_MS);
            if (res && res.error) {
                log('提交失败:', res.error.message || res.error.code);
                return { ok: false, error: res.error.message || '写入失败' };
            }
            log('已写入云端');
            return { ok: true };
        } catch (e) {
            log('提交异常:', e && e.message);
            return { ok: false, error: (e && e.message) || '网络异常' };
        }
    }

    window.FeedbackCloud = {
        submit: submit,
        TABLE: TABLE
    };
})();
