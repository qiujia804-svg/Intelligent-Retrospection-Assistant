// 智能复盘助手 - JavaScript 逻辑

// DOM 元素获取
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const reviewForm = document.getElementById('review-form');
const planForm = document.getElementById('plan-form');
const goalProgress = document.getElementById('goal-progress');
const progressValue = document.getElementById('progress-value');
const dateInput = document.getElementById('date');
const historyList = document.getElementById('history-list');
const historyFilter = document.getElementById('history-filter');
const clearHistoryBtn = document.getElementById('clear-history');
const historyDetail = document.getElementById('history-detail');
const detailContent = document.getElementById('detail-content');
const closeDetailBtn = document.getElementById('close-detail');
const generateAdviceBtn = document.getElementById('generate-advice');
const adviceContent = document.querySelector('.advice-content');

// 时间管理相关DOM元素
const scheduleItemsContainer = document.getElementById('schedule-items');
const totalDurationElement = document.getElementById('total-duration');
const totalTasksElement = document.getElementById('total-tasks');

// 数据概览相关DOM元素
const refreshDataBtn = document.getElementById('refresh-data');
const segmentToggle = document.getElementById('segment-toggle');
const segmentCards = document.querySelector('.segment-cards');
const totalDaysElement = document.getElementById('total-days');
const avgCompletionElement = document.getElementById('avg-completion');
const streakDaysElement = document.getElementById('streak-days');
const improvementRateElement = document.getElementById('improvement-rate');
const lastReviewElement = document.getElementById('last-review');
const segment7Element = document.getElementById('segment-7');
const segment14Element = document.getElementById('segment-14');
const segment21Element = document.getElementById('segment-21');
const segment28Element = document.getElementById('segment-28');

// 图表相关变量
let completionTrendChart = null;
let timeDistributionChart = null;

// 设置当前日期
const today = new Date();
const formattedDate = today.toISOString().split('T')[0];
dateInput.value = formattedDate;

// 标签切换功能
function setupTabs() {
    // 页面加载时默认显示今日复盘内容，隐藏其他内容
    tabContents.forEach((content, index) => {
        if (index === 0) { // 假设第一个内容区域是今日复盘
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
    
    // 确保今日复盘按钮默认是活跃状态
    if (tabBtns.length > 0) {
        tabBtns.forEach((btn, index) => {
            if (index === 0) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    // 为标签按钮添加点击事件
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 移除所有按钮的活跃状态
            tabBtns.forEach(b => b.classList.remove('active'));
            // 添加当前按钮的活跃状态
            btn.classList.add('active');
            
            // 获取目标内容区域ID
            const targetTab = btn.getAttribute('data-tab');
            
            // 隐藏所有内容区域
            tabContents.forEach(content => {
                content.classList.remove('active');
            });
            
            // 显示目标内容区域
            const targetContent = document.getElementById(targetTab);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

// 进度条功能
function setupProgressBar() {
    goalProgress.addEventListener('input', () => {
        progressValue.textContent = `${goalProgress.value}%`;
    });
}

// 四象限任务管理
function setupQuadrants() {
    // 添加任务按钮事件
    document.querySelectorAll('.add-task-btn').forEach(btn => {
        // 先移除可能存在的事件监听器，避免重复绑定
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', function() {
            try {
                const taskList = this.closest('.task-list');
                const taskItem = this.closest('.task-item');
                
                if (!taskList || !taskItem) {
                    console.error('无法找到任务列表或任务项元素');
                    showNotification('添加任务失败，请刷新页面重试', 'error');
                    return;
                }
                
                const newTaskItem = taskItem.cloneNode(true);
                
                // 清空输入内容
                newTaskItem.querySelectorAll('input, textarea').forEach(input => {
                    input.value = '';
                });
                
                taskList.appendChild(newTaskItem);
                showNotification('任务项添加成功', 'success');
                
                // 只为新添加的任务项中的按钮单独添加事件监听器
                const newAddBtn = newTaskItem.querySelector('.add-task-btn');
                const newRemoveBtn = newTaskItem.querySelector('.remove-task-btn');
                
                if (newAddBtn) {
                    setupAddTaskButton(newAddBtn);
                }
                
                if (newRemoveBtn) {
                    setupRemoveTaskButton(newRemoveBtn);
                }
            } catch (error) {
                console.error('添加任务失败:', error);
                showNotification('添加任务时发生错误', 'error');
            }
        });
    });
    
    // 删除任务按钮事件
    document.querySelectorAll('.remove-task-btn').forEach(btn => {
        // 先移除可能存在的事件监听器，避免重复绑定
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', function() {
            const taskList = this.closest('.task-list');
            const taskItem = this.closest('.task-item');
            
            // 确保至少保留一个任务项
            if (taskList.querySelectorAll('.task-item').length > 1) {
                taskItem.remove();
            } else {
                // 清空输入内容
                taskItem.querySelectorAll('input, textarea').forEach(input => {
                    input.value = '';
                });
            }
        });
    });
}

// 设置添加任务按钮
function setupAddTaskButton(btn) {
    btn.addEventListener('click', function() {
        try {
            const taskList = this.closest('.task-list');
            const taskItem = this.closest('.task-item');
            
            if (!taskList || !taskItem) {
                console.error('无法找到任务列表或任务项元素');
                showNotification('添加任务失败，请刷新页面重试', 'error');
                return;
            }
            
            const newTaskItem = taskItem.cloneNode(true);
            
            // 清空输入内容
            newTaskItem.querySelectorAll('input, textarea').forEach(input => {
                input.value = '';
            });
            
            taskList.appendChild(newTaskItem);
            showNotification('任务项添加成功', 'success');
            
            // 为新添加的按钮单独添加事件监听
            const newAddBtn = newTaskItem.querySelector('.add-task-btn');
            const newRemoveBtn = newTaskItem.querySelector('.remove-task-btn');
            
            if (newAddBtn) {
                setupAddTaskButton(newAddBtn);
            }
            
            if (newRemoveBtn) {
                setupRemoveTaskButton(newRemoveBtn);
            }
        } catch (error) {
            console.error('添加任务失败:', error);
            showNotification('添加任务时发生错误', 'error');
        }
    });
}

// 设置删除任务按钮
function setupRemoveTaskButton(btn) {
    btn.addEventListener('click', function() {
        const taskList = this.closest('.task-list');
        const taskItem = this.closest('.task-item');
        
        // 确保至少保留一个任务项
        if (taskList.querySelectorAll('.task-item').length > 1) {
            taskItem.remove();
        } else {
            // 清空输入内容
            taskItem.querySelectorAll('input, textarea').forEach(input => {
                input.value = '';
            });
        }
    });
}

// 本地存储功能
const STORAGE_KEY_REVIEWS = 'smart_review_assistant_reviews';
const STORAGE_KEY_PLANS = 'smart_review_assistant_plans';

// 显示通知
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 显示动画
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // 3秒后自动消失
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function getReviews() {
    try {
        const reviews = localStorage.getItem(STORAGE_KEY_REVIEWS);
        const parsedReviews = reviews ? JSON.parse(reviews) : [];
        // 确保返回的是数组
        return Array.isArray(parsedReviews) ? parsedReviews : [];
    } catch (error) {
        console.error('加载复盘数据失败:', error);
        // 显示用户友好的错误信息
        showNotification('加载历史记录失败', 'error');
        return [];
    }
}

function saveReview(review) {
    try {
        const reviews = getReviews();
        const existingIndex = reviews.findIndex(r => r.date === review.date);
        
        if (existingIndex >= 0) {
            reviews[existingIndex] = review;
        } else {
            reviews.push(review);
        }
        
        localStorage.setItem(STORAGE_KEY_REVIEWS, JSON.stringify(reviews));
        showNotification('保存成功', 'success');
    } catch (error) {
        console.error('保存复盘数据失败:', error);
        showNotification('保存失败，请重试', 'error');
    }
}

function getPlans() {
    const plans = localStorage.getItem(STORAGE_KEY_PLANS);
    return plans ? JSON.parse(plans) : [];
}

function savePlan(plan) {
    const plans = getPlans();
    const existingIndex = plans.findIndex(p => p.date === plan.date);
    
    if (existingIndex >= 0) {
        plans[existingIndex] = plan;
    } else {
        plans.push(plan);
    }
    
    localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(plans));
}

// 复盘表单提交处理
function setupReviewForm() {
    reviewForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const review = {
            date: document.getElementById('date').value,
            goalCompletion: `${goalProgress.value}%`,
            strengths: document.getElementById('strengths').value,
            weaknesses: document.getElementById('weaknesses').value,
            improvements: document.getElementById('improvements').value,
            todos: document.getElementById('todos').value
        };
        
        saveReview(review);
        alert('复盘记录已保存！');
        
        // 清空表单
        this.reset();
        dateInput.value = formattedDate;
        goalProgress.value = 50;
        progressValue.textContent = '50%';
        
        // 保存后更新数据概览
        updateDataOverview(getReviews());
        
        // 同时更新历史记录列表，确保新保存的数据能立即显示
        displayHistory();
    });
}

