/**
 * 智能复盘助手 - 数据持久化与离线同步模块
 * 第二阶段优化：IndexedDB + 离线同步 + 自动备份
 */

(function() {
    'use strict';

    // ==================== 配置常量 ====================
    const DB_CONFIG = {
        name: 'SmartReviewAssistantDB',
        version: 1,
        stores: {
            reviews: 'reviews',
            plans: 'plans',
            syncQueue: 'syncQueue',
            settings: 'settings'
        }
    };

    const STORAGE_KEYS = {
        reviews: 'smart_review_assistant_reviews',
        plans: 'smart_review_assistant_plans',
        lastSync: 'last_sync_time',
        pendingSync: 'pending_sync_data'
    };

    // ==================== IndexedDB 初始化 ====================
    let db = null;
    let dbReady = false;

    /**
     * 初始化 IndexedDB 数据库
     */
    function initDatabase() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                console.warn('[DataStorage] IndexedDB 不支持，将使用 localStorage');
                resolve(false);
                return;
            }

            const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

            request.onerror = (event) => {
                console.error('[DataStorage] IndexedDB 打开失败:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                dbReady = true;
                console.log('[DataStorage] IndexedDB 初始化成功');

                // 数据库打开后，进行数据迁移
                migrateFromLocalStorage();
                resolve(true);
            };

            request.onupgradeneeded = (event) => {
                const database = event.target.result;
                console.log('[DataStorage] 创建/升级数据库结构');

                // 创建复盘记录存储
                if (!database.objectStoreNames.contains(DB_CONFIG.stores.reviews)) {
                    const reviewStore = database.createObjectStore(DB_CONFIG.stores.reviews, { keyPath: 'date' });
                    reviewStore.createIndex('date', 'date', { unique: true });
                    reviewStore.createIndex('syncStatus', 'syncStatus', { unique: false });
                    console.log('[DataStorage] 创建 reviews 存储');
                }

                // 创建规划记录存储
                if (!database.objectStoreNames.contains(DB_CONFIG.stores.plans)) {
                    const planStore = database.createObjectStore(DB_CONFIG.stores.plans, { keyPath: 'date' });
                    planStore.createIndex('date', 'date', { unique: true });
                    planStore.createIndex('syncStatus', 'syncStatus', { unique: false });
                    console.log('[DataStorage] 创建 plans 存储');
                }

                // 创建同步队列存储
                if (!database.objectStoreNames.contains(DB_CONFIG.stores.syncQueue)) {
                    const syncStore = database.createObjectStore(DB_CONFIG.stores.syncQueue, { keyPath: 'id', autoIncrement: true });
                    syncStore.createIndex('type', 'type', { unique: false });
                    syncStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('[DataStorage] 创建 syncQueue 存储');
                }

                // 创建设置存储
                if (!database.objectStoreNames.contains(DB_CONFIG.stores.settings)) {
                    database.createObjectStore(DB_CONFIG.stores.settings, { keyPath: 'key' });
                    console.log('[DataStorage] 创建 settings 存储');
                }
            };
        });
    }

    /**
     * 从 localStorage 迁移数据到 IndexedDB
     */
    async function migrateFromLocalStorage() {
        if (!dbReady || !db) return;

        try {
            // 迁移复盘数据
            const reviewsJson = localStorage.getItem(STORAGE_KEYS.reviews);
            if (reviewsJson) {
                const reviews = JSON.parse(reviewsJson);
                if (Array.isArray(reviews) && reviews.length > 0) {
                    for (const review of reviews) {
                        await saveToIndexedDB(DB_CONFIG.stores.reviews, {
                            ...review,
                            syncStatus: 'synced',
                            lastModified: Date.now()
                        });
                    }
                    console.log('[DataStorage] 迁移了', reviews.length, '条复盘记录到 IndexedDB');
                }
            }

            // 迁移规划数据
            const plansJson = localStorage.getItem(STORAGE_KEYS.plans);
            if (plansJson) {
                const plans = JSON.parse(plansJson);
                if (Array.isArray(plans) && plans.length > 0) {
                    for (const plan of plans) {
                        await saveToIndexedDB(DB_CONFIG.stores.plans, {
                            ...plan,
                            syncStatus: 'synced',
                            lastModified: Date.now()
                        });
                    }
                    console.log('[DataStorage] 迁移了', plans.length, '条规划记录到 IndexedDB');
                }
            }
        } catch (error) {
            console.error('[DataStorage] 数据迁移失败:', error);
        }
    }

    // ==================== IndexedDB 操作函数 ====================

    /**
     * 保存数据到 IndexedDB
     */
    function saveToIndexedDB(storeName, data) {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject(new Error('数据库未初始化'));
                return;
            }

            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve(true);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * 从 IndexedDB 读取数据
     */
    function getFromIndexedDB(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject(new Error('数据库未初始化'));
                return;
            }

            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * 获取存储中的所有数据
     */
    function getAllFromIndexedDB(storeName) {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject(new Error('数据库未初始化'));
                return;
            }

            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * 从 IndexedDB 删除数据
     */
    function deleteFromIndexedDB(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject(new Error('数据库未初始化'));
                return;
            }

            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve(true);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    // ==================== 统一数据存储接口 ====================

    /**
     * 保存复盘数据 - 同时写入 IndexedDB 和 localStorage
     */
    async function saveReviewData(review) {
        const reviewWithMeta = {
            ...review,
            lastModified: Date.now(),
            syncStatus: navigator.onLine ? 'synced' : 'pending'
        };

        // 尝试保存到 IndexedDB
        if (dbReady) {
            try {
                await saveToIndexedDB(DB_CONFIG.stores.reviews, reviewWithMeta);
                console.log('[DataStorage] 复盘数据已保存到 IndexedDB:', review.date);
            } catch (error) {
                console.error('[DataStorage] IndexedDB 保存失败:', error);
            }
        }

        // 同时保存到 localStorage 作为备份
        try {
            const reviews = JSON.parse(localStorage.getItem(STORAGE_KEYS.reviews) || '[]');
            const existingIndex = reviews.findIndex(r => r.date === review.date);

            if (existingIndex >= 0) {
                reviews[existingIndex] = reviewWithMeta;
            } else {
                reviews.push(reviewWithMeta);
            }

            localStorage.setItem(STORAGE_KEYS.reviews, JSON.stringify(reviews));
            console.log('[DataStorage] 复盘数据已备份到 localStorage');
        } catch (error) {
            console.error('[DataStorage] localStorage 保存失败:', error);
        }

        // 如果离线，添加到同步队列
        if (!navigator.onLine) {
            addToSyncQueue('review', review.date, reviewWithMeta);
        }

        return true;
    }

    /**
     * 获取所有复盘数据 - 优先从 IndexedDB 读取
     */
    async function getReviewData() {
        // 优先尝试从 IndexedDB 获取
        if (dbReady) {
            try {
                const reviews = await getAllFromIndexedDB(DB_CONFIG.stores.reviews);
                if (reviews && reviews.length > 0) {
                    console.log('[DataStorage] 从 IndexedDB 读取了', reviews.length, '条复盘记录');
                    return reviews;
                }
            } catch (error) {
                console.error('[DataStorage] IndexedDB 读取失败:', error);
            }
        }

        // 回退到 localStorage
        try {
            const reviews = JSON.parse(localStorage.getItem(STORAGE_KEYS.reviews) || '[]');
            console.log('[DataStorage] 从 localStorage 读取了', reviews.length, '条复盘记录');
            return reviews;
        } catch (error) {
            console.error('[DataStorage] localStorage 读取失败:', error);
            return [];
        }
    }

    /**
     * 保存规划数据
     */
    async function savePlanData(plan) {
        const planWithMeta = {
            ...plan,
            lastModified: Date.now(),
            syncStatus: navigator.onLine ? 'synced' : 'pending'
        };

        // 保存到 IndexedDB
        if (dbReady) {
            try {
                await saveToIndexedDB(DB_CONFIG.stores.plans, planWithMeta);
                console.log('[DataStorage] 规划数据已保存到 IndexedDB:', plan.date);
            } catch (error) {
                console.error('[DataStorage] IndexedDB 保存失败:', error);
            }
        }

        // 备份到 localStorage
        try {
            const plans = JSON.parse(localStorage.getItem(STORAGE_KEYS.plans) || '[]');
            const existingIndex = plans.findIndex(p => p.date === plan.date);

            if (existingIndex >= 0) {
                plans[existingIndex] = planWithMeta;
            } else {
                plans.push(planWithMeta);
            }

            localStorage.setItem(STORAGE_KEYS.plans, JSON.stringify(plans));
        } catch (error) {
            console.error('[DataStorage] localStorage 保存失败:', error);
        }

        // 离线时添加到同步队列
        if (!navigator.onLine) {
            addToSyncQueue('plan', plan.date, planWithMeta);
        }

        return true;
    }

    /**
     * 获取所有规划数据
     */
    async function getPlanData() {
        if (dbReady) {
            try {
                const plans = await getAllFromIndexedDB(DB_CONFIG.stores.plans);
                if (plans && plans.length > 0) {
                    return plans;
                }
            } catch (error) {
                console.error('[DataStorage] IndexedDB 读取失败:', error);
            }
        }

        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.plans) || '[]');
        } catch (error) {
            return [];
        }
    }

    // ==================== 离线同步队列 ====================

    /**
     * 添加数据到同步队列
     */
    async function addToSyncQueue(type, key, data) {
        const syncItem = {
            type,
            key,
            data,
            timestamp: Date.now(),
            retryCount: 0
        };

        if (dbReady) {
            try {
                await saveToIndexedDB(DB_CONFIG.stores.syncQueue, syncItem);
                console.log('[DataStorage] 已添加到同步队列:', type, key);
            } catch (error) {
                console.error('[DataStorage] 同步队列添加失败:', error);
            }
        }

        // 同时保存到 localStorage 作为备份
        try {
            const queue = JSON.parse(localStorage.getItem(STORAGE_KEYS.pendingSync) || '[]');
            queue.push(syncItem);
            localStorage.setItem(STORAGE_KEYS.pendingSync, JSON.stringify(queue));
        } catch (error) {
            console.error('[DataStorage] 同步队列备份失败:', error);
        }
    }

    /**
     * 处理同步队列 - 在联网时调用
     */
    async function processSyncQueue() {
        if (!navigator.onLine) {
            console.log('[DataStorage] 当前离线，跳过同步');
            return;
        }

        console.log('[DataStorage] 开始处理同步队列...');

        let queue = [];

        // 从 IndexedDB 获取同步队列
        if (dbReady) {
            try {
                queue = await getAllFromIndexedDB(DB_CONFIG.stores.syncQueue);
            } catch (error) {
                console.error('[DataStorage] 获取同步队列失败:', error);
            }
        }

        // 如果 IndexedDB 队列为空，尝试从 localStorage 获取
        if (queue.length === 0) {
            try {
                queue = JSON.parse(localStorage.getItem(STORAGE_KEYS.pendingSync) || '[]');
            } catch (error) {
                queue = [];
            }
        }

        if (queue.length === 0) {
            console.log('[DataStorage] 同步队列为空');
            return;
        }

        console.log('[DataStorage] 发现', queue.length, '条待同步数据');

        // 处理每条同步数据
        for (const item of queue) {
            try {
                // 更新数据状态为已同步
                if (item.type === 'review') {
                    item.data.syncStatus = 'synced';
                    await saveReviewData(item.data);
                } else if (item.type === 'plan') {
                    item.data.syncStatus = 'synced';
                    await savePlanData(item.data);
                }

                // 从队列中移除
                if (dbReady && item.id) {
                    await deleteFromIndexedDB(DB_CONFIG.stores.syncQueue, item.id);
                }

                console.log('[DataStorage] 已同步:', item.type, item.key);
            } catch (error) {
                console.error('[DataStorage] 同步失败:', item.type, item.key, error);
            }
        }

        // 清空 localStorage 中的同步队列
        localStorage.removeItem(STORAGE_KEYS.pendingSync);

        // 更新最后同步时间
        localStorage.setItem(STORAGE_KEYS.lastSync, Date.now().toString());

        console.log('[DataStorage] 同步队列处理完成');

        // 显示同步完成提示
        if (typeof window.showMobileToast === 'function') {
            window.showMobileToast('数据同步完成', 'success');
        }
    }

    // ==================== 网络状态监听 ====================

    /**
     * 初始化网络状态监听
     */
    function initNetworkListener() {
        // 联网时自动同步
        window.addEventListener('online', () => {
            console.log('[DataStorage] 网络已恢复，开始同步...');
            setTimeout(processSyncQueue, 1000);
        });

        // 离线时提示
        window.addEventListener('offline', () => {
            console.log('[DataStorage] 网络已断开，数据将在恢复连接后同步');
        });

        // 页面可见时检查同步
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && navigator.onLine) {
                processSyncQueue();
            }
        });
    }

    // ==================== Service Worker 同步支持 ====================

    /**
     * 注册后台同步
     */
    async function registerBackgroundSync(tag) {
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            try {
                const registration = await navigator.serviceWorker.ready;
                await registration.sync.register(tag);
                console.log('[DataStorage] 后台同步已注册:', tag);
            } catch (error) {
                console.error('[DataStorage] 后台同步注册失败:', error);
            }
        }
    }

    // ==================== 数据备份与恢复 ====================

    /**
     * 导出所有数据
     */
    async function exportAllData() {
        const reviews = await getReviewData();
        const plans = await getPlanData();

        const exportData = {
            version: '2.0',
            exportDate: new Date().toISOString(),
            reviews,
            plans,
            settings: {
                customTags: localStorage.getItem('custom_tags_v1'),
                vipStatus: localStorage.getItem('is_premium'),
                trialStartTime: localStorage.getItem('vip_trial_start_time')
            }
        };

        return exportData;
    }

    /**
     * 导入数据
     */
    async function importAllData(data) {
        if (!data || !data.reviews) {
            throw new Error('无效的导入数据格式');
        }

        // 导入复盘数据
        for (const review of data.reviews) {
            await saveReviewData(review);
        }

        // 导入规划数据
        if (data.plans) {
            for (const plan of data.plans) {
                await savePlanData(plan);
            }
        }

        // 导入设置
        if (data.settings) {
            if (data.settings.customTags) {
                localStorage.setItem('custom_tags_v1', data.settings.customTags);
            }
        }

        console.log('[DataStorage] 数据导入完成');
        return true;
    }

    // ==================== 数据清理 ====================

    /**
     * 清理过期数据（保留最近365天）
     */
    async function cleanupOldData() {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const cutoffDate = oneYearAgo.toISOString().split('T')[0];

        if (dbReady) {
            try {
                const reviews = await getAllFromIndexedDB(DB_CONFIG.stores.reviews);
                const oldReviews = reviews.filter(r => r.date < cutoffDate);

                for (const review of oldReviews) {
                    await deleteFromIndexedDB(DB_CONFIG.stores.reviews, review.date);
                }

                if (oldReviews.length > 0) {
                    console.log('[DataStorage] 已清理', oldReviews.length, '条过期数据');
                }
            } catch (error) {
                console.error('[DataStorage] 数据清理失败:', error);
            }
        }
    }

    // ==================== 数据完整性检查 ====================

    /**
     * 检查并修复数据完整性
     */
    async function checkDataIntegrity() {
        console.log('[DataStorage] 开始数据完整性检查...');

        // 比较 IndexedDB 和 localStorage 数据
        if (dbReady) {
            const idbReviews = await getAllFromIndexedDB(DB_CONFIG.stores.reviews);
            const lsReviews = JSON.parse(localStorage.getItem(STORAGE_KEYS.reviews) || '[]');

            // 如果 IndexedDB 数据少于 localStorage，进行补充
            if (idbReviews.length < lsReviews.length) {
                console.log('[DataStorage] 检测到数据不一致，进行修复...');
                const idbDates = new Set(idbReviews.map(r => r.date));

                for (const review of lsReviews) {
                    if (!idbDates.has(review.date)) {
                        await saveToIndexedDB(DB_CONFIG.stores.reviews, {
                            ...review,
                            syncStatus: 'synced',
                            lastModified: Date.now()
                        });
                    }
                }
                console.log('[DataStorage] 数据修复完成');
            }
        }
    }

    // ==================== 初始化 ====================

    /**
     * 初始化数据存储模块
     */
    async function init() {
        console.log('[DataStorage] 初始化数据存储模块...');

        try {
            await initDatabase();
            initNetworkListener();

            // 延迟执行数据检查
            setTimeout(async () => {
                await checkDataIntegrity();
                await cleanupOldData();

                // 如果在线，处理同步队列
                if (navigator.onLine) {
                    await processSyncQueue();
                }
            }, 2000);

            console.log('[DataStorage] 数据存储模块初始化完成');
        } catch (error) {
            console.error('[DataStorage] 初始化失败:', error);
        }
    }

    // ==================== 暴露全局接口 ====================

    window.DataStorage = {
        init,
        saveReview: saveReviewData,
        getReviews: getReviewData,
        savePlan: savePlanData,
        getPlans: getPlanData,
        processSyncQueue,
        registerBackgroundSync,
        exportAllData,
        importAllData,
        checkDataIntegrity,
        cleanupOldData,
        isReady: () => dbReady
    };

    // 页面加载时自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('[DataStorage] 数据存储模块已加载');

})();
