# Scale

## 性能目标

| 指标 | 目标 | 说明 |
|------|------|------|
| 单文件大小 | 100GB+ | 支持超大文件 |
| 分片大小 | 5MB（默认）| 可配置 |
| 并发分片数 | 3-5 | 平衡速度和资源 |
| 上传速度 | 取决于用户带宽 | 分片并行加速 |
| 秒传成功率 | > 30% | 热门文件复用 |
| 合并成功率 | > 99.9% | 含 Hash 校验 |
| 上传可用性 | 99.99% | 服务本身 |

---

## 性能瓶颈分析

### 瓶颈 1：文件 Hash 计算（浏览器端）

#### 问题

大文件（10GB+）的 Hash 计算在主线程会导致 UI 卡顿。

#### 优化方案

| 方案 | 实现 | 效果 |
|------|------|------|
| **Web Worker** | 后台线程计算 | UI 不卡顿 |
| **分片 Hash** | 每片单独计算，最后合并 | 可显示进度 |
| **SHA-256 替代 MD5** | 安全性更高 | 速度稍慢 |

#### Web Worker 实现

```javascript
// worker.js
self.onmessage = async function(e) {
    const { file, chunkSize = 5 * 1024 * 1024 } = e.data;

    let offset = 0;
    let hash = null;

    while (offset < file.size) {
        const chunk = file.slice(offset, offset + chunkSize);
        const chunkHash = await computeChunkHash(chunk);

        if (hash === null) {
            hash = chunkHash;
        } else {
            hash = combineHash(hash, chunkHash);
        }

        offset += chunkSize;
        self.postMessage({ type: 'progress', offset, total: file.size });
    }

    self.postMessage({ type: 'complete', hash });
};
```

---

### 瓶颈 2：分片上传网络开销

#### 问题

每个分片一个 HTTP 请求，10GB 文件（5MB 分片）= 2000 个请求，HTTP 头部开销大。

#### 优化方案

| 方案 | 实现 | 效果 |
|------|------|------|
| **HTTP/2 Multiplexing** | 复用连接 | 减少 TCP 握手 |
| **批量上传** | 一次请求上传多个分片 | 减少请求数 |
| **Gzip 压缩** | 分片数据压缩 | 减少传输量（文本文件）|

---

### 瓶颈 3：合并操作耗时

#### 问题

1000 个分片合并需要按顺序读写 5GB 数据，可能需要几分钟。

#### 优化方案

| 方案 | 实现 | 效果 |
|------|------|------|
| **流式合并** | 边读边写，不占用大量内存 | 内存占用低 |
| **后台异步合并** | 立即返回，后台处理 | 用户无感知 |
| **并行合并** | 多线程同时读写 | 速度提升 |

#### 流式合并实现

```go
func (h *UploadHandler) mergeFileStreaming(taskID string, chunks []*Chunk, destPath string) error {
    destFile, err := os.Create(destPath)
    if err != nil {
        return err
    }
    defer destFile.Close()

    // 按顺序追加每个分片
    for _, chunk := range chunks {
        srcFile, err := os.Open(chunk.StoragePath)
        if err != nil {
            return err
        }

        // io.Copy 流式复制，不占用大量内存
        _, err = io.Copy(destFile, srcFile)
        srcFile.Close()

        if err != nil {
            return err
        }
    }

    return nil
}
```

---

### 瓶颈 4：存储写入性能

#### 问题

OSS/S3 单个 Object 写入带宽有限，高并发时成为瓶颈。

#### 优化方案

| 方案 | 实现 | 效果 |
|------|------|------|
| **分片并发写入** | 多个分片同时上传到 OSS | 吞吐提升 |
| **OSS 拼接 API** | 上传后直接拼接 | 无需下载再上传 |
| **CDN 加速** | 静态资源走 CDN | 下载加速 |

---

## 扩展方案

### 扩展维度 1：多节点水平扩展