// 规划表单提交处理
function setupPlanForm() {
    planForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const plan = {
            date: new Date().toISOString().split('T')[0], // 保存为今天的日期
            quadrants: {
                a: getTasksFromQuadrant('quadrant-a'),
                b: getTasksFromQuadrant('quadrant-b'),
                c: getTasksFromQuadrant('quadrant-c'),
                d: getTasksFromQuadrant('quadrant-d')
            }
        };
        
        savePlan(plan);
        alert('明日规划已保存！');
    });
}

// 从四象限获取任务数据
function getTasksFromQuadrant(quadrantId) {
    const tasks = [];
    const taskItems = document.querySelectorAll(`#${quadrantId} .task-item`);
    
    taskItems.forEach(item => {
        const task = {
            what: item.querySelector('.task-what').value,
            why: item.querySelector('.task-why').value,
            how: item.querySelector('.task-how').value,
            solution: item.querySelector('.task-solution').value,
            help: item.querySelector('.task-help').value
        };
        
        // 只添加有内容的任务
        if (task.what.trim() !== '') {
            tasks.push(task);
        }
    });
    
    return tasks;
}

// 显示历史记录
function displayHistory() {
    const reviews = getReviews();
    const filter = historyFilter.value;
    
    // 根据筛选条件过滤
    let filteredReviews = reviews;
    if (filter) {
        filteredReviews = reviews.filter(review => 
            review.date.startsWith(filter)
        );
    }
    
    // 按日期降序排序
    filteredReviews.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // 清空并重新渲染历史列表
    historyList.innerHTML = '';
    
    if (filteredReviews.length === 0) {
        historyList.innerHTML = '<p class="no-data">暂无复盘记录</p>';
        return;
    }
    
    filteredReviews.forEach(review => {
        // 获取目标达成率（兼容对象和字符串格式）
        const completionRate = typeof review.goalCompletion === 'object' 
            ? review.goalCompletion.percentage 
            : review.goalCompletion.replace('%', '');
        
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <div class="history-item-date">${review.date}</div>
            <div class="history-item-brief">目标达成: ${completionRate}% | 优点: ${review.strengths ? review.strengths.substring(0, 50) : ''}${review.strengths && review.strengths.length > 50 ? '...' : ''}</div>
        `;
        
        item.addEventListener('click', () => showHistoryDetail(review));
        historyList.appendChild(item);
    });
}

// 显示历史详情
function showHistoryDetail(review) {
    // 兼容不同格式的goalCompletion数据
    let completionRate = 0;
    let completionDescription = '无';
    
    if (typeof review.goalCompletion === 'object') {
        completionRate = review.goalCompletion.percentage;
        completionDescription = review.goalCompletion.description || '无';
    } else if (typeof review.goalCompletion === 'string') {
        completionRate = review.goalCompletion.replace('%', '');
    }
    
    detailContent.innerHTML = `
        <div class="detail-section">
            <h4>日期</h4>
            <p>${review.date}</p>
        </div>
        <div class="detail-section">
            <h4>目标达成情况</h4>
            <p><strong>完成度:</strong> ${completionRate}%</p>
            <p><strong>详细说明:</strong> ${completionDescription}</p>
        </div>
        <div class="detail-section">
            <h4>优点</h4>
            <p>${review.strengths || '无'}</p>
        </div>
        <div class="detail-section">
            <h4>不足</h4>
            <p>${review.weaknesses || '无'}</p>
        </div>
        <div class="detail-section">
            <h4>改进措施</h4>
            <p>${review.improvements || '无'}</p>
        </div>
        <div class="detail-section">
            <h4>待办事项</h4>
            <p>${review.todos || '无'}</p>
        </div>
    `;
    
    historyDetail.style.display = 'block';
}

// 关闭历史详情
function setupDetailModal() {
    closeDetailBtn.addEventListener('click', () => {
        historyDetail.style.display = 'none';
    });
    
    // 点击外部关闭
    window.addEventListener('click', (e) => {
        if (e.target === historyDetail) {
            historyDetail.style.display = 'none';
        }
    });
}

// 清空历史记录
// 导出数据功能
function exportData() {
    try {
        // 获取所有数据
        const exportData = {
            reviews: getReviews(),
            plans: getPlans(),
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        // 创建JSON字符串
        const jsonString = JSON.stringify(exportData, null, 2);
        
        // 创建Blob对象
        const blob = new Blob([jsonString], { type: 'application/json' });
        
        // 创建下载链接
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `smart-review-data-${new Date().toISOString().split('T')[0]}.json`;
        
        // 触发下载
        document.body.appendChild(link);
        link.click();
        
        // 清理
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showNotification('数据导出成功', 'success');
    } catch (error) {
        console.error('导出数据失败:', error);
        showNotification('数据导出失败，请重试', 'error');
    }
}

// 导入数据功能
function importData() {
    try {
        // 创建文件输入元素
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        
        // 处理文件选择
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            // 验证文件类型
            if (!file.name.endsWith('.json')) {
                showNotification('请选择有效的JSON文件', 'error');
                return;
            }
            
            // 读取文件
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    // 解析JSON数据
                    const importData = JSON.parse(e.target.result);
                    
                    // 验证数据格式
                    if (!importData.reviews || !Array.isArray(importData.reviews)) {
                        showNotification('无效的数据格式，请检查文件', 'error');
                        return;
                    }
                    
                    // 确认是否导入
                    if (confirm('确定要导入数据吗？这将会覆盖当前的数据。')) {
                        // 保存数据到localStorage
                        localStorage.setItem(STORAGE_KEY_REVIEWS, JSON.stringify(importData.reviews));
                        
                        // 如果有计划数据，也保存
                        if (importData.plans && Array.isArray(importData.plans)) {
                            localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(importData.plans));
                        }
                        
                        // 重置历史记录筛选器，确保新导入的数据能够显示
                        historyFilter.value = '';
                        // 刷新界面
                        displayHistory();
                        
                        // 如果在数据概览标签页，也更新概览数据
                        if (document.querySelector('.tab-content.active').id === 'data-overview') {
                            updateDataOverview();
                        }
                        
                        showNotification('数据导入成功', 'success');
                    }
                } catch (error) {
                    console.error('解析JSON文件失败:', error);
                    showNotification('文件格式错误，请检查文件内容', 'error');
                }
            };
            
            reader.onerror = () => {
                showNotification('文件读取失败', 'error');
            };
            
            // 开始读取文件
            reader.readAsText(file);
        });
        
        // 触发文件选择对话框
        fileInput.click();
    } catch (error) {
        console.error('导入数据失败:', error);
        showNotification('数据导入失败，请重试', 'error');
    }
}

function setupHistoryControls() {
    clearHistoryBtn.addEventListener('click', () => {
        if (confirm('确定要清空所有复盘记录吗？此操作不可恢复。')) {
            localStorage.removeItem(STORAGE_KEY_REVIEWS);
            displayHistory();
        }
    });
    
    historyFilter.addEventListener('change', displayHistory);
    
    // 添加导出导入按钮
    const historyControls = clearHistoryBtn.parentNode;
    
    // 创建导出按钮
    const exportBtn = document.createElement('button');
    exportBtn.id = 'export-data-btn';
    exportBtn.className = 'btn';
    exportBtn.textContent = '导出数据';
    exportBtn.addEventListener('click', exportData);
    
    // 创建导入按钮
    const importBtn = document.createElement('button');
    importBtn.id = 'import-data-btn';
    importBtn.className = 'btn';
    importBtn.textContent = '导入数据';
    importBtn.addEventListener('click', importData);
    
    // 在清空按钮之前插入
    historyControls.insertBefore(exportBtn, clearHistoryBtn);
    historyControls.insertBefore(importBtn, clearHistoryBtn);
    
    // 添加按钮样式
    const style = document.createElement('style');
    style.textContent = `
        #export-data-btn, #import-data-btn {
            margin-right: 10px;
            background-color: #1890ff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.3s;
        }
        
        #export-data-btn:hover, #import-data-btn:hover {
            background-color: #40a9ff;
        }
        
        #export-data-btn {
            background-color: #52c41a;
        }
        
        #export-data-btn:hover {
            background-color: #73d13d;
        }
    `;
    document.head.appendChild(style);
}

// 生成智能建议
function setupAdviceGenerator() {
    generateAdviceBtn.addEventListener('click', () => {
        const reviews = getReviews();
        
        if (reviews.length === 0) {
            adviceContent.innerHTML = '<p class="no-data">请先添加复盘记录，以便我们为您生成智能建议。</p>';
            return;
        }
        
        const advice = generateSmartAdvice(reviews);
        displayAdvice(advice);
    });
}

// 根据历史记录生成智能建议
function generateSmartAdvice(reviews) {
    const advice = [];
    
    // 1. 目标达成趋势分析
    const completionTrend = analyzeCompletionTrend(reviews);
    advice.push(completionTrend);
    
    // 2. 优势强化建议
    const strengthsAnalysis = analyzeStrengths(reviews);
    if (strengthsAnalysis) {
        advice.push(strengthsAnalysis);
    }
    
    // 3. 不足改进建议
    const weaknessesAnalysis = analyzeWeaknesses(reviews);
    if (weaknessesAnalysis) {
        advice.push(weaknessesAnalysis);
    }
    
    // 4. 习惯养成建议
    const habitAdvice = generateHabitAdvice(reviews);
    advice.push(habitAdvice);
    
    // 5. 个性化时间管理建议
    const timeManagementAdvice = generateTimeManagementAdvice(reviews);
    advice.push(timeManagementAdvice);
    
    // 6. 成就回顾与激励
    const achievementAdvice = generateAchievementAdvice(reviews);
    advice.push(achievementAdvice);
    
    return advice;
}

// 分析目标达成趋势
function analyzeCompletionTrend(reviews) {
    if (reviews.length < 2) {
        return {
            type: '目标管理',
            content: '建议继续记录复盘数据，以便我们为您提供更精准的趋势分析。目前建议：\n1. 设定SMART原则的目标\n2. 每天记录实际完成情况\n3. 定期回顾目标合理性'
        };
    }
    
    // 兼容对象和字符串格式的goalCompletion数据
    const getCompletionRate = (review) => {
        if (typeof review.goalCompletion === 'object' && review.goalCompletion.percentage !== undefined) {
            return review.goalCompletion.percentage;
        } else if (typeof review.goalCompletion === 'string') {
            return parseInt(review.goalCompletion.replace('%', '')) || 0;
        }
        return 0;
    };
    
    const avgCompletion = reviews.reduce((sum, r) => sum + getCompletionRate(r), 0) / reviews.length;
    const recentReviews = reviews.slice(-3);
    const avgRecent = recentReviews.length > 0 ? recentReviews.reduce((sum, r) => sum + getCompletionRate(r), 0) / recentReviews.length : 0;
    
    let trend = '';
    if (avgRecent > avgCompletion + 10 && avgRecent > 0) {
        trend = '您的目标达成情况正在显著提升，保持这种良好势头！';
    } else if (avgRecent < avgCompletion - 10 && avgRecent > 0) {
        trend = '您的目标达成率有所下降，建议分析原因并调整策略。';
    } else if (avgRecent > 0) {
        trend = '您的目标达成率相对稳定，可以尝试挑战更高目标。';
    }
    
    return {
        type: '目标达成趋势',
        content: `${trend}\n平均完成率：${Math.round(avgCompletion)}%\n最近完成率：${Math.round(avgRecent)}%\n建议：\n1. ${avgCompletion < 80 ? '尝试将大目标分解为更小的可执行任务' : '设定更具挑战性的目标'}\n2. 每天早上明确今日最重要的3件事\n3. 睡前5分钟回顾当天目标完成情况`
    };
}

// 分析优势
function analyzeStrengths(reviews) {
    const strengths = reviews.map(r => r.strengths).filter(s => s && s.trim());
    
    if (strengths.length === 0) {
        return null;
    }
    
    const commonStrengths = findCommonThemes(strengths);
    
    let advice = '您的优势：';
    if (commonStrengths.length > 0) {
        advice += commonStrengths.join('、') + '\n';
    } else {
        advice += '善于发现自身的优点\n';
    }
    
    advice += '建议：\n1. 将您的优势应用到更多场景中\n2. 考虑如何用优势弥补不足\n3. 定期总结成功经验，形成方法论';
    
    return {
        type: '优势强化',
        content: advice
    };
}

// 分析不足
function analyzeWeaknesses(reviews) {
    const weaknesses = reviews.map(r => r.weaknesses).filter(w => w && w.trim());
    
    if (weaknesses.length === 0) {
        return null;
    }
    
    const commonWeaknesses = findCommonThemes(weaknesses);
    const improvements = reviews.map(r => r.improvements).filter(i => i && i.trim());
    
    let advice = '需要改进的方面：';
    if (commonWeaknesses.length > 0) {
        advice += commonWeaknesses.join('、') + '\n';
    }
    
    if (improvements.length > 0) {
        const recentImprovement = improvements[improvements.length - 1];
        advice += `您最近的改进措施：${recentImprovement}\n`;
    }
    
    advice += '建议：\n1. 为每个不足设定具体、可衡量的改进目标\n2. 每周回顾改进进展\n3. 寻求反馈，调整改进策略';
    
    return {
        type: '成长机会',
        content: advice
    };
}

// 生成习惯养成建议
function generateHabitAdvice(reviews) {
    const consistency = reviews.length >= 3 ? '很好' : reviews.length >= 1 ? '一般' : '需要加强';
    const streak = calculateStreak(reviews);
    
    let advice = `您的复盘习惯：${consistency}\n`;
    advice += `当前连续复盘天数：${streak}天\n`;
    
    if (streak >= 7) {
        advice += '恭喜您！已经养成了良好的复盘习惯。\n';
    } else if (streak >= 3) {
        advice += '您正在建立复盘习惯，继续保持！\n';
    } else {
        advice += '建议每天固定时间（如晚上9点）进行复盘，形成习惯。\n';
    }
    
    advice += '习惯养成建议：\n1. 将复盘与现有习惯绑定（如晚饭后）\n2. 设置复盘提醒\n3. 记录复盘习惯养成进度';
    
    return {
        type: '习惯养成',
        content: advice
    };
}

// 计算连续复盘天数
function calculateStreak(reviews) {
    if (reviews.length === 0) return 0;
    
    // 按日期排序
    const sortedReviews = [...reviews].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < sortedReviews.length; i++) {
        const reviewDate = new Date(sortedReviews[i].date);
        reviewDate.setHours(0, 0, 0, 0);
        
        const expectedDate = new Date(today);
        expectedDate.setDate(today.getDate() - i);
        
        if (reviewDate.getTime() === expectedDate.getTime()) {
            streak++;
        } else {
            break;
        }
    }
    
    return streak;
}

// 生成个性化时间管理建议
function generateTimeManagementAdvice(reviews) {
    // 基于复盘内容分析可能的时间管理问题
    const hasTimeManagementIssue = reviews.some(r => 
        r.weaknesses && (r.weaknesses.includes('时间') || r.weaknesses.includes('拖延'))
    );
    
    let advice = '时间管理建议：\n';
    
    if (hasTimeManagementIssue) {
        advice += '1. 尝试番茄工作法：25分钟专注工作，5分钟休息\n';
        advice += '2. 早晨规划：每天开始列出今日任务并排序\n';
        advice += '3. 设置截止时间：为每个任务设定明确的完成时间\n';
        advice += '4. 减少干扰：工作时关闭社交媒体通知';
    } else {
        advice += '1. 继续保持良好的时间管理习惯\n';
        advice += '2. 考虑使用更高级的时间管理技术，如GTD方法\n';
        advice += '3. 定期评估时间分配的合理性\n';
        advice += '4. 学会合理拒绝非核心任务';
    }
    
    advice += '\n\n四象限应用建议：\n';
    advice += '• A类（重要且紧急）：立即处理，尽量减少此类任务\n';
    advice += '• B类（重要不紧急）：规划时间定期处理，这是成长的关键\n';
    advice += '• C类（紧急不重要）：尽量委托或批量处理\n';
    advice += '• D类（不重要不紧急）：尽量避免，记录时间黑洞';
    
    return {
        type: '时间管理优化',
        content: advice
    };
}

// 生成成就回顾与激励
function generateAchievementAdvice(reviews) {
    if (reviews.length === 0) {
        return {
            type: '开始行动',
            content: '每一次记录都是成长的开始。坚持复盘，您会看到自己的进步！\n建议：\n1. 从记录今天的小成就开始\n2. 保持积极心态，关注进步而非完美\n3. 定期回顾，感受成长的力量'
        };
    }
    
    const latestReview = reviews[reviews.length - 1];
    let achievements = '最近成就：\n';
    
    if (latestReview.strengths) {
        achievements += latestReview.strengths + '\n';
    } else {
        achievements += '完成了今日复盘，这本身就是一个成就！\n';
    }
    
    achievements += '\n继续加油！您正在变得更好！\n';
    achievements += '记住：\n1. 每天进步一点点，积累起来就是巨大的成长\n2. 庆祝每一个小胜利\n3. 相信自己的潜力';
    
    return {
        type: '成就与激励',
        content: achievements
    };
}

// 查找文本中的共同主题
function findCommonThemes(texts) {
    const keywords = [
        '时间管理', '拖延', '沟通', '效率', '学习', 
        '专注', '计划', '优先级', '压力', '健康'
    ];
    
    const counts = {};
    
    keywords.forEach(keyword => {
        texts.forEach(text => {
            if (text.includes(keyword)) {
                counts[keyword] = (counts[keyword] || 0) + 1;
            }
        });
    });
    
    // 找出出现频率最高的前2个关键词
    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(entry => entry[0]);
}

// 显示智能建议
function displayAdvice(advice) {
    adviceContent.innerHTML = '';
    
    advice.forEach(item => {
        const adviceItem = document.createElement('div');
        adviceItem.className = 'advice-item';
        adviceItem.innerHTML = `
            <h4>${item.type}</h4>
            <p>${item.content.replace(/\\n/g, '<br>')}</p>
        `;
        adviceContent.appendChild(adviceItem);
    });
}

// 初始化所有功能
// 生成模拟数据（如果没有实际数据时使用）
function generateMockReviews() {
    const mockData = [];
    const today = new Date();
    
    // 生成过去8天的模拟数据
    for (let i = 7; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const formattedDate = date.toISOString().split('T')[0];
        
        // 生成随机的目标达成率，范围在60%-99%之间
        const completionPercentage = Math.floor(Math.random() * 40) + 60;
        
        mockData.push({
            date: formattedDate,
            goalCompletion: `${completionPercentage}%`,
            strengths: '工作效率高，沟通顺畅',
            weaknesses: '时间管理不够合理',
            improvements: '使用番茄工作法',
            todos: '完成项目报告'
        });
    }
    
    return mockData;
}

// 计算总体平均达成率
function calculateAverageCompletion(reviews) {
    if (reviews.length === 0) return 0;
    
    console.log('计算平均达成率，记录数:', reviews.length);
    
    const total = reviews.reduce((sum, review) => {
        let percentage = 0;
        if (review.goalCompletion) {
            try {
                if (typeof review.goalCompletion === 'string') {
                    // 从字符串中提取数字 (支持 "80%" 或 "80")
                    const match = review.goalCompletion.match(/\d+/);
                    percentage = match ? parseInt(match[0], 10) : 0;
                } else if (typeof review.goalCompletion === 'number') {
                    percentage = review.goalCompletion;
                }
                // 确保百分比在合理范围内
                percentage = Math.max(0, Math.min(100, percentage));
            } catch (e) {
                console.error('解析达成率时出错:', e, review.goalCompletion);
            }
        }
        return sum + percentage;
    }, 0);
    
    const result = Math.round(total / reviews.length);
    console.log('平均达成率结果:', result);
    return result;
}

// 计算连续复盘天数
function calculateStreakDays(reviews) {
    if (reviews.length === 0) return 0;
    
    console.log('计算连续复盘天数，记录数:', reviews.length);
    
    // 按日期排序（最新的在前）
    const sortedReviews = [...reviews].filter(review => review.date).sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 检查今天或昨天是否有复盘记录
    const latestReviewDate = new Date(sortedReviews[0].date);
    latestReviewDate.setHours(0, 0, 0, 0);
    const daysSinceLatest = Math.floor((today - latestReviewDate) / (1000 * 60 * 60 * 24));
    
    // 如果最近的记录超过2天前，连续天数为0
    if (daysSinceLatest > 1) {
        console.log('最近记录超过2天前，连续天数为0');
        return 0;
    }
    
    for (let i = 0; i < sortedReviews.length; i++) {
        const reviewDate = new Date(sortedReviews[i].date);
        reviewDate.setHours(0, 0, 0, 0);
        
        // 计算与今天的差值
        const diffDays = Math.floor((today - reviewDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays === daysSinceLatest + i) {
            streak++;
        } else {
            break;
        }
    }
    
    console.log('连续复盘天数结果:', streak);
    return streak;
}

// 计算关键改进项完成率
function calculateImprovementRate(reviews) {
    // 这里简化处理，实际应该根据改进措施的执行情况来计算
    // 目前返回一个基于目标达成率的估计值
    const avgCompletion = calculateAverageCompletion(reviews);
    return Math.round(avgCompletion * 0.8);
}

// 获取最后复盘日期的格式化显示
function getLastReviewDate(reviews) {
    if (reviews.length === 0) {
        const today = new Date();
        return `${today.getMonth() + 1}月${today.getDate()}日`;
    }
    
    const sortedReviews = [...reviews].sort((a, b) => new Date(b.date) - new Date(a.date));
    const lastDate = new Date(sortedReviews[0].date);
    return `${lastDate.getMonth() + 1}月${lastDate.getDate()}日`;
}

// 计算不同时间段的达成率
function calculateSegmentCompletion(reviews, days) {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - days);
    
    const segmentReviews = reviews.filter(review => {
        const reviewDate = new Date(review.date);
        return reviewDate >= startDate && reviewDate <= now;
    });
    
    if (segmentReviews.length === 0) return null;
    return calculateAverageCompletion(segmentReviews);
}

// 获取趋势图数据
function getTrendChartData(reviews) {
    try {
        // 确保reviews是数组
        if (!Array.isArray(reviews)) {
            console.error('getTrendChartData: reviews参数不是数组');
            return getDefaultTrendData();
        }
        
        // 获取最近7天的数据，包括今天
        const now = new Date();
        const labels = [];
        const data = [];
        
        // 创建日期到完成率的映射
        const completionMap = {};
        
        reviews.forEach(review => {
            try {
                // 确保review是有效的对象
                if (!review || typeof review !== 'object') {
                    console.warn('getTrendChartData: 无效的review对象');
                    return;
                }
                
                // 检查日期是否存在
                if (!review.date) {
                    console.warn('getTrendChartData: review缺少日期字段');
                    return;
                }
                
                // 处理不同格式的goalCompletion
                let percentage = 0;
                if (review.goalCompletion) {
                    if (typeof review.goalCompletion === 'string') {
                        // 从字符串中提取数字 (如 "80%")
                        const match = review.goalCompletion.match(/\d+/);
                        percentage = match ? parseInt(match[0], 10) : 0;
                    } else if (typeof review.goalCompletion === 'number') {
                        // 直接使用数字值
                        percentage = review.goalCompletion;
                    } else if (typeof review.goalCompletion === 'object' && review.goalCompletion.percentage !== undefined) {
                        // 支持旧格式 { percentage: 80 }
                        percentage = review.goalCompletion.percentage;
                    }
                }
                
                // 确保百分比在合理范围内
                percentage = Math.max(0, Math.min(100, percentage));
                completionMap[review.date] = percentage;
            } catch (itemError) {
                console.error('处理单个review时出错:', itemError);
            }
        });
        
        // 生成最近7天的标签和数据
        for (let i = 6; i >= 0; i--) {
            try {
                const date = new Date(now);
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                const displayDate = `${date.getMonth() + 1}月${date.getDate()}日`;
                
                labels.push(displayDate);
                data.push(completionMap[dateStr] || 0);
            } catch (dateError) {
                console.error('处理日期时出错:', dateError);
                // 即使某一天出错，也要添加默认值以保持数组长度一致
                labels.push('未知');
                data.push(0);
            }
        }
        
        // 确保返回有效的数据结构
        if (labels.length === 0 || data.length === 0) {
            console.warn('getTrendChartData: 生成的标签或数据为空');
            return getDefaultTrendData();
        }
        
        return { labels, data };
    } catch (error) {
        console.error('获取趋势图数据时发生错误:', error);
        return getDefaultTrendData();
    }
}

// 初始化目标达成率趋势图
function initCompletionTrendChart(reviews) {
    try {
        // 确保Chart全局对象存在
        if (typeof Chart === 'undefined') {
            console.error('Chart.js未加载');
            // 尝试重新加载Chart.js
            loadChartJsIfNeeded();
            return;
        }
        
        // 获取canvas元素
        const ctx = document.getElementById('completionTrendChart');
        if (!ctx) {
            console.error('Canvas元素不存在');
            return;
        }
        
        // 设置canvas尺寸
        const chartWrapper = ctx.parentElement;
        if (chartWrapper) {
            // 确保canvas有足够的高度显示图表
            ctx.style.width = '100%';
            ctx.style.height = '300px'; // 设置固定高度
            ctx.width = ctx.offsetWidth;
            ctx.height = ctx.offsetHeight || 300; // 确保有最小高度
        }
        
        const ctx2d = ctx.getContext('2d');
        if (!ctx2d) {
            console.error('无法获取Canvas 2D上下文');
            return;
        }
        
        // 获取趋势图数据
        let trendData;
        try {
            trendData = getTrendChartData(reviews);
            // 确保数据有效
            if (!trendData || !trendData.labels || !trendData.data) {
                console.error('获取趋势图数据失败');
                // 使用默认的7天数据作为备用
                trendData = getDefaultTrendData();
            }
        } catch (dataError) {
            console.error('处理趋势图数据时出错:', dataError);
            // 使用默认数据
            trendData = getDefaultTrendData();
        }
        
        // 如果图表已存在，销毁它
        if (completionTrendChart && typeof completionTrendChart.destroy === 'function') {
            try {
                completionTrendChart.destroy();
            } catch (destroyError) {
                console.error('销毁现有图表时出错:', destroyError);
                // 创建新的canvas元素替换旧的
                const newCanvas = document.createElement('canvas');
                newCanvas.id = 'completionTrendChart';
                ctx.parentNode.replaceChild(newCanvas, ctx);
                return initCompletionTrendChart(reviews); // 重新初始化
            }
        }
        
        // 创建新图表
        completionTrendChart = new Chart(ctx2d, {
            type: 'line',
            data: {
                labels: trendData.labels,
                datasets: [{
                    label: '目标达成率',
                    data: trendData.data,
                    borderColor: '#1890ff',
                    backgroundColor: 'rgba(24, 144, 255, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: '#1890ff',
                    pointBorderColor: '#fff',
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        titleColor: '#333',
                        bodyColor: '#666',
                        borderColor: '#ddd',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            },
                            stepSize: 20
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
        
        console.log('图表初始化成功');
    } catch (error) {
        console.error('初始化图表时发生错误:', error);
    }
}

// 获取默认趋势图数据作为备用
function getDefaultTrendData() {
    const now = new Date();
    const labels = [];
    const data = [];
    
    // 生成最近7天的标签和随机数据
    for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const displayDate = `${date.getMonth() + 1}月${date.getDate()}日`;
        
        labels.push(displayDate);
        // 生成60-90之间的随机数据
        data.push(Math.floor(Math.random() * 31) + 60);
    }
    
    return { labels, data };
}

// 确保Chart.js加载
function loadChartJsIfNeeded() {
    if (typeof Chart === 'undefined') {
        console.log('尝试重新加载Chart.js');
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = function() {
            console.log('Chart.js重新加载成功');
            // 尝试重新初始化图表
            const reviews = getReviews();
            updateDataOverview(reviews);
        };
        script.onerror = function() {
            console.error('Chart.js重新加载失败');
        };
        document.head.appendChild(script);
    }
}

// 获取默认趋势图数据
function getDefaultTrendData() {
    try {
        const now = new Date();
        const labels = [];
        const data = [0, 0, 0, 0, 0, 0, 0]; // 7天的默认数据
        
        // 生成最近7天的日期标签
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const displayDate = `${date.getMonth() + 1}月${date.getDate()}日`;
            labels.push(displayDate);
        }
        
        return { labels, data };
    } catch (error) {
        console.error('生成默认趋势数据时出错:', error);
        // 最基本的回退数据，保证图表能正常渲染
        return {
            labels: ['默认1', '默认2', '默认3', '默认4', '默认5', '默认6', '默认7'],
            data: [0, 0, 0, 0, 0, 0, 0]
        };
    }
}

// 更新数据概览和图表
function updateDataOverview(reviews = []) {
    try {
        // 确保reviews是数组
        if (!Array.isArray(reviews)) {
            console.error('updateDataOverview: reviews参数不是数组');
            reviews = [];
        }
        
        // 确保始终有数据可用，即使reviews为空也要生成模拟数据
        let dataToUse = [];
        
        // 首先尝试使用实际数据
        if (reviews.length > 0) {
            dataToUse = reviews;
            console.log('使用实际数据:', dataToUse.length, '条记录');
        } else {
            // 没有实际数据时，强制使用模拟数据
            dataToUse = generateMockReviews();
            console.log('使用模拟数据初始化图表');
        }
        
        // 更新各项指标
        if (totalDaysElement) totalDaysElement.textContent = dataToUse.length;
        const avgCompletion = calculateAverageCompletion(dataToUse);
        if (avgCompletionElement) avgCompletionElement.textContent = `${avgCompletion}%`;
        const streakDays = calculateStreakDays(dataToUse);
        if (streakDaysElement) streakDaysElement.textContent = `${streakDays}天`;
        const improvementRate = calculateImprovementRate(dataToUse);
        if (improvementRateElement) improvementRateElement.textContent = `${improvementRate}%`;
        if (lastReviewElement) lastReviewElement.textContent = getLastReviewDate(dataToUse);
        
        // 更新分段数据
        // 近7天 (今天到6天前)
        const recent7Days = calculateTimeRangeCompletion(dataToUse, 0, 7);
        if (segment7Element) segment7Element.textContent = recent7Days !== null ? `${recent7Days}%` : '--';
        
        // 8-14天前
        const days8to14 = calculateTimeRangeCompletion(dataToUse, 7, 14);
        if (segment14Element) segment14Element.textContent = days8to14 !== null ? `${days8to14}%` : '--';
        
        // 15-21天前
        const days15to21 = calculateTimeRangeCompletion(dataToUse, 14, 21);
        if (segment21Element) segment21Element.textContent = days15to21 !== null ? `${days15to21}%` : '--';
        
        // 22-28天前
        const days22to28 = calculateTimeRangeCompletion(dataToUse, 21, 28);
        if (segment28Element) segment28Element.textContent = days22to28 !== null ? `${days22to28}%` : '--';
        
        // 更新趋势图 - 添加额外检查确保canvas元素存在
        const canvasElement = document.getElementById('completionTrendChart');
        if (canvasElement && typeof Chart !== 'undefined') {
            try {
                // 传递完整的reviews数组给图表初始化函数
                initCompletionTrendChart(dataToUse);
            } catch (chartError) {
                console.error('更新图表时出错:', chartError);
                // 使用最基本的默认数据再次尝试初始化图表
                    try {
                        // 生成模拟reviews数组以符合函数参数要求
                        const mockReviews = generateMockReviews();
                        initCompletionTrendChart(mockReviews);
                } catch (fallbackError) {
                    console.error('使用默认数据初始化图表时也出错:', fallbackError);
                    // 作为最后的后备，在canvas元素上显示错误信息
                    const ctx = canvasElement.getContext('2d');
                    if (ctx) {
                        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
                        ctx.fillStyle = '#666';
                        ctx.font = '16px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('图表加载失败', canvasElement.width / 2, canvasElement.height / 2);
                    }
                }
            }
        } else {
            console.error('Canvas元素不存在或Chart.js未加载');
        }
    } catch (error) {
        console.error('更新数据概览时发生错误:', error);
        // 即使出错也尝试使用模拟数据初始化图表
        try {
            // 生成模拟reviews数组以符合函数参数要求
            const mockReviews = generateMockReviews();
            initCompletionTrendChart(mockReviews);
        } catch (chartError) {
            console.error('初始化图表失败:', chartError);
        }
    }
}

// 计算特定时间范围内的平均达成率
function calculateTimeRangeCompletion(reviews, startDaysAgo, endDaysAgo) {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - endDaysAgo);
    startDate.setHours(0, 0, 0, 0); // 设置为当天开始时间
    
    const endDate = new Date(now);
    endDate.setDate(now.getDate() - startDaysAgo);
    endDate.setHours(23, 59, 59, 999); // 设置为当天结束时间
    
    console.log(`计算时间范围: ${startDaysAgo}-${endDaysAgo}天前`, startDate, endDate);
    
    const rangeReviews = reviews.filter(review => {
        if (!review.date) return false;
        const reviewDate = new Date(review.date);
        reviewDate.setHours(0, 0, 0, 0); // 设置为当天开始时间进行比较
        return reviewDate >= startDate && reviewDate <= endDate;
    });
    
    console.log(`找到 ${rangeReviews.length} 条记录`);
    
    if (rangeReviews.length === 0) return null;
    
    const total = rangeReviews.reduce((sum, review) => {
        let percentage = 0;
        if (review.goalCompletion) {
            if (typeof review.goalCompletion === 'string') {
                // 从字符串中提取数字 (如 "80%" 或 "80")
                const match = review.goalCompletion.match(/\d+/);
                percentage = match ? parseInt(match[0], 10) : 0;
            } else if (typeof review.goalCompletion === 'number') {
                percentage = review.goalCompletion;
            }
        }
        return sum + percentage;
    }, 0);
    
    const result = Math.round(total / rangeReviews.length);
    console.log(`计算结果: ${result}%`);
    return result;
}

// 设置数据概览事件监听
function setupDataOverview() {
    // 刷新按钮事件
    if (refreshDataBtn) {
        refreshDataBtn.addEventListener('click', function() {
            const reviews = getReviews();
            updateDataOverview(reviews);
            showNotification('数据已刷新', 'success');
        });
    }
    
    // 分段数据切换事件
    if (segmentToggle && segmentCards) {
        segmentToggle.addEventListener('change', function() {
            segmentCards.style.display = this.checked ? 'grid' : 'none';
        });
    }
    
    // 初始更新数据
    const reviews = getReviews();
    updateDataOverview(reviews);
}

// 监听存储变化，实现实时同步
function setupStorageSync() {
    window.addEventListener('storage', function(e) {
        if (e.key === STORAGE_KEY_REVIEWS) {
            // 当存储数据变化时更新概览
            const reviews = getReviews();
            updateDataOverview(reviews);
        }
    });
}



// 时间管理功能实现
function initTimeManagement() {
    if (!scheduleItemsContainer) return;
    
    // 生成时间段（8:00-22:00）
    generateTimeSlots();
    
    // 初始化饼图
    initPieChart();
    
    // 绑定事件监听器
    setupTimeManagementEvents();
}

function generateTimeSlots() {
    // 清空容器
    scheduleItemsContainer.innerHTML = '';
    
    // 生成5:00到22:00的时间段
    for (let hour = 5; hour < 22; hour++) {
        const startTime = hour.toString().padStart(2, '0') + ':00';
        const endTime = (hour + 1).toString().padStart(2, '0') + ':00';
        // 只在第一行（5:00-6:00）显示示例数据
        const isFirstRow = hour === 5;
        const timeSlot = createTimeSlot(startTime, endTime, isFirstRow);
        scheduleItemsContainer.appendChild(timeSlot);
    }
}

function createTimeSlot(startTime, endTime, isFirstRow = false) {
    const row = document.createElement('div');
    row.className = 'schedule-item';
    
    // 根据是否为第一行设置默认值
    const taskValue = isFirstRow ? '学习英语' : '';
    const durationValue = isFirstRow ? '60' : '';
    // 只在第一行显示提示，其他行不显示任何提示
    const taskPlaceholder = isFirstRow ? '' : '';
    const durationPlaceholder = isFirstRow ? '' : '';
    
    // 时间段选择器
    const timeSlotHtml = `
        <div class="schedule-time">
            <select class="time-select">
                <option value="${startTime}-${endTime}">${startTime}-${endTime}</option>
            </select>
        </div>
        <div class="schedule-task">
            <input type="text" class="task-input" placeholder="${taskPlaceholder}" value="${taskValue}" />
        </div>
        <div class="schedule-duration">
            <input type="number" class="duration-input" placeholder="${durationPlaceholder}" min="0" max="180" value="${durationValue}" />
        </div>
    `;
    
    row.innerHTML = timeSlotHtml;
    
    // 绑定输入事件
    const taskInput = row.querySelector('.task-input');
    const durationInput = row.querySelector('.duration-input');
    
    taskInput.addEventListener('input', updateTimeStatistics);
    durationInput.addEventListener('input', updateTimeStatistics);
    
    return row;
}

// 任务类型映射
const taskTypeMap = {
    '学习英语': { color: '#1890ff' },  // 蓝色
    '学习AI': { color: '#722ed1' },    // 紫色
    '学习Python': { color: '#faad14' }, // 黄色
    '学习营销': { color: '#f5222d' },   // 红色
    '休息放松': { color: '#52c41a' },    // 绿色
    '看书': { color: '#ff7d00' }         // 橙色
};

function getTaskType(taskName) {
    if (!taskName) return null;
    
    const lowerName = taskName.toLowerCase();
    for (const [type, config] of Object.entries(taskTypeMap)) {
        if (lowerName.includes(type.toLowerCase())) {
            return { type, config };
        }
    }
    // 删除'其他'选项，当找不到匹配类型时返回'休息放松'
    return { type: '休息放松', config: taskTypeMap['休息放松'] };
}

function updateTimeStatistics() {
    const scheduleRows = document.querySelectorAll('.schedule-item');
    const typeDurations = {};
    let totalMinutes = 0;
    let taskCount = 0;
    let restRelaxExtraMinutes = 0; // 存储需要额外添加的休息放松时间
    let studyTotalMinutes = 0; // 存储学习类任务总时长
    
    // 定义学习类任务类型
    const studyTypes = ['学习英语', '学习AI', '学习Python', '学习营销', '看书'];
    
    // 计算各类型任务的时长和剩余时间
    scheduleRows.forEach(row => {
        const timeSelect = row.querySelector('.time-select');
        const taskInput = row.querySelector('.task-input');
        const durationInput = row.querySelector('.duration-input');
        
        // 获取时间段信息
        const timeSlotValue = timeSelect.value;
        // 解析时间段，计算该时间段的总分钟数（通常为60分钟）
        const timeSlotMinutes = 60; // 假设每个时间段都是60分钟
        
        const taskName = taskInput.value.trim();
        const duration = parseInt(durationInput.value) || 0;
        
        if (taskName && duration > 0) {
            const { type } = getTaskType(taskName);
            // 确保只添加有效的任务类型，不包括"其他"
            if (type !== '其他') {
                typeDurations[type] = (typeDurations[type] || 0) + duration;
                totalMinutes += duration;
                taskCount++;
                
                // 如果是学习类任务，累加到学习总时长
                if (studyTypes.includes(type)) {
                    studyTotalMinutes += duration;
                }
            }
            
            // 计算剩余时间并累加到休息放松类型
            const remainingMinutes = Math.max(0, timeSlotMinutes - duration);
            if (remainingMinutes > 0) {
                restRelaxExtraMinutes += remainingMinutes;
            }
        } else if (duration === 0 && timeSlotMinutes > 0) {
            // 如果没有任务或时长为0，则整个时间段视为休息放松
            restRelaxExtraMinutes += timeSlotMinutes;
        }
    });
    
    // 添加额外的休息放松时间
    const restType = '休息放松';
    typeDurations[restType] = (typeDurations[restType] || 0) + restRelaxExtraMinutes;
    totalMinutes += restRelaxExtraMinutes;
    
    // 更新总时长、任务数量和学习总占比
    updateTotalStatistics(totalMinutes, taskCount, studyTotalMinutes);
    
    // 更新饼图
    updatePieChart(typeDurations, totalMinutes);
}

function updateTotalStatistics(totalMinutes, taskCount, studyTotalMinutes) {
    if (totalDurationElement) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        totalDurationElement.textContent = `${totalMinutes}分钟${hours > 0 ? `(${hours}小时${minutes > 0 ? minutes + '分钟' : ''})` : ''}`;
        
        // 计算学习总占比并显示
        let studyPercentage = 0;
        if (totalMinutes > 0) {
            studyPercentage = ((studyTotalMinutes / totalMinutes) * 100).toFixed(1);
        }
        
        // 计算学习总时长的小时和分钟
        const studyHours = Math.floor(studyTotalMinutes / 60);
        const studyMinutes = studyTotalMinutes % 60;
        
        // 检查是否已有学习占比元素，如果没有则创建
        let studyPercentageElement = document.getElementById('study-percentage');
        if (!studyPercentageElement) {
            studyPercentageElement = document.createElement('span');
            studyPercentageElement.id = 'study-percentage';
            studyPercentageElement.style.display = 'block';
            studyPercentageElement.style.marginTop = '5px';
            studyPercentageElement.style.color = '#1890ff';
            totalDurationElement.parentNode.appendChild(studyPercentageElement);
        }
        
        // 显示格式：学习总时长：XX分钟（XX小时），占比XX%
        studyPercentageElement.textContent = `学习总时长：${studyTotalMinutes}分钟${studyHours > 0 ? `(${studyHours}小时${studyMinutes > 0 ? studyMinutes + '分钟' : ''})` : ''}，占比${studyPercentage}%`;
    }
    
    if (totalTasksElement) {
        totalTasksElement.textContent = taskCount;
    }
}

function initPieChart() {
    const ctx = document.getElementById('timeDistributionChart');
    if (!ctx) return;
    
    // 销毁已存在的图表
    if (timeDistributionChart) {
        timeDistributionChart.destroy();
    }
    
    timeDistributionChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [],
                borderColor: [],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                            return `${label}: ${value}分钟 (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function updatePieChart(typeDurations, totalMinutes) {
    if (!timeDistributionChart || !Object.keys(typeDurations).length) return;
    
    const labels = [];
    const data = [];
    const backgroundColor = [];
    const borderColor = [];
    const externalLabels = [];
    
    for (const [type, duration] of Object.entries(typeDurations)) {
        labels.push(type);
        data.push(duration);
        
        // 获取颜色 - 精确匹配任务类型
        let color = taskTypeMap[type]?.color;
        
        // 如果直接匹配失败，尝试模糊匹配
        if (!color) {
            const lowerType = type.toLowerCase();
            for (const [mapType, config] of Object.entries(taskTypeMap)) {
                if (lowerType.includes(mapType.toLowerCase())) {
                    color = config.color;
                    break;
                }
            }
        }
        
        // 如果仍然没有找到颜色，使用默认颜色
        if (!color) {
            color = '#8c8c8c';
        }
        backgroundColor.push(color + '80'); // 添加透明度
        borderColor.push(color);
        
        // 计算百分比
        const percentage = Math.round((duration / totalMinutes) * 100);
        externalLabels.push(`${type}/${duration}分钟/${percentage}%`);
    }
    
    // 更新图表数据
    timeDistributionChart.data.labels = externalLabels;
    timeDistributionChart.data.datasets[0].data = data;
    timeDistributionChart.data.datasets[0].backgroundColor = backgroundColor;
    timeDistributionChart.data.datasets[0].borderColor = borderColor;
    
    // 更新图表选项，调整标签位置
    timeDistributionChart.options.plugins.legend.display = true;
    timeDistributionChart.options.plugins.legend.position = 'right';
    timeDistributionChart.options.plugins.legend.labels = {
        font: {
            size: 12
        },
        padding: 10
    };
    
    // 更新图表
    timeDistributionChart.update();
}

function setupTimeManagementEvents() {
    // 初始化时更新统计
    updateTimeStatistics();
    
    // 监听DOM变化，以便在动态添加行时绑定事件
    const observer = new MutationObserver(() => {
        updateTimeStatistics();
        // 为新添加的输入框绑定事件
        bindInputEvents();
    });
    
    if (scheduleItemsContainer) {
        observer.observe(scheduleItemsContainer, {
            childList: true,
            subtree: true
        });
    }
    
    // 绑定输入框事件
    function bindInputEvents() {
        const taskInputs = document.querySelectorAll('.task-input');
        const durationInputs = document.querySelectorAll('.duration-input');
        
        taskInputs.forEach(input => {
            input.addEventListener('input', updateTimeStatistics);
            input.addEventListener('change', updateTimeStatistics);
        });
        
        durationInputs.forEach(input => {
            input.addEventListener('input', updateTimeStatistics);
            input.addEventListener('change', updateTimeStatistics);
        });
    }
    
    // 初始绑定事件
    bindInputEvents();
}

function init() {
    try {
        setupTabs();
        setupProgressBar();
        setupQuadrants();
        setupReviewForm();
        setupPlanForm();
        setupDetailModal();
        setupHistoryControls();
        setupAdviceGenerator();
        displayHistory();
        setupDataOverview();
        setupStorageSync();
        initTimeManagement();
        
        // 设置默认选中当月
        const currentMonth = today.toISOString().substring(0, 7);
        if (historyFilter) {
            historyFilter.value = currentMonth;
        }
        
        // 添加页面加载完成提示
        showNotification('智能复盘助手已加载完成', 'success');
    } catch (error) {
        console.error('应用初始化失败:', error);
        showNotification('应用加载失败，请刷新页面重试', 'error');
    }
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', init);

// 添加详情区域和通知的样式
const style = document.createElement('style');
style.textContent = `
    .detail-section {
        margin-bottom: 20px;
        padding-bottom: 20px;
        border-bottom: 1px solid #e8e8e8;
    }
    .detail-section:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
    }
    .detail-section h4 {
        color: #1890ff;
        margin-bottom: 10px;
        font-size: 16px;
    }
    .no-data {
        text-align: center;
        color: #8c8c8c;
        padding: 40px;
        font-style: italic;
    }
    /* 通知样式 */
    .notification {
        position: fixed;
        top: 20px;
        right: -300px;
        padding: 12px 24px;
        border-radius: 4px;
        color: white;
        font-size: 14px;
        z-index: 10000;
        transition: right 0.3s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .notification.show {
        right: 20px;
    }
    .notification-success {
        background-color: #52c41a;
    }
    .notification-error {
        background-color: #f5222d;
    }
    .notification-warning {
        background-color: #faad14;
    }
    .notification-info {
        background-color: #1890ff;
    }
`;
document.head.appendChild(style);