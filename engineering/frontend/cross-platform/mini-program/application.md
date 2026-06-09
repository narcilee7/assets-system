# 小程序简化版应用：电商购物

## 应用结构

```
shop-mini-program/
├── app.js                 # 全局逻辑
├── app.json               # 全局配置（页面路由、TabBar、窗口样式）
├── app.wxss               # 全局样式
├── pages/
│   ├── index/             # 首页
│   │   ├── index.js
│   │   ├── index.wxml
│   │   └── index.wxss
│   ├── category/          # 分类页
│   ├── product/           # 商品详情
│   ├── cart/              # 购物车
│   └── order/             # 订单列表
├── components/
│   ├── search-bar/        # 搜索栏
│   ├── product-card/      # 商品卡片
│   ├── sku-selector/      # SKU 选择器
│   └── bottom-bar/        # 底部操作栏
└── utils/
    ├── api.js             # 接口封装
    ├── storage.js         # 本地存储
    └── format.js          # 格式化工具
```

## 1. 全局配置

```json
{
  "pages": [
    "pages/index/index",
    "pages/category/category",
    "pages/product/product",
    "pages/cart/cart",
    "pages/order/order"
  ],
  "tabBar": {
    "list": [
      { "pagePath": "pages/index/index", "text": "首页", "iconPath": "icons/home.png" },
      { "pagePath": "pages/category/category", "text": "分类", "iconPath": "icons/category.png" },
      { "pagePath": "pages/cart/cart", "text": "购物车", "iconPath": "icons/cart.png" }
    ]
  },
  "window": {
    "navigationBarTitleText": "小程序商城",
    "navigationBarBackgroundColor": "#ff6600",
    "enablePullDownRefresh": true
  },
  "usingComponents": {
    "search-bar": "/components/search-bar/search-bar",
    "product-card": "/components/product-card/product-card"
  }
}
```

## 2. 首页实现

```javascript
// pages/index/index.js
Page({
  data: {
    banners: [],
    categories: [],
    products: [],
    loading: false,
    hasMore: true,
    page: 1,
  },

  async onLoad() {
    await this.loadBanners();
    await this.loadCategories();
    await this.loadProducts();
  },

  // 下拉刷新
  async onPullDownRefresh() {
    this.setData({ page: 1, products: [], hasMore: true });
    await this.loadProducts();
    wx.stopPullDownRefresh();
  },

  // 上拉加载更多
  async onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return;
    await this.loadProducts();
  },

  async loadProducts() {
    this.setData({ loading: true });

    const { list, total } = await api.get('/products', {
      page: this.data.page,
      pageSize: 10,
    });

    // 关键：小程序列表性能优化
    // 1. 使用 wx:key 减少重排
    // 2. 图片使用 lazy-load
    // 3. 列表项高度固定，避免动态计算
    this.setData({
      products: [...this.data.products, ...list],
      page: this.data.page + 1,
      hasMore: this.data.products.length + list.length < total,
      loading: false,
    });
  },

  onProductTap(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/product/product?id=${id}` });
  },
});
```

```xml
<!-- pages/index/index.wxml -->
<view class="container">
  <!-- 搜索栏 -->
  <search-bar placeholder="搜索商品" bind:search="onSearch" />

  <!-- Banner 轮播 -->
  <swiper class="banner" indicator-dots autoplay circular>
    <swiper-item wx:for="{{banners}}" wx:key="id">
      <image src="{{item.imageUrl}}" mode="aspectFill" lazy-load />
    </swiper-item>
  </swiper>

  <!-- 分类入口 -->
  <view class="categories">
    <view class="category-item" wx:for="{{categories}}" wx:key="id" bindtap="onCategoryTap">
      <image src="{{item.icon}}" class="category-icon" />
      <text>{{item.name}}</text>
    </view>
  </view>

  <!-- 商品列表 -->
  <view class="product-list">
    <product-card
      wx:for="{{products}}"
      wx:key="id"
      product="{{item}}"
      bind:tap="onProductTap"
    />
  </view>

  <!-- 加载状态 -->
  <view class="load-more" wx:if="{{loading}}">加载中...</view>
  <view class="no-more" wx:if="{{!hasMore && products.length > 0}}">没有更多了</view>
</view>
```

## 3. 商品详情页

```javascript
// pages/product/product.js
Page({
  data: {
    product: null,
    selectedSku: null,
    quantity: 1,
    showSkuPanel: false,
  },

  async onLoad(options) {
    const { id } = options;
    const product = await api.get(`/products/${id}`);
    this.setData({
      product,
      selectedSku: product.skus[0],
    });
  },

  // 选择 SKU
  onSkuSelect(e) {
    const { skuId } = e.detail;
    const sku = this.data.product.skus.find(s => s.id === skuId);
    this.setData({ selectedSku: sku });
  },

  // 加入购物车
  async addToCart() {
    const { selectedSku, quantity } = this.data;

    await api.post('/cart/add', {
      skuId: selectedSku.id,
      quantity,
    });

    wx.showToast({ title: '已加入购物车', icon: 'success' });

    // 更新购物车角标
    const cartCount = await api.get('/cart/count');
    wx.setTabBarBadge({
      index: 2, // 购物车 tab 索引
      text: String(cartCount),
    });
  },

  // 立即购买
  async buyNow() {
    const { selectedSku, quantity } = this.data;
    wx.navigateTo({
      url: `/pages/order/confirm?skuId=${selectedSku.id}&quantity=${quantity}`,
    });
  },
});
```

## 4. 购物车逻辑

```javascript
// pages/cart/cart.js
Page({
  data: {
    items: [],
    selectedIds: [],
    editing: false,
  },

  onShow() {
    this.loadCart();
  },

  async loadCart() {
    const items = await api.get('/cart');
    this.setData({ items });
  },

  // 选择/取消选择
  toggleSelect(e) {
    const { id } = e.currentTarget.dataset;
    const { selectedIds } = this.data;
    const index = selectedIds.indexOf(id);

    if (index > -1) {
      selectedIds.splice(index, 1);
    } else {
      selectedIds.push(id);
    }

    this.setData({ selectedIds: [...selectedIds] });
  },

  // 全选
  toggleSelectAll() {
    const { items, selectedIds } = this.data;
    const allSelected = selectedIds.length === items.length;
    this.setData({
      selectedIds: allSelected ? [] : items.map(i => i.id),
    });
  },

  // 计算总价
  computedTotal() {
    const { items, selectedIds } = this.data;
    return items
      .filter(i => selectedIds.includes(i.id))
      .reduce((sum, i) => sum + i.price * i.quantity, 0);
  },

  // 结算
  async checkout() {
    const { selectedIds } = this.data;
    if (selectedIds.length === 0) {
      wx.showToast({ title: '请选择商品', icon: 'none' });
      return;
    }

    wx.navigateTo({
      url: `/pages/order/confirm?cartItemIds=${selectedIds.join(',')}`,
    });
  },
});
```

## 性能优化 Checklist

| 优化点 | 方案 |
|--------|------|
| 首屏加载 | 分包加载、预加载、骨架屏 |
| setData | 只传变化字段、避免频繁调用、大数据分页 |
| 图片 | `lazy-load`、`webp`、CDN 裁剪 |
| 列表 | `wx:key`、固定高度、`recycle-view` |
| 存储 | `wx.getStorageSync` 只在启动时用，运行时读内存 |
| 请求 | 合并请求、缓存策略、失败重试 |
