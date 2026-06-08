# JSBridge 能力检测与降级

## 核心问题

当 H5 运行在多种容器中时（App 1.0、App 2.0、微信浏览器、系统浏览器），必须回答：
- **这个容器支持什么能力？**
- **不支持时如何优雅降级？**

## 1. 能力检测方案

### 方案 A：User-Agent 解析（不推荐）

```javascript
// 脆弱、易伪造、维护成本高
const isApp1 = /MyApp\/1\.\d+/.test(navigator.userAgent);
const isApp2 = /MyApp\/2\.\d+/.test(navigator.userAgent);
```

### 方案 B：特性检测（推荐）

```javascript
// 检测某个具体 API 是否可用
async function checkCapability(module, action) {
  try {
    const result = await bridge.invoke('capability', 'check', { module, action });
    return result.available;
  } catch {
    return false;
  }
}

// 批量检测
async function detectCapabilities() {
  const capabilities = {
    scan: await checkCapability('scan', 'scan'),
    pay: await checkCapability('payment', 'pay'),
    share: await checkCapability('share', 'share'),
    location: await checkCapability('location', 'getCurrentPosition'),
    push: await checkCapability('push', 'getToken'),
  };
  return capabilities;
}
```

### 方案 C：能力声明协议（最佳）

容器在页面加载时主动注入能力列表：

```javascript
// 容器注入
window._containerCapabilities = {
  version: '2.5.1',
  platform: 'ios',
  capabilities: {
    scan: { version: '1.0', actions: ['scan', 'checkPermission'] },
    payment: { version: '2.1', actions: ['pay', 'checkAvailable'] },
    share: { version: '1.5', actions: ['share', 'showSheet'] },
  },
};

// JS 层读取
function getCapability(module, action) {
  const caps = window._containerCapabilities?.capabilities;
  if (!caps) return { available: false, reason: 'not_in_app' };

  const mod = caps[module];
  if (!mod) return { available: false, reason: 'module_not_found' };

  if (!mod.actions.includes(action)) {
    return { available: false, reason: 'action_not_supported', containerVersion: mod.version };
  }

  return { available: true, version: mod.version };
}
```

## 2. 降级策略矩阵

```typescript
type FallbackStrategy = 'block' | 'warn' | 'redirect' | 'polyfill';

interface CapabilityConfig {
  module: string;
  action: string;
  fallback: FallbackStrategy;
  polyfill?: () => Promise<any>;
  redirectUrl?: string;
  warnMessage?: string;
}

const CAPABILITY_MATRIX: CapabilityConfig[] = [
  {
    module: 'payment',
    action: 'pay',
    fallback: 'redirect',
    redirectUrl: '/payment/h5',
  },
  {
    module: 'scan',
    action: 'scan',
    fallback: 'polyfill',
    polyfill: async () => {
      // 降级为上传二维码图片识别
      const file = await selectFile();
      return api.post('/qrcode/decode', { image: file });
    },
  },
  {
    module: 'share',
    action: 'share',
    fallback: 'polyfill',
    polyfill: async (content) => {
      // 降级为系统分享或复制链接
      if (navigator.share) {
        return navigator.share({ title: content.title, url: content.url });
      }
      await navigator.clipboard.writeText(content.url);
      toast('链接已复制');
    },
  },
  {
    module: 'location',
    action: 'getCurrentPosition',
    fallback: 'polyfill',
    polyfill: () => new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        pos => resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
        reject
      );
    }),
  },
];

// 统一调用入口
export async function invokeWithFallback(module: string, action: string, params: any) {
  const cap = getCapability(module, action);

  if (cap.available) {
    return bridge.invoke(module, action, params);
  }

  const config = CAPABILITY_MATRIX.find(c => c.module === module && c.action === action);
  if (!config) {
    throw new Error(`Capability not available: ${module}.${action}`);
  }

  switch (config.fallback) {
    case 'block':
      throw new Error(`This feature requires app version ${cap.containerVersion || 'latest'}`);
    case 'warn':
      toast(config.warnMessage || '请升级 App 体验完整功能');
      throw new Error('Feature not available');
    case 'redirect':
      window.location.href = config.redirectUrl!;
      return;
    case 'polyfill':
      return config.polyfill!(params);
  }
}
```

## 3. 版本兼容性处理

```javascript
// 能力版本不匹配时的处理
function requireCapability(module, action, minVersion) {
  const cap = getCapability(module, action);

  if (!cap.available) {
    return { status: 'unavailable', fallback: true };
  }

  if (minVersion && compareVersion(cap.version, minVersion) < 0) {
    // 能力存在但版本过低
    return {
      status: 'deprecated',
      currentVersion: cap.version,
      requiredVersion: minVersion,
      fallback: true,
    };
  }

  return { status: 'ok', version: cap.version };
}

function compareVersion(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const a = parts1[i] || 0;
    const b = parts2[i] || 0;
    if (a !== b) return a - b;
  }
  return 0;
}
```
