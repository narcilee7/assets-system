# Lynx 原生集成

## Element PAPI

Element PAPI 是 Lynx 暴露原生 UI 能力的接口，与 RN 的 Native Module 类似，但更贴近渲染层。

```
DSL 层 (JSX)
   │
   │ <x-video src="..." />
   ▼
Tasm 解析
   │
   │ 发现自定义 Element: x-video
   ▼
Element PAPI (C++)
   │
   │ LynxVideoElement::Create()
   ▼
Native 实现
   │
   ├── iOS: AVPlayerLayer + UIView
   └── Android: ExoPlayer + TextureView
```

## 1. 自定义 Element 开发

### iOS 实现

```objc
// iOS/LynxVideoElement.h
#import <Lynx/LynxUI.h>
#import <AVFoundation/AVFoundation.h>

@interface LynxVideoElement : LynxUI<UIView *>
@property (nonatomic, strong) AVPlayer *player;
@property (nonatomic, strong) AVPlayerLayer *playerLayer;
@end

// iOS/LynxVideoElement.m
#import "LynxVideoElement.h"

@implementation LynxVideoElement

// 注册 Element
+ (void)registerElement {
    [LynxElementRegistry registerUI:LynxVideoElement.class withName:@"x-video"];
}

// 创建 Native View
- (UIView *)createView {
    UIView *view = [[UIView alloc] init];
    self.playerLayer = [AVPlayerLayer playerLayerWithPlayer:self.player];
    self.playerLayer.videoGravity = AVLayerVideoGravityResizeAspectFill;
    [view.layer addSublayer:self.playerLayer];
    return view;
}

// 布局更新
- (void)layoutSubviews {
    [super layoutSubviews];
    self.playerLayer.frame = self.view.bounds;
}

// 接收 Props 变化
- (void)updateProp:(NSString *)name withValue:(id)value {
    if ([name isEqualToString:@"src"]) {
        [self loadVideo:value];
    } else if ([name isEqualToString:@"autoplay"]) {
        self.shouldAutoPlay = [value boolValue];
        if (self.shouldAutoPlay) {
            [self.player play];
        }
    }
}

- (void)loadVideo:(NSString *)urlString {
    NSURL *url = [NSURL URLWithString:urlString];
    AVPlayerItem *item = [AVPlayerItem playerItemWithURL:url];
    self.player = [AVPlayer playerWithPlayerItem:item];
    self.playerLayer.player = self.player;

    // 监听播放状态
    [self.player addObserver:self forKeyPath:@"status" options:NSKeyValueObservingOptionNew context:nil];
}

// 事件上报
- (void)notifyPlayEvent {
    // 通过 JSBinding 通知 JS 层
    [self emitEvent:@"play" detail:@{}];
}

@end
```

### Android 实现

```kotlin
// android/src/main/java/com/lynx/video/LynxVideoElement.kt
package com.lynx.video

import android.content.Context
import android.view.TextureView
import com.google.android.exoplayer2.ExoPlayer
import com.google.android.exoplayer2.MediaItem
import com.lynx.tasm.behavior.ui.LynxUI

class LynxVideoElement(context: Context) : LynxUI<TextureView>(context) {
    private var player: ExoPlayer? = null

    companion object {
        @JvmStatic
        fun registerElement() {
            LynxElementRegistry.registerUI("x-video", LynxVideoElement::class.java)
        }
    }

    override fun createView(context: Context): TextureView {
        return TextureView(context).apply {
            player = ExoPlayer.Builder(context).build()
        }
    }

    override fun onPropsUpdated(props: Map<String, Any?>) {
        super.onPropsUpdated(props)

        props["src"]?.let { src ->
            loadVideo(src as String)
        }

        props["autoplay"]?.let { autoPlay ->
            if (autoPlay as Boolean) {
                player?.play()
            }
        }
    }

    private fun loadVideo(url: String) {
        val mediaItem = MediaItem.fromUri(url)
        player?.setMediaItem(mediaItem)
        player?.prepare()
    }

    override fun onLayoutUpdated() {
        super.onLayoutUpdated()
        // 同步布局到 TextureView
    }

    fun notifyPlayEvent() {
        emitEvent("play", mapOf())
    }
}
```

### JS 层封装

```javascript
// src/elements/x-video.jsx
export default function XVideo(props) {
  const {
    src,
    autoplay = false,
    loop = false,
    muted = false,
    controls = true,
    onPlay,
    onPause,
    onEnded,
    onError,
    style
  } = props;

  return (
    <x-video
      class="lynx-video"
      src={src}
      autoplay={autoplay}
      loop={loop}
      muted={muted}
      controls={controls}
      style={style}
      bindplay={onPlay}
      bindpause={onPause}
      bindended={onEnded}
      binderror={onError}
    />
  );
}
```

## 2. Module PAPI（原生能力模块）

Module PAPI 用于非 UI 的原生能力，如网络、存储、设备信息。

```objc
// iOS/LynxLocationModule.m
#import <Lynx/LynxModule.h>
#import <CoreLocation/CoreLocation.h>

@interface LynxLocationModule : NSObject <LynxModule, CLLocationManagerDelegate>
@property (nonatomic, strong) CLLocationManager *locationManager;
@property (nonatomic, copy) LynxCallback callback;
@end

@implementation LynxLocationModule

Lynx_EXPORT_MODULE(LocationModule)

Lynx_EXPORT_METHOD(getCurrentPosition:(NSDictionary *)options
                   callback:(LynxCallback)callback) {
    self.callback = callback;

    self.locationManager = [[CLLocationManager alloc] init];
    self.locationManager.delegate = self;
    self.locationManager.desiredAccuracy = kCLLocationAccuracyBest;

    [self.locationManager requestWhenInUseAuthorization];
    [self.locationManager startUpdatingLocation];

    // 超时处理
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(10 * NSEC_PER_SEC)),
                   dispatch_get_main_queue(), ^{
        if (self.callback) {
            self.callback(@{ @"error": @"Timeout" });
            self.callback = nil;
        }
    });
}

- (void)locationManager:(CLLocationManager *)manager
     didUpdateLocations:(NSArray<CLLocation *> *)locations {
    CLLocation *location = locations.lastObject;
    if (self.callback) {
        self.callback(@{
            @"latitude": @(location.coordinate.latitude),
            @"longitude": @(location.coordinate.longitude),
            @"accuracy": @(location.horizontalAccuracy),
        });
        self.callback = nil;
    }
    [manager stopUpdatingLocation];
}

@end
```

```javascript
// JS 层调用
const position = await lynx.callNative('LocationModule', 'getCurrentPosition', {
  highAccuracy: true,
  timeout: 10000
});
```

## 3. SDK 集成最佳实践

| SDK | Element PAPI | Module PAPI | 说明 |
|-----|-------------|-------------|------|
| 视频播放 | `x-video` | - | ExoPlayer / AVPlayer |
| 地图 | `x-map` | `MapModule` | 高德 / Google / MapKit |
| 扫码 | - | `ScanModule` | ZXing / AVFoundation |
| 支付 | - | `PaymentModule` | 微信/支付宝 SDK |
| 推送 | - | `PushModule` | APNs / FCM |
| 分享 | - | `ShareModule` | 系统分享 / SDK |
| 定位 | - | `LocationModule` | CoreLocation / 高德 |
| 传感器 | - | `SensorModule` | 加速度计、陀螺仪 |
