# Lynx 简化版应用：内容信息流

## 应用概述

构建一个简化版内容信息流 App，包含四个核心页面：
1. **Feed 流**：双列瀑布流，支持视频自动播放
2. **详情页**：内容详情 + 评论区
3. **搜索页**：搜索建议 + 结果列表
4. **个人中心**：用户信息 + 发布内容列表

## 1. 项目结构

```
content-app/
├── src/
│   ├── pages/
│   │   ├── Feed/                  # 首页 Feed
│   │   │   ├── Feed.jsx
│   │   │   └── Feed.css
│   │   ├── Detail/                # 内容详情
│   │   │   ├── Detail.jsx
│   │   │   └── Detail.css
│   │   ├── Search/                # 搜索
│   │   └── Profile/               # 个人中心
│   ├── components/
│   │   ├── WaterfallList/         # 瀑布流组件
│   │   ├── VideoPlayer/           # 视频播放器
│   │   ├── CommentList/           # 评论列表
│   │   └── Skeleton/              # 骨架屏
│   ├── utils/
│   │   ├── api.js                 # 网络请求
│   │   └── format.js              # 格式化
│   └── app.jsx                    # 应用入口
├── lynx.config.js                 # Lynx 构建配置
└── package.json
```

## 2. 核心页面实现

### 2.1 Feed 瀑布流

```jsx
// src/pages/Feed/Feed.jsx
import { useState, useEffect, useRef } from '@lynx/react';

export default function Feed() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(1);

  useEffect(() => {
    loadMore();
  }, []);

  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    const data = await lynx.request({
      url: 'https://api.example.com/feed',
      method: 'GET',
      data: { page: pageRef.current, pageSize: 10 }
    });

    setItems(prev => [...prev, ...data.list]);
    setHasMore(data.hasMore);
    pageRef.current++;
    setLoading(false);
  };

  const onItemTap = (item) => {
    lynx.navigateTo({ url: `/pages/Detail/Detail?id=${item.id}` });
  };

  return (
    <view class="feed-page">
      <WaterfallList
        data={items}
        columnCount={2}
        columnGap="8px"
        renderItem={(item) => (
          <FeedCard item={item} onTap={() => onItemTap(item)} />
        )}
        onLoadMore={loadMore}
        loading={loading}
      />
    </view>
  );
}
```

```css
/* src/pages/Feed/Feed.css */
.feed-page {
  background-color: #f5f5f5;
  padding: 8px;
}

.feed-card {
  background-color: #fff;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 8px;
}

.feed-card .cover {
  width: 100%;
  background-color: #e0e0e0;
}

.feed-card .title {
  font-size: 14px;
  color: #333;
  padding: 8px;
  line-height: 1.4;
  /* Lynx 文本截断 */
  text-overflow: ellipsis;
  max-lines: 2;
}

.feed-card .author {
  flex-direction: row;
  align-items: center;
  padding: 0 8px 8px;
}

.feed-card .author-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
}

.feed-card .author-name {
  font-size: 12px;
  color: #999;
  margin-left: 4px;
}
```

### 2.2 视频卡片组件

```jsx
// src/components/VideoPlayer/VideoPlayer.jsx
import { useState, useEffect } from '@lynx/react';

export default function VideoCard({ videoUrl, coverUrl, autoPlay }) {
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(false);

  // 监听元素可见性，实现滚动自动播放
  useEffect(() => {
    const observer = lynx.createIntersectionObserver({
      thresholds: [0.5]
    });

    observer.observe('.video-container', (res) => {
      setVisible(res.intersectionRatio > 0.5);
      if (autoPlay && res.intersectionRatio > 0.5) {
        setPlaying(true);
      } else {
        setPlaying(false);
      }
    });

    return () => observer.disconnect();
  }, []);

  return (
    <view class="video-container">
      <image
        class="cover"
        src={coverUrl}
        style={{ display: playing ? 'none' : 'flex' }}
      />
      <x-video
        class="player"
        src={videoUrl}
        autoplay={playing}
        loop={true}
        muted={true}
        style={{ display: playing ? 'flex' : 'none' }}
      />
      {!playing && (
        <view class="play-btn">
          <text>▶</text>
        </view>
      )}
    </view>
  );
}
```

### 2.3 详情页

```jsx
// src/pages/Detail/Detail.jsx
import { useState, useEffect } from '@lynx/react';

export default function Detail() {
  const [detail, setDetail] = useState(null);
  const [comments, setComments] = useState([]);

  useEffect(() => {
    const query = lynx.getQuery();  // 获取页面参数
    loadDetail(query.id);
  }, []);

  const loadDetail = async (id) => {
    const [detailRes, commentsRes] = await Promise.all([
      lynx.request({ url: `/api/content/${id}` }),
      lynx.request({ url: `/api/content/${id}/comments` })
    ]);

    setDetail(detailRes);
    setComments(commentsRes.list);
  };

  const onLike = async () => {
    await lynx.request({
      url: `/api/content/${detail.id}/like`,
      method: 'POST'
    });
    setDetail({ ...detail, liked: true, likeCount: detail.likeCount + 1 });
  };

  if (!detail) {
    return <Skeleton type="detail" />;
  }

  return (
    <scroll-view class="detail-page" scroll-y="true">
      <image class="cover" src={detail.cover} mode="aspectFill" />

      <view class="content">
        <text class="title">{detail.title}</text>
        <text class="body">{detail.content}</text>
      </view>

      <view class="actions">
        <view class="action-btn" bindtap={onLike}>
          <text>{detail.liked ? '♥' : '♡'}</text>
          <text>{detail.likeCount}</text>
        </view>
        <view class="action-btn">
          <text>💬</text>
          <text>{detail.commentCount}</text>
        </view>
        <view class="action-btn">
          <text>↗</text>
          <text>分享</text>
        </view>
      </view>

      <CommentList comments={comments} />
    </scroll-view>
  );
}
```

## 3. 网络请求封装

```javascript
// src/utils/api.js
const BASE_URL = 'https://api.example.com';

class APIClient {
  async request(options) {
    const { url, method = 'GET', data, headers = {} } = options;

    // 自动附加 Token
    const token = lynx.getStorageSync('access_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await lynx.request({
        url: `${BASE_URL}${url}`,
        method,
        data,
        header: headers,
        timeout: 10000,
      });

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return response.data;
      }

      throw new Error(response.data?.message || `HTTP ${response.statusCode}`);
    } catch (error) {
      // 统一错误处理
      if (error.statusCode === 401) {
        // Token 过期，触发登录
        lynx.navigateTo({ url: '/pages/Login/Login' });
      }
      throw error;
    }
  }

  get(url, params) {
    return this.request({ url, method: 'GET', data: params });
  }

  post(url, data) {
    return this.request({ url, method: 'POST', data });
  }
}

export const api = new APIClient();
```

## 4. 性能优化 Checklist

| 场景 | 优化手段 |
|------|----------|
| 首屏加载 | TTF 模板直出、骨架屏、图片懒加载 |
| 长列表 | `<list>` 组件、cell 复用、图片尺寸裁剪 |
| 视频播放 | 可见性控制、预加载策略、内存释放 |
| 包体积 | Tasm 压缩、图片 CDN、按需加载 |
| 状态更新 | 细粒度 setState、避免全量刷新 |
