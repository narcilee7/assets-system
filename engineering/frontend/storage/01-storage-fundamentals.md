# 浏览器存储概览

## 1. 四种核心存储对比

| 特性 | localStorage | sessionStorage | IndexedDB | Cache API |
|------|-------------|----------------|-----------|-----------|
| 容量 | ~5-10MB | ~5-10MB | 取决于磁盘（通常 50%+） | 取决于磁盘 |
| 生命周期 | 永久（除非用户清除） | 页面会话 | 永久 | 永久（受 SW 控制） |
| 同步/异步 | 同步（阻塞主线程） | 同步 | 异步 | 异步 |
| 数据结构 | Key-Value（字符串） | Key-Value（字符串） | 结构化对象（索引） | Request/Response |
| 同源策略 | 是 | 是 | 是 | 是 |
| 可共享 | 否 | 否 | 否 | Service Worker 可访问 |
| 适用范围 | 简单配置 | 临时状态 | 复杂应用数据 | 缓存资源 |

```javascript
// ========== localStorage ==========

// 基础 API
localStorage.setItem('key', 'value');
localStorage.getItem('key');        // 'value'
localStorage.removeItem('key');
localStorage.clear();
localStorage.length;                // 数量
localStorage.key(0);                // 第 0 个 key

// 注意：只能存字符串
const user = { name: 'Alice', age: 30 };
localStorage.setItem('user', JSON.stringify(user));
const parsed = JSON.parse(localStorage.getItem('user'));

// 存储事件（跨标签页同步）
window.addEventListener('storage', (e) => {
  console.log('Key changed:', e.key);
  console.log('Old value:', e.oldValue);
  console.log('New value:', e.newValue);
  console.log('URL:', e.url);
});

// 容量检测
try {
  const testKey = '__storage_test__';
  localStorage.setItem(testKey, 'x'.repeat(1024 * 1024));
  localStorage.removeItem(testKey);
} catch (e) {
  if (e.name === 'QuotaExceededError') {
    console.warn('Storage quota exceeded');
  }
}
```

```javascript
// ========== sessionStorage ==========

// 与 localStorage API 完全相同，但生命周期不同
sessionStorage.setItem('temp', 'value');  // 页面关闭后消失

// 典型场景
// 1. 表单草稿（页面刷新保留，关闭后丢弃）
// 2. 多标签页隔离状态（每个标签页独立）
// 3. 敏感临时数据
```

```javascript
// ========== IndexedDB ==========

// 完整异步 API
const request = indexedDB.open('my-app', 1);

request.onupgradeneeded = (event) => {
  const db = event.target.result;

  // 创建对象存储（类似表）
  if (!db.objectStoreNames.contains('users')) {
    const store = db.createObjectStore('users', { keyPath: 'id' });
    store.createIndex('email', 'email', { unique: true });
    store.createIndex('age', 'age', { unique: false });
  }

  // 复合索引
  if (!db.objectStoreNames.contains('orders')) {
    const store = db.createObjectStore('orders', { keyPath: 'id' });
    store.createIndex('user-date', ['userId', 'date'], { unique: false });
  }
};

request.onsuccess = (event) => {
  const db = event.target.result;

  // 写入
  const tx = db.transaction('users', 'readwrite');
  const store = tx.objectStore('users');
  store.add({ id: 1, name: 'Alice', email: 'alice@example.com', age: 30 });
  store.put({ id: 1, name: 'Alice Updated' });  // 更新

  // 查询
  const getReq = store.get(1);
  getReq.onsuccess = () => console.log(getReq.result);

  // 索引查询
  const index = store.index('age');
  const range = IDBKeyRange.bound(25, 35);
  index.openCursor(range).onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      console.log(cursor.value);
      cursor.continue();
    }
  };

  tx.oncomplete = () => db.close();
};
```

```javascript
// ========== Cache API ==========

// 主要被 Service Worker 使用
const cacheName = 'app-cache-v1';

// 打开缓存
const cache = await caches.open(cacheName);

// 存储响应
await cache.put('/api/data', new Response(JSON.stringify({ data: [] })));

// 匹配请求
const response = await cache.match('/api/data');
if (response) {
  const data = await response.json();
}

// 批量操作
await cache.addAll(['/index.html', '/app.js', '/style.css']);

// 清理旧缓存
const keys = await caches.keys();
for (const key of keys) {
  if (key !== cacheName) {
    await caches.delete(key);
  }
}
```

## 2. 现代存储 API

```javascript
// ========== StorageManager / StorageEstimate ==========

// 查询配额
if (navigator.storage && navigator.storage.estimate) {
  const estimate = await navigator.storage.estimate();
  console.log('Quota:', estimate.quota);           // 总配额（字节）
  console.log('Usage:', estimate.usage);            // 已使用（字节）
  console.log('IndexedDB:', estimate.usageDetails?.indexedDB);
  console.log('Cache:', estimate.usageDetails?.caches);
}

// 请求持久化存储
if (navigator.storage && navigator.storage.persist) {
  const isPersistent = await navigator.storage.persist();
  console.log('Persistent storage granted:', isPersistent);
}

// 检查持久化状态
if (navigator.storage && navigator.storage.persisted) {
  const persisted = await navigator.storage.persisted();
  console.log('Already persistent:', persisted);
}

// ========== OPFS (Origin Private File System) ==========

// Chrome 86+，高性能文件操作
const root = await navigator.storage.getDirectory();

// 创建文件
const fileHandle = await root.getFileHandle('data.json', { create: true });

// 写入（使用 FileSystemWritableFileStream）
const writable = await fileHandle.createWritable();
await writable.write(JSON.stringify({ large: 'data' }));
await writable.close();

// 读取
const file = await fileHandle.getFile();
const text = await file.text();

// 创建目录
const dirHandle = await root.getDirectoryHandle('cache', { create: true });

// 遍历
for await (const [name, handle] of dirHandle.entries()) {
  console.log(name, handle.kind);  // 'file' or 'directory'
}
```

## 3. 存储选型矩阵

| 场景 | 推荐方案 | 原因 |
|------|----------|------|
| 用户偏好设置 | localStorage | 简单、同步、小数据 |
| 登录 Token | sessionStorage / cookie | 安全、会话级 |
| 应用状态（Redux） | IndexedDB / Memory | 结构化、可恢复 |
| 离线文档 | IndexedDB | 大容量、索引查询 |
| 图片缓存 | Cache API | 匹配 Request/Response |
| 大文件处理 | OPFS | 接近原生文件性能 |
| 日志/分析数据 | IndexedDB + 定期上传 | 批量累积后上报 |
| 敏感数据 | IndexedDB + Web Crypto | 加密存储 |
