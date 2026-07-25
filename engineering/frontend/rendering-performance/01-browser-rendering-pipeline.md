# 浏览器渲染管线

## 1. 关键渲染路径

```
HTML                    CSS
  │                      │
  ▼                      ▼
DOM Tree              CSSOM Tree
  │                      │
  └──────────┬───────────┘
             ▼
       Render Tree（可见节点）
             │
             ▼
       Layout（Reflow）
       计算几何信息（位置/大小）
             │
             ▼
       Paint（绘制）
       生成绘制指令
             │
             ▼
       Composite（合成）
       分层 → GPU 合成 → 显示
```

### Render Tree对吗？

#### 哪些DOM节点不会出现在Layout Tree里？

##### 1. `display: none` 的节点及其**整个子树**

这是最直接的情况。`display: none` 的元素本身不生成盒子，它的所有后代也不会进入 Layout Tree。注意这和 `visibility: hidden` 有本质区别——后者元素仍在 Layout Tree 中占据空间，只是 Paint 阶段被跳过。

##### 2. 不可见标签

- `<head>` 及其子元素（`<meta>`, `<link>`, `<title>`, `<style>`, `<script>` 等）
- 这些标签在 DOM 树中存在，但不会生成任何 Layout Object，因此不会进入 Layout Tree

##### 3. `display: contents`

这个元素**本身**不会出现在 Layout Tree 中（不生成盒子），但它的**子节点会"穿透"它直接参与父容器的布局**。也就是说，子节点会挂在该元素的父节点下参与布局，仿佛这个元素不存在。

如果子节点混排了块级和内联元素，浏览器会按照 CSS 2.1 的匿名块盒规则处理。

##### 4. 匿名块盒（Anonymous Block Box）

这不是 DOM 节点，而是 Layout Tree 中**多出来**的节点。当一个块级容器里同时存在块级子元素和内联子元素时，浏览器会把连续的内联内容包裹在一个匿名的块级盒子中。DOM 树里没有这个节点，但 Layout Tree 里有。

##### 5. 伪元素 `::before` / `::after`

DOM 树里没有它们，但 Layout Tree 里有对应的 Layout Object（前提是 `content` 属性非 `none` 且生成了实际内容）。如果 `content: ""` 且没有任何尺寸/背景/边框等可见样式，某些优化路径下可能不创建盒子，但规范上只要有 `content` 就应该生成。

##### 6. `content-visibility: auto`

离屏时，该元素及其子树**不会进入 Layout Tree**（更准确地说，不会进行 Layout 计算），Paint 和后续阶段也会被跳过。这是一种"懒加载布局"机制。

但如果 JS 强行读取 `offsetHeight` 等布局属性，浏览器必须**立即同步计算**该子树的 Layout，这会导致性能回退。

##### 7. Shadow DOM / `<slot>`

- `<slot>` 元素本身在 Layout Tree 中通常表现为一个**透明的占位/穿透角色**
- 被分发的节点（slotted nodes）在 Layout Tree 中挂在 slot 的位置下，但 DOM 结构上它们仍在各自的 Shadow Host 下

##### 8. `display: none` 的 `<iframe>`

`<iframe>` 本身如果 `display: none`，不会进入父文档的 Layout Tree。同时，**内部文档的渲染管线完全独立**，它自己还是会构建自己的 DOM/CSSOM/Layout Tree，只是不会被绘制到屏幕上。

---

##### `visibility: hidden` vs `display: none` 的本质区别

| | `display: none` | `visibility: hidden` |
|---|---|---|
| **Layout Tree** | 不进入 | 进入，占据空间 |
| **Reflow** | 不触发（元素不存在于布局中） | 会触发（空间仍被计算） |
| **Paint** | 跳过 | 跳过 |
| **Composite** | 无合成层 | 如果有合成层，层仍在，只是内容不可见 |
| **GPU 纹理** | 不分配 | 可能仍占用 GPU 内存（如果已光栅化） |

从 GPU 合成角度：`visibility: hidden` 的元素如果之前已经被提升为合成层（比如有 `will-change: transform`），它的纹理可能仍保留在 GPU 内存中，只是最终合成时不被混合到输出帧。而 `display: none` 的元素根本不会走到光栅化和合成阶段。

---



### 构建时序: DOM和CSSOM是“各自构建完后再合并吗”?

#### HTML Pareser遇到`<script>`时，如果脚本需要访问样式信息(getComputedStyle)，会发生什么？

