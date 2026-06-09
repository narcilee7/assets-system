# JSBridge SDK 集成实践

## 常见 SDK 桥接模式

### 1. 支付 SDK

```typescript
// 微信支付 / 支付宝 桥接
interface PayOrder {
  appId: string;
  partnerId?: string;
  prepayId: string;
  nonceStr: string;
  timeStamp: string;
  sign: string;
  package?: string;
}

interface PayResult {
  status: 'success' | 'cancel' | 'fail';
  code?: string;
  message?: string;
}

export const PaymentSDK = {
  // 调起支付
  async pay(order: PayOrder, provider: 'wechat' | 'alipay'): Promise<PayResult> {
    // 检查是否安装对应 App
    const isAvailable = await bridge.invoke('payment', 'checkAvailable', { provider });
    if (!isAvailable) {
      // 降级到 H5 支付
      return this.payByH5(order);
    }

    // 调起原生支付
    return bridge.invoke('payment', 'pay', { order, provider });
  },

  // H5 降级支付
  async payByH5(order: PayOrder): Promise<PayResult> {
    const form = await api.post('/payment/h5', { order });
    // 在 WebView 中加载支付页面
    window.location.href = form.payUrl;
    // 轮询支付结果
    return this.pollResult(order.prepayId);
  },

  private async pollResult(orderId: string): Promise<PayResult> {
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const result = await api.get(`/payment/result/${orderId}`);
      if (result.status !== 'pending') return result;
    }
    return { status: 'fail', message: '支付超时' };
  },
};
```

### 2. 地图 SDK

```typescript
interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  icon?: string;
}

interface MapOptions {
  center: { latitude: number; longitude: number };
  zoom: number;
  markers?: MapMarker[];
  showLocation?: boolean;
}

export const MapSDK = {
  // 打开地图选择位置
  async chooseLocation(): Promise<{ latitude: number; longitude: number; address: string }> {
    return bridge.invoke('map', 'chooseLocation', {});
  },

  // 显示地图页面
  async openMap(options: MapOptions): Promise<void> {
    return bridge.invoke('map', 'openMap', options);
  },

  // 导航到目的地
  async navigateTo(
    destination: { latitude: number; longitude: number; name: string },
    mode: 'drive' | 'bus' | 'walk' | 'ride' = 'drive'
  ): Promise<void> {
    // 优先调起高德/百度/Google Maps App
    const canOpenNative = await bridge.invoke('map', 'canOpenNative', {});
    if (canOpenNative) {
      return bridge.invoke('map', 'navigate', { destination, mode });
    }
    // 降级到 Web 地图
    const url = `https://maps.google.com/?q=${destination.latitude},${destination.longitude}`;
    window.open(url, '_blank');
  },
};
```

### 3. 分享 SDK

```typescript
interface ShareContent {
  title: string;
  description?: string;
  imageUrl?: string;
  url?: string;
  type?: 'text' | 'image' | 'link' | 'miniProgram';
}

type SharePlatform = 'wechatSession' | 'wechatTimeline' | 'qq' | 'weibo' | 'system';

export const ShareSDK = {
  async share(content: ShareContent, platform: SharePlatform): Promise<void> {
    // 图片预下载
    if (content.imageUrl && content.imageUrl.startsWith('http')) {
      content.imageUrl = await this.downloadImage(content.imageUrl);
    }

    return bridge.invoke('share', 'share', { content, platform });
  },

  async showShareSheet(content: ShareContent): Promise<void> {
    // 获取可用的分享渠道
    const platforms = await bridge.invoke('share', 'getAvailablePlatforms', {});
    // 调起原生分享面板
    return bridge.invoke('share', 'showSheet', { content, platforms });
  },

  private async downloadImage(url: string): Promise<string> {
    // 下载到本地缓存，返回本地路径
    return bridge.invoke('file', 'downloadCache', { url });
  },
};
```

### 4. 推送 SDK

```typescript
interface PushOptions {
  badge?: number;
  sound?: string;
  alert?: string;
  data?: Record<string, any>;
}

export const PushSDK = {
  // 获取推送 Token
  async getToken(): Promise<string> {
    return bridge.invoke('push', 'getToken', {});
  },

  // 设置标签（用于分群推送）
  async setTags(tags: string[]): Promise<void> {
    return bridge.invoke('push', 'setTags', { tags });
  },

  // 监听推送到达
  onMessage(handler: (message: { title: string; body: string; data: any }) => void) {
    bridge.on('push:message', handler);
  },

  // 清除角标
  async clearBadge(): Promise<void> {
    return bridge.invoke('push', 'clearBadge', {});
  },
};
```

## SDK 封装 checklist

| SDK | iOS 原生 | Android 原生 | Web 降级 |
|-----|----------|--------------|----------|
| 支付 | 微信/支付宝 SDK | 微信/支付宝 SDK | H5 收银台 |
| 地图 | MapKit / 高德 | 高德 / Google | Web Maps |
| 分享 | UIActivity / 微信 SDK | Intent / 微信 SDK | Web Share API |
| 推送 | APNs / 极光 | FCM / 极光 | Web Push |
| 扫码 | AVFoundation | ZXing | 上传图片识别 |
| 定位 | CoreLocation | 高德定位 | Geolocation API |
