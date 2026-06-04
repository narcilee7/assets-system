# Read & Write Path

## 文件上传核心流程

### 完整上传流程

```
用户选择文件
  │
  ▼
计算文件 Hash（MD5/SHA-256）
  │
  ▼
检查秒传（查询 file_hash_index）
  │
  ├── 文件已存在 → 秒传成功，直接返回
  │
  └── 文件不存在
       │
       ▼
  初始化上传任务（/upload/init）
       │
       ▼
  分片上传（并行 3-5 个分片）
       │
       ▼
  上传进度实时同步到 localStorage
       │
       ▼
  所有分片上传完成
       │
       ▼
  合并文件（/upload/{id}/merge）
       │
       ▼
  校验整体 Hash
       │
       ├── Hash 一致 → 上传成功
       └── Hash 不一致 → 返回错误，重新上传
```

---

## 详细阶段分析

### 阶段 1：文件 Hash 计算

#### 大文件 Hash 计算（Web Worker）

```javascript
// 在 Web Worker 中计算 Hash，避免阻塞主线程
self.onmessage = async function(e) {
    const { file, chunkSize = 5 * 1024 * 1024 } = e.data;

    const chunkCount = Math.ceil(file.size / chunkSize);
    let completedChunks = 0;

    // 分片读取 + 计算
    for (let i = 0; i < chunkCount; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        const chunkHash = await computeChunkHash(chunk);

        // 发送进度
        self.postMessage({
            type: 'progress',
            completed: ++completedChunks,
            total: chunkCount
        });
    }

    // 最终 Hash
    self.postMessage({ type: 'complete', hash: finalHash });
};

async function computeChunkHash(chunk) {
    // 使用 SubtleCrypto API 计算 Hash
    const buffer = await chunk.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return bufferToHex(hashBuffer);
}
```

#### 主线程接收进度

```javascript
worker.onmessage = function(e) {
    if (e.data.type === 'progress') {
        updateProgressBar(e.data.completed / e.data.total);
    }
    if (e.data.type === 'complete') {
        uploadFile(e.data.hash);
    }
};
```

---

### 阶段 2：秒传检查

#### 秒传流程

```javascript
async function checkInstantUpload(fileHash, fileName, fileSize) {
    const response = await fetch('/api/v1/upload/instant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            file_hash: fileHash,
            file_name: fileName,
            file_size: fileSize
        })
    });

    const result = await response.json();

    if (result.instant_upload) {
        // 秒传成功
        showSuccess('文件已存在，快速完成！');
        return { success: true, file_id: result.file_id };
    } else {
        // 需要分片上传
        return {
            success: false,
            upload_id: result.upload_id,
            chunk_size: result.chunk_size
        };
    }
}
```

---

### 阶段 3：分片上传

#### 分片器实现

```javascript
class ChunkUploader {
    constructor(file, uploadId, options = {}) {
        this.file = file;
        this.uploadId = uploadId;
        this.chunkSize = options.chunkSize || 5 * 1024 * 1024; // 5MB
        this.maxConcurrency = options.maxConcurrency || 3;
        this.chunks = this.createChunks();
    }

    createChunks() {
        const chunks = [];
        let start = 0;
        let index = 0;

        while (start < this.file.size) {
            const end = Math.min(start + this.chunkSize, this.file.size);
            chunks.push({
                index: index++,
                start: start,
                end: end,
                blob: this.file.slice(start, end),
                status: 'pending'
            });
            start = end;
        }

        return chunks;
    }

    async upload() {
        // 并发控制：同时最多上传 N 个分片
        const queue = new ChunkQueue(this.chunks, this.maxConcurrency);
        const results = await queue.process();

        return this.aggregateResults(results);
    }
}
```

#### 并发控制