HTML Parser 遇到 `<script>` 时，默认会暂停 DOM 构建（parser blocking），去下载并执行脚本。
如果脚本执行期间调用了 `getComputedStyle()` 或访问了任何需要布局信息的 DOM 属性（如 offsetWidth、clientHeight
），而此刻 CSSOM 尚未构建完成：浏览器必须立即完成当前所有待处理 CSS 的解析和 CSSOM 构建
然后执行强制同步布局（Forced Synchronous Layout）
这会导致双重阻塞：脚本阻塞 DOM 解析 + CSS 阻塞脚本执行
这就是为什么要将 `<script>` 放在 `<link rel="stylesheet">` 之后，或者给 `<script>` 加 `async/defer` 的原因——避免脚本卡在 CSSOM 未完成的状态。

##### `<link rel="stylesheet">`能做什么？

1. 核心功能：构建CSSOM：引入外部CSS资源，浏览器下载后解析为CSSOM，与DOM合并构建Layout Tree。
2. 渲染阻塞：
  - 阻塞首次渲染：CSSOM构建完成前，浏览器不会进行首次Paint(白屏);
  - 不阻塞DOM解析：HTML Parser遇到`<link>`不会停下来，会继续解析后面的HTML；
  - 间接阻塞 DOM 解析：如果后面有 `<script>`，脚本执行前必须等 CSSOM Ready（因为脚本可能访问 getComputedStyle），这时 DOM 解析被迫暂停；
  3. media属性：条件加载与性能优化：
  - 匹配当前环境的 media：正常阻塞首屏渲染
  - 不匹配当前环境的 media（如 media="print"）：不阻塞屏幕首屏渲染，CSS 可能仍被下载但不参与 CSSOM 构建
  - 这是关键 CSS 优化的底层原理：把非首屏 CSS 用 media 条件化，或拆分到异步加载
  4. ```html
  <link rel="stylesheet" href="a.css">
  <script src="b.js"></script> 
  ```
  如果`a.css`还没下载完成，浏览器遇到`b.js`时：
  1. 下载`b.js`
  2. 等待`a.css`的CSSOM构建完成
  3. 执行`b.js`
  4. 继续解析

##### `script`加上`async/defer`能做什么？


#### CSSOM 的构建会阻塞 DOM 构建吗？什么条件下阻塞、什么条件下不阻塞？

不直接阻塞DOM树构建，但是会阻塞Render Tree的构建和首次渲染

| 场景                                     | 是否阻塞 DOM 解析                 | 是否阻塞首次渲染            |
| -------------------------------------- | --------------------------- | ------------------- |
| `<link rel="stylesheet">` 在 `<head>` 中 | 不阻塞 DOM 解析（HTML Parser 继续跑） | **阻塞**，CSSOM 完成前不渲染 |
| 脚本需要访问样式信息                             | 阻塞 DOM 解析（脚本执行完才继续）         | 阻塞                  |
| `media="print"` 的 CSS                  | 不阻塞                         | **不阻塞** 屏幕首次渲染      |
| `media="screen"` 的 CSS                 | 不阻塞 DOM 解析                  | **阻塞** 首次渲染         |

关键点：HTML Parser 是流式的，遇到 CSS 不会停下来，但渲染管线会等 CSSOM Ready。


#### media="print" 的 CSS 会阻塞首屏渲染吗？为什么？

浏览器在匹配 CSS 资源时，会检查 media 属性是否与当前渲染环境匹配。media="print" 只匹配打印环境，不匹配屏幕环境，因此：
- 它仍然会被下载（如果浏览器认为未来可能用到）
- 但它不会阻塞屏幕首次渲染
- 它也不会参与当前 CSSOM 的构建（针对屏幕渲染而言）
这是性能优化中常用的技巧：把非关键 CSS 标记为 media="print" 或 media="(min-width: 99999px)" 来避免阻塞首屏。

#### 如果 CSS 文件里有一个 `@import url(...)`，这条链路的阻塞规则是什么？

```css
@import url("a.css");

body {}
```

1. `@import`必须放在CSS文件的最顶部，任何放在它前面的规则都会让整条`@import`规则无效
2. `@import`引入的 CSS 会阻塞后续 CSS 的解析和应用——浏览器必须等 @import 的 CSS 下载并解析完后，才能继续解析主 CSS 文件中`@import`之后的规则
3. 如果HTML中通过`<link>`引入的CSS里包含了`@import`，那么这个`@import`也会阻塞后续 CSS 的解析和应用
4. 多个`@import`是串行的，现代浏览器会尝试并行下载，但是解析顺序依旧是串行的


