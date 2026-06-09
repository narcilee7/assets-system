# Electron 进程模型与安全

## 进程架构

```
Main Process (Node.js)
    │
    ├── 创建 Renderer Process
    │   ├── preload.js   (隔离的桥梁)
    │   └── index.html   (前端应用)
    │
    ├── 创建 Renderer Process
    │   └── ...
    │
    ├── 系统服务
    │   ├── 文件系统
    │   ├── 系统通知
    │   ├── 全局快捷键
    │   └── 自动更新
    │
    └── IPC 通信中心
```

| 进程 | 职责 | 能力 |
|------|------|------|
| Main | 应用入口、窗口管理、系统调用 | 完整 Node.js + OS API |
| Renderer | 渲染 UI、用户交互 | 受限（默认无 Node.js） |
| Preload | 连接 Main 和 Renderer | 有限制的 bridge |
| Utility | 后台任务、插件 | 根据用途受限 |

## 1. 安全最佳实践

### 1.1 Context Isolation（上下文隔离）

```javascript
// main.js - 创建窗口时启用隔离
const { BrowserWindow } = require('electron');

const mainWindow = new BrowserWindow({
  width: 1200,
  height: 800,
  webPreferences: {
    contextIsolation: true,     // 必须启用！
    nodeIntegration: false,     // 必须禁用！
    sandbox: true,              // 沙盒渲染
    preload: path.join(__dirname, 'preload.js'),
  },
});
```

```javascript
// preload.js - 安全地暴露有限 API
const { contextBridge, ipcRenderer } = require('electron');

// 只暴露白名单 API，不暴露整个 ipcRenderer
contextBridge.exposeInMainWorld('electronAPI', {
  // 文件操作
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (content) => ipcRenderer.invoke('dialog:saveFile', content),

  // 平台信息（只读）
  platform: process.platform,

  // 监听主进程事件
  onFileOpened: (callback) => ipcRenderer.on('file:opened', callback),

  // 移除监听（防止内存泄漏）
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
```

```javascript
// renderer.js - 前端代码通过暴露的 API 通信
async function handleOpenFile() {
  const filePath = await window.electronAPI.openFile();
  console.log('Selected:', filePath);
}

// 接收主进程推送
window.electronAPI.onFileOpened((event, filePath) => {
  loadFile(filePath);
});
```

### 1.2 内容安全策略（CSP）

```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com;
">
```

### 1.3 远程内容安全

```javascript
// main.js
const { shell } = require('electron');

// ❌ 错误：在渲染进程中直接打开外部链接
// window.location.href = 'https://evil.com'

// ✅ 正确：通过主进程用系统浏览器打开
mainWindow.webContents.setWindowOpenHandler(({ url }) => {
  if (url.startsWith('https:')) {
    shell.openExternal(url);  // 用系统默认浏览器打开
  }
  return { action: 'deny' };  // 禁止在应用内打开
});
```

## 2. 进程间通信（IPC）安全

```javascript
// main.js - IPC Handler 必须验证输入
const { ipcMain, dialog, fs } = require('electron');

// ❌ 危险：未验证路径可能导致目录遍历攻击
ipcMain.handle('file:read', async (event, filePath) => {
  return fs.readFileSync(filePath, 'utf-8');  // 可以读取任意文件！
});

// ✅ 安全：限制在指定目录内
const ALLOWED_DIR = path.join(app.getPath('userData'), 'documents');

ipcMain.handle('file:read', async (event, relativePath) => {
  const resolvedPath = path.resolve(ALLOWED_DIR, relativePath);

  // 路径遍历检查
  if (!resolvedPath.startsWith(ALLOWED_DIR)) {
    throw new Error('Access denied: path outside allowed directory');
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error('File not found');
  }

  return fs.readFileSync(resolvedPath, 'utf-8');
});
```

## 3. 自动更新安全

```javascript
// 更新前校验签名
const { autoUpdater } = require('electron-updater');
const crypto = require('crypto');

autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName, releaseDate, updateURL) => {
  // 校验更新包签名
  const publicKey = fs.readFileSync('public.pem');
  const signature = fs.readFileSync(path.join(autoUpdater.downloadedUpdateHelper.cacheDir, 'update.sig'));

  const verify = crypto.createVerify('SHA256');
  verify.update(fs.readFileSync(updatePath));

  if (!verify.verify(publicKey, signature)) {
    console.error('Update signature verification failed!');
    return;
  }

  autoUpdater.quitAndInstall();
});
```