```javascript
class ChunkQueue {
    constructor(chunks, maxConcurrency) {
        this.chunks = chunks;
        this.maxConcurrency = maxConcurrency;
        this.running = 0;
        this.results = [];
    }

    async process() {
        const promises = [];

        for (const chunk of this.chunks) {
            const promise = this.uploadChunk(chunk);
            promises.push(promise);

            // 控制并发数
            if (this.running >= this.maxConcurrency) {
                await Promise.race(promises);
            }
        }

        return Promise.all(promises);
    }

    async uploadChunk(chunk) {
        this.running++;

        try {
            const formData = new FormData();
            formData.append('chunk', chunk.blob);
            formData.append('index', chunk.index);
            formData.append('hash', await this.computeChunkHash(chunk.blob));

            const response = await fetch(`/api/v1/upload/${this.uploadId}/chunks/${chunk.index}`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            // 保存进度到 localStorage
            this.saveProgress(chunk.index);

            return { success: true, chunk };
        } catch (error) {
            return { success: false, chunk, error };
        } finally {
            this.running--;
        }
    }

    saveProgress(chunkIndex) {
        const progress = JSON.parse(localStorage.getItem('upload_progress') || '{}');
        progress[this.uploadId] = progress[this.uploadId] || { uploaded: [] };
        progress[this.uploadId].uploaded.push(chunkIndex);
        localStorage.setItem('upload_progress', JSON.stringify(progress));
    }
}
```

---

### 阶段 4：断点续传

#### 恢复上传

```javascript
async function resumeUpload(uploadId) {
    // 1. 从 localStorage 获取已上传的分片
    const localProgress = getLocalProgress(uploadId);

    // 2. 从服务端获取已上传的分片
    const serverStatus = await fetch(`/api/v1/upload/${uploadId}/status`);
    const { uploaded_chunks } = await serverStatus.json();

    // 3. 计算缺失的分片
    const allChunks = Array.from({ length: totalChunks }, (_, i) => i);
    const missingChunks = allChunks.filter(i => !uploaded_chunks.includes(i));

    // 4. 跳过已上传的分片，只上传缺失的
    return uploadMissingChunks(uploadId, missingChunks);
}
```

#### 进度持久化

```javascript
// 定期保存进度到 localStorage
function saveProgress(uploadId, uploadedChunks) {
    const progress = {
        upload_id: uploadId,
        file_name: fileName,
        file_hash: fileHash,
        total_chunks: totalChunks,
        uploaded_chunks: uploadedChunks,
        progress_percent: (uploadedChunks.length / totalChunks * 100).toFixed(2),
        last_updated: Date.now()
    };

    localStorage.setItem(`upload_${uploadId}`, JSON.stringify(progress));
}

// 页面刷新后恢复
function restoreProgress(uploadId) {
    const saved = localStorage.getItem(`upload_${uploadId}`);
    if (saved) {
        const progress = JSON.parse(saved);
        // 检查是否超时（24h 内）
        if (Date.now() - progress.last_updated < 24 * 60 * 60 * 1000) {
            return progress;
        }
    }
    return null;
}
```

---

### 阶段 5：文件合并

#### 合并请求

```javascript
async function mergeChunks(uploadId, fileHash, chunkHashes) {
    const response = await fetch(`/api/v1/upload/${uploadId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            file_hash: fileHash,
            chunks: chunkHashes.map((hash, index) => ({ index, hash }))
        })
    });

    const result = await response.json();

    if (result.status === 'merging') {
        // 合并中，等待完成
        return waitForMergeComplete(uploadId);
    }

    return result;
}

async function waitForMergeComplete(uploadId) {
    // 轮询合并状态
    while (true) {
        const status = await fetch(`/api/v1/upload/${uploadId}/status`);
        const result = await status.json();

        if (result.status === 'completed') {
            return result;
        }

        if (result.status === 'failed') {
            throw new Error('合并失败：' + result.error_message);
        }

        await sleep(1000); // 等待 1 秒
    }
}
```

---

## 服务端处理

### 分片上传处理

```go
func (h *UploadHandler) UploadChunk(c *gin.Context) {
    uploadID := c.Param("upload_id")
    chunkIndex, _ := strconv.Atoi(c.Param("chunk_index"))

    // 读取分片数据
    chunkData, err := io.ReadAll(c.Request.Body)
    if err != nil {
        c.JSON(400, gin.H{"error": "failed to read chunk"})
        return
    }

    // 计算分片 Hash
    chunkHash := md5.Sum(chunkData)

    // 检查分片是否已存在（幂等性）
    existing, err := h.chunkStore.Exists(uploadID, chunkIndex)
    if existing {
        c.JSON(200, gin.H{"chunk_index": chunkIndex, "skipped": true})
        return
    }

    // 上传到存储（OSS / 本地）
    storagePath := fmt.Sprintf("%s/chunk_%04d", uploadID, chunkIndex)
    err = h.storage.Write(storagePath, chunkData)
    if err != nil {
        c.JSON(500, gin.H{"error": "failed to store chunk"})
        return
    }

    // 记录分片状态
    err = h.chunkStore.Create(&Chunk{
        TaskID:     uploadID,
        ChunkIndex: chunkIndex,
        ChunkHash:  hex.EncodeToString(chunkHash[:]),
        StoragePath: storagePath,
        Status:     "completed",
    })

    // 更新任务进度
    h.taskStore.IncrementUploadedChunks(uploadID)

    c.JSON(200, gin.H{
        "chunk_index": chunkIndex,
        "chunk_hash": hex.EncodeToString(chunkHash[:]),
        "uploaded_at": time.Now(),
    })
}
```

### 文件合并处理

```go
func (h *UploadHandler) MergeChunks(c *gin.Context) {
    uploadID := c.Param("upload_id")

    var req MergeRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": "invalid request"})
        return
    }

    // 1. 获取所有分片
    chunks, err := h.chunkStore.ListByTaskID(uploadID)
    if err != nil {
        c.JSON(500, gin.H{"error": "failed to list chunks"})
        return
    }

    // 2. 校验分片完整性
    if len(chunks) != req.TotalChunks {
        c.JSON(400, gin.H{"error": "incomplete chunks"})
        return
    }

    // 3. 更新任务状态
    h.taskStore.UpdateStatus(uploadID, "merging")

    // 4. 异步合并（避免超时）
    go h.mergeFileAsync(uploadID, chunks, req.FileHash)

    c.JSON(200, gin.H{
        "upload_id": uploadID,
        "status":    "merging",
    })
}

