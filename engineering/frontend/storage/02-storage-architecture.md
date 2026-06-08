# 存储架构

## 1. 分层存储模式

```
┌─────────────────────────────────────────┐
│  Layer 1: Memory (内存缓存)              │
│  - 容量: 小 (MB 级)                       │
│  - 速度: 最快                            │
│  - 生命周期: 页面刷新丢失                  │
├─────────────────────────────────────────┤
│  Layer 2: SessionStorage (会话存储)       │
│  - 容量: ~5MB                            │
│  - 速度: 快 (同步)                        │
│  - 生命周期: 标签页关闭                    │
├─────────────────────────────────────────┤
│  Layer 3: LocalStorage (本地存储)         │
│  - 容量: ~5-10MB                         │
│  - 速度: 快 (同步)                        │
│  - 生命周期: 永久                         │
├─────────────────────────────────────────┤
│  Layer 4: IndexedDB (结构化存储)          │
│  - 容量: 大 (GB 级)                       │
│  - 速度: 中等 (异步)                       │
│  - 生命周期: 永久                         │
├─────────────────────────────────────────┤
│  Layer 5: OPFS (私有文件系统)              │
│  - 容量: 大 (GB 级)                       │
│  - 速度: 快 (流式)                        │
│  - 生命周期: 永久                         │
├─────────────────────────────────────────┤
│  Layer 6: Server (服务端)                 │
│  - 容量: 无限                            │
│  - 速度: 慢 (网络)                        │
│  - 生命周期: 永久                         │
└─────────────────────────────────────────┘
```

```typescript
// 分层存储管理器
interface StorageLayer<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, options?: StorageOptions): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

class LayeredStorage<T> {
  private layers: StorageLayer<T>[];
  private hitStats = new Map<string, { hits: number; misses: number }>();

  constructor(layers: StorageLayer<T>[]) {
    this.layers = layers;
  }

  async get(key: string): Promise<T | null> {
    for (let i = 0; i < this.layers.length; i++) {
      const value = await this.layers[i].get(key);
      if (value !== null) {
        // 回填上层缓存
        for (let j = 0; j < i; j++) {
          await this.layers[j].set(key, value);
        }
        this.recordHit(key);
        return value;
      }
    }
    this.recordMiss(key);
    return null;
  }

  async set(key: string, value: T, options?: StorageOptions): Promise<void> {
    // 写入所有层（或根据策略选择）
    const promises = this.layers.map((layer, index) => {
      // 高层（更快）总是写入
      // 低层根据 TTL 和容量策略决定
      if (index < 2 || !options?.ephemeral) {
        return layer.set(key, value, options);
      }
      return Promise.resolve();
    });
    await Promise.all(promises);
  }

  async delete(key: string): Promise<void> {
    await Promise.all(this.layers.map((layer) => layer.delete(key)));
  }

  private recordHit(key: string) {
    const stats = this.hitStats.get(key) || { hits: 0, misses: 0 };
    stats.hits++;
    this.hitStats.set(key, stats);
  }

  private recordMiss(key: string) {
    const stats = this.hitStats.get(key) || { hits: 0, misses: 0 };
    stats.misses++;
    this.hitStats.set(key, stats);
  }

  getStats() {
    let totalHits = 0;
    let totalMisses = 0;
    for (const { hits, misses } of this.hitStats.values()) {
      totalHits += hits;
      totalMisses += misses;
    }
    return {
      totalHits,
      totalMisses,
      hitRate: totalHits / (totalHits + totalMisses || 1),
    };
  }
}
```

## 2. Schema 版本管理

