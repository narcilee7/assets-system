# Data Model

## 核心设计原则

- **分片状态独立**：每个分片独立管理，上传状态互不影响
- **幂等性**：重复上传同一分片不会创建重复数据
- **可恢复性**：上传状态持久化，支持断点恢复
- **Hash 校验**：分片和整体文件都需要 Hash 校验

---

## 1. 上传任务数据模型

### 上传任务（Upload Task）

```sql
CREATE TABLE upload_tasks (
    id              VARCHAR(64) PRIMARY KEY,
    file_id         VARCHAR(64) NOT NULL,

    -- 文件信息
    file_name       VARCHAR(256) NOT NULL,
    file_size       BIGINT NOT NULL,
    file_hash       VARCHAR(128) NOT NULL,  -- MD5/SHA256
    chunk_size      INT NOT NULL,
    total_chunks    INT NOT NULL,

    -- 元信息
    content_type    VARCHAR(64),
    user_id         VARCHAR(64) NOT NULL,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    folder_id       VARCHAR(64),

    -- 状态
    status          ENUM('initialized', 'uploading', 'paused', 'merging', 'completed', 'cancelled', 'failed') DEFAULT 'initialized',

    -- 进度
    uploaded_chunks INT DEFAULT 0,

    -- 时间
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at      TIMESTAMP,  -- 上传超时时间（默认 24h）

    INDEX idx_user (user_id),
    INDEX idx_status (status),
    INDEX idx_file_hash (file_hash)
);
```

---

## 2. 分片数据模型

### 分片记录（Chunk Record）

```sql
CREATE TABLE upload_chunks (
    id              VARCHAR(64) PRIMARY KEY,
    task_id         VARCHAR(64) NOT NULL,
    chunk_index     INT NOT NULL,
    chunk_hash      VARCHAR(128) NOT NULL,  -- MD5 of chunk
    chunk_size      INT NOT NULL,

    -- 存储位置
    storage_path    VARCHAR(512) NOT NULL,

    -- 状态
    status          ENUM('pending', 'uploading', 'completed', 'failed') DEFAULT 'pending',
    uploaded_at     TIMESTAMP,

    -- 校验
    md5_verified    BOOLEAN DEFAULT FALSE,

    -- 索引
    UNIQUE KEY uk_task_chunk (task_id, chunk_index),
    INDEX idx_task (task_id),

    FOREIGN KEY (task_id) REFERENCES upload_tasks(id)
);
```

### 分片存储路径

```
存储路径设计：
  /{tenant_id}/{user_id}/{file_id}/chunk_{index}

示例：
  /default/u12345/file-abc123/chunk_0000
  /default/u12345/file-abc123/chunk_0001
  ...
```

---

## 3. 文件数据模型

### 文件表（File）

```sql
CREATE TABLE files (
    id              VARCHAR(64) PRIMARY KEY,
    file_name       VARCHAR(256) NOT NULL,
    file_size       BIGINT NOT NULL,
    file_hash       VARCHAR(128) NOT NULL,  -- MD5/SHA256

    -- 存储
    storage_type    ENUM('local', 'oss', 's3', 'minio') DEFAULT 'oss',
    storage_path    VARCHAR(512),  -- 对象存储路径或本地路径
    storage_bucket  VARCHAR(128),
    cdn_url         VARCHAR(512),

    -- 元信息
    content_type    VARCHAR(64),
    user_id         VARCHAR(64) NOT NULL,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',

    -- 状态
    status          ENUM('uploading', 'completed', 'deleted') DEFAULT 'completed',

    -- 关联上传任务
    upload_task_id   VARCHAR(64),

    -- 时间
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_user (user_id),
    INDEX idx_hash (file_hash)
);
```

---

## 4. 秒传数据模型

### 文件 Hash 索引（用于秒传）

```sql
CREATE TABLE file_hash_index (
    file_hash       VARCHAR(128) PRIMARY KEY,
    file_id         VARCHAR(64) NOT NULL,
    file_size       BIGINT NOT NULL,

    -- 存储位置
    storage_path    VARCHAR(512) NOT NULL,

    -- 访问统计（用于 LRU 淘汰）
    access_count    INT DEFAULT 0,
    last_accessed_at TIMESTAMP,

    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_access (last_accessed_at)
);
```

### 秒传流程

```
1. 前端计算文件 Hash（MD5/SHA256）
2. 查询 file_hash_index：SELECT * FROM file_hash_index WHERE file_hash = ?
3. 存在 → 返回已有文件，秒传成功
4. 不存在 → 正常分片上传，合并后插入 file_hash_index
```

---

## 5. 上传进度数据模型

### Redis 中的上传状态（用于快速查询）

```
Redis Key: upload:status:{upload_id}
  Hash Fields:
    - total_chunks: 2048
    - uploaded_chunks: 100
    - status: "uploading"
    - updated_at: 1717200000

TTL: 7 天（任务过期时间）

Redis Key: upload:chunks:{upload_id}
  Set: [0, 1, 2, ..., 99]  # 已上传的分片索引
```

