// 导入数据到localStorage的脚本
const fs = require('fs');
const path = require('path');

// 读取JSON文件
const jsonPath = path.join(__dirname, 'shuju', 'smart-review-data-2026-01-04.json');
const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// 模拟localStorage（因为Node.js中没有localStorage）
const localStorage = {
    data: {},
    setItem: function(key, value) {
        this.data[key] = value;
        console.log(`[localStorage] 存储 ${key}: ${value.substring(0, 100)}...`);
    },
    getItem: function(key) {
        return this.data[key];
    }
};

// 定义存储键
const STORAGE_KEY_REVIEWS = 'smart_review_assistant_reviews';
const STORAGE_KEY_PLANS = 'smart_review_assistant_plans';

// 保存数据到localStorage
console.log('开始导入数据...');
localStorage.setItem(STORAGE_KEY_REVIEWS, JSON.stringify(jsonData.reviews));
console.log(`成功导入 ${jsonData.reviews.length} 条复盘记录`);

if (jsonData.plans && Array.isArray(jsonData.plans)) {
    localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(jsonData.plans));
    console.log(`成功导入 ${jsonData.plans.length} 条计划记录`);
}

// 验证导入结果
const importedReviews = JSON.parse(localStorage.getItem(STORAGE_KEY_REVIEWS));
console.log(`\n导入验证：`);
console.log(`- 总复盘天数：${new Set(importedReviews.map(r => r.date)).size} 天`);
console.log(`- 日期范围：${importedReviews.map(r => r.date).sort()[0]} 至 ${importedReviews.map(r => r.date).sort().pop()}`);

// 检查指定日期范围的数据
const startDate = new Date('2025-11-14');
const endDate = new Date('2026-01-03');
const filteredReviews = importedReviews.filter(r => {
    const reviewDate = new Date(r.date);
    return reviewDate >= startDate && reviewDate <= endDate;
});
const uniqueFilteredDates = new Set(filteredReviews.map(r => r.date));
console.log(`\n2025-11-14 至 2026-01-03 期间：`);
console.log(`- 复盘记录数：${filteredReviews.length} 条`);
console.log(`- 复盘天数：${uniqueFilteredDates.size} 天`);

// 将数据写入到一个可用于浏览器的脚本
const browserScriptPath = path.join(__dirname, 'import-for-browser.js');
const browserScript = `
// 浏览器端导入脚本
document.addEventListener('DOMContentLoaded', function() {
    console.log('开始导入数据...');
    const jsonData = ${JSON.stringify(jsonData)};
    
    // 保存数据到localStorage
    localStorage.setItem('${STORAGE_KEY_REVIEWS}', JSON.stringify(jsonData.reviews));
    console.log('成功导入复盘记录');
    
    if (jsonData.plans && Array.isArray(jsonData.plans)) {
        localStorage.setItem('${STORAGE_KEY_PLANS}', JSON.stringify(jsonData.plans));
        console.log('成功导入计划记录');
    }
    
    // 刷新数据概览
    if (typeof updateDataOverview === 'function') {
        updateDataOverview();
    }
    
    alert('数据导入成功！从2025-11-14到2026-01-03期间，总复盘天数为${uniqueFilteredDates.size}天。');
});
`;

fs.writeFileSync(browserScriptPath, browserScript);
console.log(`\n浏览器端导入脚本已生成：${browserScriptPath}`);
console.log('请将此脚本在浏览器控制台中执行，或通过script标签引入。');
