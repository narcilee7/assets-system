# 存储安全

## 1. 加密存储

```javascript
// Web Crypto API 加密存储

class EncryptedStorage {
  private key: CryptoKey | null = null;
  private storage: StorageLayer<string>;

  constructor(storage: StorageLayer<string>) {
    this.storage = storage;
  }

  // 派生密钥（从密码）
  async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // 生成随机密钥
  async generateKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,  // extractable
      ['encrypt', 'decrypt']
    );
  }

  // 加密
  async encrypt(data: string): Promise<{ ciphertext: string; iv: string; salt?: string }> {
    if (!this.key) throw new Error('Key not initialized');

    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.key,
      encoder.encode(data)
    );

    return {
      ciphertext: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv),
    };
  }

  // 解密
  async decrypt(ciphertext: string, iv: string): Promise<string> {
    if (!this.key) throw new Error('Key not initialized');

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.base64ToArrayBuffer(iv) },
      this.key,
      this.base64ToArrayBuffer(ciphertext)
    );

    return new TextDecoder().decode(decrypted);
  }

  // 存储加密数据
  async set(key: string, value: string): Promise<void> {
    const encrypted = await this.encrypt(value);
    await this.storage.set(key, JSON.stringify(encrypted));
  }

  // 读取并解密
  async get(key: string): Promise<string | null> {
    const data = await this.storage.get(key);
    if (!data) return null;

    const { ciphertext, iv } = JSON.parse(data);
    return this.decrypt(ciphertext, iv);
  }

  // 密钥导出为 JWK（用于安全存储）
  async exportKey(key: CryptoKey): Promise<JsonWebKey> {
    return crypto.subtle.exportKey('jwk', key);
  }

  // 从 JWK 导入
  async importKey(jwk: JsonWebKey): Promise<CryptoKey> {
    return crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// 使用
const encryptedStorage = new EncryptedStorage(new IndexedDBStorage('secure-data'));
const key = await encryptedStorage.generateKey();
encryptedStorage['key'] = key;

await encryptedStorage.set('ssn', '123-45-6789');
const ssn = await encryptedStorage.get('ssn');  // '123-45-6789'
```

## 2. 配额管理

```javascript
// 存储配额监控

class QuotaManager {
  private threshold: number;
  private listeners = new Set<(usage: number, quota: number) => void>();

  constructor(threshold = 0.8) {
    this.threshold = threshold;
    this.startMonitoring();
  }

  async getEstimate(): Promise<{ usage: number; quota: number; percentage: number }> {
    if (!navigator.storage?.estimate) {
      return { usage: 0, quota: Infinity, percentage: 0 };
    }

    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || Infinity;
    const percentage = quota === Infinity ? 0 : usage / quota;

    return { usage, quota, percentage };
  }

  async isFull(): Promise<boolean> {
    const { percentage } = await this.getEstimate();
    return percentage >= this.threshold;
  }

  async getRemaining(): Promise<number> {
    const { usage, quota } = await this.getEstimate();
    return quota - usage;
  }

  // 自动清理策略
  async cleanup(strategy: CleanupStrategy): Promise<number> {
    let freed = 0;

    switch (strategy.type) {
      case 'lru':
        freed = await this.cleanupLRU(strategy.storeName, strategy.maxAge);
        break;
      case 'size':
        freed = await this.cleanupBySize(strategy.storeName, strategy.maxSize);
        break;
      case 'count':
        freed = await this.cleanupByCount(strategy.storeName, strategy.maxCount);
        break;
    }

    return freed;
  }

  private async cleanupLRU(storeName: string, maxAge: number): Promise<number> {
    const db = await openDB(storeName);
    const items = await db.getAll(storeName);
    const now = Date.now();
    let freed = 0;

    for (const item of items) {
      if (item._timestamp && now - item._timestamp > maxAge) {
        const size = JSON.stringify(item).length;
        await db.delete(storeName, item.id);
        freed += size;
      }
    }

    return freed;
  }

  private startMonitoring() {
    // 每 5 分钟检查一次
    setInterval(async () => {
      const estimate = await this.getEstimate();
      this.listeners.forEach((fn) => fn(estimate.usage, estimate.quota));

      if (estimate.percentage >= this.threshold) {
        console.warn(`Storage quota warning: ${(estimate.percentage * 100).toFixed(1)}%`);
      }
    }, 5 * 60 * 1000);
  }

  onQuotaChange(fn: (usage: number, quota: number) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

interface CleanupStrategy {
  type: 'lru' | 'size' | 'count';
  storeName: string;
  maxAge?: number;    // LRU: 毫秒
  maxSize?: number;   // Size: 字节
  maxCount?: number;  // Count: 数量
}
```

