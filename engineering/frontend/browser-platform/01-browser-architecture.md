# 浏览器架构

## 1. 多进程模型

```
Chrome 进程架构：

Browser Process（1 个）
  ├── GPU Process（1 个，共享）
  ├── Utility Process（多个，网络/存储/解码）
  ├── Renderer Process（每个站点 1 个或每个标签页 1 个）
  │     ├── Main Thread
  │     ├── Compositor Thread
  │     ├── Raster Worker
  │     └── IO Thread
  └── Plugin Process（已废弃，PPAPI → Web API）

Firefox：
  ├── Parent Process（主进程）
  └── Content Process（每个标签页 1 个）

Safari：
  ├── UI Process
  └── Web Content Process
```

| 进程类型 | 数量 | 职责 |
|---------|------|------|
| **Browser** | 1 | 地址栏、书签、下载、权限管理 |
| **Renderer** | N | HTML/CSS/JS 解析执行、渲染 |
| **GPU** | 1 | 3D、合成、栅格化 |
| **Utility** | N | 音频解码、网络代理、拼写检查 |
| **Plugin** | 0 | 已废弃（Flash/PPAPI） |

## 2. 渲染进程线程模型

```
Renderer Process
├── Main Thread（主线程，最关键）
│   ├── HTML Parser → DOM Tree
│   ├── CSS Parser → CSSOM
│   ├── JavaScript Engine（V8/SpiderMonkey/JSC）
│   ├── Style Calculation（样式计算）
│   ├── Layout（回流）
│   └── Layer Tree 构建
│
├── Compositor Thread（合成线程）
│   ├── 接收用户输入（滚动、缩放）
│   ├── 维护 Layer Tree
│   └── 将绘制任务分发给 Raster Worker
│
├── Raster Worker（栅格化线程池）
│   ├── 将 Draw Quads 转换为位图
│   └── 使用 GPU 或 CPU 栅格化
│
└── IO Thread
    ├── 与 Browser Process 通信（IPC）
    └── 处理网络响应回调
```

## 3. 进程通信（IPC）

```
Renderer Process ←IPC→ Browser Process

消息类型：
1. 导航请求："我要加载 https://example.com"
2. 网络响应："这是请求的 HTML"
3. 权限申请："用户点击了地理位置请求"
4. 存储操作："读取 LocalStorage 键 x"
5. GPU 命令："请合成这些图层"

IPC 机制（Chrome）：
- Mojo：现代 IPC 框架（取代旧版 IPC）
- 基于消息管道 + 接口定义语言（IDL）
- 支持进程内/跨进程统一调用
```

```javascript
// Chrome DevTools 查看进程信息
// 地址栏输入：chrome://process-internals

// 在 JS 中查看当前进程信息（实验性）
if ('performance' in window && 'memory' in performance) {
  console.log('Used JS Heap:', performance.memory.usedJSHeapSize / 1048576, 'MB');
  console.log('Total JS Heap:', performance.memory.totalJSHeapSize / 1048576, 'MB');
}
```

## 4. Site Isolation

```
Site Isolation 之前（进程按标签页划分）：
  Tab 1: evil.com + bank.com（iframe）→ 同一个渲染进程
  风险：Spectre 攻击可以读取 bank.com 的内存

Site Isolation 之后（进程按站点划分）：
  Tab 1: evil.com → Renderer A
         bank.com（iframe）→ Renderer B
  Tab 2: bank.com → 复用 Renderer B

规则：
- 不同站点（eTLD+1）→ 不同进程
- 相同站点 → 可能复用进程（标签页数上限）
- 跨站 iframe → 强制独立进程
```

```html
<!-- 通过 COOP/COEP 启用跨域隔离 -->
<!-- 服务器响应头 -->
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp

<!-- 启用后： -->
<!-- 1. 页面获得独立的进程 -->
<!-- 2. 可以启用 SharedArrayBuffer -->
<!-- 3. 更高的 Spectre 防护 -->

<script>
  // 检查是否处于跨域隔离环境
  console.log(self.crossOriginIsolated);  // true / false
</script>
```

## 5. 标签页生命周期

```
标签页状态机：

Active（活跃）
  ↓ 用户切换到其他标签
Passive（可见但不活跃）
  ↓ 页面被隐藏
Hidden（隐藏）
  ↓ 系统内存紧张
Frozen（冻结，JS 定时器暂停）
  ↓ 更长时间不活动
Discarded（丢弃，页面卸载）

JS API：
- document.visibilityState: 'visible' | 'hidden'
- document.hidden: boolean
- pageshow / pagehide / freeze / resume 事件
```

```javascript
// 监听页面生命周期
// 1. 可见性变化
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // 页面隐藏：暂停动画、减少轮询频率
    stopAnimation();
    reducePolling();
  } else {
    // 页面显示：恢复动画
    startAnimation();
  }
});

// 2. 冻结/恢复（Chrome 68+）
document.addEventListener('freeze', () => {
  // 页面被冻结：保存状态
  saveState();
});

document.addEventListener('resume', () => {
  // 页面恢复：恢复状态
  restoreState();
});

// 3. 页面卸载前
window.addEventListener('beforeunload', (e) => {
  // 发送未完成的埋点数据
  navigator.sendBeacon('/analytics', JSON.stringify(pendingEvents));
});
```
