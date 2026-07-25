# Web Vitals 深度优化

## 0. 蓝图

| 指标      | 定义       | Good   | Needs Improvement | Poor   |
| ------- | -------- | ------ | ----------------- | ------ |
| **LCP** | 最大内容绘制时间 | ≤2.5s  | ≤4.0s             | >4.0s  |
| **INP** | 交互到下一次绘制 | ≤200ms | ≤500ms            | >500ms |
| **CLS** | 累积布局偏移   | ≤0.1   | ≤0.25             | >0.25  |

辅助指标：

- TTFB：首字节时间，所有后续指标的天花板
- FCP：首次内容绘制，标志了浏览器首次Paint的完成

### 指标和渲染管线的映射关系

```plain
TTFB ─────────────────────────────────────┐
                                          │
FCP ──→ HTML解析 ──→ CSSOM ──→ 首次Paint ─┤
                                          │
LCP ──→ 资源加载 ──→ Layout ──→ Paint ──→ Raster ──→ 显示
                                          │
CLS ──→ Layout 阶段几何变化 ──────────────┘
                                          │
INP ──→ Main Thread 事件循环 ──→ 样式计算 ──→ Layout ──→ Paint ──→ Composite
```

| 指标       | 锚定阶段            | 核心瓶颈                                     |
| -------- | --------------- | ---------------------------------------- |
| **TTFB** | 网络层（还没进渲染管线）    | DNS、TLS、服务器处理、CDN 缓存命中率                  |
| **FCP**  | 首次 Paint        | CSSOM 阻塞、字体阻塞、JS 阻塞解析                    |
| **LCP**  | Paint + Raster  | 图片/视频资源加载慢、服务端渲染注水（Hydration）阻塞、阻塞式 JS   |
| **CLS**  | Layout          | 图片无尺寸、字体回退（FOIT/FOUT）、动态插入内容、异步加载广告      |
| **INP**  | Main Thread 全流程 | 长任务（Long Tasks）占用主线程、FSL、重计算样式、大量 DOM 操作 |

## 1. TTFB优化策略

TTFB是后续所有渲染指标的物理天花板，必须按照网络链路分层拆解。

### TTFB的测量边界

TTFB=请求首次发出到响应首字节到达的时间。在Resource Timing API中

```plain
TTFB = responseStart - startTime
```

注意：
startTime 是 fetchStart（DNS 之后），所以 TTFB 测量的是从 DNS 解析完成到首字节到达。如果要算完整链路，看 navigationStart → responseStart。
但是不包含浏览器解析HTML的时间，那是TTFB -> FCP的区间。

#### 链路分层拆解与优化

##### DNS层

| 问题          | 优化                                                |
| ----------- | ------------------------------------------------- |
| DNS 查询慢     | `dns-prefetch`（`<link rel="dns-prefetch">`）提前解析域名 |
| 多域名分散       | 减少关键路径上的域名数量，避免多次 DNS 查询                          |
| DNS 解析失败/劫持 | 使用 DNS over HTTPS（DoH）或 HTTP DNS                  |

`dns-prefetch`和`preconnect`的区别：前者预先解析IP，后者还会提前建立TCP+TLS连接

##### TCP + TLS层

| 问题             | 优化                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------- |
| TCP 三次握手 RTT   | `preconnect` 提前建连；HTTP/2 或 HTTP/3 多路复用减少连接数                                               |
| TLS 1.2 两次 RTT | 升级到 **TLS 1.3**（1-RTT，甚至 0-RTT 重连）；开启 OCSP Stapling 减少证书验证往返                              |
| TCP 慢启动        | 启用 **TCP Fast Open**（TFO）；确保初始拥塞窗口（initcwnd）配置合理（现代 Linux 默认 10 MSS，Cloudflare 调到了 10-20） |

##### 服务器处理(杠杆最大)

