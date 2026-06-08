# 跨端能力矩阵

## 能力对比总表

| 能力 | iOS App | Android App | H5 | 微信小程序 | 支付宝小程序 | React Native | Electron |
|------|---------|-------------|----|-----------|-------------|--------------|----------|
| 扫码 | ✅ | ✅ | ⚠️(上传识别) | ✅ | ✅ | ✅ | ❌ |
| 定位 | ✅ | ✅ | ⚠️(精度低) | ✅ | ✅ | ✅ | ❌ |
| 相机 | ✅ | ✅ | ⚠️(需授权) | ✅ | ✅ | ✅ | ✅ |
| 相册 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 支付 | ✅原生SDK | ✅原生SDK | ✅H5收银台 | ✅ | ✅ | ✅原生SDK | ❌ |
| 推送 | ✅APNs | ✅FCM | ⚠️Web Push | ✅订阅消息 | ✅ | ✅ | ❌ |
| 分享 | ✅系统分享 | ✅Intent | ✅Web Share | ✅ | ✅ | ✅ | ✅ |
| 蓝牙 | ✅ | ✅ | ⚠️Web BLE | ✅ | ✅ | ✅ | ✅ |
| NFC | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| 指纹/人脸 | ✅FaceID/TouchID | ✅指纹/人脸 | ⚠️WebAuthn | ❌ | ✅ | ✅ | ❌ |
| 文件系统 | ✅ | ✅ | ⚠️IndexedDB | ❌ | ⚠️ | ✅ | ✅ |
| 后台播放 | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| 离线存储 | ✅SQLite | ✅SQLite | ✅LocalStorage | ✅ | ✅ | ✅AsyncStorage | ✅ |
| 剪贴板 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 振动 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 屏幕常亮 | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| 网络状态 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

✅ 原生支持　⚠️ 有限支持/需降级　❌ 不支持

## 降级策略设计

```typescript
// capability-matrix.ts
interface CapabilityInfo {
  supported: boolean;
  level: 'full' | 'partial' | 'none';
  fallback?: string;
  note?: string;
}

const capabilityMatrix: Record<string, Record<string, CapabilityInfo>> = {
  scan: {
    'ios-app': { supported: true, level: 'full' },
    'android-app': { supported: true, level: 'full' },
    'h5': { supported: false, level: 'none', fallback: 'upload-qrcode', note: '用户上传二维码图片，服务端识别' },
    'wechat-mini': { supported: true, level: 'full' },
    'alipay-mini': { supported: true, level: 'full' },
    'react-native': { supported: true, level: 'full' },
    'electron': { supported: false, level: 'none', fallback: 'none', note: '桌面端无需扫码' },
  },

  payment: {
    'ios-app': { supported: true, level: 'full', note: '微信支付/支付宝 SDK' },
    'android-app': { supported: true, level: 'full', note: '微信支付/支付宝 SDK' },
    'h5': { supported: true, level: 'partial', fallback: 'h5-cashier', note: '跳转 H5 收银台' },
    'wechat-mini': { supported: true, level: 'full', note: '微信支付' },
    'alipay-mini': { supported: true, level: 'full', note: '支付宝支付' },
    'react-native': { supported: true, level: 'full', note: '微信支付/支付宝 SDK' },
    'electron': { supported: false, level: 'none', fallback: 'qrcode-pay', note: '展示支付二维码，手机扫码' },
  },

  push: {
    'ios-app': { supported: true, level: 'full', note: 'APNs' },
    'android-app': { supported: true, level: 'full', note: 'FCM/极光' },
    'h5': { supported: true, level: 'partial', fallback: 'web-push', note: '需用户订阅，iOS 不支持' },
    'wechat-mini': { supported: true, level: 'partial', note: '订阅消息/服务通知' },
    'alipay-mini': { supported: true, level: 'partial', note: '模板消息' },
    'react-native': { supported: true, level: 'full', note: 'APNs/FCM' },
    'electron': { supported: false, level: 'none', fallback: 'none' },
  },

  location: {
    'ios-app': { supported: true, level: 'full', note: 'CoreLocation，精度高' },
    'android-app': { supported: true, level: 'full', note: '高德/Google，精度高' },
    'h5': { supported: true, level: 'partial', fallback: 'ip-location', note: 'GPS 精度低，需授权' },
    'wechat-mini': { supported: true, level: 'full' },
    'alipay-mini': { supported: true, level: 'full' },
    'react-native': { supported: true, level: 'full' },
    'electron': { supported: false, level: 'none', fallback: 'ip-location', note: '基于 IP 定位' },
  },
};

// 获取当前平台的能力信息
function getCapability(platform: string, capability: string): CapabilityInfo {
  return capabilityMatrix[capability]?.[platform] || { supported: false, level: 'none' };
}

// 判断是否可用（含降级）
function isAvailable(platform: string, capability: string): boolean {
  const info = getCapability(platform, capability);
  return info.supported || !!info.fallback;
}
```

## 组件降级策略

```typescript
// 以地图组件为例
interface MapComponentProps {
  latitude: number;
  longitude: number;
  markers?: Array<{ latitude: number; longitude: number; title: string }>;
}

function UnifiedMap(props: MapComponentProps) {
  const platform = detectPlatform();
  const mapCapability = getCapability(platform, 'map');

  // 原生地图
  if (mapCapability.level === 'full') {
    return <NativeMap {...props} />;
  }

  // Web 地图降级
  if (mapCapability.fallback === 'web-map') {
    return <WebMap {...props} />;
  }

  // 静态地图降级（最低要求）
  return <StaticMap {...props} />;
}

// NativeMap - 调用原生地图 SDK
// WebMap - 使用 Leaflet/高德 JS API
// StaticMap - 静态图片 + 文字地址
```
