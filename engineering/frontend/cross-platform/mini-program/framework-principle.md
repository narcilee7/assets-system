# 小程序框架原理

## 双线程模型

小程序采用 **逻辑层（JavaScript）** 和 **渲染层（WebView）** 分离的架构：

```
┌─────────────────────────────────────────┐
│              渲染层 (WebView)             │
│  ┌─────────┐    ┌─────────┐             │
│  │  Page 1 │    │  Page 2 │             │
│  │  (View) │    │  (View) │             │
│  └────┬────┘    └────┬────┘             │
│       │              │                   │
│       └──────────────┘                   │
│              │                           │
│       Virtual DOM Diff                   │
│              │                           │
│  ┌───────────▼───────────┐              │
│  │   WebView 渲染引擎     │              │
│  └───────────────────────┘              │
└─────────────────────────────────────────┘
                    │ Native 通信
┌─────────────────────────────────────────┐
│              逻辑层 (JS Engine)          │
│  ┌───────────────────────────────┐      │
│  │  App Service                   │      │
│  │  ├── Page 1 logic.js           │      │
│  │  ├── Page 2 logic.js           │      │
│  │  ├── app.js                    │      │
│  │  └── 全局状态管理               │      │
│  └───────────────────────────────┘      │
│              │                           │
│       setData 序列化                      │
│              │                           │
│  ┌───────────▼───────────┐              │
│  │   V8 / JSCore 引擎     │              │
│  └───────────────────────┘              │
└─────────────────────────────────────────┘
```

### 为什么要分离？

1. **安全隔离**：JS 逻辑无法直接操作 DOM，防止 XSS 和恶意脚本。
2. **性能隔离**：复杂计算在 JS 引擎运行，不阻塞 WebView 渲染。
3. **管控能力**：平台可以拦截和审核所有 setData 调用。

### setData 通信机制

```javascript
// 逻辑层
Page({
  data: {
    list: [],
    loading: false,
  },

  onLoad() {
    // setData 将数据从逻辑层发送到渲染层
    this.setData({
      list: [1, 2, 3],
      loading: true,
    });
  },
});

// 底层通信过程：
// 1. JS 对象被序列化为 JSON 字符串
// 2. 通过 Native 桥发送到 WebView
// 3. WebView 反序列化后更新 Virtual DOM
// 4. 计算 Diff 后应用到真实 DOM
```

**性能陷阱**：
- `setData` 传输大数据会卡顿（JSON 序列化 + 跨线程通信）。
- 频繁 `setData` 会导致渲染层来不及处理。
- 解决方案：分批 setData、只传变化字段、使用 `observers`。

## 生命周期

```
App 生命周期
    │
    ├── onLaunch     ──▶ 小程序初始化（全局只触发一次）
    ├── onShow       ──▶ 小程序进入前台
    ├── onHide       ──▶ 小程序进入后台
    └── onError      ──▶ 全局错误监听

Page 生命周期
    │
    ├── onLoad       ──▶ 页面创建，接收参数
    ├── onShow       ──▶ 页面显示
    ├── onReady      ──▶ 页面初次渲染完成
    ├── onHide       ──▶ 页面隐藏（切换到后台或其他页面）
    ├── onUnload     ──▶ 页面销毁
    └── onPullDownRefresh / onReachBottom / onShareAppMessage
```

## 组件系统

### 自定义组件结构

```
components/my-component/
├── my-component.js      # 逻辑
├── my-component.wxml    # 模板
├── my-component.wxss    # 样式
└── my-component.json    # 配置
```

```javascript
// my-component.js
Component({
  // 外部传入的属性
  properties: {
    title: {
      type: String,
      value: '默认标题',
    },
    items: {
      type: Array,
      value: [],
    },
  },

  // 内部数据
  data: {
    expanded: false,
  },

  // 计算属性（微信不支持，需手动实现）
  observers: {
    'items.**': function(items) {
      this.setData({ itemCount: items.length });
    },
  },

  // 生命周期
  lifetimes: {
    attached() {
      console.log('组件挂载');
    },
    detached() {
      console.log('组件卸载');
    },
  },

  // 方法
  methods: {
    onTap() {
      this.setData({ expanded: !this.data.expanded });
      // 触发自定义事件
      this.triggerEvent('expand', { expanded: this.data.expanded });
    },
  },
});
```

### 组件间关系

```javascript
// 父组件引用子组件
Component({
  methods: {
    getChildData() {
      // 获取子组件实例
      const child = this.selectComponent('#myChild');
      child.doSomething();
    },
  },
});

// 跨组件通信（EventBus 简化版）
const eventBus = {
  events: {},
  on(event, callback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
  },
  emit(event, data) {
    this.events[event]?.forEach(cb => cb(data));
  },
};
```