1. CDN:
  - 静态资源：直接缓存
  - 动态的HTML：动态缓存，用户永远拿到缓存副本，后台异步更新缓存
  2. 服务端渲染(SSR)的注水时机：
  瓶颈一般是：数据库查询，模版渲染(React/Vue SSR是同步阻塞)
  优化：
    - Streaming SSR：React18的`renderToPipeableStream`/`renderToReadableStream`，边渲染边输出HTML，首字节不用等待整棵树完成
    - Out-of-Order Streaming：先输出 <head> 和骨架屏，再流式填充内容（需要配合 Suspense + selective hydration）
    - Data Loader并行化：避免串行数据获取

  3. 边缘计算(Edge Functions)：
    把 SSR 逻辑下沉到 CDN 边缘节点（Vercel Edge、Cloudflare Workers）：
    用户 → 边缘节点（距离近，RTT 低）
    边缘节点 → 源站（只取必要数据，甚至直接读边缘 KV 存储）
    TTFB 从几百 ms 降到几十 ms
    面试点：Edge SSR 和传统 CDN 缓存的区别？Edge SSR 是在边缘节点运行业务逻辑，输出动态 HTML；传统 CDN 缓存是静态存储，无法处理个性化内容。
  4. 网络传输层：
  | 问题   | 优化                                                           |
  | ---- | ------------------------------------------------------------ |
  | 带宽不足 | 启用 Brotli 压缩（比 Gzip 体积小 15-25%）；Tree Shaking 减少 JS/CSS 体积    |
  | 分包过大 | HTTP/2 Server Push（已废弃）→ 改用 **Early Hints（103 Status Code）** |
  | 跨洋延迟 | 多区域部署 + GeoDNS 路由；使用 Anycast 网络                              |

  Early Hints（103） 是 TTFB 优化的一个高级手段：
  服务器收到请求后，立刻返回 103 Early Hints，带上 Link: </css>; rel=preload 头
  浏览器在等 200 OK 的同时，提前开始下载关键资源
  等真正的 HTML 到达时，CSS 可能已经下载完了，FCP 大幅提前
  面试点：103 Early Hints 和直接 preload 的区别？preload 在 HTML 里，必须等 HTML 解析到那行才触发；103 在 HTTP 响应头里，比 HTML 更早到达浏览器。

TTFB 优化是必要条件，不是充分条件。TTFB 好了，FCP/LCP 不一定好（如果 CSS/JS 阻塞严重）。
但 TTFB 差，后续指标一定差。这是物理层面的限制。

## 2. LCP（Largest Contentful Paint）优化

LCP是资源加载+渲染管线的交汇点，它的优化必须按“最大内容元素是什么类型”和“它在管线的哪个阶段被卡住”两个维度拆解。

### 测量区间

```plain
LCP = 最大内容元素在视口中完成渲染的时间戳
```

```plain
TTFB ──→ 资源下载完成 ──→ 元素进入视口 ──→ Layout ──→ Paint ──→ Raster ──→ Composite ──→ 显示
│           │                │            │         │          │           │
└───────────┴────────────────┴────────────┴─────────┴──────────┴───────────┘
         = LCP 的完整耗时
```
LCP 不是"图片下载完"的时间，而是图片下载完 + 解码 + 布局 + 绘制 + 光栅化 + 合成后，像素真正出现在屏幕上的时间。

### LCP候选元素的资格

| 元素类型                     | 条件                       | 面试陷阱                                     |
| ------------------------ | ------------------------ | ---------------------------------------- |
| `<img>`                  | 图片资源加载完成并渲染              | CSS `background-image` **没资格**，因为它不是文档内容 |
| `<image>` inside `<svg>` | SVG 内嵌图片                 | 需要图片本身加载完成                               |
| `<video>`                | **poster 图**的渲染时间，不是视频首帧 | 如果 poster 没设置，视频首帧不算 LCP                 |
| 块级元素内的**文本**             | 使用系统字体或 Web Font 渲染完成    | 字体加载阻塞时，LCP 可能延迟到字体到达                    |
| CSS 渐变/背景色？              | **不算**                   | 装饰性内容不计入                                 |

