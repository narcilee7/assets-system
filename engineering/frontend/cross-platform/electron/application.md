# Electron 简化版应用：Markdown 编辑器

## 应用结构

```
markdown-editor/
├── package.json
├── main.js              # 主进程入口
├── preload.js           # 预加载脚本（安全桥梁）
├── src/
│   ├── index.html       # 渲染页面
│   ├── renderer.js      # 渲染进程逻辑
│   ├── editor.js        # 编辑器组件
│   ├── preview.js       # 预览组件
│   └── styles.css
├── build/               # 打包输出
└── electron-builder.yml # 打包配置
```

## 1. 主进程

```javascript
// main.js
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('src/index.html');

  // 设置应用菜单
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFile(),
        },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu:save'),
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
ipcMain.handle('dialog:openFile', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (filePaths.length === 0) return null;

  const filePath = filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');

  return { filePath, content };
});

ipcMain.handle('dialog:saveFile', async (event, { filePath, content }) => {
  if (!filePath) {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });
    if (result.canceled) return false;
    filePath = result.filePath;
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  return { success: true, filePath };
});

// 系统通知
ipcMain.handle('notification:show', (event, { title, body }) => {
  const { Notification } = require('electron');
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

## 2. Preload 脚本

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 文件操作
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (data) => ipcRenderer.invoke('dialog:saveFile', data),

  // 通知
  showNotification: (options) => ipcRenderer.invoke('notification:show', options),

  // 监听菜单事件
  onMenuSave: (callback) => ipcRenderer.on('menu:save', callback),

  // 平台信息
  platform: process.platform,
});
```

## 3. 渲染进程

```html
<!-- src/index.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';">
  <title>Markdown Editor</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="toolbar">
    <button id="openBtn">打开</button>
    <button id="saveBtn">保存</button>
    <span id="filePath"></span>
  </div>
  <div class="editor-container">
    <textarea id="editor" placeholder="输入 Markdown..."></textarea>
    <div id="preview" class="preview"></div>
  </div>
  <script src="renderer.js"></script>
</body>
</html>
```

```javascript
// src/renderer.js
const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const filePathDisplay = document.getElementById('filePath');

let currentFilePath = null;

// Markdown 实时预览（简化版）
function updatePreview() {
  const markdown = editor.value;
  // 生产环境使用 marked.js，这里展示简化转换
  const html = markdown
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/\n/g, '<br>');

  preview.innerHTML = html;
}

editor.addEventListener('input', updatePreview);

// 打开文件
document.getElementById('openBtn').addEventListener('click', async () => {
  const result = await window.electronAPI.openFile();
  if (result) {
    currentFilePath = result.filePath;
    editor.value = result.content;
    filePathDisplay.textContent = currentFilePath;
    updatePreview();
  }
});

// 保存文件
document.getElementById('saveBtn').addEventListener('click', saveFile);
window.electronAPI.onMenuSave(saveFile);

async function saveFile() {
  const result = await window.electronAPI.saveFile({
    filePath: currentFilePath,
    content: editor.value,
  });

  if (result.success) {
    currentFilePath = result.filePath;
    filePathDisplay.textContent = currentFilePath;
    window.electronAPI.showNotification({
      title: '保存成功',
      body: `文件已保存到 ${result.filePath}`,
    });
  }
}
```

## 4. 系统托盘

```javascript
// main.js - 添加托盘
const { Tray, nativeImage } = require('electron');

let tray;

function createTray() {
  const icon = nativeImage.createFromPath('assets/tray-icon.png');
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: '新建文档', click: () => createNewDocument() },
    { label: '显示窗口', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);

  tray.setToolTip('Markdown Editor');
  tray.setContextMenu(contextMenu);

  // 点击托盘图标显示/隐藏窗口
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});
```

## 5. 打包配置

```yaml
# electron-builder.yml
appId: com.example.markdown-editor
productName: Markdown Editor

directories:
  output: dist

files:
  - main.js
  - preload.js
  - src/**
  - package.json

mac:
  category: public.app-category.productivity
  target:
    - dmg
    - zip

win:
  target:
    - nsis
    - portable

linux:
  target:
    - AppImage
    - deb
```
