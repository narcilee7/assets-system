# Lynx 跨端组件设计

## Element 体系

Lynx 的 UI 层基于 **Element**，每个 Element 对应 Native 端的一个原生 View：

```
DSL (JSX)
   │
   │ 编译
   ▼
Tasm Element
   │
   │ 解析
   ▼
Native Element (C++)
   │
   │ 映射
   ▼
iOS: UIView / Android: android.view.View
```

## 1. 基础 Element

| Element | iOS 映射 | Android 映射 | 说明 |
|---------|----------|--------------|------|
| `<view>` | UIView | View | 通用容器 |
| `<text>` | UILabel | TextView | 文本 |
| `<image>` | UIImageView | ImageView | 图片 |
| `<scroll-view>` | UIScrollView | ScrollView | 滚动容器 |
| `<list>` | UITableView / UICollectionView | RecyclerView | 长列表 |
| `<x-video>` | AVPlayerLayer | ExoPlayer | 视频（PAPI 扩展） |
| `<x-map>` | MKMapView | MapView | 地图（PAPI 扩展） |

## 2. 组件设计原则

### 2.1 通用卡片组件

```jsx
// src/components/ContentCard/ContentCard.jsx
import { useCallback } from '@lynx/react';

export default function ContentCard({ item, layout, onTap, onAction }) {
  const handleTap = useCallback(() => {
    onTap?.(item);
  }, [item, onTap]);

  return (
    <view
      class={`content-card ${layout}`}
      bindtap={handleTap}
    >
      {/* 封面图 */}
      <image
        class="cover"
        src={item.coverUrl}
        placeholder="@res/placeholder"
        mode={layout === 'grid' ? 'aspectFill' : 'widthFix'}
      />

      {/* 内容区 */}
      <view class="body">
        <text class="title" max-lines={layout === 'grid' ? 2 : 3}>
          {item.title}
        </text>

        {item.tags?.length > 0 && (
          <view class="tags">
            {item.tags.map(tag => (
              <text key={tag} class="tag">{tag}</text>
            ))}
          </view>
        )}
      </view>

      {/* 底部操作栏 */}
      <view class="footer">
        <view class="author">
          <image class="avatar" src={item.author.avatar} />
          <text class="name">{item.author.name}</text>
        </view>
        <view class="stats">
          <text class="stat">♥ {formatCount(item.likeCount)}</text>
          <text class="stat">💬 {formatCount(item.commentCount)}</text>
        </view>
      </view>
    </view>
  );
}
```

```css
/* ContentCard.css */
.content-card {
  background-color: #fff;
  border-radius: 8px;
  overflow: hidden;
}

.content-card.grid {
  width: 100%;
}

.content-card.list {
  flex-direction: row;
  padding: 12px;
}

.content-card .cover {
  width: 100%;
  background-color: #f0f0f0;
}

.content-card.grid .cover {
  height: 200px;
}

.content-card.list .cover {
  width: 120px;
  height: 90px;
  border-radius: 6px;
}

.content-card .title {
  font-size: 14px;
  color: #333;
  line-height: 1.5;
  margin: 8px;
}

.content-card .tags {
  flex-direction: row;
  flex-wrap: wrap;
  margin: 0 8px;
}

.content-card .tag {
  font-size: 10px;
  color: #ff6600;
  background-color: #fff5f0;
  padding: 2px 6px;
  border-radius: 4px;
  margin-right: 4px;
  margin-bottom: 4px;
}

.content-card .footer {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  border-top: 1px solid #f5f5f5;
}

.content-card .author {
  flex-direction: row;
  align-items: center;
}

.content-card .avatar {
  width: 16px;
  height: 16px;
  border-radius: 50%;
}

.content-card .name {
  font-size: 11px;
  color: #999;
  margin-left: 4px;
}

.content-card .stats {
  flex-direction: row;
}

.content-card .stat {
  font-size: 11px;
  color: #999;
  margin-left: 8px;
}
```

### 2.2 列表组件封装

```jsx
// src/components/WaterfallList/WaterfallList.jsx
export default function WaterfallList({
  data,
  columnCount = 2,
  columnGap = 8,
  renderItem,
  onLoadMore,
  loading
}) {
  // 将数据分组成多列
  const columns = Array.from({ length: columnCount }, () => []);
  data.forEach((item, index) => {
    columns[index % columnCount].push(item);
  });

  return (
    <view class="waterfall" style={{ padding: `${columnGap}px` }}>
      {columns.map((col, colIndex) => (
        <view
          key={colIndex}
          class="waterfall-column"
          style={{ marginRight: colIndex < columnCount - 1 ? `${columnGap}px` : 0 }}
        >
          {col.map((item, index) => (
            <view key={item.id} style={{ marginBottom: `${columnGap}px` }}>
              {renderItem(item, colIndex * col.length + index)}
            </view>
          ))}
        </view>
      ))}

      {/* 加载更多 */}
      {loading && (
        <view class="loading">
          <text>加载中...</text>
        </view>
      )}
    </view>
  );
}
```

## 3. 平台差异化处理

```jsx
// src/components/SafeArea/SafeArea.jsx
import { useState, useEffect } from '@lynx/react';

export default function SafeArea({ children, style }) {
  const [insets, setInsets] = useState({ top: 0, bottom: 0 });

  useEffect(() => {
    // 获取安全区信息
    const info = lynx.getSystemInfoSync();
    setInsets({
      top: info.statusBarHeight || 0,
      bottom: info.safeAreaBottom || 0,
    });
  }, []);

  return (
    <view
      class="safe-area"
      style={{
        paddingTop: `${insets.top}px`,
        paddingBottom: `${insets.bottom}px`,
        ...style
      }}
    >
      {children}
    </view>
  );
}
```

## 4. 自定义 Element（PAPI）

```jsx
// 使用原生扩展的 Video Element
// 需要在 lynx.config.js 中注册

// lynx.config.js
export default {
  elements: {
    'x-video': {
      ios: 'LynxVideoElement',
      android: 'LynxVideoElement',
    }
  }
};

// 组件中使用
function VideoPlayer({ src, autoplay, onPlay, onPause }) {
  return (
    <x-video
      class="video-player"
      src={src}
      autoplay={autoplay}
      controls={true}
      preload="auto"
      bindplay={onPlay}
      bindpause={onPause}
      bindended={() => console.log('播放结束')}
    />
  );
}
```
