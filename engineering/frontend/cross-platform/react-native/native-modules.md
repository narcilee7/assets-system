# React Native 原生模块 SDK 封装

## 封装原则

1. **接口统一**：iOS 和 Android 暴露相同的 JS API，平台差异在原生层消化。
2. **异常标准化**：所有错误统一为 `{ code, message, details }` 结构。
3. **权限前置**：需要权限的 API 在调用前主动检查，拒绝时给明确引导。
4. **生命周期感知**：Native 模块应感知 JS 组件 mount/unmount，避免回调到已销毁组件。

## 1. 扫码模块

### JS 接口

```typescript
// src/modules/ScanModule.ts
import { NativeModules, Platform } from 'react-native';
const { ScanModule: NativeScan } = NativeModules;

interface ScanResult {
  code: string;
  type: 'QR_CODE' | 'BAR_CODE';
  rawBytes?: number[];
}

interface ScanOptions {
  barcodeTypes?: string[];    // 限制条码类型
  torchOn?: boolean;          // 是否开启闪光灯
  hintText?: string;          // 扫描框提示文字
}

export const ScanModule = {
  async scan(options: ScanOptions = {}): Promise<ScanResult> {
    try {
      return await NativeScan.scan(options);
    } catch (error: any) {
      // 标准化错误码
      throw standardizeError(error);
    }
  },

  // 检查权限状态
  async checkPermission(): Promise<'granted' | 'denied' | 'restricted'> {
    return NativeScan.checkPermission();
  },

  // 跳转设置页
  openSettings(): void {
    NativeScan.openSettings();
  },
};

function standardizeError(error: any) {
  const codeMap: Record<string, string> = {
    'E_SCAN_CANCELLED': 'USER_CANCELLED',
    'E_CAMERA_PERMISSION': 'PERMISSION_DENIED',
    'E_SCAN_TIMEOUT': 'TIMEOUT',
  };
  return {
    code: codeMap[error.code] || 'UNKNOWN_ERROR',
    message: error.message || 'Scan failed',
    details: error.userInfo,
  };
}
```

### iOS 实现（Objective-C）

```objc
// ios/ScanModule.m
#import <React/RCTBridgeModule.h>
#import <AVFoundation/AVFoundation.h>

@interface ScanModule : NSObject <RCTBridgeModule, AVCaptureMetadataOutputObjectsDelegate>
@property (nonatomic, strong) RCTPromiseResolveBlock resolve;
@property (nonatomic, strong) RCTPromiseRejectBlock reject;
@end

@implementation ScanModule
RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(scan:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  self.resolve = resolve;
  self.reject = reject;

  // 权限检查
  AVAuthorizationStatus status = [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeVideo];
  if (status == AVAuthorizationStatusDenied) {
    reject(@"E_CAMERA_PERMISSION", @"Camera permission denied", nil);
    return;
  }

  // 启动扫码页面（简化版）
  dispatch_async(dispatch_get_main_queue(), ^{
    ScanViewController *vc = [[ScanViewController alloc] init];
    vc.delegate = self;
    vc.options = options;
    [self presentViewController:vc];
  });
}

// 扫码结果回调
- (void)didScanCode:(NSString *)code type:(NSString *)type {
  self.resolve(@{ @"code": code, @"type": type });
}

@end
```

### Android 实现（Kotlin）

```kotlin
// android/app/src/main/java/com/demo/ScanModule.kt
package com.demo

import com.facebook.react.bridge.*
import com.google.zxing.integration.android.IntentIntegrator

class ScanModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "ScanModule"

  @ReactMethod
  fun scan(options: ReadableMap, promise: Promise) {
    // 权限检查
    if (!PermissionChecker.checkSelfPermission(reactContext, Manifest.permission.CAMERA)
        == PermissionChecker.PERMISSION_GRANTED) {
      promise.reject("E_CAMERA_PERMISSION", "Camera permission denied")
      return
    }

    val activity = currentActivity ?: run {
      promise.reject("E_NO_ACTIVITY", "No active activity")
      return
    }

    // 启动 ZXing 扫码
    val integrator = IntentIntegrator(activity)
    integrator.setDesiredBarcodeFormats(IntentIntegrator.QR_CODE)
    integrator.setPrompt(options.getString("hintText") ?: "Scan a code")
    integrator.setTorchEnabled(options.getBoolean("torchOn"))
    integrator.initiateScan()

    // 结果通过 ActivityEventListener 回调
    pendingPromise = promise
  }

  companion object {
    var pendingPromise: Promise? = null
  }
}
```

## 2. 定位模块

```typescript
// src/modules/LocationModule.ts
interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  city?: string;
  address?: string;
}

export const LocationModule = {
  // 单次定位
  async getCurrentPosition(): Promise<LocationResult> {
    return NativeModules.LocationModule.getCurrentPosition({
      timeout: 10000,
      maximumAge: 60000,
      enableHighAccuracy: true,
    });
  },

  // 持续定位（返回 subscription，需手动停止）
  watchPosition(
    onUpdate: (loc: LocationResult) => void,
    onError: (error: any) => void,
    options = { interval: 5000, distanceFilter: 10 }
  ) {
    const eventEmitter = new NativeEventEmitter(NativeModules.LocationModule);
    const sub = eventEmitter.addListener('LocationUpdate', onUpdate);
    NativeModules.LocationModule.startWatching(options);

    return {
      remove: () => {
        sub.remove();
        NativeModules.LocationModule.stopWatching();
      },
    };
  },
};
```

## 3. 分享模块

```typescript
// src/modules/ShareModule.ts
interface ShareItem {
  title: string;
  message?: string;
  url?: string;
  imageUrl?: string;
}

type SharePlatform = 'wechat_session' | 'wechat_timeline' | 'system';

export const ShareModule = {
  async share(item: ShareItem, platform: SharePlatform): Promise<void> {
    // iOS: UIActivityViewController / 微信 SDK
    // Android: Intent.ACTION_SEND / 微信 SDK
    return NativeModules.ShareModule.share(item, platform);
  },

  // 检查平台是否可用
  async isPlatformAvailable(platform: SharePlatform): Promise<boolean> {
    return NativeModules.ShareModule.isPlatformAvailable(platform);
  },
};
```

## 4. SDK 封装 checklist

| 检查项 | 说明 |
|--------|------|
| 错误码统一 | 同一场景 iOS/Android 返回相同 code |
| 空值保护 | 原生层可能返回 null，JS 层做默认值处理 |
| 主线程安全 | UI 相关操作必须在主线程执行 |
| 内存泄漏 | 组件 unmount 时取消原生回调/监听 |
| 版本兼容 | 旧容器调用新 API 时优雅降级 |
| TypeScript | 提供完整类型定义，Codegen 自动生成绑定 |
