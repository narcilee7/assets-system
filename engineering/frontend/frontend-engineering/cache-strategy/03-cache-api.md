# Cache API 与离线存储

## 1. Cache Storage API

```javascript
// 打开指定缓存
const cache = await caches.open('api-cache-v1');

// 添加请求到缓存
await cache.add('/api/user');           // 自动 fetch + cache
await cache.addAll(['/api/user', '/api/posts']);

// 手动 put（已有 Response）
const response = await fetch('/api/data');
await cache.put('/api/data', response.clone());

// 匹配缓存
const cached = await cache.match('/api/user');
if (cached) {
  const data = await cached.json();
}

// 删除缓存项
await cache.delete('/api/user');

// 遍历所有缓存
const keys = await cache.keys();
for (const request of keys) {
  console.log(request.url);
}
```

## 2. IndexedDB（结构化数据离线存储）

```javascript
// 打开数据库
const db = await openDB('my-app', 1, {
  upgrade(db) {
    // 创建对象存储（类似表）
    if (!db.objectStoreNames.contains('posts')) {
      const store = db.createObjectStore('posts', { keyPath: 'id' });
      store.createIndex('by-date', 'createdAt');
    }
  },
});

// 写入数据
await db.put('posts', { id: 1, title: 'Hello', content: 'World', createdAt: Date.now() });

// 读取数据
const post = await db.get('posts', 1);

// 查询索引
const recentPosts = await db.getAllFromIndex('posts', 'by-date');

// 删除数据
await db.delete('posts', 1);
```

## 3. 离线优先架构

```
用户操作 → 本地存储（IndexedDB）→ 同步队列 → 网络请求
                ↓                      ↓
              立即响应               成功：清除队列
              （乐观更新）            失败：重试/提示
```

```javascript
// 离线优先数据层
class OfflineFirstStore {
  constructor(dbName) {
    this.db = openDB(dbName, 1, {
      upgrade(db) {
        db.createObjectStore('data', { keyPath: 'id' });
        db.createObjectStore('syncQueue', { autoIncrement: true });
      },
    });
  }

  async read(id) {
    const db = await this.db;
    return db.get('data', id);
  }

  async write(item) {
    const db = await this.db;
    await db.put('data', item);

    // 添加到同步队列
    await db.add('syncQueue', {
      action: 'upsert',
      data: item,
      timestamp: Date.now(),
    });

    // 尝试立即同步
    this.sync();
  }

  async sync() {
    const db = await this.db;
    const queue = await db.getAll('syncQueue');

    for (const task of queue) {
      try {
        await fetch('/api/sync', {
          method: 'POST',
          body: JSON.stringify(task),
        });
        await db.delete('syncQueue', task.id);
      } catch (err) {
        console.error('Sync failed, will retry:', err);
        break;  // 网络问题，停止同步，等待下次
      }
    }
  }
}
```
