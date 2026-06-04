# Scale

## 单机扩展

### 无锁化

```go
type TokenBucket struct {
    tokens     atomic.Int64
    lastRefill atomic.Int64
    capacity   int64
    rate       int64 // tokens per nanosecond
}
```

使用 `atomic` 替代 `sync.Mutex`，单机 QPS 可达 50W+。

### 批量预取

对于高频 resource，向 Redis 批量预取一批配额到本地：

```
本地配额耗尽 ──► 向 Redis 申请 100 个配额 ──► 本地消费（减少 99 次 Redis 访问）
```

## 分布式扩展

### Redis Cluster 分片

```
resource + dimension_hash % 16384 → Redis slot
```

避免单节点热点，支持水平扩展。

### 本地缓存 + 异步同步

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Node 1     │◄───►│  Redis      │◄───►│  Node 2     │
│  L1 Cache   │     │  L2 Store   │     │  L1 Cache   │
└─────────────┘     └─────────────┘     └─────────────┘
```

- L1 本地缓存：过期时间 1s，减少 90%+ Redis 访问
- L2 Redis：最终一致，容忍秒级延迟

### 多级限流架构

```
边缘层（CDN / WAF）──► 网关层（API Gateway）──► 服务层（Service Mesh）──► 应用层（业务代码）
   粗粒度 IP 黑名单          接口级限流               服务级限流               资源级限流
   百万级 QPS                十万级 QPS               万级 QPS                千级 QPS
```

越靠近边缘，粒度越粗，容量越大；越靠近应用，粒度越细，精度越高。

## 高可用部署

```
                ┌─────────────┐
                │   LB        │
                └──────┬──────┘
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
  ┌─────────┐    ┌─────────┐    ┌─────────┐
  │Limiter 1│    │Limiter 2│    │Limiter 3│
  │ + Local │    │ + Local │    │ + Local │
  └────┬────┘    └────┬────┘    └────┬────┘
       └───────────────┼───────────────┘
                       ▼
                ┌─────────────┐
                │Redis Cluster│
                │  Master x3  │
                │  Replica x3 │
                └─────────────┘
```

- 限流节点无状态，可水平扩容
- Redis Cluster 三主三从，自动故障转移

## 瓶颈分析

| 瓶颈 | 原因 | 解决 |
|------|------|------|
| Redis 单节点 CPU | 高频 INCR / Lua 执行 | 本地缓存 + 批量预取 + Cluster 分片 |
| 规则匹配 | 规则数过多，线性扫描 | Trie 树索引 + resource 精确匹配优先 |
| 内存占用 | 本地缓存 key 过多 | LRU 淘汰 + 过期清理 |
| 网络 RTT | 跨机房 Redis 访问 | 同机房部署 Redis 副本；本地优先策略 |