性能陷阱： 很多人把 @import 放在外部 CSS 文件里，以为和 <link> 一样，实际上它引入了额外的串行延迟，比直接在 HTML 里放多个 <link> 更慢。


### Reflow的边界：所有的样式变化都会触发Reflow吗？

样式变化是否触发Reflow，取决于它是否影响几何信息

#### 不触发Reflow的样式(仅仅出发Repaint或Composite)

| 属性                           | 触发什么                        | 为什么                                    |
| ---------------------------- | --------------------------- | -------------------------------------- |
| `color` / `background-color` | **Repaint**                 | 只影响像素颜色，不影响布局                          |
| `visibility`                 | **Repaint**                 | 元素仍在 Layout Tree 中占空间，只是不绘制            |
| `opacity`                    | **Composite**（GPU）          | 不改变几何，仅改变 alpha 混合                     |
| `transform`（2D/3D）           | **Composite**（GPU）          | 不改变元素在 Layout Tree 中的位置和大小，只在合成阶段做矩阵变换 |
| `filter` / `backdrop-filter` | **Repaint** 或 **Composite** | 后处理效果，不触发布局                            |
| `clip-path`                  | **Repaint**                 | 裁剪路径不改变盒模型                             |

transform 和 opacity 能被 GPU 合成层直接处理，是因为它们只影响视觉输出，不影响元素在文档流中的占位。

#### 触发Reflow的样式

| 属性/操作                                                   | 影响范围                                  |
| ------------------------------------------------------- | ------------------------------------- |
| `width` / `height` / `padding` / `margin` / `border`    | 元素自身 + 父容器 + 兄弟节点 + 子节点（如果子节点尺寸依赖父节点） |
| `display`（如 `none` ↔ `block`）                           | 整个子树重新布局                              |
| `position`（如 `static` ↔ `absolute`）                     | 脱离/进入文档流，影响周围元素                       |
| `top` / `left` / `right` / `bottom`（非 `static` 定位）      | 元素自身位置                                |
| `float` / `clear`                                       | 文档流重排                                 |
| `font-size` / `line-height` / `font-family`             | 文本度量变化，可能级联影响                         |
| `min-width` / `max-width` / `min-height` / `max-height` | 约束条件变化                                |
| `overflow`（如 `visible` ↔ `hidden`）                      | 可能改变滚动容器尺寸                            |
| **DOM 操作**：增删节点、修改文本内容                                  | 触发包含块的局部或全局 Reflow                    |
| **窗口 resize**                                           | 全局 Reflow                             |

#### Reflow的级联范围：不是页面重排那么简单

浏览器会对Reflow做增量优化，但是范围取决于变化的位置和类型：

| 场景                                         | Reflow 范围                                   |
| ------------------------------------------ | ------------------------------------------- |
| 修改 `absolute` / `fixed` 定位元素的 `top`/`left` | **仅该元素**（脱离文档流，不影响兄弟）                       |
| 修改 `float` 元素的 `width`                     | **该元素 + 后续浮动元素 + 包含块**                      |
| 修改文档流中普通元素的 `width`                        | **该元素 + 所有子节点 + 后续兄弟节点 + 父容器**（如果父容器尺寸依赖内容） |
| 修改 `<html>` 的 `font-size`                  | **全局 Reflow**（rem 单位级联）                     |
| 读取 `offsetHeight` 后修改 `width`              | **强制同步布局**，范围取决于修改的元素                       |

#### Forced Synchronous Layout (FSL/FLS)

```javascript
for (let i = 0; i < 1000; i++) {
  const h = el.offsetHeight; // 读取触发了Layout
  el.style.width = h + 10 + 'px'; // 修改使得之前的Layout失效
}
```

浏览器做了什么：
第一次循环：offsetHeight → 浏览器必须立即计算 Layout（如果队列中有未处理的样式变更，先 flush 掉）
el.style.height = ... → 标记该元素需要重新 Layout
第二次循环：offsetHeight → 浏览器发现上一次的 Layout 结果已经被 height 修改污染了，必须重新计算 Layout
循环 100 次 = 100 次强制同步布局