```typescript
// IndexedDB Schema 迁移

interface Migration {
  version: number;
  name: string;
  up: (db: IDBDatabase, tx: IDBTransaction) => void;
  down?: (db: IDBDatabase, tx: IDBTransaction) => void;
}

class SchemaManager {
  private dbName: string;
  private migrations: Migration[] = [];

  constructor(dbName: string) {
    this.dbName = dbName;
  }

  register(migration: Migration) {
    this.migrations.push(migration);
    this.migrations.sort((a, b) => a.version - b.version);
    return this;
  }

  async migrate(targetVersion?: number): Promise<IDBDatabase> {
    const currentVersion = await this.getCurrentVersion();
    const target = targetVersion || this.migrations[this.migrations.length - 1]?.version || 1;

    if (currentVersion === target) {
      return this.open(target);
    }

    if (currentVersion < target) {
      return this.migrateUp(currentVersion, target);
    }

    return this.migrateDown(currentVersion, target);
  }

  private async migrateUp(from: number, to: number): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, to);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        const tx = request.transaction!;
        const oldVersion = event.oldVersion;

        for (const migration of this.migrations) {
          if (migration.version > oldVersion && migration.version <= to) {
            console.log(`Applying migration: ${migration.name} (v${migration.version})`);
            migration.up(db, tx);
          }
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getCurrentVersion(): Promise<number> {
    return new Promise((resolve) => {
      const request = indexedDB.open(this.dbName);
      request.onsuccess = () => {
        const version = request.result.version;
        request.result.close();
        resolve(version);
      };
      request.onerror = () => resolve(0);
    });
  }

  private open(version: number): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, version);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// 使用
const schema = new SchemaManager('my-app');

schema
  .register({
    version: 1,
    name: 'Initial schema',
    up: (db) => {
      db.createObjectStore('users', { keyPath: 'id' });
    },
  })
  .register({
    version: 2,
    name: 'Add orders',
    up: (db) => {
      db.createObjectStore('orders', { keyPath: 'id' });
    },
  })
  .register({
    version: 3,
    name: 'Add user preferences',
    up: (db, tx) => {
      const store = tx.objectStore('users');
      store.createIndex('preferences', 'preferences', { unique: false });
    },
  });

await schema.migrate();
```

## 3. 存储封装（Repository 模式）

```typescript
// 数据访问层封装

interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findAll(options?: QueryOptions): Promise<T[]>;
  findOne(query: Partial<T>): Promise<T | null>;
  create(data: Omit<T, 'id'>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
  count(query?: Partial<T>): Promise<number>;
}

interface QueryOptions {
  where?: Record<string, unknown>;
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  limit?: number;
  offset?: number;
}

class IndexedDBRepository<T extends { id: string }> implements Repository<T> {
  private db: Promise<IDBDatabase>;
  private storeName: string;

  constructor(dbName: string, storeName: string, version = 1) {
    this.storeName = storeName;
    this.db = this.openDB(dbName, version);
  }

  private openDB(dbName: string, version: number): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, version);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async transaction(mode: IDBTransactionMode): Promise<[IDBObjectStore, IDBTransaction]> {
    const db = await this.db;
    const tx = db.transaction(this.storeName, mode);
    return [tx.objectStore(this.storeName), tx];
  }

  async findById(id: string): Promise<T | null> {
    const [store] = await this.transaction('readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async findAll(options: QueryOptions = {}): Promise<T[]> {
    const [store, tx] = await this.transaction('readonly');

    return new Promise((resolve, reject) => {
      const results: T[] = [];
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const value = cursor.value as T;

          // 过滤
          if (!options.where || this.matches(value, options.where)) {
            results.push(value);
          }

          cursor.continue();
        } else {
          // 排序
          if (options.orderBy) {
            const { field, direction } = options.orderBy;
            results.sort((a, b) => {
              const aVal = (a as any)[field];
              const bVal = (b as any)[field];
              return direction === 'asc'
                ? aVal > bVal ? 1 : -1
                : aVal < bVal ? 1 : -1;
            });
          }

          // 分页
          const offset = options.offset || 0;
          const limit = options.limit || results.length;
          resolve(results.slice(offset, offset + limit));
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async create(data: Omit<T, 'id'>): Promise<T> {
    const item = { ...data, id: this.generateId() } as T;
    const [store, tx] = await this.transaction('readwrite');

    return new Promise((resolve, reject) => {
      const request = store.add(item);
      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    });
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Item ${id} not found`);

    const updated = { ...existing, ...data, id };
    const [store] = await this.transaction('readwrite');

    return new Promise((resolve, reject) => {
      const request = store.put(updated);
      request.onsuccess = () => resolve(updated);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(id: string): Promise<void> {
    const [store] = await this.transaction('readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private matches(item: T, where: Record<string, unknown>): boolean {
    for (const [key, value] of Object.entries(where)) {
      if ((item as any)[key] !== value) return false;
    }
    return true;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 使用
const userRepo = new IndexedDBRepository<User>('my-app', 'users');
const user = await userRepo.create({ name: 'Alice', email: 'alice@example.com' });
const users = await userRepo.findAll({
  where: { active: true },
  orderBy: { field: 'name', direction: 'asc' },
  limit: 10,
});
```
