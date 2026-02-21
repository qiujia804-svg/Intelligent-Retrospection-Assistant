/**
 * 智能复盘助手 - 本地持久化存储管理器
 * 实现用户数据的自动本地保存和恢复功能
 */

(function() {
    'use strict';

    // 存储键名常量
    const STORAGE_KEYS = {
        // 复盘表单数据
        REVIEW_FORM_DRAFT: 'smart_review_assistant_review_draft',
        // 规划表单数据
        PLAN_FORM_DRAFT: 'smart_review_assistant_plan_draft',
        // 自动保存设置
        AUTO_SAVE_ENABLED: 'smart_review_assistant_auto_save_enabled',
        // 最后保存时间
        LAST_AUTO_SAVE: 'smart_review_assistant_last_auto_save',
        // 表单版本控制
        FORM_VERSION: 'smart_review_assistant_form_version'
    };

    // 自动保存配置
    const AUTO_SAVE_CONFIG = {
        enabled: true,
        interval: 3000, // 3秒自动保存间隔
        debounceDelay: 1000, // 输入防抖延迟
        maxDraftAge: 24 * 60 * 60 * 1000 // 草稿最大保存时间：24小时
    };

    // 防抖函数
    function debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // 节流函数
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * 获取当前日期（YYYY-MM-DD格式）
     */
    function getCurrentDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 检查草稿是否过期
     */
    function isDraftExpired(timestamp) {
        const now = Date.now();
        return (now - timestamp) > AUTO_SAVE_CONFIG.maxDraftAge;
    }

    /**
     * 安全地解析JSON数据
     */
    function safeJsonParse(str, defaultValue = null) {
        try {
            return JSON.parse(str);
        } catch (error) {
            console.warn('[LocalStorageManager] JSON解析失败:', error);
            return defaultValue;
        }
    }

    /**
     * 安全地设置localStorage数据
     */
    function safeLocalStorageSetItem(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            console.error('[LocalStorageManager] localStorage设置失败:', error);
            
            // 如果是存储空间不足，尝试清理旧数据
            if (error.name === 'QuotaExceededError') {
                cleanupOldDrafts();
                try {
                    localStorage.setItem(key, value);
                    return true;
                } catch (retryError) {
                    console.error('[LocalStorageManager] 重试存储失败:', retryError);
                    return false;
                }
            }
            return false;
        }
    }

    /**
     * 清理旧草稿数据
     */
    function cleanupOldDrafts() {
        console.log('[LocalStorageManager] 开始清理旧草稿数据...');
        
        const keysToRemove = [];
        const now = Date.now();
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes('_draft_')) {
                try {
                    const data = safeJsonParse(localStorage.getItem(key));
                    if (data && data.timestamp && isDraftExpired(data.timestamp)) {
                        keysToRemove.push(key);
                    }
                } catch (error) {
                    console.warn('[LocalStorageManager] 检查草稿数据时出错:', error);
                }
            }
        }
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log('[LocalStorageManager] 已清理过期草稿:', key);
        });
        
        console.log('[LocalStorageManager] 草稿清理完成，清理了', keysToRemove.length, '个项目');
    }

    /**
     * 收集复盘表单数据
     */
    function collectReviewFormData() {
        const formData = {};
        
        // 获取基本表单字段
        const dateInput = document.getElementById('date');
        const goalProgress = document.getElementById('goal-progress');
        const goalCompletion = document.getElementById('goal-completion');
        const strengths = document.getElementById('strengths');
        const weaknesses = document.getElementById('weaknesses');
        const improvements = document.getElementById('improvements');
        const todos = document.getElementById('todos');
        
        if (dateInput) formData.date = dateInput.value;
        if (goalProgress) formData.goalProgress = goalProgress.value;
        if (goalCompletion) formData.goalCompletion = goalCompletion.value;
        if (strengths) formData.strengths = strengths.value;
        if (weaknesses) formData.weaknesses = weaknesses.value;
        if (improvements) formData.improvements = improvements.value;
        if (todos) formData.todos = todos.value;
        
        // 添加元数据
        formData.timestamp = Date.now();
        formData.version = '1.0';
        
        return formData;
    }

    /**
     * 收集规划表单数据
     */
    function collectPlanFormData() {
        const formData = {
            quadrants: {},
            schedule: [],
            timestamp: Date.now(),
            version: '1.0'
        };
        
        // 收集四象限数据
        const quadrants = ['a', 'b', 'c', 'd'];
        quadrants.forEach(quadrant => {
            const taskList = document.getElementById(`quadrant-${quadrant}`);
            if (taskList) {
                const taskItems = taskList.querySelectorAll('.task-item');
                formData.quadrants[quadrant] = [];
                
                taskItems.forEach(item => {
                    const taskData = {};
                    const what = item.querySelector('.task-what');
                    const why = item.querySelector('.task-why');
                    const how = item.querySelector('.task-how');
                    const solution = item.querySelector('.task-solution');
                    const help = item.querySelector('.task-help');
                    
                    if (what) taskData.what = what.value;
                    if (why) taskData.why = why.value;
                    if (how) taskData.how = how.value;
                    if (solution) taskData.solution = solution.value;
                    if (help) taskData.help = help.value;
                    
                    if (Object.keys(taskData).length > 0) {
                        formData.quadrants[quadrant].push(taskData);
                    }
                });
            }
        });
        
        // 收集时间安排数据
        const scheduleItems = document.querySelectorAll('.schedule-item');
        scheduleItems.forEach(item => {
            const timeSelect = item.querySelector('.time-select');
            const taskInput = item.querySelector('.task-input');
            const durationInput = item.querySelector('.duration-input');
            
            if (timeSelect && taskInput && durationInput) {
                formData.schedule.push({
                    time: timeSelect.value,
                    task: taskInput.value,
                    duration: durationInput.value
                });
            }
        });
        
        return formData;
    }

    /**
     * 恢复复盘表单数据
     */
    function restoreReviewFormData(data) {
        if (!data || typeof data !== 'object') return false;
        
        console.log('[LocalStorageManager] 开始恢复复盘表单数据...');
        
        const fields = [
            { id: 'date', value: data.date },
            { id: 'goal-progress', value: data.goalProgress },
            { id: 'goal-completion', value: data.goalCompletion },
            { id: 'strengths', value: data.strengths },
            { id: 'weaknesses', value: data.weaknesses },
            { id: 'improvements', value: data.improvements },
            { id: 'todos', value: data.todos }
        ];
        
        let restoredCount = 0;
        fields.forEach(field => {
            const element = document.getElementById(field.id);
            if (element && field.value !== undefined && field.value !== null) {
                element.value = field.value;
                
                // 触发相应的事件以更新UI
                if (field.id === 'goal-progress') {
                    const event = new Event('input', { bubbles: true });
                    element.dispatchEvent(event);
                }
                
                restoredCount++;
                console.log('[LocalStorageManager] 恢复字段:', field.id);
            }
        });
        
        console.log('[LocalStorageManager] 复盘表单数据恢复完成，恢复了', restoredCount, '个字段');
        return restoredCount > 0;
    }

    /**
     * 恢复规划表单数据
     */
    function restorePlanFormData(data) {
        if (!data || typeof data !== 'object') return false;
        
        console.log('[LocalStorageManager] 开始恢复规划表单数据...');
        
        let restoredCount = 0;
        
        // 恢复四象限数据
        if (data.quadrants) {
            Object.keys(data.quadrants).forEach(quadrant => {
                const taskList = document.getElementById(`quadrant-${quadrant}`);
                if (taskList && Array.isArray(data.quadrants[quadrant])) {
                    const tasks = data.quadrants[quadrant];
                    const taskItems = taskList.querySelectorAll('.task-item');
                    
                    tasks.forEach((taskData, index) => {
                        let taskItem = taskItems[index];
                        if (!taskItem && tasks.length > taskItems.length) {
                            // 如果需要更多任务项，添加新的任务项
                            const addBtn = taskList.querySelector('.add-task-btn');
                            if (addBtn) {
                                addBtn.click();
                                taskItem = taskList.querySelectorAll('.task-item')[index];
                            }
                        }
                        
                        if (taskItem) {
                            const fields = [
                                { selector: '.task-what', value: taskData.what },
                                { selector: '.task-why', value: taskData.why },
                                { selector: '.task-how', value: taskData.how },
                                { selector: '.task-solution', value: taskData.solution },
                                { selector: '.task-help', value: taskData.help }
                            ];
                            
                            fields.forEach(field => {
                                const element = taskItem.querySelector(field.selector);
                                if (element && field.value !== undefined && field.value !== null) {
                                    element.value = field.value;
                                    restoredCount++;
                                }
                            });
                        }
                    });
                }
            });
        }
        
        // 恢复时间安排数据
        if (data.schedule && Array.isArray(data.schedule)) {
            // 这里需要根据实际的日程安排UI来实现
            console.log('[LocalStorageManager] 检测到时间安排数据，但恢复功能需要UI支持');
        }
        
        console.log('[LocalStorageManager] 规划表单数据恢复完成，恢复了', restoredCount, '个字段');
        return restoredCount > 0;
    }

    /**
     * 自动保存复盘表单
     */
    const autoSaveReviewForm = throttle(function() {
        if (!AUTO_SAVE_CONFIG.enabled) return;
        
        console.log('[LocalStorageManager] 开始自动保存复盘表单...');
        
        const formData = collectReviewFormData();
        const dataToSave = {
            ...formData,
            autoSaved: true,
            saveTime: new Date().toISOString()
        };
        
        const success = safeLocalStorageSetItem(
            STORAGE_KEYS.REVIEW_FORM_DRAFT,
            JSON.stringify(dataToSave)
        );
        
        if (success) {
            safeLocalStorageSetItem(STORAGE_KEYS.LAST_AUTO_SAVE, Date.now().toString());
            console.log('[LocalStorageManager] 复盘表单自动保存成功');
            
            // 显示保存提示
            showAutoSaveIndicator('复盘数据已自动保存');
        } else {
            console.error('[LocalStorageManager] 复盘表单自动保存失败');
        }
    }, AUTO_SAVE_CONFIG.interval);

    /**
     * 自动保存规划表单
     */
    const autoSavePlanForm = throttle(function() {
        if (!AUTO_SAVE_CONFIG.enabled) return;
        
        console.log('[LocalStorageManager] 开始自动保存规划表单...');
        
        const formData = collectPlanFormData();
        const dataToSave = {
            ...formData,
            autoSaved: true,
            saveTime: new Date().toISOString()
        };
        
        const success = safeLocalStorageSetItem(
            STORAGE_KEYS.PLAN_FORM_DRAFT,
            JSON.stringify(dataToSave)
        );
        
        if (success) {
            safeLocalStorageSetItem(STORAGE_KEYS.LAST_AUTO_SAVE, Date.now().toString());
            console.log('[LocalStorageManager] 规划表单自动保存成功');
            
            // 显示保存提示
            showAutoSaveIndicator('规划数据已自动保存');
        } else {
            console.error('[LocalStorageManager] 规划表单自动保存失败');
        }
    }, AUTO_SAVE_CONFIG.interval);

    /**
     * 显示自动保存指示器
     */
    function showAutoSaveIndicator(message) {
        // 创建或获取指示器元素
        let indicator = document.getElementById('auto-save-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'auto-save-indicator';
            indicator.className = 'auto-save-indicator';
            indicator.innerHTML = `
                <style>
                    .auto-save-indicator {
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: rgba(76, 175, 80, 0.9);
                        color: white;
                        padding: 8px 16px;
                        border-radius: 4px;
                        font-size: 12px;
                        z-index: 10000;
                        opacity: 0;
                        transform: translateY(-10px);
                        transition: all 0.3s ease;
                        pointer-events: none;
                    }
                    .auto-save-indicator.show {
                        opacity: 1;
                        transform: translateY(0);
                    }
                </style>
                <span>💾 ${message}</span>
            `;
            document.body.appendChild(indicator);
        }
        
        indicator.querySelector('span').innerHTML = `💾 ${message}`;
        indicator.classList.add('show');
        
        // 3秒后隐藏
        setTimeout(() => {
            if (indicator) {
                indicator.classList.remove('show');
            }
        }, 3000);
    }

    /**
     * 恢复草稿数据
     */
    function restoreDraftData() {
        console.log('[LocalStorageManager] 开始恢复草稿数据...');
        
        // 检查当前活跃的表单
        const activeTab = document.querySelector('.tab-content.active');
        if (!activeTab) return;
        
        let restored = false;
        
        if (activeTab.id === 'review-content') {
            const draftData = safeJsonParse(localStorage.getItem(STORAGE_KEYS.REVIEW_FORM_DRAFT));
            if (draftData && !isDraftExpired(draftData.timestamp)) {
                restored = restoreReviewFormData(draftData);
                if (restored) {
                    showAutoSaveIndicator('已恢复上次未保存的复盘数据');
                }
            }
        } else if (activeTab.id === 'plan-content') {
            const draftData = safeJsonParse(localStorage.getItem(STORAGE_KEYS.PLAN_FORM_DRAFT));
            if (draftData && !isDraftExpired(draftData.timestamp)) {
                restored = restorePlanFormData(draftData);
                if (restored) {
                    showAutoSaveIndicator('已恢复上次未保存的规划数据');
                }
            }
        }
        
        if (restored) {
            console.log('[LocalStorageManager] 草稿数据恢复成功');
        } else {
            console.log('[LocalStorageManager] 没有需要恢复的草稿数据');
        }
        
        return restored;
    }

    /**
     * 清除草稿数据
     */
    function clearDraftData() {
        console.log('[LocalStorageManager] 开始清除草稿数据...');
        
        localStorage.removeItem(STORAGE_KEYS.REVIEW_FORM_DRAFT);
        localStorage.removeItem(STORAGE_KEYS.PLAN_FORM_DRAFT);
        localStorage.removeItem(STORAGE_KEYS.LAST_AUTO_SAVE);
        
        console.log('[LocalStorageManager] 草稿数据已清除');
    }

    /**
     * 绑定表单事件监听器
     */
    function bindFormEventListeners() {
        console.log('[LocalStorageManager] 开始绑定表单事件监听器...');
        
        // 复盘表单事件
        const reviewForm = document.getElementById('review-form');
        if (reviewForm) {
            const reviewFields = [
                'date', 'goal-progress', 'goal-completion', 'strengths',
                'weaknesses', 'improvements', 'todos'
            ];
            
            reviewFields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) {
                    // 使用防抖函数避免频繁保存
                    field.addEventListener('input', debounce(autoSaveReviewForm, AUTO_SAVE_CONFIG.debounceDelay));
                    field.addEventListener('change', debounce(autoSaveReviewForm, AUTO_SAVE_CONFIG.debounceDelay));
                }
            });
            
            console.log('[LocalStorageManager] 复盘表单事件监听器已绑定');
        }
        
        // 规划表单事件（使用事件委托处理动态添加的任务项）
        const planContent = document.getElementById('plan-content');
        if (planContent) {
            // 监听四象限区域的输入事件
            const quadrants = ['a', 'b', 'c', 'd'];
            quadrants.forEach(quadrant => {
                const quadrantElement = document.getElementById(`quadrant-${quadrant}`);
                if (quadrantElement) {
                    quadrantElement.addEventListener('input', debounce(autoSavePlanForm, AUTO_SAVE_CONFIG.debounceDelay));
                }
            });
            
            // 监听动态添加的任务项
            planContent.addEventListener('click', function(event) {
                if (event.target.classList.contains('add-task-btn')) {
                    // 延迟绑定新任务项的事件
                    setTimeout(() => {
                        const newTaskItem = event.target.closest('.task-list').querySelector('.task-item:last-child');
                        if (newTaskItem) {
                            newTaskItem.addEventListener('input', debounce(autoSavePlanForm, AUTO_SAVE_CONFIG.debounceDelay));
                        }
                    }, 100);
                }
            });
            
            console.log('[LocalStorageManager] 规划表单事件监听器已绑定');
        }
        
        // 监听表单提交事件以清除草稿
        if (reviewForm) {
            reviewForm.addEventListener('submit', function() {
                setTimeout(clearDraftData, 1000); // 延迟清除，确保数据已保存
            });
        }
        
        const planForm = document.getElementById('plan-form');
        if (planForm) {
            planForm.addEventListener('submit', function() {
                setTimeout(clearDraftData, 1000); // 延迟清除，确保数据已保存
            });
        }
        
        console.log('[LocalStorageManager] 表单事件监听器绑定完成');
    }

    /**
     * 监听标签切换事件
     */
    function bindTabSwitchListeners() {
        // 监听标签切换，恢复对应标签的草稿数据
        const tabButtons = document.querySelectorAll('.tab-btn, .tabbar-item');
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                const targetTab = this.getAttribute('data-tab');
                if (targetTab) {
                    // 延迟恢复，等待标签内容显示
                    setTimeout(() => {
                        restoreDraftData();
                    }, 300);
                }
            });
        });
        
        console.log('[LocalStorageManager] 标签切换事件监听器已绑定');
    }

    /**
     * 监听页面可见性变化
     */
    function bindVisibilityChangeListener() {
        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'visible') {
                console.log('[LocalStorageManager] 页面变为可见，检查草稿数据...');
                restoreDraftData();
            } else if (document.visibilityState === 'hidden') {
                console.log('[LocalStorageManager] 页面变为隐藏，执行最后保存...');
                // 页面隐藏时立即保存当前数据
                if (AUTO_SAVE_CONFIG.enabled) {
                    autoSaveReviewForm();
                    autoSavePlanForm();
                }
            }
        });
        
        console.log('[LocalStorageManager] 页面可见性变化监听器已绑定');
    }

    /**
     * 监听页面卸载事件
     */
    function bindBeforeUnloadListener() {
        window.addEventListener('beforeunload', function(event) {
            console.log('[LocalStorageManager] 页面即将卸载，执行最后保存...');
            
            // 执行最后的数据保存
            if (AUTO_SAVE_CONFIG.enabled) {
                autoSaveReviewForm();
                autoSavePlanForm();
            }
            
            // 如果有未保存的草稿，显示确认提示
            const hasDraft = localStorage.getItem(STORAGE_KEYS.REVIEW_FORM_DRAFT) || 
                           localStorage.getItem(STORAGE_KEYS.PLAN_FORM_DRAFT);
            
            if (hasDraft) {
                // 现代浏览器需要设置returnValue才能显示确认对话框
                event.preventDefault();
                event.returnValue = '您有未保存的数据，确定要离开吗？';
                return '您有未保存的数据，确定要离开吗？';
            }
        });
        
        console.log('[LocalStorageManager] 页面卸载事件监听器已绑定');
    }

    /**
     * 初始化本地存储管理器
     */
    function init() {
        console.log('[LocalStorageManager] 初始化本地存储管理器...');
        
        // 检查自动保存功能是否启用
        const autoSaveEnabled = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE_ENABLED);
        if (autoSaveEnabled !== null) {
            AUTO_SAVE_CONFIG.enabled = autoSaveEnabled === 'true';
        }
        
        // 延迟初始化，等待DOM完全加载
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(() => {
                    bindFormEventListeners();
                    bindTabSwitchListeners();
                    bindVisibilityChangeListener();
                    bindBeforeUnloadListener();
                    restoreDraftData();
                    
                    console.log('[LocalStorageManager] 本地存储管理器初始化完成');
                    console.log('[LocalStorageManager] 自动保存功能:', AUTO_SAVE_CONFIG.enabled ? '已启用' : '已禁用');
                }, 1000); // 延迟1秒确保所有脚本加载完成
            });
        } else {
            setTimeout(() => {
                bindFormEventListeners();
                bindTabSwitchListeners();
                bindVisibilityChangeListener();
                bindBeforeUnloadListener();
                restoreDraftData();
                
                console.log('[LocalStorageManager] 本地存储管理器初始化完成');
                console.log('[LocalStorageManager] 自动保存功能:', AUTO_SAVE_CONFIG.enabled ? '已启用' : '已禁用');
            }, 1000);
        }
        
        // 定期清理过期草稿（每天执行一次）
        setInterval(cleanupOldDrafts, 24 * 60 * 60 * 1000);
        
        console.log('[LocalStorageManager] 本地存储管理器初始化开始...');
    }

    /**
     * 启用/禁用自动保存功能
     */
    function setAutoSaveEnabled(enabled) {
        AUTO_SAVE_CONFIG.enabled = enabled;
        safeLocalStorageSetItem(STORAGE_KEYS.AUTO_SAVE_ENABLED, enabled.toString());
        
        console.log('[LocalStorageManager] 自动保存功能已', enabled ? '启用' : '禁用');
        
        if (typeof window.showMobileToast === 'function') {
            window.showMobileToast(`自动保存已${enabled ? '启用' : '禁用'}`, 'info');
        }
    }

    /**
     * 获取自动保存状态
     */
    function isAutoSaveEnabled() {
        return AUTO_SAVE_CONFIG.enabled;
    }

    /**
     * 手动保存当前表单数据
     */
    function manualSave() {
        console.log('[LocalStorageManager] 执行手动保存...');
        
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab) {
            if (activeTab.id === 'review-content') {
                autoSaveReviewForm();
            } else if (activeTab.id === 'plan-content') {
                autoSavePlanForm();
            }
        }
        
        // 保存两个表单
        autoSaveReviewForm();
        autoSavePlanForm();
    }

    /**
     * 获取存储统计信息
     */
    function getStorageStats() {
        const stats = {
            reviewDraft: false,
            planDraft: false,
            autoSaveEnabled: AUTO_SAVE_CONFIG.enabled,
            lastAutoSave: null,
            storageUsage: {
                used: 0,
                total: 0,
                percentage: 0
            }
        };
        
        // 检查草稿数据
        const reviewDraft = safeJsonParse(localStorage.getItem(STORAGE_KEYS.REVIEW_FORM_DRAFT));
        const planDraft = safeJsonParse(localStorage.getItem(STORAGE_KEYS.PLAN_FORM_DRAFT));
        
        if (reviewDraft && !isDraftExpired(reviewDraft.timestamp)) {
            stats.reviewDraft = true;
            stats.reviewDraftDate = new Date(reviewDraft.timestamp).toLocaleString();
        }
        
        if (planDraft && !isDraftExpired(planDraft.timestamp)) {
            stats.planDraft = true;
            stats.planDraftDate = new Date(planDraft.timestamp).toLocaleString();
        }
        
        // 获取最后保存时间
        const lastSave = localStorage.getItem(STORAGE_KEYS.LAST_AUTO_SAVE);
        if (lastSave) {
            stats.lastAutoSave = new Date(parseInt(lastSave)).toLocaleString();
        }
        
        // 估算存储使用情况
        let totalSize = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                const value = localStorage.getItem(key);
                if (value) {
                    totalSize += key.length + value.length;
                }
            }
        }
        
        // 估算总容量（通常为5-10MB，这里按5MB计算）
        const estimatedTotal = 5 * 1024 * 1024; // 5MB
        stats.storageUsage.used = totalSize;
        stats.storageUsage.total = estimatedTotal;
        stats.storageUsage.percentage = Math.round((totalSize / estimatedTotal) * 100);
        
        return stats;
    }

    // 暴露全局接口
    window.LocalStorageManager = {
        init,
        setAutoSaveEnabled,
        isAutoSaveEnabled,
        manualSave,
        clearDraftData,
        getStorageStats,
        restoreDraftData,
        cleanupOldDrafts
    };

    // 自动初始化
    init();

    console.log('[LocalStorageManager] 本地存储管理器已加载');

})();