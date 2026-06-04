# Failure Mode

## F1: 分片上传失败

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 网络超时 | 单个分片上传超时 | 需要重试 |
| 网络断开 | 用户断网 | 上传中断 |
| 服务器错误 | 500 错误 | 需要重试 |
| 存储满 | OSS/磁盘空间不足 | 上传失败 |

### 应对策略

#### 1. 自动重试（指数退避）

```javascript
async function uploadChunkWithRetry(chunk, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await uploadChunk(chunk);
        } catch (error) {
            if (isRetryableError(error)) {
                const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                await sleep(delay);
                continue;
            }
            throw error;
        }
    }
    throw new Error('Max retries exceeded');
}

function isRetryableError(error) {
    // 网络超时、服务器错误可重试
    // 客户端错误（400）不可重试
    return error.status >= 500 || error.status === -1;
}
```

#### 2. 断点恢复

```javascript
// 页面刷新后自动恢复
window.onload = async function() {
    const savedProgress = restoreProgress(uploadId);
    if (savedProgress) {
        const { missingChunks } = await getMissingChunks(uploadId);
        if (missingChunks.length > 0) {
            showResumePrompt(`有 ${missingChunks.length} 个分片未上传，是否继续？`);
        }
    }
};
```

---

## F2: 文件 Hash 不一致

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 分片数据损坏 | 网络传输中数据损坏 | 合并后文件损坏 |
| 客户端计算错误 | MD5 实现有 bug | 误判秒传失败 |
| 合并顺序错误 | 分片顺序错乱 | 文件损坏 |

### 应对策略

#### 1. 分片级 Hash 校验

```go
// 服务端校验每个分片的 Hash
func (h *UploadHandler) VerifyChunkHash(chunkData []byte, expectedHash string) bool {
    actualHash := md5.Sum(chunkData)
    return hex.EncodeToString(actualHash[:]) == expectedHash
}

// 不一致时拒绝接受
if !VerifyChunkHash(chunkData, req.ChunkHash) {
    c.JSON(400, gin.H{"error": "chunk hash mismatch"})
    return
}
```

#### 2. 合并后整体 Hash 校验

```go
// 合并后校验整体 Hash
finalHash, err := computeFileHash(tmpFile.Name())
if finalHash != expectedHash {
    // 删除已合并的文件
    h.storage.Delete(finalPath)
    // 清理分片
    h.cleanupChunks(uploadID)
    // 返回错误
    return fmt.Errorf("file hash mismatch after merge")
}
```

#### 3. 客户端上传前校验

```javascript
// 分片前计算分片 Hash
async function computeChunkHash(chunk) {
    const buffer = await chunk.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('MD5', buffer);
    return bufferToHex(hashBuffer);
}
```

---

## F3: 合并接口重复调用

### 场景

用户连续点击"完成"按钮两次，或网络重试导致重复请求。

### 影响

- 并发创建两个合并任务
- 产生重复的分片引用
- 数据库一致性问题

### 应对策略

#### 1. 幂等合并接口

```go
func (h *UploadHandler) MergeChunks(c *gin.Context) {
    uploadID := c.Param("upload_id")

    // 检查任务状态
    task, _ := h.taskStore.Get(uploadID)

    switch task.Status {
    case "completed":
        // 已完成，直接返回成功（幂等）
        c.JSON(200, gin.H{
            "status": "completed",
            "file_id": task.FileID,
        })
        return

    case "merging":
        // 正在合并，返回进行中（幂等）
        c.JSON(200, gin.H{
            "status": "merging",
        })
        return

    case "initialized", "uploading":
        // 正常流程，开始合并
        h.startMerge(uploadID)
    }
}
```

#### 2. 分布式锁保护

```go
func (h *UploadHandler) MergeChunks(c *gin.Context) {
    uploadID := c.Param("upload_id")

    // 获取分布式锁
    lock, err := h.redis.GetLock("merge:" + uploadID)
    if err != nil {
        c.JSON(409, gin.H{"error": "merge in progress"})
        return
    }
    defer lock.Release()

    // 执行合并逻辑
    h.doMerge(uploadID)
}
```

---

## F4: 上传超时未完成

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| 用户放弃上传 | 用户关闭页面 | 临时分片占用空间 |
| 长时间中断 | 网络故障 | 任务僵死 |
| 忘记确认 | 用户操作中断 | 资源泄漏 |