### localStorage 中的客户端状态

```json
{
  "upload_id": "upload-01HV3WWZP...",
  "file_name": "video.mp4",
  "file_hash": "md5:...",
  "total_chunks": 2048,
  "uploaded_chunks": [0, 1, 2, ..., 99],
  "progress_percent": 4.88,
  "last_updated": 1717200000
}
```

---

## 6. 合并任务数据模型

### 合并任务（Merge Task）

```sql
CREATE TABLE merge_tasks (
    id              VARCHAR(64) PRIMARY KEY,
    task_id         VARCHAR(64) NOT NULL,
    file_id         VARCHAR(64) NOT NULL,

    -- 状态
    status          ENUM('pending', 'merging', 'completed', 'failed') DEFAULT 'pending',

    -- 合并信息
    total_chunks    INT,
    merged_chunks   INT DEFAULT 0,
    merge_progress  DECIMAL(5,2) DEFAULT 0,

    -- 结果
    final_hash      VARCHAR(128),
    file_size       BIGINT,

    -- 错误信息
    error_message   TEXT,
    error_code      VARCHAR(32),

    -- 时间
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,

    INDEX idx_task (task_id)
);
```

---

## 7. 分片状态机

### 分片状态转换

```
                  ┌─────────┐
                  │ pending │
                  └────┬────┘
                       │ 上传请求
                       ▼
                  ┌─────────┐
            ┌─────│uploading│─────┐
            │     └────┬────┘     │
            │   成功    │    失败   │
            ▼          │          ▼
      ┌─────────┐      │    ┌─────────┐
      │completed│      │    │ failed  │
      └─────────┘      │    └─────────┘
                       │
                  重新上传
                       │
                       ▼
                  ┌─────────┐
                  │ pending │（或直接重试）
                  └─────────┘
```

---

## 8. 上传任务状态机

### 任务状态转换

```
┌──────────────┐
│ initialized │
└──────┬──────┘
       │ 开始上传分片
       ▼
┌──────────────┐     全部上传完成      ┌──────────────┐
│  uploading   │─────────────────────▶│  merging    │
└──────┬──────┘                      └──────┬──────┘
       │ 取消/超时                       │ 合并完成
       ▼                                 ▼
┌──────────────┐                  ┌──────────────┐
│ cancelled   │                  │ completed   │
└──────────────┘                  └──────────────┘

       ┌──────────────┐
       │   failed     │  ← 合并失败（Hash 不一致等）
       └──────────────┘
```

---

## 9. 大文件 Hash 计算

### 分片 Hash 计算（Web Worker）

```go
// Web Worker 中计算文件 Hash
async function computeFileHash(file, chunkSize = 5 * 1024 * 1024) {
    const hash = await crypto.subtle.digest('MD5', await file.arrayBuffer());

    // 对于大文件，分片计算再合并
    // 1. 读取第一个分片
    // 2. 计算该分片 Hash
    // 3. 读取下一个分片，用上一个 Hash 作为参数继续计算
    // 4. 最终得到整个文件的 Hash
}
```

### 分片 Hash 校验

```sql
-- 每个分片上传时记录 Hash
INSERT INTO upload_chunks (id, task_id, chunk_index, chunk_hash, chunk_size, storage_path, status, uploaded_at)
VALUES ('chunk-001', 'task-abc', 0, 'md5:abc123', 5242880, '/path/chunk_0000', 'completed', NOW())

-- 合并前验证所有分片
SELECT chunk_index, chunk_hash
FROM upload_chunks
WHERE task_id = 'task-abc'
ORDER BY chunk_index

-- 合并后验证整体 Hash
SELECT file_hash FROM files WHERE id = 'file-abc'
-- 对比客户端提供的 file_hash
```

---

## 10. 存储方案数据模型

### OSS / S3 对象存储

```go
type ObjectStorageConfig struct {
    Provider   string  // "oss" | "s3" | "minio"
    Endpoint  string
    Bucket    string
    AccessKey string
    SecretKey string
    Region    string
}

// 上传分片到 OSS
func (s *ObjectStorage) UploadChunk(taskID string, chunkIndex int, data []byte) error {
    key := fmt.Sprintf("%s/chunk_%04d", taskID, chunkIndex)
    return s.client.PutObject(s.bucket, key, bytes.NewReader(data), int64(len(data)))
}

// 合并时组装最终文件
func (s *ObjectStorage) MergeChunks(taskID string, chunkCount int, destKey string) error {
    // OSS 支持拼接（上传后拼接多个 Object）
    // S3 需要下载后本地拼接，再上传
}
```

### 分片清理策略

```
上传完成/取消/超时 → 触发分片清理

清理规则：
  1. 上传完成后，保留分片 N 天后删除（N = 配置，默认 7 天）
  2. 上传取消后，立即清理分片
  3. 上传超时后，延迟 1 小时清理（给用户恢复时间）

清理方式：
  - 定时任务扫描（每小时）
  - 或使用 OSS 生命周期规则自动清理
```