## 3. 数据清理策略

```javascript
// 安全的数据清理

class SecureDataWiper {
  // 安全删除（覆盖后再删除）
  async secureDelete(storage: StorageLayer<string>, key: string): Promise<void> {
    // 1. 读取当前值
    const value = await storage.get(key);
    if (!value) return;

    // 2. 用随机数据覆盖
    const randomData = this.generateRandomString(value.length);
    await storage.set(key, randomData);

    // 3. 再次覆盖（0）
    await storage.set(key, '0'.repeat(value.length));

    // 4. 删除
    await storage.delete(key);
  }

  // 批量清理
  async clearAll(storage: StorageLayer<string>, options: ClearOptions = {}): Promise<void> {
    const keys = await storage.keys();

    for (const key of keys) {
      if (options.preserve?.includes(key)) continue;
      if (options.pattern && !key.match(options.pattern)) continue;

      if (options.secure) {
        await this.secureDelete(storage, key);
      } else {
        await storage.delete(key);
      }
    }
  }

  // 过期清理
  async cleanupExpired(storage: StorageLayer<string>): Promise<number> {
    const keys = await storage.keys();
    let count = 0;

    for (const key of keys) {
      const value = await storage.get(key);
      if (!value) continue;

      try {
        const data = JSON.parse(value);
        if (data._expires && Date.now() > data._expires) {
          await storage.delete(key);
          count++;
        }
      } catch {
        // 不是 JSON，跳过
      }
    }

    return count;
  }

  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

interface ClearOptions {
  secure?: boolean;
  preserve?: string[];
  pattern?: RegExp;
}
```

## 4. 隐私合规

```javascript
// GDPR / CCPA 合规的数据管理

class PrivacyCompliantStorage {
  private dataClassification = new Map<string, 'public' | 'internal' | 'confidential' | 'restricted'>();

  // 数据分类标记
  classify(key: string, level: 'public' | 'internal' | 'confidential' | 'restricted') {
    this.dataClassification.set(key, level);
  }

  // 存储时自动分类
  async set(key: string, value: string, options: StorageOptions = {}): Promise<void> {
    const classified = {
      value,
      _meta: {
        classification: options.classification || 'internal',
        created: Date.now(),
        expires: options.ttl ? Date.now() + options.ttl : undefined,
        retention: options.retentionDays || 365,
        encrypted: options.encrypt || false,
      },
    };

    await storage.set(key, JSON.stringify(classified));
  }

  // 数据导出（GDPR 可携带权）
  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const allKeys = await storage.keys();
    const userData: Record<string, unknown> = {};

    for (const key of allKeys) {
      if (key.startsWith(`user:${userId}:`)) {
        const value = await storage.get(key);
        if (value) {
          const parsed = JSON.parse(value);
          userData[key] = parsed.value;
        }
      }
    }

    return userData;
  }

  // 数据删除（GDPR 被遗忘权）
  async deleteUserData(userId: string): Promise<number> {
    const allKeys = await storage.keys();
    let count = 0;

    for (const key of allKeys) {
      if (key.startsWith(`user:${userId}:`)) {
        await storage.delete(key);
        count++;
      }
    }

    return count;
  }

  // 保留期检查
  async enforceRetention(): Promise<number> {
    const allKeys = await storage.keys();
    let deleted = 0;

    for (const key of allKeys) {
      const value = await storage.get(key);
      if (!value) continue;

      try {
        const parsed = JSON.parse(value);
        const meta = parsed._meta;

        if (meta?.retention) {
          const retentionMs = meta.retention * 24 * 60 * 60 * 1000;
          const age = Date.now() - (meta.created || 0);

          if (age > retentionMs) {
            await storage.delete(key);
            deleted++;
          }
        }
      } catch {
        // 非结构化数据，跳过
      }
    }

    return deleted;
  }
}

interface StorageOptions {
  classification?: 'public' | 'internal' | 'confidential' | 'restricted';
  ttl?: number;
  retentionDays?: number;
  encrypt?: boolean;
}
```