LCP 的"最大"怎么定义？
- 按视口内可见面积计算
- 如果图片被 `object-fit: cover` 裁剪，按渲染后的可见面积算，不是图片原始尺寸
- 文本按文本节点的布局盒面积算

动态变化：
- LCP 不是静态的。如果后续有更大的内容进入视口并渲染，LCP 会被更新
- 但用户交互（点击、滚动）后，LCP 不再更新——它只记录首次加载过程中的最大值

### 按照资源类型

#### 图片LCP

| 格式       | 压缩率                | 解码速度       | 兼容性        | 适用场景           |
| -------- | ------------------ | ---------- | ---------- | -------------- |
| **AVIF** | 最高（比 JPEG 小 50%）   | 慢（CPU 密集型） | Chrome 85+ | 大图、照片、带宽敏感     |
| **WebP** | 高（比 JPEG 小 25-35%） | 快          | 现代浏览器全覆盖   | 通用首选           |
| **JPEG** | 基准                 | 最快         | 全兼容        | 老旧浏览器 fallback |
| **PNG**  | 低                  | 快          | 全兼容        | 透明、UI 元素       |

AVIF 压缩率高但解码慢，在低端设备上，解码时间可能抵消传输节省，导致 LCP 反而变差。怎么办？
用 <picture> 提供多格式，让浏览器根据设备能力和网络条件选择
或者服务端根据 User-Agent + Save-Data 头动态返回格式

响应式图片：`srcset` + `sizes`的精确语义

```html
<img 
  srcset="small.jpg 400w, medium.jpg 800w, large.jpg 1200w"
  sizes="(max-width: 600px) 100vw, 50vw"
  src="fallback.jpg"
>
```

根据 sizes 算出该图片在布局中占用的 CSS 像素宽度（如视口 800px，sizes 算出 400px）
根据 DPR（设备像素比，如 2x）算出需要的物理像素宽度（400 × 2 = 800px）
在 srcset 中找最接近且不小于 800px 的候选（medium.jpg 800w）

```html
<!-- 如果 LCP 元素是一张图片，且图片 URL 在 HTML 中才能确定 -->
<link rel="preload" as="image" href="hero.jpg" fetchpriority="high">

<!-- 如果图片是响应式的，需要加 imagesrcset -->
<link rel="preload" as="image" 
      imagesrcset="small.jpg 400w, large.jpg 800w" 
      imagesizes="100vw" 
      fetchpriority="high">
```

图片解码：decoding="async"
```html
<img src="hero.jpg" decoding="async">
```

默认情况下，大图解码可能在主线程同步阻塞，拖慢 Paint
`decoding="async"` 把解码移到后台线程，但图片可能晚几帧显示
权衡：如果它是 LCP 元素，你希望它尽快显示，不一定要加 async。但如果它很大且不是严格 LCP，加 async 避免阻塞主线程

#### 文本LCP（当最大内容是标题/段落时）

如果文本LCP，字体加载会成为瓶颈

| 策略                                     | 行为                         | LCP 影响                                   | CLS 风险       |
| -------------------------------------- | -------------------------- | ---------------------------------------- | ------------ |
| **FOIT**（默认）                           | 字体到达前文字不可见（白屏）             | 极差，LCP 被字体阻塞                             | 无            |
| **FOUT**（`font-display: swap`）         | 先用 fallback 字体显示，到达后替换     | LCP 提前（fallback 字体算 LCP），但可能**重新计算 LCP** | 高，字体替换导致布局偏移 |
| **FANT**（`font-display: fallback`）     | 短暂 FOIT（3s 内），超时用 fallback | 中等                                       | 中等           |
| **Optional**（`font-display: optional`） | 缓存中有就用，没有就用 fallback，不重新加载 | 最好（无重新渲染）                                | 无            |

