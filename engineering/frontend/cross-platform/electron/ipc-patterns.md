# Electron IPC 模式

## 1. Invoke / Handle（请求-响应）

适用于 Renderer 请求 Main 执行操作并等待结果。

```javascript
// preload.js
contextBridge.exposeInMainWorld('electronAPI', {
  getSystemInfo: () => ipcRenderer.invoke('system:getInfo'),
  readConfig: (key) => ipcRenderer.invoke('config:read', key),
});

// main.js
ipcMain.handle('system:getInfo', async () => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: process.getSystemVersion(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
  };
});

ipcMain.handle('config:read', async (event, key) => {
  const configPath = path.join(app.getPath('userData'), 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return config[key];
});

// renderer.js
async function showSystemInfo() {
  const info = await window.electronAPI.getSystemInfo();
  console.log(`Platform: ${info.platform}, Memory: ${info.totalMemory / 1024 / 1024}MB`);
}
```

## 2. Send / On（发布-订阅）

适用于 Main 主动向 Renderer 推送事件。

```javascript
// main.js - 监听系统事件并推送给 Renderer
const { powerMonitor } = require('electron');

powerMonitor.on('suspend', () => {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('system:suspend');
  });
});

powerMonitor.on('resume', () => {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('system:resume');
  });
});

// preload.js
contextBridge.exposeInMainWorld('electronAPI', {
  onSystemSuspend: (callback) => ipcRenderer.on('system:suspend', callback),
  onSystemResume: (callback) => ipcRenderer.on('system:resume', callback),
  removeSystemListeners: () => {
    ipcRenderer.removeAllListeners('system:suspend');
    ipcRenderer.removeAllListeners('system:resume');
  },
});

// renderer.js
window.electronAPI.onSystemSuspend(() => {
  // 保存未保存的内容
  autoSave();
});

window.electronAPI.onSystemResume(() => {
  // 恢复网络连接，同步数据
  syncData();
});
```

## 3. Renderer 到 Renderer（窗口间通信）

```javascript
// main.js - 作为消息中转站
ipcMain.on('window:broadcast', (event, { channel, data }) => {
  BrowserWindow.getAllWindows().forEach(win => {
    if (win.webContents.id !== event.sender.id) {
      win.webContents.send(channel, data);
    }
  });
});

// preload.js
contextBridge.exposeInMainWorld('electronAPI', {
  broadcast: (channel, data) => ipcRenderer.send('window:broadcast', { channel, data }),
  onBroadcast: (channel, callback) => ipcRenderer.on(channel, callback),
});

// renderer.js - 窗口 A 发送
window.electronAPI.broadcast('theme:changed', { theme: 'dark' });

// renderer.js - 窗口 B 接收
window.electronAPI.onBroadcast('theme:changed', (event, { theme }) => {
  document.body.className = theme;
});
```

## 4. TypeScript 类型安全 IPC

```typescript
// ipc-types.ts
export interface IPCChannels {
  'dialog:openFile': {
    request: void;
    response: { filePath: string; content: string } | null;
  };
  'dialog:saveFile': {
    request: { filePath?: string; content: string };
    response: { success: boolean; filePath: string };
  };
  'config:read': {
    request: string;  // key
    response: unknown;
  };
  'system:suspend': {
    request: void;
    response: void;
  };
}

// typed-ipc.ts
import { ipcMain, ipcRenderer, IpcMainInvokeEvent } from 'electron';
import { IPCChannels } from './ipc-types';

export function typedHandle<K extends keyof IPCChannels>(
  channel: K,
  handler: (
    event: IpcMainInvokeEvent,
    request: IPCChannels[K]['request']
  ) => Promise<IPCChannels[K]['response']> | IPCChannels[K]['response']
) {
  ipcMain.handle(channel, handler as any);
}

export function typedInvoke<K extends keyof IPCChannels>(
  channel: K,
  request: IPCChannels[K]['request']
): Promise<IPCChannels[K]['response']> {
  return ipcRenderer.invoke(channel, request);
}

// 使用
typedHandle('dialog:openFile', async (event) => {
  // 类型安全的 handler
  const result = await dialog.showOpenDialog(...);
  return result.filePaths[0] ? { filePath: result.filePaths[0], content: '' } : null;
});
```
