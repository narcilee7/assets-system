# 小程序自定义组件设计

## 1. SKU 选择器组件

```
components/sku-selector/
├── sku-selector.js
├── sku-selector.wxml
├── sku-selector.wxss
└── sku-selector.json
```

```json
{
  "component": true,
  "usingComponents": {}
}
```

```javascript
// sku-selector.js
Component({
  properties: {
    skus: {
      type: Array,
      value: [],
      // 格式：[{ id, attrs: [{ name, value }], price, stock, image }]
    },
    visible: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    selectedAttrs: {},      // { color: '红色', size: 'L' }
    selectedSku: null,
    quantity: 1,
  },

  observers: {
    'skus': function(skus) {
      // 提取所有属性维度
      if (skus.length > 0) {
        const attrMap = {};
        skus.forEach(sku => {
          sku.attrs.forEach(attr => {
            if (!attrMap[attr.name]) {
              attrMap[attr.name] = new Set();
            }
            attrMap[attr.name].add(attr.value);
          });
        });

        const attrList = Object.keys(attrMap).map(name => ({
          name,
          values: Array.from(attrMap[name]),
        }));

        this.setData({ attrList });
      }
    },
  },

  methods: {
    // 选择属性值
    onAttrSelect(e) {
      const { attrName, value } = e.currentTarget.dataset;
      const selectedAttrs = { ...this.data.selectedAttrs, [attrName]: value };

      // 查找匹配的 SKU
      const selectedSku = this.data.skus.find(sku => {
        return sku.attrs.every(attr => selectedAttrs[attr.name] === attr.value);
      });

      this.setData({ selectedAttrs, selectedSku });
    },

    // 修改数量
    onQuantityChange(e) {
      const quantity = parseInt(e.detail.value) || 1;
      const max = this.data.selectedSku?.stock || 1;
      this.setData({ quantity: Math.min(Math.max(1, quantity), max) });
    },

    // 确认选择
    onConfirm() {
      if (!this.data.selectedSku) {
        wx.showToast({ title: '请选择完整规格', icon: 'none' });
        return;
      }

      this.triggerEvent('confirm', {
        sku: this.data.selectedSku,
        quantity: this.data.quantity,
      });

      this.setData({ visible: false });
    },

    onClose() {
      this.setData({ visible: false });
      this.triggerEvent('close');
    },
  },
});
```

```xml
<!-- sku-selector.wxml -->
<view class="sku-panel" wx:if="{{visible}}">
  <view class="mask" bindtap="onClose" />
  <view class="content">
    <!-- 已选 SKU 信息 -->
    <view class="header" wx:if="{{selectedSku}}">
      <image class="sku-image" src="{{selectedSku.image}}" />
      <view class="sku-info">
        <text class="price">¥{{selectedSku.price}}</text>
        <text class="stock">库存 {{selectedSku.stock}} 件</text>
      </view>
    </view>

    <!-- 属性选择 -->
    <view class="attr-section" wx:for="{{attrList}}" wx:key="name">
      <text class="attr-name">{{item.name}}</text>
      <view class="attr-values">
        <text
          wx:for="{{item.values}}"
          wx:for-item="value"
          wx:key="value"
          class="attr-value {{selectedAttrs[item.name] === value ? 'active' : ''}}"
          data-attr-name="{{item.name}}"
          data-value="{{value}}"
          bindtap="onAttrSelect"
        >
          {{value}}
        </text>
      </view>
    </view>

    <!-- 数量选择 -->
    <view class="quantity-section">
      <text>数量</text>
      <view class="quantity-control">
        <button bindtap="onQuantityChange" data-value="{{quantity - 1}}">-</button>
        <input type="number" value="{{quantity}}" bindblur="onQuantityChange" />
        <button bindtap="onQuantityChange" data-value="{{quantity + 1}}">+</button>
      </view>
    </view>

    <!-- 确认按钮 -->
    <button class="confirm-btn" type="primary" bindtap="onConfirm">
      确定
    </button>
  </view>
</view>
```

## 2. 通用弹窗组件

```javascript
// components/modal/modal.js
Component({
  options: {
    multipleSlots: true,  // 启用多 slot
  },

  properties: {
    visible: Boolean,
    title: String,
    showClose: { type: Boolean, value: true },
    showCancel: { type: Boolean, value: true },
    confirmText: { type: String, value: '确定' },
    cancelText: { type: String, value: '取消' },
  },

  methods: {
    onMaskTap() {
      this.triggerEvent('close');
    },
    onConfirm() {
      this.triggerEvent('confirm');
    },
    onCancel() {
      this.triggerEvent('cancel');
    },
  },
});
```

```xml
<!-- modal.wxml -->
<view class="modal" wx:if="{{visible}}">
  <view class="mask" bindtap="onMaskTap" />
  <view class="dialog">
    <view class="header">
      <text class="title">{{title}}</text>
      <text wx:if="{{showClose}}" class="close" bindtap="onMaskTap">×</text>
    </view>
    <view class="body">
      <slot name="content" />
    </view>
    <view class="footer">
      <button wx:if="{{showCancel}}" bindtap="onCancel">{{cancelText}}</button>
      <button type="primary" bindtap="onConfirm">{{confirmText}}</button>
    </view>
  </view>
</view>
```

## 3. 组件通信模式

```javascript
// 方式 1：properties + triggerEvent（父子通信）
// 父页面
<sku-selector skus="{{product.skus}}" bind:confirm="onSkuConfirm" />

// 方式 2：全局状态（跨页面/跨组件）
// utils/store.js
const store = {
  state: {},
  listeners: [],
  setState(key, value) {
    this.state[key] = value;
    this.listeners.forEach(cb => cb(key, value));
  },
  subscribe(callback) {
    this.listeners.push(callback);
  },
};

// 方式 3：页面间通信（eventChannel）
wx.navigateTo({
  url: '/pages/product/product?id=123',
  success: (res) => {
    res.eventChannel.emit('acceptDataFromOpenerPage', { from: 'cart' });
  },
});
```
