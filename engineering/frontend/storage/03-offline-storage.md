# 离线存储

## 1. 离线数据架构

```
离线优先架构

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   用户操作   │────▶│  本地存储层  │────▶│   UI 更新    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼ (网络恢复)
                    ┌─────────────┐
                    │  同步队列   │
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  服务端     │
                    └─────────────┘
```

```typescript
// 离线存储管理器
interface SyncItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  entity: string;
  data: unknown;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
}

class OfflineStorage {
  private db: IDBDatabase | null = null;
  private syncQueue: SyncItem[] = [];
  private isOnline = navigator.onLine;

  constructor(dbName = 'offline-store') {
    this.initDB(dbName);
    this.setupNetworkListeners();
  }

  private async initDB(dbName: string) {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains('data')) {
          db.createObjectStore('data', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          const queue = db.createObjectStore('syncQueue', { keyPath: 'id' });
          queue.createIndex('status', 'status', { unique: false });
          queue.createIndex('entity', 'entity', { unique: false });
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        this.loadSyncQueue();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processSyncQueue();
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  // ========== CRUD 操作 ==========

  async create(entity: string, data: any): Promise<any> {
    const id = this.generateId();
    const item = { ...data, id, _local: true, _syncStatus: 'pending' };

    // 写入本地
    await this.write('data', item);

    // 加入同步队列
    await this.addToSyncQueue({
      id: this.generateId(),
      operation: 'create',
      entity,
      data: item,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    });

    // 尝试立即同步
    if (this.isOnline) {
      this.processSyncQueue();
    }

    return item;
  }

  async update(entity: string, id: string, data: any): Promise<any> {
    const existing = await this.read('data', id);
    if (!existing) throw new Error(`Item ${id} not found`);

    const updated = { ...existing, ...data, id, _syncStatus: 'pending' };
    await this.write('data', updated);

    await this.addToSyncQueue({
      id: this.generateId(),
      operation: 'update',
      entity,
      data: updated,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    });

    if (this.isOnline) this.processSyncQueue();
    return updated;
  }

  async delete(entity: string, id: string): Promise<void> {
    await this.deleteFromStore('data', id);

    await this.addToSyncQueue({
      id: this.generateId(),
      operation: 'delete',
      entity,
      data: { id },
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    });

    if (this.isOnline) this.processSyncQueue();
  }

  // ========== 同步队列 ==========

  private async addToSyncQueue(item: SyncItem): Promise<void> {
    this.syncQueue.push(item);
    await this.write('syncQueue', item);
  }

  private async loadSyncQueue(): Promise<void> {
    const items = await this.readAll('syncQueue');
    this.syncQueue = items.filter((i: SyncItem) => i.status === 'pending');
    if (this.isOnline && this.syncQueue.length > 0) {
      this.processSyncQueue();
    }
  }

  private async processSyncQueue(): Promise<void> {
    const pending = this.syncQueue.filter((i) => i.status === 'pending');

    for (const item of pending) {
      item.status = 'syncing';
      await this.write('syncQueue', item);

      try {
        await this.syncItem(item);
        item.status = 'synced';
        await this.deleteFromStore('syncQueue', item.id);

        // 更新本地数据状态
        if (item.operation !== 'delete') {
          const localData = await this.read('data', (item.data as any).id);
          if (localData) {
            await this.write('data', { ...localData, _local: false, _syncStatus: 'synced' });
          }
        }
      } catch (error) {
        item.retryCount++;
        if (item.retryCount >= 3) {
          item.status = 'failed';
        } else {
          item.status = 'pending';
        }
        await this.write('syncQueue', item);
      }
    }

    // 清理已同步的
    this.syncQueue = this.syncQueue.filter((i) => i.status !== 'synced');
  }

  private async syncItem(item: SyncItem): Promise<void> {
    const response = await fetch(`/api/${item.entity}/${item.operation}`, {
      method: item.operation === 'create' ? 'POST' : item.operation === 'update' ? 'PUT' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item.data),
    });

    if (!response.ok) throw new Error(`Sync failed: ${response.status}`);
  }

  // ========== 冲突解决 ==========

  async resolveConflict(
    localItem: any,
    serverItem: any,
    strategy: 'local' | 'server' | 'merge' | 'manual'
  ): Promise<any> {
    switch (strategy) {
      case 'local':
        return localItem;
      case 'server':
        await this.write('data', serverItem);
        return serverItem;
      case 'merge':
        const merged = { ...serverItem, ...localItem, _syncStatus: 'synced' };
        await this.write('data', merged);
        return merged;
      case 'manual':
        // 抛出冲突供用户选择
        throw new ConflictError(localItem, serverItem);
      default:
        throw new Error(`Unknown conflict strategy: ${strategy}`);
    }
  }

  // ========== IndexedDB 封装 ==========

  private async write(storeName: string, data: any): Promise<void> {
    return this.transaction(storeName, 'readwrite', (store) => store.put(data));
  }

  private async read(storeName: string, id: string): Promise<any> {
    return this.transaction(storeName, 'readonly', (store) => store.get(id));
  }

  private async readAll(storeName: string): Promise<any[]> {
    return this.transaction(storeName, 'readonly', (store) => store.getAll());
  }

  private async deleteFromStore(storeName: string, id: string): Promise<void> {
    return this.transaction(storeName, 'readwrite', (store) => store.delete(id));
  }

  private transaction<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.db) throw new Error('Database not initialized');
      const tx = this.db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = fn(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

class ConflictError extends Error {
  constructor(public local: any, public server: any) {
    super('Data conflict detected');
  }
}
```