如果 LCP 是文本，且用了 font-display: swap，LCP 可能在** fallback 字体渲染时就已经记录，后续 Web Font 替换不会更新 LCP。
但如果 fallback 字体和 Web Font 的度量（metrics）差异大**，会导致 CLS。

##### 预加载字体

```html
<link rel="preload" as="font" href="font.woff2" type="font/woff2" crossorigin>
```

必须加 crossorigin，即使字体和页面同域（因为字体请求是匿名 CORS 模式）
预加载字体可以减少 FOIT/FOUT 的等待时间，直接提升文本 LCP

系统字体栈
如果品牌允许，直接用系统字体（-apple-system, BlinkMacSystemFont, Segoe UI 等）：
零加载时间
零布局偏移
LCP 只受 TTFB 和 HTML 解析影响

#### 视频Poster LCP

```html
<video poster="poster.jpg" src="video.mp4"></video>
```

LCP 取的是 poster 图完全渲染的时间
poster 图应该按图片 LCP 的策略优化（格式、预加载、尺寸预留）
如果没有 poster，视频首帧不算 LCP，LCP 可能落到页面其他元素上

#### 按管线阶段拆解LCP瓶颈

##### 网络阶段

| 瓶颈            | 优化                                        |                                                          |
| ------------- | ----------------------------------------- | -------------------------------------------------------- |
| 图片请求发现太晚      | 图片在 HTML 中靠后，浏览器预扫描器（Preload Scanner）发现得晚 | 把 `<img>` 尽量往前放，或用 `preload`                             |
| 关键请求被低优先级资源阻塞 | 大量 JS/CSS 和图片并发，带宽竞争                      | `fetchpriority="high"` 提升 LCP 图片优先级                      |
| 图片太大          | 未压缩、未裁剪、未响应式                              | 服务端动态裁剪 + 格式转换（如 Cloudflare Images `?w=800&format=avif`） |

##### 解析阶段

| 瓶颈       | 优化                                          |                           |
| -------- | ------------------------------------------- | ------------------------- |
| CSS 阻塞渲染 | 样式表在 `<head>` 中，必须等 CSSOM 完成才构建 Render Tree | 内联关键 CSS，异步非关键 CSS        |
| JS 阻塞解析  | `<script>` 在 `<img>` 之前，暂停 DOM 构建           | `defer` / `async`，或把脚本放底部 |
| 字体阻塞     | `@font-face` 在 CSS 中，CSSOM 构建时就开始加载字体       | 预加载字体，或把字体声明放得更精准         |


##### Layout阶段

| 瓶颈     | 优化                      |                                      |
| ------ | ----------------------- | ------------------------------------ |
| 图片无尺寸  | 图片下载完成后改变布局，触发 Reflow   | 提供 `width`/`height` 或 `aspect-ratio` |
| 复杂布局计算 | Flexbox/Grid 嵌套过深，布局时间长 | 简化 DOM 结构，减少嵌套                       |

##### Paint+Raster阶段

| 瓶颈     | 优化               |                               |
| ------ | ---------------- | ----------------------------- |
| 大图同步解码 | 主线程被图片解码阻塞       | `decoding="async"`（权衡见上文）     |
| 光栅化延迟  | 图片在视口外，进入视口时才光栅化 | 确保图片初始就在视口内（或接近），避免懒加载 LCP 图片 |

**不要对LCP图片用`loading="lazy"`**
loading="lazy" 会延迟图片加载到它接近视口时
如果这张图片是 LCP 元素，懒加载直接恶化 LCP
LCP 图片应该用 loading="eager"（默认）或 fetchpriority="high"

## 2. INP（Interaction to Next Paint）优化

INP 是 FID 的完全上位替代，它测量的是从交互触发到下一帧绘制完成的完整周期，而 FID 只测了输入延迟（Input Delay）那一小段。优化 INP 的核心战场是 Main Thread 的时序调度——你必须把长任务切碎、把重计算移出主线程、把框架的 Hydration 开销压到最低。

### INP的精确测量模型