**优化：读写分离**
```javascript
// 先全部读取
const height = elements.map(el => el.offsetHeight)

// 再全部写入
elements.forEach((el, i) => {
  el.style.height = heights[i] + 10 + 'px'
})
```

这样浏览器可以在读取阶段批量计算一次 Layout，写入阶段标记变更后在下一帧统一处理。
Chromium 的 LayoutNG 对此有优化：它会尝试缓存 Layout 结果，但如果检测到"读-写-读"的依赖链，缓存失效，仍回退到同步计算。

##### 冷知识：`getBoundingClientRect()`也会触发FSL



### 更细节的渲染管线

#### Paint阶段：产生的不是像素，而是Display List

Reflow(Layout)完成后，浏览器进入Paint阶段，但是Paint不直接画像素，它产出的是Display List(绘制指令表)

为什么不是直接画成位图？
Display List 是矢量化的、与分辨率无关的
后续可以重放（replay）到不同 DPI 的屏幕、打印设备、或缩放到不同比例
支持部分重绘：如果只有一小块区域变了，不需要重画整个页面

#### 光栅化：Paint和Composite之间的隐藏阶段

Paint 产出的 Display List 必须经过光栅化才能变成 GPU 能用的位图/纹理。
但光栅化不是 Paint 后立即全局执行的。
现代浏览器（Chrome 的 Ganesh/Vulkan 后端、Safari 的 Core Animation）采用的是 Deferred + Tile-based Rasterization：
| 阶段                           | 发生了什么                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| **Paint**                    | Main Thread 产出整棵 Layer Tree 的 Display List                                                |
| **Commit**                   | Main Thread 把 Layer Tree + Property Trees + Display List 提交给 Compositor Thread            |
| **Tile-based Rasterization** | Compositor Thread 将可见区域切成 **Tile**（通常是 256x256 或 512x512 的小块），**按需**光栅化。不可见区域（离屏）可能永远不光栅化 |
| **GPU Rasterization**        | 每个 Tile 的 Display List 被送到 GPU 进程（或 Skia GPU backend）执行，产出纹理（Texture）                     |

#### Composite 阶段：Layer不是越多越好

Composite 阶段的核心任务是：决定哪些内容需要独立的合成层（Layer），然后把各层的光栅化结果（纹理）按正确顺序和变换混合成最终帧。

合成层创建的触发条件
以下情况会强制创建独立 Layer：
transform: translate3d() / rotate3d() / scale3d()（3D 变换）
will-change: transform, opacity
<video> / <canvas> / <iframe>（插件内容必须独立层）
position: fixed 或 position: sticky（滚动时避免重绘）
动画中的 transform / opacity（浏览器自动提升）
filter / backdrop-filter（某些情况下）
覆盖在 video 上的元素（为了正确混合）


### 从Main Thread到Compositor Thread的数据流

1. 传统模型：Main Thread 把 Layer Tree 扔给 Compositor Thread，Compositor 直接操作 Layer。
2. 现代模型（Chrome 59+）： Main Thread 提交的是：
   - Layer Tree（层的结构）
   - Property Trees（属性树）：
      - Transform Tree：所有变换矩阵（transform、scroll offset）
      - Effect Tree：透明度、滤镜、裁剪、混合模式
      - Clip Tree：裁剪区域
   - 为什么抽离出 Property Trees？
      - 以前每个滚动容器、每个透明元素都需要一个独立 Layer 来承载属性，导致层数膨胀
      - Property Trees 把属性从层中解耦，多个 Layer 可以共享同一个 Transform Node 或 Effect Node
      - 动画（如 transform / opacity）只需要修改 Property Trees 中的节点值，不需要重建 Layer Tree

### React Native的渲染管线

React Native 的渲染管线经历了 Paper → Fabric → Bridgeless 三代架构迭代，每一代都在解决同一个核心矛盾：JS 逻辑层与 Native UI 层之间的通信成本和语义鸿沟。

#### 旧Paper：Bridge就是瓶颈

```plain
JS Thread          Bridge (异步 JSON)          Shadow Thread          Main Thread
  │                      │                          │                    │
  ├─ React 渲染 ────────┤                          │                    │
  ├─ 产出 Native 指令 ──┼─→ 序列化 ────────────────┼─→ Yoga 布局计算 ───┼─→ 创建/更新 UIView/View
  │                      │                          │                    │
  │                      │←─ 回调反序列化 ─────────┤                    │
```

