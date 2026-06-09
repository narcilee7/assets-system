# 持久化与同步

## 1. 持久化方案对比

| 方案 | 容量 | 生命周期 | 服务端可读 | 适用场景 |
|------|------|----------|-----------|----------|
| **localStorage** | ~5-10MB | 永久 | ❌ | 主题、用户偏好、缓存 |
| **sessionStorage** | ~5-10MB | 标签页 | ❌ | 临时表单、一次性数据 |
| **IndexedDB** | ~50MB+ | 永久 | ❌ | 大量离线数据、文件缓存 |
| **Cookie** | ~4KB | 可设过期 | ✅ | 身份认证、跟踪 |
| **OPFS** | 磁盘空间 | 永久 | ❌ | 大型文件、WASM |

## 2. localStorage 封装

```ts
// utils/storage.ts
const storage = {
  get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  },

  remove(key: string): void {
    localStorage.removeItem(key);
  },

  subscribe<T>(key: string, callback: (value: T) => void) {
    const handler = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        callback(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  },
};

// Zustand 持久化中间件用法
import { persist, createJSONStorage } from 'zustand/middleware';

const useStore = create(
  persist(
    (set) => ({ theme: 'light', setTheme: (theme) => set({ theme }) }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme }),  // 只持久化部分状态
      onRehydrateStorage: () => (state, error) => {
        console.log('Storage rehydrated', state);
      },
    }
  )
);
```

## 3. 跨标签页同步

```ts
// 使用 BroadcastChannel（现代浏览器）
const channel = new BroadcastChannel('app_sync');

// 发送
channel.postMessage({ type: 'THEME_CHANGE', payload: 'dark' });

// 接收
channel.onmessage = (event) => {
  if (event.data.type === 'THEME_CHANGE') {
    useThemeStore.setState({ theme: event.data.payload });
  }
};

// 用 StorageEvent 兼容旧浏览器
window.addEventListener('storage', (e) => {
  if (e.key === 'theme') {
    useThemeStore.setState({ theme: e.newValue });
  }
});
```

## 4. IndexedDB 高级缓存

```ts
// 用 idb-keyval 简化 IndexedDB
import { get, set, del, keys } from 'idb-keyval';

// 缓存 API 响应
async function cachedFetch(url: string, maxAge = 3600000) {
  const cached = await get<{ data: any; timestamp: number }>(url);

  if (cached && Date.now() - cached.timestamp < maxAge) {
    return cached.data;
  }

  const response = await fetch(url);
  const data = await response.json();
  await set(url, { data, timestamp: Date.now() });

  return data;
}

// 清理过期缓存
async function cleanupCache(maxAge = 7 * 24 * 3600000) {
  const allKeys = await keys();
  const now = Date.now();

  for (const key of allKeys) {
    const entry = await get<{ timestamp: number }>(key);
    if (entry && now - entry.timestamp > maxAge) {
      await del(key);
    }
  }
}
```