```plain
用户交互（点击/轻触/键盘）
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Input Delay（输入延迟）                                      │
│  = 事件到达主线程到事件处理开始                                │
│  原因：主线程被 Long Task 占用                                │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Processing Time（处理时间）                                  │
│  = 事件处理函数执行时间                                        │
│  原因：JS 执行重计算、DOM 操作、状态更新                        │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Presentation Delay（呈现延迟）                               │
│  = 事件处理完成到下一帧绘制完成                                │
│  原因：样式重计算、Layout、Paint、Raster、Composite           │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
下一帧绘制完成（Next Paint）
```

INP = Input Delay + Processing Time + Presentation Delay
面试点：
FID 只测了 Input Delay，所以它只能告诉你"用户点下去多久才有反应"
INP 测的是端到端，包括你的事件处理函数跑了多久、以及处理完后浏览器还要多久才能画出来
INP 取的是整个会话中最差的一次交互（排除异常值后），不是平均值

### Input Delay优化：消灭Long Task

#### 长任务划分

浏览器把 >50ms 的连续主线程任务定义为 Long Task。如果用户交互发生时主线程正在跑 Long Task，Input Delay 就是用户等到主线程空闲的时间。

```javascript
function heavyWork() {
  for (let i = 0; i < 1000000; i++) {
    
  }
}

async function heavyWorkV2() {
  for (let i = 0; i < 100000; i++) {
    processChunk(i);
    if (i % 10 === 0) {
      await scheduler.yield(); // 让出主线程处理
    }
  }
}
```
scheduler.yield() 和 setTimeout(0) 的区别？setTimeout 最小延迟 4ms（HTML 规范限制），且会被排到宏任务队列末尾；scheduler.yield() 是高优先级让出，允许浏览器先处理用户输入和渲染，再继续你的任务
React 18 的 startTransition 底层也是类似的调度策略，把更新标记为低优先级

#### Web Worker卸载

```js
const worker = new Worker('worker.js')

worker.postMessage({ type: "COMPUTE", data: hugeArray })

worker.onmessage = (e) => {
  setState(e.data)
}
```

什么适合放 Worker？
大数据排序/过滤
图片/视频编解码
复杂数学计算（机器学习推理、地理计算）

不适合放 Worker 的：
DOM 操作（Worker 无 DOM 访问权）
需要频繁和主线程同步通信的（序列化/反序列化开销可能抵消收益）

#### 第三方脚本隔离

第三方脚本（分析、广告、客服 widget）是 Long Task 的主要来源。
策略：
defer / async 加载非关键第三方脚本
用 Partytown 把第三方脚本放到 Web Worker 中执行，通过代理层和主线程通信
用 iframe 隔离（但 iframe 内的 Long Task 仍可能通过 postMessage 影响主线程）

### Processing Time优化：事件处理函数瘦身

#### 事件委托的问题

```js
// 每一个item都绑定
items.forEach(item => {
  item.addEventListener('click', () => {
    updateSth();
  })
})

// 好的处理
container.addEventListener('click', (e) => {
  if (e.target.matches('.item')) {
    requestAnimationFrame(() => {
      updateSth();
    });
  }
})
```

 事件处理函数里直接调用 setState（React）或修改响应式数据（Vue），会同步触发框架的重新渲染。如果渲染很重，Processing Time 会爆炸。

 #### 防抖与节流选择

 | 场景    | 策略                                 | 为什么                                 |
 | ----- | ---------------------------------- | ----------------------------------- |
 | 搜索输入  | **防抖（Debounce）**                   | 用户停止输入后才发请求，减少处理次数                  |
 | 滚动/拖拽 | **节流（Throttle）** + `passive: true` | 减少事件处理频率，且 `passive` 让浏览器不阻塞滚动等待 JS |
 | 按钮连点  | **去抖 + 状态锁**                       | 防止重复提交，避免多次重渲染                      |

#### React 优化