### 应对策略

#### 1. 上传任务过期机制

```sql
-- 创建任务时设置过期时间
ALTER TABLE upload_tasks ADD COLUMN expires_at TIMESTAMP;

-- 定时清理过期任务
SELECT * FROM upload_tasks
WHERE status IN ('initialized', 'uploading')
AND updated_at < NOW() - INTERVAL 24 HOUR;

-- 清理分片文件
DELETE FROM upload_chunks WHERE task_id = ?;
DELETE FROM upload_tasks WHERE id = ?;
```

#### 2. 用户提示和确认

```javascript
// 检测到用户要离开页面时提示
window.onbeforeunload = function(e) {
    if (uploadInProgress && progress < 100) {
        e.preventDefault();
        e.returnValue = '上传尚未完成，确定要离开吗？';
    }
};

// 提供恢复机制
localStorage.setItem('upload_pending', JSON.stringify({
    uploadId,
    fileName,
    fileHash,
    uploadedChunks: [...],
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
}));
```

---

## F5: 秒传误判

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| Hash 碰撞 | 不同文件 MD5 相同 | 文件内容被覆盖 |
| 存储故障 | 分片丢失但索引存在 | 合并失败 |

### 应对策略

#### 1. 使用 SHA-256 而非 MD5

```javascript
// 高安全场景使用 SHA-256
async function computeFileHash(file) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return 'sha256:' + bufferToHex(hashBuffer);
}
```

#### 2. 秒传后额外校验

```go
// 秒传返回后，下载文件片段校验
func (h *UploadHandler) VerifyInstantUpload(fileID string, fileHash string) error {
    // 下载文件前 1MB 和后 1MB
    headData, _ := h.storage.ReadRange(fileID, 0, 1024*1024)
    tailData, _ := h.storage.ReadRange(fileID, -1024*1024, 1024*1024)

    // 校验这些片段的 Hash
    if md5(headData) != expectedHeadHash {
        return fmt.Errorf("instant upload verification failed")
    }

    return nil
}
```

---

## F6: 分片并发冲突

### 场景

多个分片同时上传，可能出现：
- 分片数据写入顺序错乱
- 分片状态更新冲突
- 存储文件描述符耗尽

### 应对策略

#### 1. 分片编号唯一索引

```sql
-- 确保同一分片不会重复上传
UNIQUE KEY uk_task_chunk (task_id, chunk_index)

-- 重复上传返回幂等成功
INSERT INTO upload_chunks (...) VALUES (...)
ON DUPLICATE KEY UPDATE uploaded_at = NOW()
```

#### 2. 连接池限制

```go
// 限制同时写入的分片数
type ChunkWriter struct {
    semaphore chan struct{}
}

func NewChunkWriter(maxConcurrency int) *ChunkWriter {
    return &ChunkWriter{
        semaphore: make(chan struct{}, maxConcurrency),
    }
}

func (w *ChunkWriter) Write(chunk *Chunk) error {
    w.semaphore <- struct{}{}
    defer func() { <-w.semaphore }()

    return w.doWrite(chunk)
}
```

---

## F7: 对象存储故障

### 场景

| 场景 | 原因 | 影响 |
|------|------|------|
| OSS 限流 | 请求频率超限 | 上传失败 |
| 网络分区 | 网络不可达 | 上传中断 |
| Bucket 满 | 存储空间不足 | 上传失败 |

### 应对策略

#### 1. 限流和重试

```go
func (s *ObjectStorage) UploadWithRetry(key string, data []byte, maxRetries int) error {
    for attempt := 0; attempt < maxRetries; attempt++ {
        err := s.client.PutObject(key, bytes.NewReader(data))
        if err == nil {
            return nil
        }

        if isRateLimitError(err) {
            // 限流，等待后重试
            time.Sleep(time.Duration(attempt+1) * time.Second)
            continue
        }

        return err
    }
    return fmt.Errorf("max retries exceeded")
}
```

#### 2. 多存储后端降级

```go
type Storage interface {
    Write(key string, data []byte) error
    Read(key string) ([]byte, error)
    Delete(key string) error
}

type FallbackStorage struct {
    primary   Storage
    secondary Storage
}

func (s *FallbackStorage) Write(key string, data []byte) error {
    err := s.primary.Write(key, data)
    if err != nil {
        // 降级到备用存储
        return s.secondary.Write(key, data)
    }
    return nil
}
```
