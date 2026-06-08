# React Native 简化版应用：Social Feed

## 应用概述

构建一个简化版社交 App，包含四个核心页面：
1. **Feed 流**：FlatList 渲染动态卡片
2. **发布页**：TextInput + ImagePicker + 位置选择
3. **消息页**：聊天列表 + 输入框
4. **个人中心**：用户信息 + 设置

## 1. 项目结构

```
social-app/
├── src/
│   ├── components/          # 跨端组件
│   │   ├── Avatar.tsx       # 头像组件（支持占位图、缓存）
│   │   ├── FeedCard.tsx     # 动态卡片
│   │   ├── ImageGrid.tsx    # 图片网格（1-9 图适配）
│   │   └── SafeAreaView.tsx # 安全区适配
│   ├── screens/
│   │   ├── FeedScreen.tsx
│   │   ├── PostScreen.tsx
│   │   ├── ChatScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── navigation/
│   │   └── AppNavigator.tsx
│   ├── services/
│   │   ├── api.ts           # 网络层
│   │   └── storage.ts       # 本地存储
│   ├── modules/             # 原生模块
│   │   ├── CameraModule.ts
│   │   └── LocationModule.ts
│   └── App.tsx
├── ios/
├── android/
└── package.json
```

## 2. 核心页面简化实现

### 2.1 Feed 流

```tsx
// src/screens/FeedScreen.tsx
import React, { useState, useCallback } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { FeedCard } from '../components/FeedCard';
import { api } from '../services/api';

interface Post {
  id: string;
  author: { name: string; avatar: string };
  content: string;
  images: string[];
  likes: number;
  timestamp: number;
}

export const FeedScreen: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadPosts = useCallback(async () => {
    const data = await api.get('/feed?page=1');
    setPosts(data);
  }, []);

  // FlatList 性能优化三要素：
  // 1. getItemLayout: 避免 Bridge 通信测量高度
  // 2. keyExtractor: 稳定 key 减少重排
  // 3. removeClippedSubviews: 屏幕外组件卸载
  return (
    <FlatList
      data={posts}
      keyExtractor={item => item.id}
      renderItem={({ item }) => <FeedCard post={item} />}
      getItemLayout={(data, index) => ({
        length: 320, offset: 320 * index, index
      })}
      removeClippedSubviews={true}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={loadPosts} />
      }
    />
  );
};
```

### 2.2 动态卡片组件

```tsx
// src/components/FeedCard.tsx
import React, { memo } from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { Avatar } from './Avatar';
import { ImageGrid } from './ImageGrid';
import { Post } from '../types';

interface Props {
  post: Post;
}

// memo 避免父级 FlatList 滚动时无意义的 re-render
export const FeedCard = memo(({ post }: Props) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Avatar uri={post.author.avatar} size={40} />
        <Text style={styles.name}>{post.author.name}</Text>
      </View>
      <Text style={styles.content}>{post.content}</Text>
      {post.images.length > 0 && <ImageGrid images={post.images} />}
      <View style={styles.footer}>
        <Pressable onPress={handleLike}>
          <Text>♥ {post.likes}</Text>
        </Pressable>
      </View>
    </View>
  );
}, (prev, next) => prev.post.id === next.post.id);

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  name: { marginLeft: 8, fontWeight: '600' },
  content: { fontSize: 14, lineHeight: 20 },
  footer: { marginTop: 12 },
});
```

### 2.3 发布页（原生能力联动）

```tsx
// src/screens/PostScreen.tsx
import { NativeModules, Platform } from 'react-native';
const { CameraModule, LocationModule } = NativeModules;

export const PostScreen: React.FC = () => {
  const [images, setImages] = useState<string[]>([]);
  const [location, setLocation] = useState<string>('');

  const pickImage = async () => {
    // 调用原生模块（TurboModule 可同步返回）
    const result = await CameraModule.pickImage({
      maxCount: 9,
      allowCrop: true,
    });
    setImages(result.assets.map(a => a.uri));
  };

  const fetchLocation = async () => {
    const { latitude, longitude, city } = await LocationModule.getCurrentPosition();
    setLocation(city);
  };

  return (
    <View>
      <TextInput multiline placeholder="分享新鲜事..." />
      <Button title="选择图片" onPress={pickImage} />
      <ImageGrid images={images} />
      <Button title="添加位置" onPress={fetchLocation} />
      <Text>{location}</Text>
    </View>
  );
};
```

## 3. 导航与状态管理

```tsx
// src/navigation/AppNavigator.tsx
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

const Tab = createBottomTabNavigator();

export const AppNavigator = () => (
  <NavigationContainer>
    <Tab.Navigator>
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Post" component={PostScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  </NavigationContainer>
);
```

## 4. 性能 checklist

| 场景 | 优化手段 |
|------|----------|
| 长列表滑动 | FlatList + `getItemLayout` + `windowSize` + `removeClippedSubviews` |
| 图片加载 | `react-native-fast-image`（iOS SDWebImage / Android Glide） |
| 启动速度 | Hermes 引擎 + 代码拆分（RAM Bundle） + 原生模块懒加载 |
| 内存占用 | 大图压缩、图片缓存上限、FlatList 屏幕外卸载 |
| 包体积 | ProGuard/R8、资源压缩、Hermes 字节码 |

## 5. 平台差异处理

```tsx
// src/components/SafeAreaView.tsx
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { Platform, StatusBar } from 'react-native';

export const SafeAreaView = ({ children, style }) => (
  <RNSafeAreaView
    style={[
      { flex: 1 },
      Platform.OS === 'android' && { paddingTop: StatusBar.currentHeight },
      style,
    ]}
  >
    {children}
  </RNSafeAreaView>
);
```
