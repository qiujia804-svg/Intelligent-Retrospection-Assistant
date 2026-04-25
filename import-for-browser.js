// 浏览器端导入脚本
// 【修复】修改为只在数据不存在时才导入默认数据，避免覆盖用户现有数据
document.addEventListener('DOMContentLoaded', function() {
    console.log('检查数据导入状态...');
    
    // 检查是否已有复盘数据
    const existingReviews = localStorage.getItem('smart_review_assistant_reviews');
    const existingPlans = localStorage.getItem('smart_review_assistant_plans');
    
    // 如果已有数据，不要覆盖
    if (existingReviews) {
        console.log('已有复盘数据，跳过导入:', JSON.parse(existingReviews).length, '条记录');
    } else {
        // 只有在没有数据时才导入默认空数据
        const jsonData = {"reviews":[],"plans":[]};
        localStorage.setItem('smart_review_assistant_reviews', JSON.stringify(jsonData.reviews));
        console.log('初始化复盘记录存储');
    }
    
    if (existingPlans) {
        console.log('已有计划数据，跳过导入');
    } else {
        const jsonData = {"reviews":[],"plans":[]};
        if (jsonData.plans && Array.isArray(jsonData.plans)) {
            localStorage.setItem('smart_review_assistant_plans', JSON.stringify(jsonData.plans));
            console.log('初始化计划记录存储');
        }
    }
    
    // 刷新数据概览
    if (typeof updateDataOverview === 'function') {
        // 等待一段时间确保所有变量都已初始化
        setTimeout(function() {
            try {
                updateDataOverview();
            } catch (error) {
                console.error('刷新数据概览时出错:', error);
            }
        }, 500);
    }
    
});
