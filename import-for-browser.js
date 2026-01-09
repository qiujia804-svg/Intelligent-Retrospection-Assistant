// 浏览器端导入脚本
document.addEventListener('DOMContentLoaded', function() {
    console.log('开始导入数据...');
    const jsonData = {"reviews":[],"plans":[]};
    
    // 保存数据到localStorage
    localStorage.setItem('smart_review_assistant_reviews', JSON.stringify(jsonData.reviews));
    console.log('成功导入复盘记录');
    
    if (jsonData.plans && Array.isArray(jsonData.plans)) {
        localStorage.setItem('smart_review_assistant_plans', JSON.stringify(jsonData.plans));
        console.log('成功导入计划记录');
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
