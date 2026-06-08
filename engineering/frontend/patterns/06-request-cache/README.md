# 06 Request Cache / SWR（请求缓存）

## 问题描述

实现一个 SWR（Stale-While-Revalidate）风格的请求缓存管理器。

### 核心行为

1. **缓存优先**：先返回缓存数据（即使 stale），同时后台重新验证。
2. **并发去重**：相同 key 的请求只发一个。
3. **过期策略**：缓存数据超过 TTL 后不再使用。
4. **手动失效**：提供 `mutate()` 强制重新请求。

## 核心概念

- **SWR**：先返回缓存（stale），再异步验证（revalidate）。让用户立即看到数据。
- **Cache Key**：请求的唯一标识（如 `['/api/user', id]`）。
- **Deduplication**：相同 key 的并发请求共享同一个 Promise。
- **TTL / Age**：缓存的存活时间。

## 约束

- 不得使用 swr、react-query、apollo 等第三方库。
- 缓存 key 支持字符串和数组（会被序列化为字符串）。
- 缓存项包含：`data`、`timestamp`、`promise`。

## 手写提示

1. 用 `Map<key, CacheEntry>` 存储缓存。
2. `get(key)` 时检查 TTL，过期返回 null。
3. `fetch(key, fetcher)` 时检查是否有进行中的 promise，有则复用。
4. `mutate(key)` 清除缓存并重新 fetch。

## 验证方式

```bash
make run   # 运行骨架
make test  # 验证缓存逻辑
```

## 追问

- 如何处理 fetcher 抛出异常？缓存的错误结果如何处理？
- 如何实现 cache invalidation（如 POST 后自动 invalidate 相关 GET）？
- 内存缓存如何与 localStorage / IndexedDB 结合实现持久化？
- 如何实现 stale-while-revalidate 的 "revalidate" 逻辑？