问题：
1. Bridge是单线程异步管道：所有的UI操作、Native Module调用都是JSON序列化、反序列化，批量异步提交，导致了：
  - 快速滑动，JS帧和Native帧不同步
  - 无法同步读取Native视图的布局信息
2. Shadow Thread 只负责布局：Yoga（Facebook 的 C++ Flexbox 引擎）在 Shadow Thread 计算布局，但布局结果要通过 Bridge 回传，再分发到 Main Thread 创建视图。
3. 没有真正的"渲染管线"：RN Paper 不产像素，它只产原生视图操作指令。最终的 Draw/Paint/Raster/Composite 完全交给 iOS（Core Animation）或 Android（HWUI/Skia）。

#### 二、新架构 Fabric：JSI 重构了通信范式

Fabric 是 RN 的 New Architecture 核心，它用 JSI（JavaScript Interface） 取代了 Bridge。
1. JSI 的本质：共享内存 + 同步调用
Bridge 是"进程间/线程间消息管道"，JSI 是"同进程内的 C++ 对象绑定"：
JS 引擎（Hermes/V8/JSC）和 C++ 代码运行在同一进程
JS 可以直接持有 C++ Host Object 的引用，同步调用 C++ 方法
不需要 JSON 序列化，没有异步队列
2. Fabric 的完整管线

```
plain
JS Thread                              C++ Fabric Core                         Main Thread
  │                                          │                                    │
  ├─ React Reconciler ──────────────────────┤                                    │
  ├─ 产出 React Element Tree ────────────────┤                                    │
  │                                          ├─ 构建 React Shadow Tree (C++)      │
  │                                          ├─ Yoga 布局计算 (Shadow Thread)      │
  │                                          ├─ Diff 算法 (Tree Mutation)          │
  │                                          ├─ Mounting Phase ────────────────────┼─→ 创建/更新 Native View
  │                                          │                                    │
  │←─ 同步读取布局 (measure 等) ─────────────┤                                    │
```

#### Fabric 的关键创新：
<table>
  <tr>
    <th>组件</th>
    <th>作用</th>
  </tr>
  <tr>
    <td>React Shadow Tree</td>
    <td>C++ 层维护的完整 UI 树，是 JS Virtual DOM 的镜像。JS 通过 JSI 直接读写</td>
  </tr>
  <tr>
    <td>Yoga</td>
    <td>跨平台 Flexbox 布局引擎，在 C++ 层同步计算布局</td>
  </tr>
  <tr>
    <td>Tree Diff (Mutation)</td>
    <td>对比新旧 Shadow Tree，产出最小化的 Native View 操作集合</td>
  </tr>
  <tr>
    <td>Mouting Phase</td>
    <td>把 Diff 结果应用到 Main Thread 的 Native View Tree</td>
  </tr>
</table>

#### 为什么 Fabric 能支持 React Concurrent Features？

因为 Shadow Tree 在 C++ 层，JS 的 Concurrent Reconciler 可以在内存中维护多棵"进行中"的 Shadow Tree（类似 React 18 的 Fiber 双缓冲），通过 JSI 原子性地提交到 Native 层。Paper 做不到，因为 Bridge 的异步性破坏了 React 的优先级调度语义。

#### 与浏览器渲染管线的同构与差异

##### 阶段	浏览器	React Native (Fabric)

| 阶段                   | 浏览器                                | React Native (Fabric)                        |
| -------------------- | ---------------------------------- | -------------------------------------------- |
| **DOM/Element Tree** | DOM Tree                           | React Element Tree (JS)                      |
| **样式系统**             | CSSOM（完整 CSS 解析 + 级联 + 继承）         | Yoga Style（Flexbox 子集，无级联，无伪元素，无媒体查询）        |
| **布局引擎**             | LayoutNG / Servo                   | Yoga（C++ Flexbox）                            |
| **布局树**              | Layout Tree                        | React Shadow Tree                            |
| **绘制指令**             | Display List (Skia/平台)             | **无**。RN 不产绘制指令                              |
| **光栅化**              | Tile-based Raster (GPU/CPU)        | **无**。交给 Native 平台                           |
| **合成**               | Compositor Thread + Property Trees | **无**。iOS Core Animation / Android HWUI 自行合成 |
| **GPU 输出**           | 浏览器自己管理纹理和合成                       | 原生平台管理（CALayer / SurfaceFlinger）             |
| **跨层通信**             | 无（单进程内）                            | JSI 同步绑定（C++ ↔ JS）                           |
