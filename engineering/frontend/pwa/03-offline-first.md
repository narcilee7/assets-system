# 离线优先架构

## 1. Background Sync

```javascript
// 注册后台同步
async function sendMessage(message) {
  // 1. 先保存到本地
  await db.messages.add({ ...message, status: 'pending', timestamp: Date.now() });

  // 2. 注册后台同步
  const registration = await navigator.serviceWorker.ready;
  await registration.sync.register(`send-message-${message.id}`);

  // 3. 乐观更新 UI
  addMessageToUI(message);
}

// SW 中处理同步
self.addEventListener('sync', (event) => {
  if (event.tag.startsWith('send-message')) {
    event.waitUntil(sendPendingMessages());
  }
});

async function sendPendingMessages() {
  const pending = await db.messages.where('status').equals('pending').toArray();

  for (const message of pending) {
    try {
      await fetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify(message),
        headers: { 'Content-Type': 'application/json' },
      });
      await db.messages.update(message.id, { status: 'sent' });
    } catch (error) {
      // 失败则等待下次同步
      console.error('Failed to send message:', error);
    }
  }
}

// 定期同步（Periodic Background Sync）
// 需要用户授权
async function registerPeriodicSync() {
  const registration = await navigator.serviceWorker.ready;

  try {
    await registration.periodicSync.register('refresh-data', {
      minInterval: 24 * 60 * 60 * 1000, // 每天
    });
  } catch (error) {
    console.error('Periodic sync registration failed:', error);
  }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'refresh-data') {
    event.waitUntil(refreshData());
  }
});
```

## 2. 乐观更新

```javascript
// 乐观更新：先更新 UI，后同步服务器
class OptimisticUpdater {
  constructor(api, store) {
    this.api = api;
    this.store = store;
  }

  async update(key, updateFn, rollbackFn) {
    // 1. 保存当前值
    const previousValue = this.store.get(key);

    // 2. 乐观更新
    const optimisticValue = updateFn(previousValue);
    this.store.set(key, optimisticValue);

    try {
      // 3. 服务器更新
      const serverValue = await this.api.update(key, optimisticValue);
      // 4. 确认（可选：用服务器值覆盖）
      this.store.set(key, serverValue);
      return { success: true, value: serverValue };
    } catch (error) {
      // 5. 回滚
      this.store.set(key, previousValue);
      rollbackFn?.(error);
      return { success: false, error };
    }
  }
}

// 使用
const updater = new OptimisticUpdater(api, store);

// 点赞
async function toggleLike(postId) {
  const result = await updater.update(
    `post:${postId}:likes`,
    (likes) => likes + 1,
    (error) => showToast('Failed to like post')
  );
}
```

## 3. 离线页面

```html
<!-- offline.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Offline</title>
  <style>
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: sans-serif;
      text-align: center;
    }
    .icon { font-size: 64px; }
    .retry-btn {
      margin-top: 20px;
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      background: #3b82f6;
      color: white;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="icon">📡</div>
  <h1>You're offline</h1>
  <p>Check your internet connection and try again.</p>
  <button class="retry-btn" onclick="location.reload()">Retry</button>

  <!-- 显示已缓存的内容 -->
  <div id="cached-content"></div>

  <script>
    // 显示已缓存的页面列表
    async function showCachedPages() {
      const cache = await caches.open('pages-v1');
      const pages = await cache.keys();
      const list = document.getElementById('cached-content');

      if (pages.length > 0) {
        list.innerHTML = '<h2>Available offline:</h2>' +
          pages.map((p) => `<a href="${p.url}">${p.url}</a>`).join('<br>');
      }
    }
    showCachedPages();
  </script>
</body>
</html>
```
