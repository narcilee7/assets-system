# 跨端能力抽象层设计

## 核心问题

同一个业务功能需要在 **iOS App / Android App / H5 / 小程序 / RN** 中实现，如何设计一套统一的 JS API，让业务代码不感知平台差异？

## 1. 抽象层架构

```
业务层 (Business)
    │
    │ 调用统一 API
    ▼
┌─────────────────────────────────────────┐
│         能力抽象层 (Abstraction Layer)     │
│  ┌───────────────────────────────────┐  │
│  │  API Gateway                      │  │
│  │  ├── storage.get/set              │  │
│  │  ├── network.request              │  │
│  │  ├── device.getInfo               │  │
│  │  ├── media.chooseImage            │  │
│  │  ├── location.getCurrentPosition  │  │
│  │  └── payment.request              │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
    │
    ├──▶ iOS JSBridge    ──▶ 原生 iOS 实现
    ├──▶ Android JSBridge ──▶ 原生 Android 实现
    ├──▶ H5 Polyfill      ──▶ Web API 降级
    ├──▶ RN NativeModule  ──▶ TurboModule 实现
    └──▶ 小程序 API       ──▶ wx/my/tt 适配
```

## 2. 统一 API 设计

```typescript
// @company/bridge-sdk

// 存储能力
interface StorageAPI {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

// 网络能力
interface NetworkAPI {
  request<T>(options: RequestOptions): Promise<T>;
  upload(options: UploadOptions): Promise<UploadResult>;
  download(options: DownloadOptions): Promise<DownloadResult>;
}

// 设备信息
interface DeviceAPI {
  getInfo(): Promise<DeviceInfo>;
  getNetworkType(): Promise<'wifi' | '4g' | '3g' | '2g' | 'none'>;
  vibrate(): Promise<void>;
}

// 媒体能力
interface MediaAPI {
  chooseImage(options: { count?: number; sourceType?: ('album' | 'camera')[] }): Promise<ImageInfo[]>;
  previewImage(options: { urls: string[]; current?: string }): Promise<void>;
  compressImage(options: { src: string; quality?: number }): Promise<{ tempFilePath: string }>;
}

// 位置能力
interface LocationAPI {
  getCurrentPosition(options?: { highAccuracy?: boolean; timeout?: number }): Promise<Position>;
  openLocation(options: Position & { name?: string; address?: string }): Promise<void>;
}

// 支付能力
interface PaymentAPI {
  request(order: OrderInfo): Promise<PaymentResult>;
}
```

## 3. 平台适配实现

### H5 降级实现

```typescript
// adapters/h5/storage.ts
export const h5Storage: StorageAPI = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    localStorage.setItem(key, JSON.stringify(value));
  },

  async remove(key: string): Promise<void> {
    localStorage.removeItem(key);
  },

  async clear(): Promise<void> {
    localStorage.clear();
  },
};

// adapters/h5/location.ts
export const h5Location: LocationAPI = {
  async getCurrentPosition(options = {}) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
        reject,
        { timeout: options.timeout || 10000 }
      );
    });
  },

  async openLocation(options) {
    const url = `https://maps.google.com/?q=${options.latitude},${options.longitude}`;
    window.open(url, '_blank');
  },
};
```

### 小程序适配实现

```typescript
// adapters/miniapp/storage.ts
export const miniappStorage: StorageAPI = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const res = await uni.getStorage({ key });
      return res.data;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    await uni.setStorage({ key, data: value });
  },

  async remove(key: string): Promise<void> {
    await uni.removeStorage({ key });
  },

  async clear(): Promise<void> {
    await uni.clearStorage();
  },
};

// adapters/miniapp/payment.ts
export const miniappPayment: PaymentAPI = {
  async request(order: OrderInfo): Promise<PaymentResult> {
    const vendor = detectVendor();

    if (vendor === 'wechat') {
      return new Promise((resolve, reject) => {
        wx.requestPayment({
          ...order,
          success: resolve,
          fail: reject,
        });
      });
    }

    if (vendor === 'alipay') {
      return new Promise((resolve, reject) => {
        my.tradePay({
          tradeNO: order.tradeNO,
          success: resolve,
          fail: reject,
        });
      });
    }

    throw new Error(`Payment not supported on ${vendor}`);
  },
};
```

### RN 原生模块适配

```typescript
// adapters/react-native/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const rnStorage: StorageAPI = {
  async get<T>(key: string): Promise<T | null> {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  },

  async set<T>(key: string, value: T): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },

  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },

  async clear(): Promise<void> {
    await AsyncStorage.clear();
  },
};

// adapters/react-native/location.ts
import { NativeModules } from 'react-native';
const { LocationModule } = NativeModules;

export const rnLocation: LocationAPI = {
  async getCurrentPosition(options = {}) {
    return LocationModule.getCurrentPosition({
      highAccuracy: options.highAccuracy ?? true,
      timeout: options.timeout ?? 10000,
    });
  },

  async openLocation(options) {
    return LocationModule.openLocation(options);
  },
};
```

## 4. 统一入口

```typescript
// bridge/index.ts
import { h5Storage, h5Location, h5Media } from './adapters/h5';
import { miniappStorage, miniappLocation, miniappMedia } from './adapters/miniapp';
import { rnStorage, rnLocation, rnMedia } from './adapters/react-native';

type Platform = 'h5' | 'miniapp' | 'react-native' | 'electron';

function detectPlatform(): Platform {
  if (typeof wx !== 'undefined') return 'miniapp';
  if (typeof my !== 'undefined') return 'miniapp';
  if (typeof tt !== 'undefined') return 'miniapp';
  if (process.env.TARO_ENV === 'rn') return 'react-native';
  if (typeof window !== 'undefined' && window.electronAPI) return 'electron';
  return 'h5';
}

const platform = detectPlatform();

const adapters = {
  h5: { storage: h5Storage, location: h5Location, media: h5Media },
  miniapp: { storage: miniappStorage, location: miniappLocation, media: miniappMedia },
  'react-native': { storage: rnStorage, location: rnLocation, media: rnMedia },
};

export const bridge = adapters[platform];

// 使用示例
import { bridge } from '@company/bridge-sdk';

async function saveUserPreference(key: string, value: any) {
  await bridge.storage.set(key, value);
}

async function takePhoto() {
  const images = await bridge.media.chooseImage({ count: 1, sourceType: ['camera'] });
  return images[0];
}
```