```tsx
// ❌ 坏代码：每次点击都触发全量重渲染
function App() {
  const [count, setCount] = useState(0);
  return (
    <div onClick={() => setCount(c => c + 1)}>
      <HeavyComponent /> {/* 每次都会重新渲染 */}
      {count}
    </div>
  );
}

// ✅ 好代码：隔离状态，避免无关组件重渲染
function Counter() {
  const [count, setCount] = useState(0);
  return <span onClick={() => setCount(c => c + 1)}>{count}</span>;
}

function App() {
  return (
    <div>
      <HeavyComponent /> {/* 不受 Counter 状态变化影响 */}
      <Counter />
    </div>
  );
}
```

#### Presentation Delay优化：减少渲染连锁反映

事件处理函数执行完后，浏览器还要：

```plain
Recalculate Style → Layout → Paint → Raster → Composite
```

#### Hydration与INP的痛点

##### 问题：Hydration阻塞主线程

```plain
HTML 到达 → 浏览器解析 → 首次 Paint（FCP/LCP 好）
     ↓
JS bundle 下载完成 → Hydration 开始 → React 重建组件树、绑定事件、恢复状态
     ↓
Hydration 期间主线程忙碌 → 用户点击按钮 → Input Delay 爆炸
```

React 18 的解决方案：
1. Selective Hydration
   - 用户点击某个区域时，React 优先 Hydration 该区域
   - 其他区域延后，主线程先响应交互
2. Streaming SSR + Suspense
   - 把页面拆成多个 `<Suspense>` 边界
   - 每个边界独立 Hydration，不阻塞整体
3. React Server Components（RSC）
   - 服务端组件不 Hydration，直接是静态 HTML
   - 减少客户端需要 Hydration 的组件数量
4. 非 React 项目的 Hydration 优化
   - 渐进式 Hydration：只给可见区域内的组件绑定事件，滚动到视口内再 Hydration
   - Idle Hydration：用 requestIdleCallback 在浏览器空闲时 Hydration 非关键区域
5. **Islands Architecture**（Astro 框架）
   - 页面大部分是静态 HTML，只有"岛屿"（交互组件）才 Hydration

## 3. CLS（Cumulative Layout Shift）优化

CLS 是视觉稳定性指标，它的恶化直接等于"页面在动"——用户正要点击一个按钮，突然上面插进来一张图，点错了。优化 CLS 的核心是提前预留空间，让浏览器在内容到达前就知道它该占多大地方。

### 测量模型

#### 单次布局偏移分数

```plain
layout shift score = impact fraction × distance fraction
```

| 分量                    | 定义                                       | 面试陷阱                                              |
| --------------------- | ---------------------------------------- | ------------------------------------------------- |
| **Impact Fraction**   | 不稳定元素**变动前后**在视口中占据的**并集面积** / 视口总面积     | 如果元素从视口外移入视口，只计算**视口内的部分**                        |
| **Distance Fraction** | 不稳定元素位移的**最大距离** / 视口的**最小维度**（宽或高中的较小者） | 是**最大单向位移**，不是总路径。元素先下移 100px 再上移 50px，距离 = 100px |

#### 会话窗口机制（Session Window）

CLS 不是简单累加所有偏移，而是按会话窗口分组：
- 窗口内连续偏移的间隔 ≤ 1 秒
- 单个窗口最长 5 秒
- 最终 CLS = 所有窗口中分数最大的那个窗口的累加值
为什么这样设计？
避免无限累加（比如单页应用路由切换后，新页面的偏移不应和旧页面累加）
只惩罚连续抖动最严重的时段
面试点：如果页面加载时图片偏移了 0.05，3 秒后广告又偏移了 0.08，这两个偏移不在同一个会话窗口（间隔 >1s），最终 CLS 取 max(0.05, 0.08) = 0.08，而不是 0.13。

### 按照来源来拆解CLS优化

#### 图片无尺寸

```html
<img src="hero.jpg">
```

图片下载完成后，浏览器发现它1200*800突然把下面的内容往下推，触发 CLS。

