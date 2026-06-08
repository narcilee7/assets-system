# Electron 自动更新

## 更新策略对比

| 策略 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| 全量更新 | 简单可靠 | 包体积大、下载慢 | 小型应用 |
| 差量更新 | 体积小、速度快 | 实现复杂 | 大型应用 |
| 静默更新 | 无感知 | 可能引入 Bug | 内部工具 |
| 提示更新 | 用户可控 | 打断体验 | 消费级应用 |

## 1. 基础自动更新（electron-updater）

```javascript
// main.js
const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');

// 检查更新频率（启动时 + 每 4 小时）
const CHECK_INTERVAL = 4 * 60 * 60 * 1000;

function setupAutoUpdater() {
  // 开发环境不检查更新
  if (process.env.NODE_ENV === 'development') return;

  // 检查更新
  autoUpdater.checkForUpdatesAndNotify();

  // 定时检查
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, CHECK_INTERVAL);

  // 发现更新
  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 ${info.version}，正在后台下载...`,
      buttons: ['确定'],
    });
  });

  // 下载完成
  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox({
      type: 'question',
      buttons: ['立即安装', '稍后'],
      defaultId: 0,
      message: `新版本 ${info.version} 已下载完成，是否立即安装？`,
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  // 更新错误
  autoUpdater.on('error', (err) => {
    console.error('Update error:', err);
  });
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
});
```

## 2. 灰度更新

```javascript
// update-service.js
const crypto = require('crypto');

class UpdateService {
  constructor() {
    this.rolloutPercentage = 0;  // 灰度百分比
  }

  // 基于用户 ID 的一致性哈希
  shouldUpdate(userId) {
    const hash = crypto.createHash('md5').update(userId).digest('hex');
    const bucket = parseInt(hash.slice(0, 4), 16) % 100;
    return bucket < this.rolloutPercentage;
  }

  async checkUpdate(userId, currentVersion) {
    const latest = await this.fetchLatestVersion();

    if (latest.version === currentVersion) {
      return { hasUpdate: false };
    }

    // 检查是否在灰度范围
    if (!this.shouldUpdate(userId)) {
      return { hasUpdate: false, reason: 'not_in_rollout' };
    }

    // 检查版本兼容性（防止降级）
    if (this.compareVersion(latest.version, currentVersion) < 0) {
      return { hasUpdate: false, reason: 'newer_installed' };
    }

    return {
      hasUpdate: true,
      version: latest.version,
      url: latest.url,
      releaseNotes: latest.notes,
      mandatory: latest.mandatory || false,
    };
  }

  compareVersion(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const a = parts1[i] || 0;
      const b = parts2[i] || 0;
      if (a !== b) return a - b;
    }
    return 0;
  }
}
```

## 3. 更新服务器配置

```json
{
  "version": "1.2.3",
  "releaseDate": "2024-01-15T10:00:00Z",
  "mandatory": false,
  "rolloutPercentage": 10,
  "notes": "修复内存泄漏，优化启动速度",
  "files": [
    {
      "platform": "mac",
      "arch": "x64",
      "url": "https://cdn.example.com/app-1.2.3-mac.zip",
      "size": 45234123,
      "checksum": "sha256:abc123..."
    },
    {
      "platform": "win",
      "arch": "x64",
      "url": "https://cdn.example.com/app-1.2.3-win.exe",
      "size": 38745123,
      "checksum": "sha256:def456..."
    }
  ]
}
```

## 4. 回滚机制

```javascript
// 保留上一个版本用于紧急回滚
class UpdateManager {
  constructor() {
    this.backupDir = path.join(app.getPath('userData'), 'update-backup');
  }

  async installUpdate(updateInfo) {
    // 备份当前版本
    await this.backupCurrentVersion();

    try {
      await this.downloadAndInstall(updateInfo);
      // 验证新版本是否正常工作
      const healthy = await this.healthCheck();
      if (!healthy) {
        throw new Error('Health check failed after update');
      }
    } catch (err) {
      console.error('Update failed, rolling back...');
      await this.rollback();
      throw err;
    }
  }

  async rollback() {
    const backupPath = path.join(this.backupDir, 'previous');
    if (fs.existsSync(backupPath)) {
      // 恢复备份
      await this.restoreFromBackup(backupPath);
      dialog.showErrorBox('更新回滚', '新版本安装失败，已恢复至上一版本。');
    }
  }
}
```
