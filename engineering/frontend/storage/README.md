# 前端存储工程化

前端存储工程化训练 —— 达到"能设计分层存储架构、能处理大数据离线场景、能保障存储安全与隐私"的水平。

## 训练哲学

1. **存储是分层缓存**：Memory → SessionStorage → LocalStorage → IndexedDB → OPFS → Server，每层有不同的容量、生命周期和访问模式。
2. **容量和配额是硬约束**：浏览器存储不是无限的，超限会导致静默失败或数据丢失。
3. **Schema 管理是长期维护的关键**：没有版本管理的存储系统等于技术债务。
4. **隐私合规是红线**：敏感数据必须加密，用户有权要求删除。

## 体系索引

| 文档 | 内容 |
|------|------|
| [01-storage-fundamentals.md](01-storage-fundamentals.md) | 浏览器存储概览：localStorage/sessionStorage/IndexedDB/Cache API 对比与选型 |
| [02-storage-architecture.md](02-storage-architecture.md) | 存储架构：分层存储、版本管理、Schema 迁移、存储封装 |
| [03-offline-storage.md](03-offline-storage.md) | 离线存储：PWA 数据层、Background Sync、冲突解决、乐观更新 |
| [04-advanced-storage.md](04-advanced-storage.md) | 高级存储：OPFS、File System Access API、SQLite WASM、大数据处理 |
| [05-storage-security.md](05-storage-security.md) | 存储安全：加密存储、配额管理、数据清理、隐私合规 |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/storage-manager.md](mini-impl/storage-manager.md) | 手写分层存储管理器 |
| [mini-impl/cache-layer.md](mini-impl/cache-layer.md) | 手写多级缓存层 |

## 存储选型决策树

```
数据量？
  ├─ < 5MB → localStorage / sessionStorage
  ├─ 5MB - 100MB → IndexedDB
  ├─ 100MB - 1GB → IndexedDB + 分片 / OPFS
  └─ > 1GB → OPFS / SQLite WASM / Server

生命周期？
  ├─ 页面会话 → sessionStorage / Memory
  ├─ 长期持久 → localStorage / IndexedDB / OPFS
  └─ 可丢弃 → Memory / Cache API

查询需求？
  ├─ Key-Value → localStorage / sessionStorage
  ├─ 索引查询 → IndexedDB
  ├─ SQL 查询 → SQLite WASM
  └─ 全文搜索 → IndexedDB + 倒排索引 / Server

需要离线？
  ├─ 是 → IndexedDB + Service Worker + Background Sync
  └─ 否 → 任意方案

敏感数据？
  ├─ 是 → 加密存储（Web Crypto API）
  └─ 否 → 明文存储
```
