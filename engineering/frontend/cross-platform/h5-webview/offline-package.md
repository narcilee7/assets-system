# 离线包系统

## 核心问题

H5 页面加载依赖网络，弱网环境下体验差。离线包将静态资源（HTML/CSS/JS）预下载到本地，实现**秒开**。

## 1. 离线包架构

```
服务端                              客户端
  │                                  │
  │  1. 构建 ZIP 包                  │
  │     (HTML + JS + CSS + 配置)     │
  ▼                                  │
┌─────────────┐                     │
│  CDN 存储    │                     │
│  /packages/  │                     │
│  ├── v1.0.0  │                     │
│  ├── v1.1.0  │                     │
│  └── v1.1.1  │                     │
└──────┬──────┘                     │
       │ 2. 下发更新配置              │
       │    {id, version, url, md5}  │
       │◀────────────────────────────│
       │                             │
       │ 3. 下载 ZIP 包               │
       │────────────────────────────▶│
       │                             │
       │                             ▼
       │                    ┌─────────────┐
       │                    │ 本地存储     │
       │                    │ /offline/    │
       │                    │ ├── pkg_01/  │
       │                    │ │   ├── v1/  │
       │                    │ │   └── v2/  │
       │                    │ └── pkg_02/  │
       │                    └─────────────┘
```

## 2. 离线包配置

```json
{
  "packages": [
    {
      "id": "shop_home",
      "name": "商城首页",
      "version": "1.2.3",
      "url": "https://cdn.example.com/packages/shop_home/1.2.3.zip",
      "md5": "a1b2c3d4e5f6...",
      "size": 1024000,
      "priority": "high",
      "entry": "index.html",
      "routes": ["/shop", "/shop/home"],
      "dependencies": ["common_lib@2.1.0"]
    }
  ]
}
```

## 3. 下载与校验

```kotlin
// Android 离线包管理器
class OfflinePackageManager(private val context: Context) {
    private val packageDir = File(context.filesDir, "offline_packages")

    suspend fun downloadPackage(config: PackageConfig): Result<Unit> {
        return try {
            // 1. 下载 ZIP
            val zipFile = File(packageDir, "${config.id}_${config.version}.zip")
            val response = httpClient.download(config.url)
            response.body()?.byteStream()?.use { input ->
                zipFile.outputStream().use { output ->
                    input.copyTo(output)
                }
            }

            // 2. MD5 校验
            val md5 = zipFile.md5()
            if (md5 != config.md5) {
                zipFile.delete()
                return Result.failure(ChecksumMismatchException())
            }

            // 3. 解压到版本目录
            val targetDir = File(packageDir, "${config.id}/${config.version}")
            unzip(zipFile, targetDir)
            zipFile.delete()

            // 4. 更新索引
            updateIndex(config.id, config.version)

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun getLocalPath(packageId: String): String? {
        val version = getCurrentVersion(packageId) ?: return null
        return File(packageDir, "$packageId/$version").absolutePath
    }
}
```

## 4. 灰度与回滚

```typescript
// 灰度策略
interface RolloutStrategy {
  percentage: number;           // 百分比灰度
  deviceTypes?: string[];       // 特定机型
  osVersions?: string[];        // 特定系统版本
  userSegments?: string[];      // 特定用户群
  regions?: string[];           // 特定地区
}

// 是否命中灰度
function isInRollout(strategy: RolloutStrategy): boolean {
  // 基于设备 ID 做一致性哈希，保证同一设备始终命中/不命中
  const hash = hashDeviceId(getDeviceId());
  const bucket = hash % 100;
  return bucket < strategy.percentage;
}

// 回滚机制
class PackageManager {
  async loadPackage(packageId: string) {
    const currentVersion = this.getCurrentVersion(packageId);
    const latestVersion = await this.fetchLatestVersion(packageId);

    if (latestVersion && latestVersion !== currentVersion) {
      try {
        await this.downloadPackage(packageId, latestVersion);
        this.setCurrentVersion(packageId, latestVersion);
      } catch (e) {
        // 下载失败，保持当前版本（隐式回滚）
        console.error('Package update failed, keeping current version');
      }
    }

    return this.getLocalPath(packageId, currentVersion);
  }

  // 紧急回滚：服务端标记版本为 bad 时，回退到上一个可用版本
  async emergencyRollback(packageId: string) {
    const badVersion = this.getCurrentVersion(packageId);
    const fallbackVersion = await this.getPreviousVersion(packageId, badVersion);
    if (fallbackVersion) {
      this.setCurrentVersion(packageId, fallbackVersion);
      this.deletePackage(packageId, badVersion);
    }
  }
}
```

## 5. WebView 加载离线包

```kotlin
// 拦截 WebView 请求，优先使用本地资源
class OfflineResourceInterceptor(
    private val packageManager: OfflinePackageManager
) : WebViewClient() {

    override fun shouldInterceptRequest(
        view: WebView,
        request: WebResourceRequest
    ): WebResourceResponse? {
        val url = request.url.toString()

        // 匹配离线包路由
        val packageId = routeMatcher.match(url)
        if (packageId != null) {
            val localPath = packageManager.getLocalPath(packageId)
            if (localPath != null) {
                // 将在线 URL 映射到本地文件
                val relativePath = url.substringAfter(packageId)
                val file = File(localPath, relativePath.ifEmpty { "index.html" })
                if (file.exists()) {
                    return WebResourceResponse(
                        getMimeType(file),
                        "UTF-8",
                        file.inputStream()
                    )
                }
            }
        }

        return super.shouldInterceptRequest(view, request)
    }
}
```