func (h *UploadHandler) mergeFileAsync(uploadID string, chunks []*Chunk, expectedHash string) {
    // 1. 按顺序拼接分片
    tmpFile, _ := os.CreateTemp("", "merge_*")
    defer os.Remove(tmpFile.Name())

    for _, chunk := range chunks {
        data, _ := h.storage.Read(chunk.StoragePath)
        tmpFile.Write(data)
    }
    tmpFile.Close()

    // 2. 校验整体 Hash
    finalHash, _ := computeFileHash(tmpFile.Name())
    if finalHash != expectedHash {
        h.taskStore.UpdateStatus(uploadID, "failed")
        h.taskStore.SetError(uploadID, "hash_mismatch")
        return
    }

    // 3. 移动到最终存储
    finalPath := fmt.Sprintf("files/%s", uploadID)
    h.storage.Move(tmpFile.Name(), finalPath)

    // 4. 更新状态
    h.taskStore.UpdateStatus(uploadID, "completed")

    // 5. 清理分片
    h.cleanupChunks(uploadID)
}
```

---

## 上传重试策略

### 分片级别重试

```javascript
async function uploadChunkWithRetry(chunk, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await uploadChunk(chunk);
        } catch (error) {
            if (attempt === maxRetries - 1) throw error;

            // 指数退避
            const delay = Math.pow(2, attempt) * 1000;
            await sleep(delay);
        }
    }
}
```

### 整体上传重试

```javascript
async function uploadWithRetry(uploadId, chunks) {
    const failedChunks = [];

    for (const chunk of chunks) {
        try {
            await uploadChunkWithRetry(chunk);
        } catch (error) {
            failedChunks.push(chunk);
        }
    }

    // 递归重试失败的
    if (failedChunks.length > 0) {
        return uploadWithRetry(uploadId, failedChunks);
    }
}
```

---

## 进度计算

### 进度上报

```javascript
function calculateProgress(uploadedChunks, totalChunks) {
    const percent = (uploadedChunks / totalChunks * 100).toFixed(2);
    const uploadedBytes = uploadedChunks * chunkSize;
    const totalBytes = totalChunks * chunkSize;
    const speed = calculateSpeed(uploadedBytes); // bytes/s
    const remaining = totalBytes - uploadedBytes;
    const eta = remaining / speed; // seconds

    return {
        percent,
        uploadedBytes,
        totalBytes,
        speed,
        eta,
        remaining: formatTime(eta)
    };
}
```

### 速度计算

```javascript
let lastUploadedBytes = 0;
let lastTime = Date.now();

function calculateSpeed(currentUploadedBytes) {
    const now = Date.now();
    const timeDiff = (now - lastTime) / 1000; // seconds
    const bytesDiff = currentUploadedBytes - lastUploadedBytes;

    lastUploadedBytes = currentUploadedBytes;
    lastTime = now;

    return bytesDiff / timeDiff; // bytes per second
}
```
