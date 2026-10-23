/**
 * 智能复盘助手 - Service Worker
 * 提供离线缓存和后台同步功能
 */

const CACHE_NAME = 'retrospection-assistant-v1.0.67';
const STATIC_CACHE = 'static-v1.0.67';
const DYNAMIC_CACHE = 'dynamic-v1.0.67';

// 需要预缓存的静态资源
// 注意：CDN 地址必须与 index.html 中实际 <script src> 使用的地址完全一致，
// 否则缓存里存的是另一个 URL，离线时页面依然取不到资源。
const STATIC_ASSETS = [
  './vendor/workbuddy-cloud-sdk.js',
  './vendor/chart.umd.js',
  './vendor/echarts.min.js',
  './',
  './index.html',
  './review-assistant.css',
  './mobile.css',
  './review-assistant.js',
  './time-tools.js',
  './pomodoro.html',
  './pomodoro.js',
  './time-tools.css',
  './ai-plan-core.js',
  './ai-planner.js',
  './ai-plan-voice.js',
  './ai-review-core.js',
  './ai-review.js',
  './ai-coach.js',
  './auth-state.js',
  './cloud-sync.js',
  './cloud-auth.js',
  './cloud-member.js',
  './feedback-cloud.js',
  './usage-tracker.js',
  './mobile-segments.js',
  './ai-planner.css',
  './data-storage.js',
  './commercial-system.js',
  './manifest.json',
  './offline.html',
  './images/pay-wechat.jpg',
  './images/pay-alipay-v2.jpg'
];

// 离线回退页面
const OFFLINE_PAGE = '/offline.html';

// 安装事件 - 预缓存静态资源
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing Service Worker ${CACHE_NAME}...`);

  event.waitUntil(
    // 旧缓存由activate清理，安装过程中保留正在使用的版本。
    caches.open(STATIC_CACHE)
    .then((cache) => {
      console.log('[SW] Pre-caching static assets');
      // 逐项缓存：原先用 cache.addAll 时，只要有任意一个资源（例如某个 CDN 临时不可用）
      // 请求失败，整个预缓存都会失败，导致离线功能彻底不可用。改为逐项缓存 + 单独记录失败。
      return Promise.all(
        STATIC_ASSETS.map(async (asset) => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          try {
            const response = await fetch(asset, { signal: controller.signal, cache: 'reload' });
            if (response.ok) await cache.put(asset, response);
          } catch (error) {
            console.warn('[SW] Skip asset, caching failed:', asset, error.message);
          } finally { clearTimeout(timer); }
        })
      );
    })
    .then(() => {
      console.log('[SW] Static assets cached successfully');
      return self.skipWaiting(); // 立即激活新版本
    })
    .catch((error) => {
      console.error('[SW] Pre-caching failed:', error);
    })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // 删除不是当前版本的缓存
              return name !== STATIC_CACHE &&
                     name !== DYNAMIC_CACHE &&
                     name !== CACHE_NAME;
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        return self.clients.claim(); // 接管所有页面
      })
  );
});

// 网络请求拦截 - 缓存优先策略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非 GET 请求
  if (request.method !== 'GET') {
    return;
  }

  // 跳过 chrome-extension 和其他非 http(s) 请求
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 账号、会员、数据库请求只能走网络，不能复用其他会话的缓存响应。
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/cb/')) {
    event.respondWith(fetch(request));
    return;
  }

  // 在线时优先取得最新页面和脚本，离线时仍可使用缓存。
  if (url.origin === self.location.origin && (request.mode === 'navigate' || /\.(js|css|html)$/.test(url.pathname))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 静态资源使用缓存优先策略
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 其他请求使用 Stale-While-Revalidate 策略
  event.respondWith(staleWhileRevalidate(request));
});

// 缓存优先策略
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache-first failed:', error);
    return caches.match(OFFLINE_PAGE);
  }
}

// 网络优先策略
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Stale-While-Revalidate 策略
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => {
      return cachedResponse || caches.match(OFFLINE_PAGE);
    });

  return cachedResponse || fetchPromise;
}

// 判断是否为静态资源
function isStaticAsset(pathname) {
  const staticExtensions = [
    '.css', '.js', '.png', '.jpg', '.jpeg',
    '.gif', '.svg', '.ico', '.woff', '.woff2'
  ];
  return staticExtensions.some(ext => pathname.endsWith(ext));
}

// 后台同步 - 当网络恢复时同步数据
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'sync-reviews') {
    event.waitUntil(syncReviews());
  }

  if (event.tag === 'sync-plans') {
    event.waitUntil(syncPlans());
  }
});

// 同步复盘数据
async function syncReviews() {
  try {
    // 从 IndexedDB 获取待同步数据
    const pendingData = await getPendingSyncData('reviews');
    if (pendingData.length === 0) return;

    // 这里可以添加实际的 API 同步逻辑
    console.log('[SW] Syncing reviews:', pendingData.length);

    // 同步成功后清除待同步标记
    await clearPendingSyncData('reviews');

    // 通知用户同步完成
    self.registration.showNotification('复盘助手', {
      body: '您的复盘数据已同步成功',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png'
    });
  } catch (error) {
    console.error('[SW] Sync reviews failed:', error);
  }
}

// 同步规划数据
async function syncPlans() {
  try {
    const pendingData = await getPendingSyncData('plans');
    if (pendingData.length === 0) return;

    console.log('[SW] Syncing plans:', pendingData.length);
    await clearPendingSyncData('plans');
  } catch (error) {
    console.error('[SW] Sync plans failed:', error);
  }
}

// 获取待同步数据（使用 IndexedDB）
async function getPendingSyncData(storeName) {
  // 暂时返回空数组，实际实现需要使用 IndexedDB
  return [];
}

// 清除待同步数据
async function clearPendingSyncData(storeName) {
  // 实际实现需要使用 IndexedDB
}

// 推送通知
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  const options = {
    body: event.data ? event.data.text() : '该复盘啦！',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      { action: 'review', title: '开始复盘', icon: '/icons/action-review.png' },
      { action: 'later', title: '稍后提醒', icon: '/icons/action-later.png' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('智能复盘助手', options)
  );
});

// 通知点击处理
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();

  if (event.action === 'review') {
    event.waitUntil(
      clients.openWindow('/index.html?tab=review')
    );
  } else if (event.action === 'later') {
    // 30分钟后再次提醒
    setTimeout(() => {
      self.registration.showNotification('智能复盘助手', {
        body: '别忘了今日复盘哦！',
        icon: '/icons/icon-192x192.png'
      });
    }, 30 * 60 * 1000);
  } else {
    event.waitUntil(
      clients.openWindow('/index.html')
    );
  }
});

// 消息处理 - 与主线程通信
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }

  if (event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});

console.log('[SW] Service Worker loaded');