```
                    ┌─────────────────┐
                    │  Load Balancer   │
                    │   (Nginx/ALB)  │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
    ┌─────────┐         ┌─────────┐         ┌─────────┐
    │ Upload  │         │ Upload  │         │ Upload  │
    │ Node-1  │         │ Node-2  │         │ Node-3  │
    └────┬────┘         └────┬────┘         └────┬────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             ▼
                    ┌─────────────────┐
                    │     Redis      │
                    │  (分片状态)    │
                    └─────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   OSS / S3      │
                    │   (对象存储)    │
                    └─────────────────┘
```

### 扩展维度 2：断点续传状态分离

```
分片状态（Redis）：
  - upload:{upload_id}:chunks → Set<chunk_index>
  - upload:{upload_id}:status → String

进度（localStorage + 后端备份）：
  - 前端：localStorage
  - 后端：MySQL/Redis

优势：
  - Redis 保证分布式一致性
  - localStorage 保证页面刷新可恢复
```

### 扩展维度 3：大文件分片存储优化

```
大文件（> 10GB）分片存储策略：

1. 分片大小动态调整
   - < 1GB：5MB 分片
   - 1-10GB：10MB 分片
   - > 10GB：20MB 分片

2. 分片存储路径优化
   - 按 upload_id 的前两位分组
   - /00/01/upload_abc123/chunk_0000
   - /00/01/upload_abc123/chunk_0001
   - ...

3. 热点分片预热
   - 秒传成功后，预热到 CDN
   - 下次下载直接走 CDN
```

---

## 容量规划

### 并发上传容量估算

```
目标：支持 1000 用户同时上传大文件（平均 1GB）

每个上传任务：
  - 并发分片数：3
  - 单分片大小：5MB
  - 单分片上传时间：2s（10Mbps 用户）
  - 上传速率：2.5MB/s

单节点容量：
  - 网络带宽：100Mbps
  - 单节点并发：100Mbps / (2.5MB/s * 8) ≈ 5 个上传任务
  - 实际考虑协议开销：3-4 个

所需节点数：
  - 1000 个并发用户 / 5 = 200 节点
  - 考虑冗余：250 节点
```

### 存储容量估算

```
每日新增上传量：
  - 日活用户：10 万
  - 平均上传文件数：1 个/用户
  - 平均文件大小：100MB
  - 每日新增：10 万 × 100MB = 10TB

存储规划：
  - 单 OSS Bucket：支持 PB 级
  - 分片临时存储：保留 7 天
  - 每日清理：10TB × 7 = 70TB

成本优化：
  - 热门文件走标准存储
  - 冷门文件转归档存储
```

---

## 监控指标

### 核心指标

```prometheus
# 上传请求
upload_requests_total{status="success"} 12345
upload_requests_total{status="failed"} 123
upload_request_duration_seconds{quantile="0.99"} 45.2

# 分片上传
chunk_uploads_total{status="success"} 1234567
chunk_uploads_total{status="failed"} 1234
chunk_upload_duration_seconds{quantile="0.99"} 2.3

# 秒传
instant_upload_total{result="hit"} 3456
instant_upload_total{result="miss"} 7890
instant_upload_hit_rate 0.304

# 合并
merge_tasks_total{status="success"} 890
merge_tasks_total{status="failed"} 10
merge_duration_seconds{quantile="0.99"} 125.6

# 存储
storage_used_bytes 53687091200000  # 50TB
storage_available_bytes 100000000000000
storage_usage_ratio 0.35
```

### 告警阈值

| 指标 | 警告 | 严重 |
|------|------|------|
| 上传失败率 | > 5% | > 10% |
| 分片上传延迟 P99 | > 10s | > 30s |
| 合并失败率 | > 1% | > 5% |
| 秒传命中率 | < 20% | < 10% |
| 存储使用率 | > 70% | > 85% |
| 并发上传数 | > 80% 容量 | > 95% 容量 |
