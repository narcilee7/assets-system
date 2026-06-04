# API

## 文件上传 API

### 1. 秒传检查（Instant Upload Check）

#### 检查文件是否已存在

```http
POST /v1/upload/instant
Content-Type: application/json

{
  "file_hash": "md5:e8b5c3d2f1a0b9c8e7d6f5a4b3c2d1e0",
  "file_name": "large_video.mp4",
  "file_size": 10737418240,
  "chunk_size": 5242880
}
```

响应（文件已存在，秒传成功）：

```json
{
  "success": true,
  "instant_upload": true,
  "file_id": "file-abc123",
  "file_url": "https://storage.example.com/files/file-abc123",
  "file_hash": "md5:e8b5c3d2f1a0b9c8e7d6f5a4b3c2d1e0"
}
```

响应（文件不存在，需要分片上传）：

```json
{
  "success": true,
  "instant_upload": false,
  "upload_id": "upload-01HV3WWZP1A3B5C6D7E8F9G0H",
  "chunk_size": 5242880,
  "chunk_count": 2048,
  "chunks_uploaded": []
}
```

---

### 2. 初始化上传（Init Upload）

#### 创建上传任务

```http
POST /v1/upload/init
Content-Type: application/json

{
  "file_name": "large_video.mp4",
  "file_size": 10737418240,
  "file_hash": "md5:e8b5c3d2f1a0b9c8e7d6f5a4b3c2d1e0",
  "chunk_size": 5242880,
  "total_chunks": 2048,
  "metadata": {
    "content_type": "video/mp4",
    "user_id": "u12345",
    "folder_id": "folder-abc"
  }
}
```

响应：

```json
{
  "upload_id": "upload-01HV3WWZP1A3B5C6D7E8F9G0H",
  "file_id": "file-abc123",
  "chunk_size": 5242880,
  "total_chunks": 2048,
  "status": "initialized",
  "created_at": "2024-06-01T10:00:00Z",
  "expires_at": "2024-06-02T10:00:00Z"
}
```

---

### 3. 分片上传（Chunk Upload）

#### 上传单个分片

```http
POST /v1/upload/{upload_id}/chunks/{chunk_index}
Content-Type: application/octet-stream
Content-MD5: {base64_md5_of_chunk}
X-Request-ID: {request_id}

[binary chunk data]
```

响应（成功）：

```json
{
  "chunk_index": 0,
  "chunk_hash": "md5:e8b5c3d2f1a0b9c8",
  "uploaded_at": "2024-06-01T10:00:05Z",
  "server_completed": true
}
```

响应（分片已存在，跳过）：

```json
{
  "chunk_index": 0,
  "skipped": true,
  "reason": "chunk_already_exists"
}
```

#### 批量上传分片（可选）

```http
POST /v1/upload/{upload_id}/chunks/batch
Content-Type: application/json

{
  "chunks": [
    {"index": 0, "hash": "md5:..."},
    {"index": 1, "hash": "md5:..."},
    {"index": 2, "hash": "md5:..."}
  ]
}
```

---

### 4. 查询上传状态（Query Upload Status）

#### 获取已上传分片列表

```http
GET /v1/upload/{upload_id}/status
```

响应：

```json
{
  "upload_id": "upload-01HV3WWZP1A3B5C6D7E8F9G0H",
  "file_id": "file-abc123",
  "total_chunks": 2048,
  "uploaded_chunks": [
    {"index": 0, "hash": "md5:e8b5c3d2", "uploaded_at": "2024-06-01T10:00:05Z"},
    {"index": 1, "hash": "md5:a1b2c3d4", "uploaded_at": "2024-06-01T10:00:10Z"}
  ],
  "uploaded_count": 2,
  "remaining_count": 2046,
  "status": "uploading",
  "progress_percent": 0.1,
  "created_at": "2024-06-01T10:00:00Z",
  "expires_at": "2024-06-02T10:00:00Z"
}
```

---

### 5. 合并文件（Merge Chunks）

#### 触发文件合并

```http
POST /v1/upload/{upload_id}/merge
Content-Type: application/json

{
  "file_hash": "md5:e8b5c3d2f1a0b9c8e7d6f5a4b3c2d1e0",
  "chunks": [
    {"index": 0, "hash": "md5:e8b5c3d2"},
    {"index": 1, "hash": "md5:a1b2c3d4"},
    {"index": 2, "hash": "md5:..."}
  ]
}
```

响应（合并中）：

```json
{
  "upload_id": "upload-01HV3WWZP1A3B5C6D7E8F9G0H",
  "file_id": "file-abc123",
  "status": "merging",
  "estimated_completion": "2024-06-01T10:05:00Z"
}
```

#### 合并完成

```json
{
  "upload_id": "upload-01HV3WWZP1A3B5C6D7E8F9G0H",
  "file_id": "file-abc123",
  "status": "completed",
  "file_url": "https://storage.example.com/files/file-abc123",
  "file_hash": "md5:e8b5c3d2f1a0b9c8e7d6f5a4b3c2d1e0",
  "file_size": 10737418240,
  "merged_at": "2024-06-01T10:05:00Z"
}
```

---

### 6. 取消上传（Cancel Upload）

```http
DELETE /v1/upload/{upload_id}
```

响应：

```json
{
  "upload_id": "upload-01HV3WWZP1A3B5C6D7E8F9G0H",
  "status": "cancelled",
  "chunks_deleted": 150,
  "released_bytes": 786432000
}
```

---

### 7. 文件管理 API

#### 获取文件信息

```http
GET /v1/files/{file_id}
```

响应：

```json
{
  "file_id": "file-abc123",
  "file_name": "large_video.mp4",
  "file_size": 10737418240,
  "file_hash": "md5:e8b5c3d2f1a0b9c8e7d6f5a4b3c2d1e0",
  "content_type": "video/mp4",
  "storage_path": "/chunks/u123/file-abc123/",
  "status": "completed",
  "uploaded_at": "2024-06-01T10:05:00Z",
  "uploaded_by": "u12345"
}
```

#### 删除文件

```http
DELETE /v1/files/{file_id}
```

#### 列出用户文件

```http
GET /v1/files?folder_id={folder_id}&page=1&page_size=20
```

---

## Event Contract

| Event | 触发时机 | 消费者 |
|-------|---------|--------|
| `upload.initiated` | 上传任务创建 | 统计、清理任务 |
| `upload.chunk_completed` | 分片上传完成 | 状态更新、进度计算 |
| `upload.chunk_failed` | 分片上传失败 | 告警、重试处理 |
| `upload.instant_success` | 秒传成功 | 统计、CDN 缓存 |
| `upload.merged` | 文件合并完成 | 状态更新、文件服务 |
| `upload.cancelled` | 上传取消 | 清理分片、释放空间 |
| `upload.expired` | 上传超时未完成 | 清理任务、分片 |
| `upload.hash_mismatch` | Hash 校验失败 | 告警、人工处理 |
