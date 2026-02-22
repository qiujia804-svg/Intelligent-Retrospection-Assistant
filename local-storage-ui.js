/**
 * 智能复盘助手 - 本地存储UI增强模块
 * 提供用户友好的数据管理界面和状态指示
 */

(function() {
    'use strict';

    // 等待DOM加载完成
    function waitForDOM() {
        return new Promise(resolve => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }

    /**
     * 创建自动保存状态指示器（已禁用，避免遮挡界面）
     */
    function createAutoSaveIndicator() {
        // 静默处理，不创建任何UI元素
        console.log('[LocalStorageUI] 自动保存状态指示器已禁用');
    }

    /**
     * 更新自动保存状态（已禁用，避免遮挡界面）
     */
    function updateAutoSaveStatus(status, message = null, time = null) {
        // 静默处理，不更新任何UI
        console.log('[LocalStorageUI] 自动保存状态:', status, message);
    }

    /**
     * 创建数据管理面板
     */
    function createDataManagementPanel() {
        // 创建管理面板
        const panel = document.createElement('div');
        panel.id = 'data-management-panel';
        panel.className = 'data-management-panel';
        panel.innerHTML = `
            <div class="panel-header">
                <h3>📊 数据管理</h3>
                <button class="panel-close" onclick="this.parentElement.parentElement.style.display='none'">×</button>
            </div>
            <div class="panel-content">
                <div class="management-section">
                    <h4>自动保存设置</h4>
                    <div class="setting-item">
                        <label class="toggle-switch">
                            <input type="checkbox" id="auto-save-toggle" checked>
                            <span class="toggle-slider"></span>
                        </label>
                        <span class="setting-label">启用自动保存</span>
                    </div>
                    <div class="setting-info">
                        <small>每3秒自动保存一次输入的数据</small>
                    </div>
                </div>
                
                <div class="management-section">
                    <h4>草稿数据</h4>
                    <div class="data-status" id="draft-status">
                        <div class="status-item">
                            <span class="status-label">复盘草稿：</span>
                            <span class="status-value" id="review-draft-status">无</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">规划草稿：</span>
                            <span class="status-value" id="plan-draft-status">无</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">最后保存：</span>
                            <span class="status-value" id="last-save-time">从未</span>
                        </div>
                    </div>
                    <div class="action-buttons">
                        <button class="btn btn-primary" onclick="LocalStorageManager.manualSave()">立即保存</button>
                        <button class="btn btn-secondary" onclick="restoreDraftData()">恢复草稿</button>
                        <button class="btn btn-danger" onclick="clearDraftData()">清除草稿</button>
                    </div>
                </div>
                
                <div class="management-section">
                    <h4>存储使用情况</h4>
                    <div class="storage-usage">
                        <div class="usage-bar">
                            <div class="usage-fill" id="storage-usage-fill"></div>
                        </div>
                        <div class="usage-text">
                            <span id="storage-used">0 KB</span> / <span id="storage-total">5 MB</span>
                            (<span id="storage-percentage">0%</span>)
                        </div>
                    </div>
                </div>
                
                <div class="management-section">
                    <h4>数据备份</h4>
                    <div class="action-buttons">
                        <button class="btn btn-primary" onclick="exportLocalData()">导出本地数据</button>
                        <button class="btn btn-secondary" onclick="importLocalData()">导入数据</button>
                    </div>
                </div>
            </div>
        `;

        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .data-management-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                width: 90%;
                max-width: 500px;
                max-height: 80vh;
                overflow-y: auto;
                z-index: 10001;
                display: none;
                border: 1px solid #e0e0e0;
            }
            
            .panel-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                border-radius: 12px 12px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .panel-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
            }
            
            .panel-close {
                background: none;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background 0.3s ease;
            }
            
            .panel-close:hover {
                background: rgba(255,255,255,0.2);
            }
            
            .panel-content {
                padding: 20px;
            }
            
            .management-section {
                margin-bottom: 25px;
                padding-bottom: 20px;
                border-bottom: 1px solid #f0f0f0;
            }
            
            .management-section:last-child {
                margin-bottom: 0;
                padding-bottom: 0;
                border-bottom: none;
            }
            
            .management-section h4 {
                margin: 0 0 15px 0;
                color: #333;
                font-size: 16px;
                font-weight: 600;
            }
            
            .setting-item {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 8px;
            }
            
            .toggle-switch {
                position: relative;
                display: inline-block;
                width: 50px;
                height: 24px;
            }
            
            .toggle-switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            
            .toggle-slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #ccc;
                transition: 0.4s;
                border-radius: 24px;
            }
            
            .toggle-slider:before {
                position: absolute;
                content: "";
                height: 16px;
                width: 16px;
                left: 4px;
                bottom: 4px;
                background-color: white;
                transition: 0.4s;
                border-radius: 50%;
            }
            
            input:checked + .toggle-slider {
                background-color: #667eea;
            }
            
            input:checked + .toggle-slider:before {
                transform: translateX(26px);
            }
            
            .setting-label {
                font-size: 14px;
                color: #555;
            }
            
            .setting-info {
                margin-top: 5px;
            }
            
            .setting-info small {
                color: #888;
                font-size: 12px;
            }
            
            .data-status {
                background: #f8f9fa;
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 15px;
            }
            
            .status-item {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                font-size: 14px;
            }
            
            .status-item:last-child {
                margin-bottom: 0;
            }
            
            .status-label {
                color: #666;
            }
            
            .status-value {
                color: #333;
                font-weight: 500;
            }
            
            .action-buttons {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }
            
            .btn {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.3s ease;
                font-weight: 500;
            }
            
            .btn-primary {
                background: #667eea;
                color: white;
            }
            
            .btn-primary:hover {
                background: #5a67d8;
                transform: translateY(-1px);
            }
            
            .btn-secondary {
                background: #e2e8f0;
                color: #4a5568;
            }
            
            .btn-secondary:hover {
                background: #cbd5e0;
                transform: translateY(-1px);
            }
            
            .btn-danger {
                background: #f56565;
                color: white;
            }
            
            .btn-danger:hover {
                background: #e53e3e;
                transform: translateY(-1px);
            }
            
            .storage-usage {
                margin-top: 10px;
            }
            
            .usage-bar {
                background: #e2e8f0;
                height: 8px;
                border-radius: 4px;
                overflow: hidden;
                margin-bottom: 8px;
            }
            
            .usage-fill {
                background: linear-gradient(90deg, #667eea, #764ba2);
                height: 100%;
                border-radius: 4px;
                transition: width 0.3s ease;
                width: 0%;
            }
            
            .usage-text {
                text-align: center;
                font-size: 12px;
                color: #666;
            }
            
            /* 移动端适配 */
            @media (max-width: 768px) {
                .data-management-panel {
                    width: 95%;
                    max-height: 85vh;
                }
                
                .panel-content {
                    padding: 15px;
                }
                
                .action-buttons {
                    flex-direction: column;
                }
                
                .btn {
                    width: 100%;
                    justify-content: center;
                }
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(panel);

        return panel;
    }

    /**
     * 显示数据管理面板
     */
    function showDataManagementPanel() {
        const panel = document.getElementById('data-management-panel');
        if (!panel) {
            createDataManagementPanel();
            showDataManagementPanel();
            return;
        }

        panel.style.display = 'block';
        updateDataManagementPanel();
    }

    /**
     * 更新数据管理面板内容
     */
    function updateDataManagementPanel() {
        if (!window.LocalStorageManager) return;

        const stats = window.LocalStorageManager.getStorageStats();

        // 更新自动保存开关
        const autoSaveToggle = document.getElementById('auto-save-toggle');
        if (autoSaveToggle) {
            autoSaveToggle.checked = stats.autoSaveEnabled;
            autoSaveToggle.addEventListener('change', function() {
                window.LocalStorageManager.setAutoSaveEnabled(this.checked);
                updateAutoSaveStatus(this.checked ? 'enabled' : 'disabled');
            });
        }

        // 更新草稿状态
        const reviewDraftStatus = document.getElementById('review-draft-status');
        const planDraftStatus = document.getElementById('plan-draft-status');
        const lastSaveTime = document.getElementById('last-save-time');

        if (reviewDraftStatus) {
            reviewDraftStatus.textContent = stats.reviewDraft ? 
                (stats.reviewDraftDate ? `有 (${new Date(stats.reviewDraftDate).toLocaleString()})` : '有') : '无';
            reviewDraftStatus.style.color = stats.reviewDraft ? '#4CAF50' : '#999';
        }

        if (planDraftStatus) {
            planDraftStatus.textContent = stats.planDraft ? 
                (stats.planDraftDate ? `有 (${new Date(stats.planDraftDate).toLocaleString()})` : '有') : '无';
            planDraftStatus.style.color = stats.planDraft ? '#4CAF50' : '#999';
        }

        if (lastSaveTime) {
            lastSaveTime.textContent = stats.lastAutoSave ? 
                new Date(stats.lastAutoSave).toLocaleString() : '从未';
        }

        // 更新存储使用情况
        const storageFill = document.getElementById('storage-usage-fill');
        const storageUsed = document.getElementById('storage-used');
        const storageTotal = document.getElementById('storage-total');
        const storagePercentage = document.getElementById('storage-percentage');

        if (storageFill) {
            storageFill.style.width = `${Math.min(stats.storageUsage.percentage, 100)}%`;
        }

        if (storageUsed) {
            const usedKB = Math.round(stats.storageUsage.used / 1024);
            storageUsed.textContent = `${usedKB} KB`;
        }

        if (storageTotal) {
            const totalMB = Math.round(stats.storageUsage.total / (1024 * 1024));
            storageTotal.textContent = `${totalMB} MB`;
        }

        if (storagePercentage) {
            storagePercentage.textContent = `${stats.storageUsage.percentage}%`;
        }
    }

    /**
     * 更新自动保存状态（已禁用）
     */
    function updateAutoSaveStatus(status) {
        // 静默处理，不更新任何UI
        console.log('[LocalStorageUI] 自动保存状态:', status);
    }

    /**
     * 导出本地数据
     */
    function exportLocalData() {
        if (!window.LocalStorageManager) return;

        const stats = window.LocalStorageManager.getStorageStats();
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            autoSaveEnabled: stats.autoSaveEnabled,
            drafts: {
                review: null,
                plan: null
            },
            storageStats: stats
        };

        // 获取草稿数据
        const reviewDraft = localStorage.getItem('smart_review_assistant_review_draft');
        const planDraft = localStorage.getItem('smart_review_assistant_plan_draft');

        if (reviewDraft) {
            try {
                exportData.drafts.review = JSON.parse(reviewDraft);
            } catch (e) {
                console.error('解析复盘草稿失败:', e);
            }
        }

        if (planDraft) {
            try {
                exportData.drafts.plan = JSON.parse(planDraft);
            } catch (e) {
                console.error('解析规划草稿失败:', e);
            }
        }

        // 创建下载链接
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `复盘助手数据备份_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);

        if (typeof window.showMobileToast === 'function') {
            window.showMobileToast('数据导出成功', 'success');
        }
    }

    /**
     * 导入本地数据
     */
    function importLocalData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = function(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importData = JSON.parse(e.target.result);
                    
                    if (importData.drafts) {
                        // 导入复盘草稿
                        if (importData.drafts.review) {
                            localStorage.setItem('smart_review_assistant_review_draft', 
                                JSON.stringify(importData.drafts.review));
                        }
                        
                        // 导入规划草稿
                        if (importData.drafts.plan) {
                            localStorage.setItem('smart_review_assistant_plan_draft', 
                                JSON.stringify(importData.drafts.plan));
                        }
                    }

                    // 导入自动保存设置
                    if (importData.autoSaveEnabled !== undefined) {
                        window.LocalStorageManager.setAutoSaveEnabled(importData.autoSaveEnabled);
                    }

                    updateDataManagementPanel();

                    if (typeof window.showMobileToast === 'function') {
                        window.showMobileToast('数据导入成功', 'success');
                    }

                } catch (error) {
                    console.error('数据导入失败:', error);
                    if (typeof window.showMobileToast === 'function') {
                        window.showMobileToast('数据导入失败，文件格式错误', 'error');
                    }
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    /**
     * 恢复草稿数据
     */
    function restoreDraftData() {
        if (window.LocalStorageManager) {
            const restored = window.LocalStorageManager.restoreDraftData();
            if (restored) {
                updateDataManagementPanel();
            }
        }
    }

    /**
     * 清除草稿数据
     */
    function clearDraftData() {
        if (confirm('确定要清除所有草稿数据吗？此操作不可恢复。')) {
            if (window.LocalStorageManager) {
                window.LocalStorageManager.clearDraftData();
                updateDataManagementPanel();
                
                if (typeof window.showMobileToast === 'function') {
                    window.showMobileToast('草稿数据已清除', 'success');
                }
            }
        }
    }

    /**
     * 初始化UI增强功能
     */
    async function initUIEnhancements() {
        await waitForDOM();

        // 等待LocalStorageManager加载
        let attempts = 0;
        while (!window.LocalStorageManager && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (!window.LocalStorageManager) {
            console.error('LocalStorageManager 未加载，UI增强功能初始化失败');
            return;
        }

        // 创建数据管理面板（自动保存状态指示器已禁用）
        createDataManagementPanel();

        // 数据管理按钮已禁用
        // addDataManagementButton();

        // 监听自动保存事件
        setupAutoSaveListeners();

        console.log('[LocalStorageUI] UI增强功能初始化完成');
    }

    /**
     * 添加数据管理按钮
     */
    function addDataManagementButton() {
        // 等待页面完全加载
        setTimeout(() => {
            // 尝试在不同位置添加按钮
            const targetLocations = [
                '.member-controls',
                'header .container',
                '.tabs',
                'main'
            ];

            let targetElement = null;
            for (const selector of targetLocations) {
                targetElement = document.querySelector(selector);
                if (targetElement) break;
            }

            if (targetElement) {
                const button = document.createElement('button');
                button.className = 'data-management-btn';
                button.innerHTML = '📊 数据管理';
                button.onclick = showDataManagementPanel;
                button.title = '管理本地存储的数据';

                // 添加按钮样式
                const style = document.createElement('style');
                style.textContent = `
                    .data-management-btn {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 20px;
                        font-size: 12px;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        margin-left: 10px;
                        font-weight: 500;
                    }
                    
                    .data-management-btn:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
                    }
                    
                    /* 移动端适配 */
                    @media (max-width: 768px) {
                        .data-management-btn {
                            padding: 6px 12px;
                            font-size: 11px;
                            margin-left: 5px;
                        }
                    }
                `;
                document.head.appendChild(style);

                targetElement.appendChild(button);
                console.log('[LocalStorageUI] 数据管理按钮已添加');
            } else {
                console.warn('[LocalStorageUI] 未找到合适的位置添加数据管理按钮');
            }
        }, 2000); // 延迟2秒确保页面完全加载
    }

    /**
     * 设置自动保存监听器
     */
    function setupAutoSaveListeners() {
        if (!window.LocalStorageManager) return;

        // 监听自动保存事件（通过覆盖原有的自动保存函数）
        const originalAutoSaveReview = window.LocalStorageManager.manualSave;
        
        // 创建自定义的保存通知
        window.addEventListener('autosave-start', () => {
            updateAutoSaveStatus('saving');
        });

        window.addEventListener('autosave-success', () => {
            updateAutoSaveStatus('saved');
        });

        window.addEventListener('autosave-error', () => {
            updateAutoSaveStatus('error');
        });

        console.log('[LocalStorageUI] 自动保存监听器已设置');
    }

    // 初始化
    initUIEnhancements();

    // 暴露全局函数
    window.showDataManagementPanel = showDataManagementPanel;
    window.exportLocalData = exportLocalData;
    window.importLocalData = importLocalData;
    window.restoreDraftData = restoreDraftData;
    window.clearDraftData = clearDraftData;
    window.updateAutoSaveStatus = updateAutoSaveStatus;

    console.log('[LocalStorageUI] 本地存储UI增强模块已加载');

})();