// 测试修复功能的脚本
// 1. 测试跨月连续天数计算
// 2. 测试总复盘天数计算
// 3. 测试实时数据更新
// 4. 测试折线图联动

console.log('=== 测试复盘统计功能修复 ===');

// 模拟一些测试数据，包括跨月情况
const testReviews = [
    { date: '2025-12-30', goalCompletion: { percentage: 80 } },
    { date: '2025-12-31', goalCompletion: { percentage: 85 } },
    { date: '2026-01-01', goalCompletion: { percentage: 90 } },
    { date: '2026-01-02', goalCompletion: { percentage: 95 } },
    { date: '2026-01-03', goalCompletion: { percentage: 100 } }
];

// 测试1：跨月连续天数计算
console.log('\n1. 测试跨月连续天数计算：');
console.log('测试数据：', testReviews.map(r => r.date));
const streakDays = calculateStreakDays(testReviews);
console.log('计算结果：', streakDays, '天');
console.log('预期结果：', 5, '天');
console.log('测试通过：', streakDays === 5);

// 测试2：总复盘天数计算
console.log('\n2. 测试总复盘天数计算：');
const uniqueDates = new Set();
testReviews.forEach(review => {
    if (review.date) {
        const dateStr = review.date.split('T')[0];
        uniqueDates.add(dateStr);
    }
});
const totalReviewDays = uniqueDates.size;
console.log('计算结果：', totalReviewDays, '天');
console.log('预期结果：', 5, '天');
console.log('测试通过：', totalReviewDays === 5);

// 测试3：模拟添加1月4日的数据
console.log('\n3. 测试添加新数据后的数据更新：');
const updatedReviews = [...testReviews, { date: '2026-01-04', goalCompletion: { percentage: 95 } }];
console.log('添加后的数据：', updatedReviews.map(r => r.date));

// 测试总复盘天数
const updatedUniqueDates = new Set();
updatedReviews.forEach(review => {
    if (review.date) {
        const dateStr = review.date.split('T')[0];
        updatedUniqueDates.add(dateStr);
    }
});
const updatedTotalReviewDays = updatedUniqueDates.size;
console.log('更新后总复盘天数：', updatedTotalReviewDays, '天');
console.log('预期结果：', 6, '天');
console.log('测试通过：', updatedTotalReviewDays === 6);

// 测试连续天数
const updatedStreakDays = calculateStreakDays(updatedReviews);
console.log('更新后连续天数：', updatedStreakDays, '天');
console.log('预期结果：', 6, '天');
console.log('测试通过：', updatedStreakDays === 6);

// 测试4：折线图数据生成
console.log('\n4. 测试折线图数据生成：');
const trendData = getTrendChartData(updatedReviews);
console.log('折线图标签：', trendData.labels);
console.log('折线图数据：', trendData.data);
console.log('测试通过：', trendData.labels.length === 7 && trendData.data.length === 7);

console.log('\n=== 测试完成 ===');
