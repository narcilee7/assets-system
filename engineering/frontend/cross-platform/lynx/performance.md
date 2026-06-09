# Lynx 性能优化

## 1. 首屏直出（TTF）优化

### TTF 原理

TTF（Template First Rendering）让首屏在 **JS 执行之前** 就开始渲染：

```
传统 RN 首屏                      Lynx TTF 首屏
   │                                  │
   │ 下载 JS Bundle                   │ 下载 Tasm（纯模板数据）
   │ (~500KB)                         │ (~50KB)
   │                                  │
   │ 解析 + 执行 JS                   │ Native 解析 Tasm
   │ (~300ms)                         │ (~20ms)
   │                                  │
   │ 创建 Virtual DOM                 │ 渲染首屏
   │                                  │（数据从 JSON 直接绑定）
   │ Diff + Bridge                    │
   │                                  │ JS 线程异步加载 Lepus
   │ Native 创建 View                 │（仅交互逻辑，不参与首屏）
   │                                  │
   ▼                                  ▼
  总时间: ~1000ms                    总时间: ~200ms
```

### TTF 数据注入

```json
// 服务端预渲染数据，随 Tasm 一起下发
{
  "template": { /* Tasm 模板 */ },
  "data": {
    "user": {
      "name": "张三",
      "avatar": "https://cdn.example.com/avatar.jpg"
    },
    "feed": [
      { "id": 1, "title": "第一条内容", "cover": "..." },
      { "id": 2, "title": "第二条内容", "cover": "..." }
    ]
  }
}
```

### 首屏优化 Checklist

| 优化点 | 方案 | 收益 |
|--------|------|------|
| Tasm 体积 | 压缩、去冗余、按需加载 | 减少下载时间 |
| 图片尺寸 | CDN 裁剪合适尺寸、WebP 格式 | 减少渲染阻塞 |
| 骨架屏 | Tasm 内置骨架结构 | 提升感知速度 |
| 预加载 | 上一页预加载下一页 Tasm | 减少等待 |
| 数据预取 | SSR 数据随包下发 | 避免首屏空白 |

## 2. 列表优化

### `<list>` 组件

Lynx 的 `<list>` 是高性能长列表组件，基于 Native RecyclerView/UITableView：

```jsx
<list
  class="feed-list"
  scroll-y="true"
  bindscrolltolower={loadMore}
>
  {items.map(item => (
    <list-item
      key={item.id}
      item-key={item.id}
      class="list-cell"
    >
      <FeedCard item={item} />
    </list-item>
  ))}
</list>
```

**关键属性**：

| 属性 | 说明 |
|------|------|
| `item-key` | 唯一标识，用于 cell 复用 |
| `reuse-identifier` | 复用池标识，不同布局用不同 pool |
| `full-span` | 是否横跨整列（瀑布流中） |

### 列表性能优化

```jsx
// 1. 固定高度，避免动态测量
<list-item style={{ height: 320 }}>

// 2. 图片懒加载
<image
  src={item.cover}
  lazy-load={true}        // 进入视口才加载
  placeholder="@res/placeholder"
/>

// 3. 细粒度更新，避免全量刷新
// 只更新变化的数据项
updateItem(index, newData) {
  this.setState(prev => {
    const items = [...prev.items];
    items[index] = { ...items[index], ...newData };
    return { items };
  });
}
```

## 3. 内存管理

### 图片内存优化

```jsx
// 根据容器尺寸请求合适尺寸的图片
function getSizedImageUrl(url, width) {
  // CDN 裁剪参数
  return `${url}?x-oss-process=image/resize,w_${width}`;
}

<image
  src={getSizedImageUrl(item.cover, 375)}
  style={{ width: '100%', height: 200 }}
/>
```

### 组件销毁清理

```jsx
export default function VideoFeed() {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    return () => {
      // 页面卸载时释放视频资源
      videos.forEach(v => {
        if (v.playerRef) {
          v.playerRef.pause();
          v.playerRef.release();
        }
      });
    };
  }, []);

  // 不可见时暂停
  const onVisibilityChange = (visible) => {
    if (!visible) {
      // 暂停所有在播视频
    }
  };
}
```

## 4. Bundle 拆分

```
App Bundle
    │
    ├── Main.tasm              # 首页（必须加载）
    ├── Main.lepus             # 首页逻辑
    │
    ├── pages/
    │   ├── Detail.tasm        # 详情页（按需加载）
    │   ├── Detail.lepus
    │   ├── Search.tasm
    │   └── Search.lepus
    │
    └── components/
        ├── common.tasm        # 公共组件
        └── vendor.lepus       # 第三方库
```

```javascript
// 动态加载子包
async function navigateToDetail(id) {
  // 预加载详情页 Bundle
  await lynx.preloadPackage('/packages/Detail.bundle');

  lynx.navigateTo({
    url: `/pages/Detail/Detail?id=${id}`
  });
}
```

## 5. 性能监控指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| TTFB | < 100ms | 首字节时间 |
| FCP | < 200ms | First Contentful Paint |
| TTI | < 500ms | Time to Interactive |
| 列表滑动帧率 | 55-60fps | 滚动流畅度 |
| 内存占用 | < 150MB | 峰值内存 |
| 包体积 | < 500KB | 主包大小 |