## 2. 乐观更新

```typescript
// 乐观更新模式

class OptimisticStore<T> {
  private pending = new Map<string, { rollback: () => void; timeout: number }>();
  private listeners = new Set<() => void>();

  constructor(
    private storage: OfflineStorage,
    private maxOptimisticDuration = 5000
  ) {}

  async optimisticUpdate(
    entity: string,
    id: string,
    updateFn: (item: T) => T,
    serverFn: () => Promise<T>
  ): Promise<T> {
    // 1. 读取当前值
    const current = await this.storage.read('data', id);
    if (!current) throw new Error(`Item ${id} not found`);

    // 2. 乐观更新
    const optimistic = updateFn(current);
    await this.storage.write('data', { ...optimistic, _optimistic: true });
    this.notify();

    // 3. 设置回滚
    const rollback = () => {
      this.storage.write('data', current);
      this.notify();
    };

    const timeout = window.setTimeout(() => {
      if (this.pending.has(id)) {
        rollback();
        this.pending.delete(id);
      }
    }, this.maxOptimisticDuration);

    this.pending.set(id, { rollback, timeout });

    try {
      // 4. 服务端更新
      const result = await serverFn();

      // 5. 确认成功，清除回滚
      const pending = this.pending.get(id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pending.delete(id);
      }

      // 6. 写入确认结果
      await this.storage.write('data', { ...result, _optimistic: false });
      this.notify();

      return result;
    } catch (error) {
      // 7. 失败回滚
      const pending = this.pending.get(id);
      if (pending) {
        clearTimeout(pending.timeout);
        pending.rollback();
        this.pending.delete(id);
      }
      throw error;
    }
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
```

## 3. Background Sync

```javascript
// 注册后台同步
async function syncWhenOnline(syncTag, data) {
  // 1. 保存到本地队列
  await saveToQueue(syncTag, data);

  // 2. 注册后台同步
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register(syncTag);
  } else {
    // 回退：监听 online 事件
    window.addEventListener('online', () => processQueue(syncTag), { once: true });
  }
}

// Service Worker 处理同步
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  } else if (event.tag === 'sync-analytics') {
    event.waitUntil(syncAnalytics());
  }
});

async function syncMessages() {
  const db = await openDB('offline-store');
  const queue = await db.getAllFromIndex('syncQueue', 'status', 'pending');

  for (const item of queue) {
    try {
      await fetch('/api/sync', {
        method: 'POST',
        body: JSON.stringify(item),
        headers: { 'Content-Type': 'application/json' },
      });
      await db.delete('syncQueue', item.id);
    } catch (error) {
      // 等待下次同步
      console.error('Sync failed for item:', item.id);
    }
  }
}
```
