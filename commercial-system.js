/**
 * 智能复盘助手 - 商业化系统模块 v1.0
 * 独立模块，通过注入方式集成到主应用
 *
 * 功能：
 * 1. 智能试用风控系统
 * 2. 锁定与解锁交互
 * 3. 模拟支付流程
 * 4. 悬浮反馈球
 */

(function() {
    'use strict';

    // ========================================
    // 配置常量
    // ========================================

    // 试用时长配置（毫秒）
    // 默认3天，测试时可改为 1 * 60 * 1000（1分钟）
    const TRIAL_DURATION = 3 * 24 * 60 * 60 * 1000; // 3天
    // const TRIAL_DURATION = 1 * 60 * 1000; // 1分钟（测试用）

    // LocalStorage 键名
    const STORAGE_KEYS = {
        TRIAL_START: 'commercial_trial_start_time',
        IS_PREMIUM: 'commercial_is_premium',
        FEEDBACK_SHOWN: 'commercial_feedback_shown'
    };

    // 订阅套餐配置
    const SUBSCRIPTION_PLANS = [
        {
            id: 'monthly',
            name: '月度会员',
            price: 19.9,
            originalPrice: 29.9,
            period: '月',
            features: ['无限复盘记录', 'AI智能分析', '数据图表导出', '优先客服支持'],
            popular: false
        },
        {
            id: 'yearly',
            name: '年度会员',
            price: 199,
            originalPrice: 358,
            period: '年',
            features: ['月度会员全部权益', '年度成长报告', '专属成长导师', '7折续费优惠'],
            popular: true,
            badge: '最受欢迎'
        },
        {
            id: 'lifetime',
            name: '终身会员',
            price: 399,
            originalPrice: 999,
            period: '永久',
            features: ['所有高级功能', '终身免费更新', 'VIP专属群', '一对一咨询'],
            popular: false,
            badge: '超值'
        }
    ];

    // ========================================
    // 样式注入
    // ========================================

    const COMMERCIAL_STYLES = `
        /* ========================================
           商业化系统样式
           ======================================== */

        /* 锁定遮罩效果 */
        .commercial-locked body > *:not(.commercial-modal):not(.commercial-feedback-ball):not(.commercial-feedback-panel) {
            filter: blur(8px);
            pointer-events: none;
            user-select: none;
        }

        .commercial-locked {
            overflow: hidden !important;
        }

        /* 订阅弹窗 */
        .commercial-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            animation: commercialFadeIn 0.3s ease;
        }

        @keyframes commercialFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .commercial-modal-content {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 20px;
            padding: 0;
            max-width: 900px;
            width: 95%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 25px 80px rgba(0, 0, 0, 0.4);
            animation: commercialSlideUp 0.4s ease;
            position: relative;
        }

        @keyframes commercialSlideUp {
            from {
                opacity: 0;
                transform: translateY(30px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        .commercial-modal-header {
            text-align: center;
            padding: 40px 40px 20px;
            color: white;
        }

        .commercial-modal-header h2 {
            font-size: 32px;
            margin-bottom: 10px;
            font-weight: 700;
        }

        .commercial-modal-header p {
            font-size: 16px;
            opacity: 0.9;
        }

        .commercial-trial-info {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            padding: 15px 25px;
            margin: 20px auto;
            display: inline-block;
        }

        .commercial-trial-info .countdown {
            font-size: 24px;
            font-weight: 700;
            color: #ffd700;
        }

        .commercial-trial-info .countdown-label {
            font-size: 14px;
            opacity: 0.9;
            margin-top: 5px;
        }

        /* 套餐卡片区域 */
        .commercial-plans {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            padding: 20px 40px 30px;
        }

        @media (max-width: 768px) {
            .commercial-plans {
                grid-template-columns: 1fr;
                padding: 20px;
            }
        }

        .commercial-plan-card {
            background: white;
            border-radius: 16px;
            padding: 25px;
            text-align: center;
            position: relative;
            transition: all 0.3s ease;
            border: 3px solid transparent;
        }

        .commercial-plan-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }

        .commercial-plan-card.popular {
            border-color: #ffd700;
            transform: scale(1.05);
        }

        .commercial-plan-card.popular:hover {
            transform: scale(1.05) translateY(-8px);
        }

        .commercial-plan-badge {
            position: absolute;
            top: -12px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%);
            color: #333;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
        }

        .commercial-plan-name {
            font-size: 20px;
            font-weight: 600;
            color: #333;
            margin-bottom: 15px;
        }

        .commercial-plan-price {
            margin-bottom: 20px;
        }

        .commercial-plan-price .amount {
            font-size: 42px;
            font-weight: 700;
            color: #667eea;
        }

        .commercial-plan-price .currency {
            font-size: 18px;
            color: #667eea;
            vertical-align: super;
        }

        .commercial-plan-price .period {
            font-size: 14px;
            color: #999;
        }

        .commercial-plan-price .original {
            text-decoration: line-through;
            color: #bbb;
            font-size: 14px;
            margin-left: 10px;
        }

        .commercial-plan-features {
            list-style: none;
            padding: 0;
            margin: 0 0 25px 0;
            text-align: left;
        }

        .commercial-plan-features li {
            padding: 8px 0;
            color: #555;
            font-size: 14px;
            display: flex;
            align-items: center;
        }

        .commercial-plan-features li::before {
            content: '✓';
            color: #52c41a;
            font-weight: 700;
            margin-right: 10px;
            font-size: 16px;
        }

        .commercial-subscribe-btn {
            width: 100%;
            padding: 14px 20px;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }

        .commercial-subscribe-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
        }

        .commercial-subscribe-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
        }

        .commercial-subscribe-btn.processing {
            background: #999;
        }

        .commercial-plan-card.popular .commercial-subscribe-btn {
            background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%);
            color: #333;
        }

        /* 信任背书 */
        .commercial-trust {
            text-align: center;
            padding: 20px 40px 30px;
            color: rgba(255, 255, 255, 0.9);
        }

        .commercial-trust-badges {
            display: flex;
            justify-content: center;
            gap: 30px;
            flex-wrap: wrap;
        }

        .commercial-trust-badge {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
        }

        .commercial-trust-badge .icon {
            font-size: 20px;
        }

        .commercial-trust-note {
            margin-top: 15px;
            font-size: 12px;
            opacity: 0.8;
        }

        /* 关闭按钮（仅在未锁定时显示） */
        .commercial-close-btn {
            position: absolute;
            top: 20px;
            right: 20px;
            width: 36px;
            height: 36px;
            border: none;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border-radius: 50%;
            font-size: 20px;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .commercial-close-btn:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: rotate(90deg);
        }

        .commercial-close-btn.hidden {
            display: none;
        }

        /* ========================================
           悬浮反馈球
           ======================================== */

        .commercial-feedback-ball {
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
            cursor: pointer;
            z-index: 99998;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            animation: commercialPulse 2s infinite;
        }

        @keyframes commercialPulse {
            0%, 100% { box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4); }
            50% { box-shadow: 0 6px 30px rgba(102, 126, 234, 0.6); }
        }

        .commercial-feedback-ball:hover {
            transform: scale(1.1);
        }

        .commercial-feedback-ball .icon {
            font-size: 28px;
            color: white;
        }

        .commercial-feedback-ball .badge {
            position: absolute;
            top: -5px;
            right: -5px;
            width: 20px;
            height: 20px;
            background: #ff4d4f;
            border-radius: 50%;
            font-size: 12px;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
        }

        /* 反馈面板 */
        .commercial-feedback-panel {
            position: fixed;
            bottom: 100px;
            right: 30px;
            width: 350px;
            max-width: calc(100vw - 60px);
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            z-index: 99998;
            overflow: hidden;
            animation: commercialSlideUp 0.3s ease;
            display: none;
        }

        .commercial-feedback-panel.show {
            display: block;
        }

        .commercial-feedback-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .commercial-feedback-header h4 {
            margin: 0;
            font-size: 18px;
        }

        .commercial-feedback-close {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
        }

        .commercial-feedback-body {
            padding: 20px;
        }

        .commercial-feedback-form .form-group {
            margin-bottom: 15px;
        }

        .commercial-feedback-form label {
            display: block;
            font-size: 14px;
            font-weight: 500;
            color: #333;
            margin-bottom: 8px;
        }

        .commercial-feedback-form input,
        .commercial-feedback-form textarea,
        .commercial-feedback-form select {
            width: 100%;
            padding: 12px;
            border: 2px solid #e8e8e8;
            border-radius: 8px;
            font-size: 14px;
            transition: border-color 0.3s ease;
            box-sizing: border-box;
        }

        .commercial-feedback-form input:focus,
        .commercial-feedback-form textarea:focus,
        .commercial-feedback-form select:focus {
            outline: none;
            border-color: #667eea;
        }

        .commercial-feedback-form textarea {
            resize: vertical;
            min-height: 100px;
        }

        .commercial-feedback-submit {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .commercial-feedback-submit:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 15px rgba(102, 126, 234, 0.4);
        }

        /* ========================================
           会员状态指示器
           ======================================== */

        .commercial-status-indicator {
            position: fixed;
            top: 20px;
            left: 20px;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            z-index: 99997;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .commercial-status-indicator:hover {
            transform: translateY(-2px);
        }

        .commercial-status-indicator.trial {
            background: linear-gradient(135deg, #faad14 0%, #d48806 100%);
            color: white;
        }

        .commercial-status-indicator.premium {
            background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
            color: white;
        }

        .commercial-status-indicator .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: white;
            animation: commercialBlink 1.5s infinite;
        }

        @keyframes commercialBlink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        /* ========================================
           响应式适配
           ======================================== */

        @media (max-width: 480px) {
            .commercial-modal-content {
                border-radius: 16px;
                margin: 10px;
            }

            .commercial-modal-header {
                padding: 30px 20px 15px;
            }

            .commercial-modal-header h2 {
                font-size: 24px;
            }

            .commercial-plans {
                padding: 15px;
                gap: 15px;
            }

            .commercial-plan-card {
                padding: 20px;
            }

            .commercial-plan-card.popular {
                transform: scale(1);
            }

            .commercial-plan-price .amount {
                font-size: 32px;
            }

            .commercial-trust {
                padding: 15px 20px 25px;
            }

            .commercial-trust-badges {
                flex-direction: column;
                gap: 10px;
            }

            .commercial-feedback-ball {
                width: 50px;
                height: 50px;
                bottom: 20px;
                right: 20px;
            }

            .commercial-feedback-ball .icon {
                font-size: 24px;
            }

            .commercial-feedback-panel {
                right: 10px;
                bottom: 80px;
                width: calc(100vw - 20px);
            }

            .commercial-status-indicator {
                top: auto;
                bottom: 90px;
                left: 10px;
                font-size: 11px;
                padding: 6px 12px;
            }
        }
    `;

    // ========================================
    // CommercialSystem 类
    // ========================================

    class CommercialSystem {
        constructor() {
            this.isLocked = false;
            this.isPremium = false;
            this.trialStartTime = null;
            this.countdownInterval = null;
            this.selectedPlan = null;

            this.init();
        }

        // 初始化
        init() {
            console.log('【商业化系统】初始化中...');

            // 注入样式
            this.injectStyles();

            // 检查/初始化试用状态
            this.initTrialStatus();

            // 检查会员状态
            this.checkPremiumStatus();

            // 创建UI组件
            this.createStatusIndicator();
            this.createFeedbackBall();

            // 检查是否需要锁定
            this.checkLockStatus();

            // 暴露调试函数
            this.exposeDebugFunctions();

            console.log('【商业化系统】初始化完成');
            console.log('【商业化系统】试用开始时间:', new Date(this.trialStartTime).toLocaleString());
            console.log('【商业化系统】是否会员:', this.isPremium);
            console.log('【商业化系统】剩余试用时间:', this.getRemainingTimeText());
        }

        // 注入样式
        injectStyles() {
            const styleElement = document.createElement('style');
            styleElement.id = 'commercial-system-styles';
            styleElement.textContent = COMMERCIAL_STYLES;
            document.head.appendChild(styleElement);
        }

        // 初始化试用状态
        initTrialStatus() {
            const savedTime = localStorage.getItem(STORAGE_KEYS.TRIAL_START);

            if (savedTime) {
                this.trialStartTime = parseInt(savedTime, 10);
            } else {
                // 首次访问，记录试用开始时间
                this.trialStartTime = Date.now();
                localStorage.setItem(STORAGE_KEYS.TRIAL_START, this.trialStartTime.toString());
                console.log('【商业化系统】首次访问，开始试用');
            }
        }

        // 检查会员状态
        checkPremiumStatus() {
            this.isPremium = localStorage.getItem(STORAGE_KEYS.IS_PREMIUM) === 'true';
        }

        // 检查锁定状态
        checkLockStatus() {
            if (this.isPremium) {
                console.log('【商业化系统】用户是会员，解锁所有功能');
                this.unrestrictFeatures();
                return;
            }

            const elapsed = Date.now() - this.trialStartTime;

            if (elapsed > TRIAL_DURATION) {
                console.log('【商业化系统】试用已过期，限制高级功能');
                // 显示提示并限制高级功能
                this.showSubscriptionModal(false);
                this.restrictFeatures();
            } else {
                console.log('【商业化系统】试用中，剩余:', this.getRemainingTimeText());
            }
        }

        // 限制高级功能
        restrictFeatures() {
            console.log('【商业化系统】开始限制高级功能');
            
            // 获取所有需要限制的功能元素
            const elementsToRestrict = [
                // 智能建议
                { selector: '#generate-advice-btn', type: 'button' },
                { selector: '.advice-content', type: 'content' },
                // 导出数据
                { selector: '#export-btn', type: 'button' },
                // 复盘挑战赛
                { selector: '.tab-btn[data-tab="challenge-content"]', type: 'button' },
                // 数据洞察相关
                { selector: '#insight-month', type: 'input' },
                { selector: '#refresh-insight', type: 'button' },
                { selector: '#radar-chart', type: 'content' },
                { selector: '#bar-chart', type: 'content' },
                { selector: '#interest-point', type: 'content' },
                { selector: '#monthly-investment', type: 'content' },
                { selector: '#review-days', type: 'content' },
                { selector: '#growth-advice', type: 'content' }
            ];
            
            // 遍历并限制每个元素
            elementsToRestrict.forEach(item => {
                const element = document.querySelector(item.selector);
                if (element) {
                    // 保存原始状态，以便后续解锁
                    if (!element.dataset.originalState) {
                        if (item.type === 'button') {
                            element.dataset.originalDisabled = element.disabled;
                            element.dataset.originalOnclick = element.onclick;
                            element.dataset.originalText = element.textContent;
                        } else if (item.type === 'content') {
                            element.dataset.originalContent = element.innerHTML;
                        } else if (item.type === 'input') {
                            element.dataset.originalDisabled = element.disabled;
                        }
                    }
                    
                    // 限制功能
                    if (item.type === 'button') {
                        element.disabled = true;
                        element.onclick = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            this.showSubscriptionModal(false);
                        };
                        element.textContent = '会员专享';
                        element.style.opacity = '0.7';
                    } else if (item.type === 'content') {
                        element.innerHTML = '<div style="color: #ff4d4f; text-align: center; padding: 20px;">🔥 会员专享功能<br>点击会员中心解锁</div>';
                    } else if (item.type === 'input') {
                        element.disabled = true;
                    }
                }
            });
            
            console.log('【商业化系统】高级功能已限制');
        }

        // 解锁高级功能
        unrestrictFeatures() {
            console.log('【商业化系统】开始解锁高级功能');
            
            // 获取所有需要解锁的功能元素
            const elementsToUnrestrict = [
                // 智能建议
                { selector: '#generate-advice-btn', type: 'button' },
                { selector: '.advice-content', type: 'content' },
                // 导出数据
                { selector: '#export-btn', type: 'button' },
                // 复盘挑战赛
                { selector: '.tab-btn[data-tab="challenge-content"]', type: 'button' },
                // 数据洞察相关
                { selector: '#insight-month', type: 'input' },
                { selector: '#refresh-insight', type: 'button' },
                { selector: '#radar-chart', type: 'content' },
                { selector: '#bar-chart', type: 'content' },
                { selector: '#interest-point', type: 'content' },
                { selector: '#monthly-investment', type: 'content' },
                { selector: '#review-days', type: 'content' },
                { selector: '#growth-advice', type: 'content' }
            ];
            
            // 遍历并解锁每个元素
            elementsToUnrestrict.forEach(item => {
                const element = document.querySelector(item.selector);
                if (element && element.dataset.originalState !== undefined) {
                    // 恢复原始状态
                    if (item.type === 'button') {
                        element.disabled = element.dataset.originalDisabled === 'true';
                        element.onclick = element.dataset.originalOnclick ? eval(`(${element.dataset.originalOnclick})`) : null;
                        element.textContent = element.dataset.originalText;
                        element.style.opacity = '';
                    } else if (item.type === 'content') {
                        element.innerHTML = element.dataset.originalContent;
                    } else if (item.type === 'input') {
                        element.disabled = element.dataset.originalDisabled === 'true';
                    }
                    
                    // 清除原始状态标记
                    delete element.dataset.originalState;
                    delete element.dataset.originalDisabled;
                    delete element.dataset.originalOnclick;
                    delete element.dataset.originalText;
                    delete element.dataset.originalContent;
                }
            });
            
            console.log('【商业化系统】高级功能已解锁');
        }

        // 获取剩余时间
        getRemainingTime() {
            const elapsed = Date.now() - this.trialStartTime;
            const remaining = Math.max(0, TRIAL_DURATION - elapsed);
            return remaining;
        }

        // 获取剩余时间文本
        getRemainingTimeText() {
            const remaining = this.getRemainingTime();

            if (remaining <= 0) return '已过期';

            const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
            const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
            const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
            const seconds = Math.floor((remaining % (60 * 1000)) / 1000);

            if (days > 0) {
                return `${days}天${hours}小时`;
            } else if (hours > 0) {
                return `${hours}小时${minutes}分钟`;
            } else if (minutes > 0) {
                return `${minutes}分${seconds}秒`;
            } else {
                return `${seconds}秒`;
            }
        }

        // 锁定页面（已废弃，不再使用）
        lock() {
            if (this.isLocked) return;
            
            console.warn('【商业化系统】lock() 方法已废弃，不再锁定页面');
            
            this.isLocked = false;
            
            // 只显示可关闭的提示，不锁定页面
            this.showSubscriptionModal(false);

            console.log('【商业化系统】已显示订阅提示，未锁定页面');
        }

        // 解锁页面
        unlock() {
            this.isLocked = false;
            document.documentElement.classList.remove('commercial-locked');

            // 关闭弹窗
            this.hideSubscriptionModal();

            // 更新状态指示器
            this.updateStatusIndicator();

            // 解锁所有高级功能
            this.unrestrictFeatures();

            console.log('【商业化系统】页面已解锁，所有功能已开放');
        }

        // 显示订阅弹窗
        showSubscriptionModal(isLocked = false) {
            // 如果已存在弹窗，先移除
            const existingModal = document.querySelector('.commercial-modal');
            if (existingModal) {
                existingModal.remove();
            }

            const modal = document.createElement('div');
            modal.className = 'commercial-modal';
            modal.innerHTML = `
                <div class="commercial-modal-content">
                    <button class="commercial-close-btn ${isLocked ? 'hidden' : ''}" onclick="window.commercialSystem.hideSubscriptionModal()">×</button>

                    <div class="commercial-modal-header">
                        <h2>${isLocked ? '🔒 试用已结束' : '🚀 升级高级会员'}</h2>
                        <p>${isLocked ? '感谢您的试用！解锁全部功能，开启高效成长之旅' : '解锁全部高级功能，让复盘更高效'}</p>

                        ${isLocked ? `
                        <div class="commercial-trial-info">
                            <div class="countdown" id="commercial-countdown">--:--:--</div>
                            <div class="countdown-label">限时优惠倒计时</div>
                        </div>
                        ` : ''}
                    </div>

                    <div class="commercial-plans">
                        ${SUBSCRIPTION_PLANS.map(plan => `
                            <div class="commercial-plan-card ${plan.popular ? 'popular' : ''}" data-plan-id="${plan.id}">
                                ${plan.badge ? `<div class="commercial-plan-badge">${plan.badge}</div>` : ''}
                                <div class="commercial-plan-name">${plan.name}</div>
                                <div class="commercial-plan-price">
                                    <span class="currency">¥</span>
                                    <span class="amount">${plan.price}</span>
                                    <span class="period">/${plan.period}</span>
                                    <span class="original">¥${plan.originalPrice}</span>
                                </div>
                                <ul class="commercial-plan-features">
                                    ${plan.features.map(f => `<li>${f}</li>`).join('')}
                                </ul>
                                <button class="commercial-subscribe-btn" onclick="window.commercialSystem.handleSubscribe('${plan.id}')">
                                    立即订阅
                                </button>
                            </div>
                        `).join('')}
                    </div>

                    <div class="commercial-trust">
                        <div class="commercial-trust-badges">
                            <div class="commercial-trust-badge">
                                <span class="icon">🛡️</span>
                                <span>7天无理由退款</span>
                            </div>
                            <div class="commercial-trust-badge">
                                <span class="icon">🔐</span>
                                <span>数据本地存储安全</span>
                            </div>
                            <div class="commercial-trust-badge">
                                <span class="icon">⚡</span>
                                <span>即时开通使用</span>
                            </div>
                        </div>
                        <p class="commercial-trust-note">支付遇到问题？请联系客服微信：JQJSBXXZI</p>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // 启动倒计时
            if (isLocked) {
                this.startCountdown();
            }

            // 点击遮罩关闭（仅非锁定状态）
            if (!isLocked) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        this.hideSubscriptionModal();
                    }
                });
            }
        }

        // 隐藏订阅弹窗
        hideSubscriptionModal() {
            const modal = document.querySelector('.commercial-modal');
            if (modal) {
                modal.remove();
            }

            if (this.countdownInterval) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
            }
        }

        // 启动倒计时
        startCountdown() {
            // 24小时倒计时（限时优惠）
            let countdown = 24 * 60 * 60;

            const updateCountdown = () => {
                const hours = Math.floor(countdown / 3600);
                const minutes = Math.floor((countdown % 3600) / 60);
                const seconds = countdown % 60;

                const countdownElement = document.getElementById('commercial-countdown');
                if (countdownElement) {
                    countdownElement.textContent =
                        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }

                if (countdown > 0) {
                    countdown--;
                }
            };

            updateCountdown();
            this.countdownInterval = setInterval(updateCountdown, 1000);
        }

        // 处理订阅 - 打开真实支付弹窗
        handleSubscribe(planId) {
            const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
            if (!plan) return;

            this.selectedPlan = plan;
            console.log('【商业化系统】用户选择套餐:', plan.name, '价格:', plan.price);

            // 更新VIP支付弹窗信息
            const vipPaymentOverlay = document.getElementById('vip-payment-modal');
            const planInfoEl = document.getElementById('vip-payment-plan-info');
            const amountEl = document.getElementById('vip-payment-amount');
            const periodEl = document.getElementById('vip-payment-period');

            if (planInfoEl) planInfoEl.textContent = plan.name;
            if (amountEl) amountEl.textContent = plan.price;

            // 根据套餐类型设置周期显示
            let periodText = '';
            if (plan.id === 'monthly') periodText = '/月';
            else if (plan.id === 'yearly') periodText = '/年';
            else if (plan.id === 'lifetime') periodText = '';
            if (periodEl) periodEl.textContent = periodText;

            // 默认显示微信支付二维码
            const wechatQR = document.getElementById('vip-qr-wechat');
            const alipayQR = document.getElementById('vip-qr-alipay');
            const methodBtns = document.querySelectorAll('.vip-method-btn');

            if (wechatQR) wechatQR.classList.add('active');
            if (alipayQR) alipayQR.classList.remove('active');
            methodBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.method === 'wechat');
            });

            // 显示支付弹窗
            if (vipPaymentOverlay) {
                vipPaymentOverlay.classList.add('show');
                console.log('【商业化系统】支付弹窗已显示，二维码可供扫描');
            } else {
                console.error('【商业化系统】找不到支付弹窗元素 vip-payment-modal');
            }
        }

        // 完成支付
        completePayment() {
            // 设置会员状态
            localStorage.setItem(STORAGE_KEYS.IS_PREMIUM, 'true');
            this.isPremium = true;

            // 解锁页面并解锁所有功能
            this.unlock();
            this.unrestrictFeatures();

            // 显示成功提示
            alert(`🎉 支付成功（模拟）！\n\n感谢您订阅${this.selectedPlan.name}！\n会员权益已全部解锁，祝您使用愉快！`);

            // 刷新数据洞察，确保内容正确显示
            if (typeof window.updateDataInsight === 'function') {
                window.updateDataInsight();
            }
            
            console.log('【商业化系统】模拟支付完成，会员权益已解锁');
        }

        // 创建状态指示器
        createStatusIndicator() {
            const indicator = document.createElement('div');
            indicator.className = 'commercial-status-indicator';
            indicator.id = 'commercial-status-indicator';
            indicator.onclick = () => this.showSubscriptionModal(false);

            this.updateStatusIndicatorContent(indicator);

            document.body.appendChild(indicator);
        }

        // 更新状态指示器
        updateStatusIndicator() {
            const indicator = document.getElementById('commercial-status-indicator');
            if (indicator) {
                this.updateStatusIndicatorContent(indicator);
            }
        }

        // 更新状态指示器内容
        updateStatusIndicatorContent(indicator) {
            if (this.isPremium) {
                indicator.className = 'commercial-status-indicator premium';
                indicator.innerHTML = `
                    <span class="status-dot"></span>
                    <span>高级会员</span>
                `;
            } else {
                indicator.className = 'commercial-status-indicator trial';
                indicator.innerHTML = `
                    <span class="status-dot"></span>
                    <span>试用中 · ${this.getRemainingTimeText()}</span>
                `;
            }
        }

        // 创建反馈悬浮球
        createFeedbackBall() {
            // 悬浮球
            const ball = document.createElement('div');
            ball.className = 'commercial-feedback-ball';
            ball.innerHTML = `
                <span class="icon">💬</span>
                <span class="badge">1</span>
            `;
            ball.onclick = () => this.toggleFeedbackPanel();
            document.body.appendChild(ball);

            // 反馈面板
            const panel = document.createElement('div');
            panel.className = 'commercial-feedback-panel';
            panel.id = 'commercial-feedback-panel';
            panel.innerHTML = `
                <div class="commercial-feedback-header">
                    <h4>💬 意见反馈</h4>
                    <button class="commercial-feedback-close" onclick="window.commercialSystem.toggleFeedbackPanel()">×</button>
                </div>
                <div class="commercial-feedback-body">
                    <form class="commercial-feedback-form" onsubmit="return window.commercialSystem.submitFeedback(event)">
                        <div class="form-group">
                            <label>反馈类型</label>
                            <select id="feedback-type" required>
                                <option value="">请选择...</option>
                                <option value="bug">Bug 报告</option>
                                <option value="feature">功能建议</option>
                                <option value="experience">体验反馈</option>
                                <option value="other">其他</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>您的邮箱（选填）</label>
                            <input type="email" id="feedback-email" placeholder="方便我们回复您">
                        </div>
                        <div class="form-group">
                            <label>反馈内容</label>
                            <textarea id="feedback-content" placeholder="请详细描述您的问题或建议..." required></textarea>
                        </div>
                        <button type="submit" class="commercial-feedback-submit">提交反馈</button>
                    </form>
                </div>
            `;
            document.body.appendChild(panel);
        }

        // 切换反馈面板
        toggleFeedbackPanel() {
            const panel = document.getElementById('commercial-feedback-panel');
            if (panel) {
                panel.classList.toggle('show');

                // 隐藏小红点
                const badge = document.querySelector('.commercial-feedback-ball .badge');
                if (badge) {
                    badge.style.display = 'none';
                }
            }
        }

        // 提交反馈
        submitFeedback(event) {
            event.preventDefault();

            const type = document.getElementById('feedback-type').value;
            const email = document.getElementById('feedback-email').value;
            const content = document.getElementById('feedback-content').value;

            const feedbackData = {
                type,
                email,
                content,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                isPremium: this.isPremium
            };

            console.log('【商业化系统】收到用户反馈:', feedbackData);

            // 清空表单
            document.getElementById('feedback-type').value = '';
            document.getElementById('feedback-email').value = '';
            document.getElementById('feedback-content').value = '';

            // 关闭面板
            this.toggleFeedbackPanel();

            // 显示感谢提示
            alert('🙏 感谢您的反馈！\n\n我们会认真阅读每一条反馈，持续改进产品体验。');

            return false;
        }

        // 暴露调试函数
        exposeDebugFunctions() {
            // 强制过期试用
            window.debug_expireTrial = () => {
                const expiredTime = Date.now() - TRIAL_DURATION - 1000;
                localStorage.setItem(STORAGE_KEYS.TRIAL_START, expiredTime.toString());
                this.trialStartTime = expiredTime;
                console.log('【调试】试用已强制过期，刷新页面或执行 window.commercialSystem.checkLockStatus() 触发锁定');
                this.checkLockStatus();
            };

            // 重置试用
            window.debug_resetTrial = () => {
                localStorage.removeItem(STORAGE_KEYS.TRIAL_START);
                localStorage.removeItem(STORAGE_KEYS.IS_PREMIUM);
                console.log('【调试】试用状态已重置，请刷新页面');
                location.reload();
            };

            // 设为会员
            window.debug_setPremium = () => {
                localStorage.setItem(STORAGE_KEYS.IS_PREMIUM, 'true');
                this.isPremium = true;
                this.unlock();
                this.updateStatusIndicator();
                console.log('【调试】已设为会员');
            };

            // 取消会员
            window.debug_removePremium = () => {
                localStorage.removeItem(STORAGE_KEYS.IS_PREMIUM);
                this.isPremium = false;
                this.updateStatusIndicator();
                console.log('【调试】已取消会员状态');
            };

            // 显示订阅弹窗
            window.debug_showModal = () => {
                this.showSubscriptionModal(false);
            };

            console.log('【商业化系统】调试函数已暴露:');
            console.log('  - window.debug_expireTrial()  : 强制过期试用，触发锁定');
            console.log('  - window.debug_resetTrial()   : 重置试用状态');
            console.log('  - window.debug_setPremium()   : 设为会员');
            console.log('  - window.debug_removePremium(): 取消会员');
            console.log('  - window.debug_showModal()    : 显示订阅弹窗');
        }
    }

    // ========================================
    // 初始化
    // ========================================

    // 等待 DOM 加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.commercialSystem = new CommercialSystem();
        });
    } else {
        window.commercialSystem = new CommercialSystem();
    }

})();
