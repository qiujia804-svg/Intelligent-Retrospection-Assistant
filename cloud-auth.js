/**
 * 云登录模块 (Cloud Auth)
 * ---------------------------------------------------------------
 * 目标：把网站原有的「假登录」（密码明文存 localStorage）替换为真实的云端账号。
 *
 * 严格约束：
 *  - 不改动任何 HTML 结构、DOM id、CSS 样式。
 *  - 不改动原有函数名（handleLogin / handleRegister / logout ...），
 *    而是通过「运行时接管」的方式替换其实现，确保 index.html 里已绑定的
 *    事件监听器继续有效（它们是按函数名在全局查找的）。
 *  - 未登录时行为与之前一致，不影响本地使用。
 *
 * 登录方式：邮箱验证码（OTP）。
 *  - 复用注册表单里已有的「发送验证码」按钮（#send-verify-code）。
 *  - 复用已有的验证码输入框（#register-verify-code）。
 *  - 登录框的密码字段仍保留（云服务支持邮箱+密码登录，但用户可只用验证码）。
 */

(function () {
    'use strict';

    const CLOUD_CONFIG = {
        endpoint: 'https://smart-review-09187.app.workbuddy.host',
        publishableKey: 'wbpk_EyygHhJU0gq4U5gWEdwZqs_5dtxmQDkuDiGlQ1oSQGQAJIzWXRZrN4W'
    };

    let cloud = null;
    let pendingOtp = null; // { email, verificationId, isExistingUser }

    function log() {
        console.log.apply(console, ['[CloudAuth]'].concat(Array.prototype.slice.call(arguments)));
    }

    function initCloud() {
        if (cloud) return cloud;
        if (typeof WorkBuddyCloud === 'undefined' || !WorkBuddyCloud.createWorkBuddyCloud) {
            console.warn('[CloudAuth] Cloud SDK 未加载');
            return null;
        }
        try {
            cloud = WorkBuddyCloud.createWorkBuddyCloud({
                endpoint: CLOUD_CONFIG.endpoint,
                publishableKey: CLOUD_CONFIG.publishableKey
            });
            return cloud;
        } catch (e) {
            console.error('[CloudAuth] 初始化失败:', e && e.message);
            return null;
        }
    }

    // ============================================================
    //  对外接口
    // ============================================================

    /** 发送邮箱验证码（供「发送验证码」按钮调用） */
    async function sendCode(email) {
        const c = initCloud();
        if (!c) {
            alert('云服务暂时不可用，请稍后重试。');
            return false;
        }
        const sent = await c.auth.sendOtp({ email: email });
        if (sent.error) {
            console.error('[CloudAuth] 验证码发送失败:', sent.error.kind || sent.error.message);
            alert('验证码发送失败：' + (sent.error.message || '请稍后重试'));
            return false;
        }
        pendingOtp = {
            email: email,
            verificationId: sent.data.verificationId,
            isExistingUser: sent.data.isExistingUser
        };
        return true;
    }

    /**
     * 用验证码完成登录/注册。
     * 新用户需要密码（云服务要求邮箱账号必须设密码，否则后续无法用密码登录）。
     */
    async function verifyCode(email, token, password) {
        const c = initCloud();
        if (!c) {
            alert('云服务暂时不可用，请稍后重试。');
            return { ok: false };
        }
        if (!pendingOtp || pendingOtp.email !== email) {
            alert('请先获取当前邮箱的验证码！');
            return { ok: false };
        }
        const completed = await c.auth.verifyOtp({
            email: pendingOtp.email,
            verificationId: pendingOtp.verificationId,
            isExistingUser: pendingOtp.isExistingUser,
            token: token,
            password: pendingOtp.isExistingUser ? undefined : password
        });
        if (completed.error) {
            console.error('[CloudAuth] 验证失败:', completed.error.kind || completed.error.message);
            return { ok: false, message: completed.error.message };
        }
        pendingOtp = null;
        return { ok: true, session: completed.data };
    }

    /** 邮箱+密码登录 */
    async function signInWithPassword(email, password) {
        const c = initCloud();
        if (!c) return { ok: false, message: '云服务暂时不可用' };
        const res = await c.auth.signInWithPassword({ email: email, password: password });
        if (res.error) return { ok: false, message: res.error.message };
        return { ok: true, session: res.data };
    }

    /** 获取当前会话 */
    async function getSession() {
        const c = initCloud();
        if (!c) return null;
        const res = await c.auth.getSession();
        if (res.error || !res.data) return null;
        return res.data;
    }

    /** 退出登录 */
    async function signOut() {
        const c = initCloud();
        if (!c) return;
        try {
            await c.auth.signOut();
        } catch (e) {
            console.warn('[CloudAuth] 退出异常:', e && e.message);
        }
    }

    // ============================================================
    //  接管原有函数（保留函数名与 DOM，只换内部实现）
    // ============================================================

    /**
     * 接管 handleLogin：原逻辑是本地比对明文密码。
     * 新逻辑：优先走云端密码登录；失败则提示用验证码。
     */
    function takeOverLogin() {
        window.handleLogin = async function (e) {
            if (e && e.preventDefault) e.preventDefault();
            const emailEl = document.getElementById('login-email');
            const pwEl = document.getElementById('login-password');
            const email = emailEl ? emailEl.value.trim() : '';
            const password = pwEl ? pwEl.value : '';

            if (!email || !password) {
                alert('请填写邮箱和密码！');
                return;
            }

            const res = await signInWithPassword(email, password);
            if (!res.ok) {
                alert('登录失败：' + (res.message || '邮箱或密码错误'));
                return;
            }

            // 获取用户信息
            const user = await getCurrentUserProfile(email);
            applySignedInState(user);

            const loginModal = document.getElementById('login-modal');
            if (typeof closeModal === 'function' && loginModal) closeModal(loginModal);
            if (typeof loginForm !== 'undefined' && loginForm && loginForm.reset) loginForm.reset();

            alert('登录成功！');

            if (typeof checkTrialStatus === 'function') checkTrialStatus();
        };
        log('handleLogin 已接管');
    }

    /**
     * 接管 handleRegister：
     * 原逻辑是本地创建用户（密码明文入库）。
     * 新逻辑：校验验证码 -> 云端注册 -> 建立会话。
     */
    function takeOverRegister() {
        window.handleRegister = async function (e) {
            if (e && e.preventDefault) e.preventDefault();

            const nameEl = document.getElementById('register-name');
            const emailEl = document.getElementById('register-email');
            const pwEl = document.getElementById('register-password');
            const cpwEl = document.getElementById('register-confirm-password');
            const codeEl = document.getElementById('register-verify-code');

            const name = nameEl ? nameEl.value.trim() : '';
            const email = emailEl ? emailEl.value.trim() : '';
            const password = pwEl ? pwEl.value : '';
            const confirmPassword = cpwEl ? cpwEl.value : '';
            const verifyCode = codeEl ? codeEl.value.trim() : '';

            if (password !== confirmPassword) {
                alert('两次输入的密码不一致！');
                return;
            }
            if (!verifyCode) {
                alert('请输入邮箱验证码！');
                return;
            }

            const res = await verifyCode(email, verifyCode, password);
            if (!res.ok) {
                alert('验证失败：' + (res.message || '验证码错误或已过期'));
                return;
            }

            // 保存用户名（云端账号本身不含昵称，本地记录便于显示）
            try {
                localStorage.setItem('smart_review_user_profile', JSON.stringify({ name: name, email: email }));
            } catch (err) {
                console.warn('[CloudAuth] 昵称保存失败:', err && err.message);
            }

            applySignedInState({ name: name, email: email });

            const registerModal = document.getElementById('register-modal');
            if (typeof closeModal === 'function' && registerModal) closeModal(registerModal);
            if (typeof registerForm !== 'undefined' && registerForm && registerForm.reset) registerForm.reset();
            if (typeof resetEmailVerification === 'function') resetEmailVerification();

            alert('注册成功！数据将自动同步到云端。');
        };
        log('handleRegister 已接管');
    }

    /** 接管 logout */
    function takeOverLogout() {
        window.logout = async function () {
            await signOut();

            // 清理本地登录态（数据保留，避免退出即丢数据）
            try {
                localStorage.removeItem('currentUser');
                sessionStorage.removeItem('currentUser');
            } catch (e) { /* 忽略 */ }

            window.currentUser = null;
            try { currentUser = null; } catch (e) { /* 忽略 */ }

            if (typeof updateMemberUI === 'function') updateMemberUI();
            if (window.CloudSync && typeof CloudSync.onSignedOut === 'function') CloudSync.onSignedOut();

            alert('已退出登录！本地数据仍保留在本机。');
        };
        log('logout 已接管');
    }

    /** 接管「发送验证码」按钮行为 —— 改为调用云端 OTP */
    function takeOverSendCodeButton() {
        const btn = document.getElementById('send-verify-code');
        if (!btn) return;

        // 克隆替换以移除原有监听器（原监听器调用的是本地假验证码逻辑）
        const fresh = btn.cloneNode(true);
        btn.parentNode.replaceChild(fresh, btn);

        fresh.addEventListener('click', async function () {
            const emailEl = document.getElementById('register-email');
            const email = emailEl ? emailEl.value.trim() : '';
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email || !emailRegex.test(email)) {
                alert('请输入有效的邮箱地址！');
                return;
            }

            fresh.disabled = true;
            fresh.textContent = '发送中…';
            const ok = await sendCode(email);

            if (ok) {
                const group = document.getElementById('verify-code-group');
                if (group) group.style.display = 'block';
                const submitBtn = document.getElementById('register-submit-btn');
                if (submitBtn) submitBtn.disabled = false;
                alert('验证码已发送至您的邮箱，请查收！');
            } else {
                fresh.disabled = false;
                fresh.textContent = '发送验证码';
                return;
            }

            // 60 秒倒计时
            let countdown = 60;
            fresh.textContent = countdown + '秒后重试';
            const timer = setInterval(function () {
                countdown--;
                if (countdown > 0) {
                    fresh.textContent = countdown + '秒后重试';
                } else {
                    clearInterval(timer);
                    fresh.disabled = false;
                    fresh.textContent = '发送验证码';
                }
            }, 1000);
        });
        log('发送验证码按钮已接管');
    }

    // ============================================================
    //  辅助
    // ============================================================

    /** 应用已登录状态到界面（复用原有 UI 函数） */
    function applySignedInState(profile) {
        const defaultPlan = {
            id: 1,
            name: '免费版',
            memberLevel: '普通用户',
            expiryDate: '永久'
        };
        const user = {
            id: profile && profile.email,
            name: (profile && profile.name) || '用户',
            email: (profile && profile.email) || '',
            memberLevel: defaultPlan.memberLevel,
            expiryDate: defaultPlan.expiryDate,
            subscription: defaultPlan.id
        };
        // currentUser 是主程序的顶层 let（不挂 window）。
        // 这里同时设置 window 与 globalThis，保证主程序后续读取到一致状态。
        window.currentUser = user;
        try { currentUser = user; } catch (e) { /* 顶层变量不可写时忽略 */ }

        try {
            localStorage.setItem('currentUser', JSON.stringify(user));
        } catch (e) { /* 忽略 */ }

        if (typeof updateMemberUI === 'function') updateMemberUI();
        if (window.CloudSync && typeof CloudSync.onSignedIn === 'function') {
            CloudSync.onSignedIn(user);
        }
    }

    /** 读取用户昵称（本地保存的） */
    async function getCurrentUserProfile(email) {
        let name = '用户';
        try {
            const raw = localStorage.getItem('smart_review_user_profile');
            if (raw) {
                const p = JSON.parse(raw);
                if (p && p.email === email && p.name) name = p.name;
            }
        } catch (e) { /* 忽略 */ }
        return { name: name, email: email };
    }

    /** 启动时恢复已有会话 */
    async function restoreSession() {
        const session = await getSession();
        if (!session || !session.user) {
            log('无有效会话，保持未登录状态');
            return;
        }
        const email = session.user.email || '';
        const profile = await getCurrentUserProfile(email);
        log('检测到有效会话，自动恢复登录');
        applySignedInState(profile);
    }

    function boot() {
        if (!initCloud()) {
            console.warn('[CloudAuth] 云服务不可用，登录功能保持原状');
            return;
        }
        takeOverLogin();
        takeOverRegister();
        takeOverLogout();
        takeOverSendCodeButton();
        restoreSession();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); });
    } else {
        setTimeout(boot, 0);
    }
})();