优化
```html
<!-- ✅ 方式1：提供固有尺寸 -->
<img src="hero.jpg" width="1200" height="800">

<!-- ✅ 方式2：CSS aspect-ratio（图片尺寸未知时） -->
<img src="hero.jpg" style="aspect-ratio: 16/9; width: 100%; height: auto;">

<!-- ✅ 方式3：容器占位 + object-fit -->
<div style="aspect-ratio: 16/9;">
  <img src="hero.jpg" style="width: 100%; height: 100%; object-fit: cover;">
</div>
```

- width/height 属性 vs CSS width/height 的区别？HTML 属性提供固有尺寸（intrinsic size），浏览器在 HTML 解析阶段就能知道图片比例，提前预留空间；纯 CSS 需要等 CSSOM 构建完成。
- 响应式图片 srcset 下，不同尺寸的图片比例必须一致，否则切换 src 时比例变化会触发 CLS。
- aspect-ratio 在 CSS 中支持后，可以脱离 HTML 的 width/height 属性，但必须在图片渲染前生效（即不能从外部 CSS 文件异步加载）。

#### 字体加载

问题：
font-display: swap：fallback 字体先显示，Web Font 到达后替换。如果两种字体的行高、字宽、度量（metrics）不同，文本行会跳动，触发 CLS。
font-display: block：文字白屏（FOIT），虽然无 CLS，但 LCP 极差。

| 策略                                                     | CLS 风险                           | LCP 影响              | 适用场景      |
| ------------------------------------------------------ | -------------------------------- | ------------------- | --------- |
| `font-display: optional`                               | **无**                            | 最好（用缓存字体或 fallback） | 非品牌关键文本   |
| `font-display: fallback`                               | 低（3s 内白屏，超时 fallback）            | 中等                  | 平衡方案      |
| `preload` + `font-display: swap` + **同度量字体**           | 中                                | 好                   | 品牌字体必须使用时 |
| `size-adjust` / `ascent-override` / `descent-override` | **强制对齐 fallback 和 Web Font 的度量** | 好                   | 高级方案      |

高级方案CSS `size-adjust`

```css
@font-face {
  font-family: 'BrandFont';
  src: url('brand.woff2') format('woff2');
  font-display: swap;
  /* 让 fallback 字体在渲染时模拟 Web Font 的度量 */
  size-adjust: 107%;
  ascent-override: 90%;
  descent-override: 20%;
  line-gap-override: 0%;
}
```

- 通过调整 fallback 字体的 size-adjust 等属性，让 fallback 和 Web Font 的排版盒尺寸几乎一致
- 字体替换时，文本行的总高度不变，消除 CLS
- 需要工具辅助计算（如 @font-face 的 unicode-range 配合 size-adjust）
- 面试点：Google 的 "Fontaine" 库（或 next/font）自动计算这些覆盖值。

#### 动态插入内容

问题：
- 异步加载的推荐列表、评论、广告
- `insertBefore` / `appendChild`插入到已有内容上方

```html
<!-- ✅ 骨架屏占位：尺寸必须和最终内容一致 -->
<div class="skeleton" style="min-height: 300px;">
  <!-- 异步内容加载后替换 -->
</div>
```

```js
// ❌ 坏代码：直接插入到容器顶部
container.insertBefore(newContent, container.firstChild);

// ✅ 好代码：如果必须插入上方，先预留空间
const placeholder = document.createElement('div');
placeholder.style.height = '300px'; // 预估高度
container.insertBefore(placeholder, container.firstChild);
// 内容加载完成后替换 placeholder
```

骨架屏高度和实际内容不一致怎么办？仍然触发 CLS。骨架屏必须尽可能精确，或者用 min-height 保证下限。
无限滚动列表（Infinite Scroll）的 CLS 怎么算？每次加载新内容推挤下方内容，如果发生在用户交互（滚动）后，不计入 CLS（CLS 在首次交互后停止记录）。但如果用户没有交互，自动加载的内容导致偏移，会计入 CLS。
