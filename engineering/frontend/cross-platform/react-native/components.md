# React Native 跨端组件设计

## 设计原则

1. **平台差异显式化**：不要隐藏平台差异，要显式声明和降级。
2. **Props 原子化**：每个 prop 只做一件事，便于组合和覆盖。
3. **Native 能力兜底**：当原生模块不可用时，提供 WebView 或 JS 降级方案。

## 1. 组件抽象层

```
Base Component (跨平台统一接口)
    ├── iOS Implementation (UIKit)
    ├── Android Implementation (Android View)
    └── Web Fallback (WebView / React DOM)
```

## 2. 核心组件设计

### 2.1 Avatar（头像）

```tsx
// src/components/Avatar.tsx
import React from 'react';
import { Image, View, Text, StyleSheet, Platform } from 'react-native';
import FastImage from 'react-native-fast-image';

interface AvatarProps {
  uri?: string;
  size?: number;
  placeholder?: string;        // 占位文字（如用户首字母）
  borderRadius?: 'full' | 'sm' | number;
  onError?: () => void;        // 加载失败回调
}

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  size = 40,
  placeholder = '?',
  borderRadius = 'full',
  onError,
}) => {
  const radius = borderRadius === 'full' ? size / 2
                : borderRadius === 'sm' ? 4
                : borderRadius;

  if (!uri) {
    return (
      <View style={[styles.fallback, { width: size, height: size, borderRadius: radius }]}>
        <Text style={[styles.text, { fontSize: size * 0.4 }]}>{placeholder}</Text>
      </View>
    );
  }

  // iOS/Android 使用原生图片库（支持缓存、渐进加载）
  // Web 降级为普通 img 标签
  const ImageComponent = Platform.OS !== 'web' ? FastImage : Image;

  return (
    <ImageComponent
      source={{ uri, priority: FastImage.priority.normal }}
      style={{ width: size, height: size, borderRadius: radius }}
      onError={onError}
      resizeMode="cover"
    />
  );
};

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: '#e1e4e8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: { color: '#586069', fontWeight: '600' },
});
```

### 2.2 ImageGrid（图片网格）

```tsx
// src/components/ImageGrid.tsx
import React, { useMemo } from 'react';
import { View, Image, Pressable, StyleSheet, Dimensions } from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
const GAP = 4;

interface ImageGridProps {
  images: string[];
  maxDisplay?: number;          // 最多显示几张（超出显示 +N）
  onPressImage?: (index: number) => void;
}

export const ImageGrid: React.FC<ImageGridProps> = ({
  images,
  maxDisplay = 9,
  onPressImage,
}) => {
  const count = images.length;
  if (count === 0) return null;

  // 动态计算网格布局
  const layout = useMemo(() => {
    if (count === 1) return { cols: 1, size: SCREEN_W - 32 };
    if (count === 2 || count === 4) return { cols: 2, size: (SCREEN_W - 32 - GAP) / 2 };
    return { cols: 3, size: (SCREEN_W - 32 - GAP * 2) / 3 };
  }, [count]);

  const display = images.slice(0, maxDisplay);

  return (
    <View style={[styles.container, { width: SCREEN_W - 32 }]}>
      {display.map((uri, idx) => (
        <Pressable
          key={idx}
          onPress={() => onPressImage?.(idx)}
          style={[
            styles.item,
            { width: layout.size, height: layout.size },
          ]}
        >
          <Image source={{ uri }} style={styles.image} />
          {idx === maxDisplay - 1 && count > maxDisplay && (
            <View style={styles.overlay}>
              <Text style={styles.overlayText}>+{count - maxDisplay}</Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  item: { marginRight: GAP, marginBottom: GAP },
  image: { width: '100%', height: '100%', borderRadius: 4 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  overlayText: { color: '#fff', fontSize: 20, fontWeight: '600' },
});
```

### 2.3 KeyboardAvoidingView（键盘适配）

```tsx
// src/components/KeyboardAwareView.tsx
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';

// iOS 键盘弹出时自动调整布局
// Android 在 adjustResize 模式下无需处理
export const KeyboardAwareView: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  if (Platform.OS === 'android') {
    return <View style={{ flex: 1 }}>{children}</View>;
  }

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
```

## 3. 组件平台差异矩阵

| 组件 | iOS | Android | Web | 降级策略 |
|------|-----|---------|-----|----------|
| PullToRefresh | `RefreshControl` | `RefreshControl` | CSS `overscroll-behavior` | 手势库自定义 |
| Swipeable | `react-native-gesture-handler` | `react-native-gesture-handler` | `touchstart/touchmove` | PanResponder |
| Video | `AVPlayer` | `ExoPlayer` | `<video>` | 静态封面 |
| Map | `MapKit` | `Google Maps` | `Leaflet` | 静态地图图 |
| Push Notification | `APNs` | `FCM` | Web Push API | 轮询 |

## 4. 手写训练：平台检测 Hook

```tsx
// src/hooks/usePlatform.ts
import { Platform } from 'react-native';

export const usePlatform = () => {
  return {
    isIOS: Platform.OS === 'ios',
    isAndroid: Platform.OS === 'android',
    isWeb: Platform.OS === 'web',
    isNative: Platform.OS !== 'web',
    version: Platform.Version,  // iOS: number, Android: API level
  };
};

// 使用示例
const { isIOS } = usePlatform();
// iOS 状态栏高度特殊处理
const statusBarHeight = isIOS ? 44 : StatusBar.currentHeight || 0;
```
