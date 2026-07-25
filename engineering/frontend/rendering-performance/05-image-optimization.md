# 图片优化

图片优化是**资源层优化**的顶点，它直接咬合 LCP、CLS、主线程负载三个指标。面试里最大的陷阱是"压缩图片就完事了"——实际上格式选择、加载时机、解码策略、响应式规则、CDN 自动化，五个维度缺一不可。

---

## 一、核心矛盾：质量、体积、解码速度、加载时机

| 维度 | 优化方向 | 面试陷阱 |
|---|---|---|
| **质量** | 视觉无损压缩、渐进式编码 | 过度压缩导致视觉劣化，反而需要更高分辨率补救 |
| **体积** | 格式选择、压缩算法、动态裁剪 | AVIF 体积小但解码慢，低端设备可能得不偿失 |
| **解码速度** | 硬件加速解码、异步解码 | 大图同步解码阻塞主线程，Paint 延迟 |
| **加载时机** | preload、fetchpriority、懒加载 | LCP 图片不能懒加载，但非 LCP 图片过早加载浪费带宽 |

---

## 二、格式选择：没有万能格式，只有场景匹配

| 格式 | 压缩率 | 解码速度 | 特性 | 适用场景 |
|---|---|---|---|---|
| **AVIF** | 最高（比 JPEG 小 50-60%） | 慢（CPU 密集型，无广泛硬件解码） | 支持 HDR、透明、动画 | 照片类大图、带宽敏感、高端设备 |
| **WebP** | 高（比 JPEG 小 25-35%） | 快（有硬件解码） | 支持透明、动画、无损 | **通用首选**，现代浏览器全覆盖 |
| **JPEG** | 基准 | 最快（硬件解码最成熟） | 不支持透明 | 老旧浏览器 fallback、缩略图 |
| **PNG** | 低 | 快 | 无损、透明 | UI 元素、图标、需要精确透明的场景 |
| **SVG** | 矢量，与分辨率无关 | 极快（浏览器原生解析） | 缩放无损、可 CSS 操作 | 图标、Logo、简单插画 |
| **GIF** | 极低 | 慢 | 256 色、动画 | **应避免**，用 WebP/APNG 替代 |

**面试深挖点：**

**1. AVIF 的解码陷阱**
- AVIF 使用 HEIF 容器 + AV1 编码，**软件解码**在低端 Android 上可能耗时 100ms+（一张 2K 图）
- 解码阻塞主线程 → Paint 延迟 → LCP 恶化
- **策略**：用 `<picture>` 提供 AVIF + WebP fallback，或服务端根据 `User-Agent` 动态返回格式

```html
<picture>
  <source srcset="photo.avif" type="image/avif">
  <source srcset="photo.webp" type="image/webp">
  <img src="photo.jpg" alt="..." width="800" height="600">
</picture>
```

**2. WebP 的渐进式（Progressive）缺失**
- JPEG 支持渐进式编码（模糊到清晰），WebP 不支持
- 弱网环境下，渐进式 JPEG 的**感知加载速度**可能优于 WebP
- 但 WebP 的**总体体积优势**通常抵消这一点

---

## 三、响应式图片：`srcset` + `sizes` 的精确语义

这是面试里**错误率最高**的知识点。

```html
<img 
  srcset="small.jpg 400w, medium.jpg 800w, large.jpg 1200w"
  sizes="(max-width: 600px) 100vw, 50vw"
  src="fallback.jpg"
  alt="..."
>
```

**浏览器的选择逻辑：**

1. 根据当前视口宽度和 `sizes` 的媒体条件，算出图片的**布局宽度**（CSS 像素）
   - 视口 800px，`(max-width: 600px)` 不匹配 → 走 `50vw` → 布局宽度 = 400px

2. 根据设备像素比（DPR，如 2x），算出**物理像素宽度**
   - 400 × 2 = 800px

3. 在 `srcset` 中找**最接近且不小于** 800px 的候选
   - `medium.jpg 800w` 正好匹配

**面试杀招：**

- **`sizes` 必须和实际布局宽度一致**。如果 CSS 中图片实际只占 30% 宽度，但 `sizes="100vw"`，浏览器会选 2-3 倍大的图片，浪费带宽。
- **`w` 描述符**是图片的**固有宽度**（原始像素宽度），不是显示宽度。如果 `small.jpg` 实际只有 300px 宽，但标了 `400w`，浏览器会按 400w 计算，可能选错。
- **`srcset` 中不能混用 `w` 和 `x` 描述符**。要么全用 `w`（响应式），要么全用 `x`（固定 DPR 切换）。

**DPR 描述符（简单场景）：**

```html
<img 
  srcset="photo-1x.jpg 1x, photo-2x.jpg 2x, photo-3x.jpg 3x"
  src="photo-1x.jpg"
>
```

- 浏览器根据 `window.devicePixelRatio` 直接选择
- 适合**固定尺寸**的图片（如图标、Logo），不适合响应式布局

---

## 四、加载策略：五个属性的精确分工

| 属性 | 作用 | 优先级 | 面试陷阱 |
|---|---|---|---|
| `loading="lazy"` | 延迟到接近视口时加载 | 低 | **LCP 图片绝对不能加**。SSR 输出中懒加载图片 URL 对爬虫可见，但爬虫可能不执行懒加载逻辑 |
| `loading="eager"` | 立即加载（默认） | 正常 | LCP 图片应保持默认 |
| `fetchpriority="high"` | 提示浏览器高优先级 | 高 | Chrome 102+。对 LCP 图片最有效，但滥用会和关键 CSS/JS 抢带宽 |
| `decoding="async"` | 异步解码，不阻塞主线程 | - | 大图非 LCP 时推荐。LCP 图片如果用 `async`，可能晚几帧显示，LCP 反而延迟 |
| `preload` (link) | 在 HTML 解析早期就开始下载 | 最高 | 必须和实际 `src` 完全匹配，否则重复下载 |

**LCP 图片的完整加载策略：**

```html
<!-- 1. 在 <head> 中预加载（如果图片 URL 在 HTML 中才能确定） -->
<link rel="preload" as="image" href="hero.jpg" fetchpriority="high">

<!-- 2. 图片本身 -->
<img 
  src="hero.jpg" 
  alt="..."
  width="1200" 
  height="800"
  fetchpriority="high"
  decoding="sync"  <!-- LCP 图片需要同步解码，确保尽快显示 -->
>
```

**面试点：** `preload` 和 `fetchpriority` 的区别？
- `preload` 是**提前发现资源**（在 HTML 解析到 `<img>` 之前就开始下载）
- `fetchpriority` 是**调整已发现资源的排队优先级**
- 两者可以叠加：`preload` 让下载开始得早，`fetchpriority="high"` 让它在并发请求中排在前面

---

## 五、解码与渲染：主线程的隐形杀手

### 1. 图片解码的线程模型

| 解码方式 | 行为 | 影响 |
|---|---|---|
| **同步解码**（默认） | 主线程解码，解码完才继续 Paint | 大图阻塞主线程，INP 恶化 |
| **异步解码**（`decoding="async"`） | 后台线程解码，解码期间先显示占位 | 不阻塞主线程，但图片可能晚几帧出现 |

**面试杀招：**
- `decoding="async"` 对 **LCP 图片是双刃剑**。它不阻塞主线程，但如果解码完成前 LCP 计时已触发（浏览器认为"内容已渲染"），LCP 可能记录的是**占位状态**（如模糊背景色），而非实际图片。
- 现代浏览器对**硬件加速解码**的图片（JPEG、WebP）通常走 GPU 解码管线，主线程阻塞较轻。AVIF 目前多为软件解码，阻塞风险更高。

### 2. CSS `background-image` 的渲染陷阱

```css
.hero {
  background-image: url('hero.jpg');
}
```

**为什么 `background-image` 不是 LCP 候选？**
- 浏览器的内容优先级模型中，`background-image` 被视为**装饰性资源**
- 它不参与文档的**内容流**，浏览器无法判断其"重要性"
- 它的加载时机由 CSSOM 构建触发，通常比 `<img>` 更晚

**面试点：** 如果首屏最大内容是一张图，**必须用 `<img>` 而非 `background-image`**，否则 LCP 会落到其他元素上（如文本），且图片加载不受 `fetchpriority` 控制。

### 3. `will-change` 与图片合成层

```css
img {
  will-change: transform;
}
```

- 提示浏览器把图片提升为**合成层（Layer）**
- 图片解码后作为 GPU 纹理，后续 `transform` 动画不触发重绘
- 但合成层有**内存开销**，图片过多时 GPU 内存爆炸

---

## 六、尺寸预留：CLS 的防御线

```html
<!-- ✅ 方式1：固有尺寸 -->
<img src="photo.jpg" width="800" height="600">

<!-- ✅ 方式2：aspect-ratio（尺寸未知时） -->
<img src="photo.jpg" style="aspect-ratio: 16/9; width: 100%; height: auto;">

<!-- ✅ 方式3：容器占位 -->
<div style="aspect-ratio: 16/9;">
  <img src="photo.jpg" style="width: 100%; height: 100%; object-fit: cover;">
</div>
```

**面试深挖：**

- `width`/`height` 属性提供的是**固有尺寸比例**，不是显示尺寸。配合 CSS `width: 100%; height: auto;` 时，浏览器在 HTML 解析阶段就知道图片比例，提前预留空间。
- `aspect-ratio` 在 CSS 中支持后，可以脱离 HTML 属性，但**必须在图片渲染前生效**（不能从外部 CSS 文件异步加载）。
- `object-fit: cover` 会裁剪图片，但**不影响 Layout Tree 中的盒尺寸**，因此不触发 CLS。

---

## 七、CDN 自动化：现代图片服务的策略

### 1. 动态格式转换

```
https://cdn.example.com/photo.jpg?w=800&h=600&format=avif&q=80
```

| 参数 | 作用 |
|---|---|
| `w` / `h` | 服务端动态裁剪/缩放，避免客户端下载大图后缩小 |
| `format=auto` / `f_auto` | 根据 `Accept` 头自动返回 AVIF/WebP/JPEG |
| `q=auto` / `q_80` | 质量参数，通常 80-85 是视觉无损的甜点 |
| `fit=cover` | 裁剪模式 |

**面试点：** 为什么 `w=800` 比客户端下载 2000px 图片再 `width: 800px` 更好？
- 减少传输体积（可能差 4 倍以上）
- 减少客户端解码压力（解码 2000px 图再缩小，浪费 CPU）
- 但 CDN 裁剪需要**服务端存储和处理能力**，不是免费午餐

### 2. 低质量图片占位（LQIP）

```html
<img 
  src="photo.jpg" 
  srcset="..."
  style="background-image: url(data:image/jpeg;base64,/9j/4AAQ...); background-size: cover;"
>
```

- Base64 内联的 LQIP 体积通常 **200-500 字节**
- 图片加载完成前显示模糊占位，加载完成后自然覆盖
- **注意**：LQIP 本身如果尺寸和最终图片不一致，仍可能触发 CLS。通常 LQIP 是**同比例的小图**，安全。

### 3. 渐进式 JPEG vs 模糊占位

| 策略 | 行为 | LCP 影响 |
|---|---|---|
| 渐进式 JPEG | 图片本身从模糊到清晰逐层加载 | LCP 可能在**首层模糊时**就触发，数值提前，但视觉质量差 |
| LQIP + 正常图片 | 先显示模糊占位，再切换为清晰图片 | LCP 在清晰图片显示时触发，数值可能更高，但视觉体验好 |

**面试点：** Google 的 LCP 算法以**最大内容元素完全渲染**为计时点。渐进式 JPEG 的模糊首层如果被视为"内容"，LCP 可能提前记录，但用户实际看到的是模糊图。这是 LCP 的**测量盲区**。

---

## 八、与 Web Vitals 的精确咬合

| 指标 | 图片优化要点 |
|---|---|
| **LCP** | 用 `<img>` 而非 `background-image`；预加载 + `fetchpriority="high"`；提供 `width`/`height`；不用 `loading="lazy"`；同步解码 |
| **CLS** | 必须提供固有尺寸或 `aspect-ratio`；避免图片加载后推挤内容；字体加载导致的文本重排不推挤图片布局 |
| **INP** | 大图用 `decoding="async"` 避免阻塞主线程；但 LCP 图片权衡使用；避免在事件处理中同步读取图片尺寸（`naturalWidth` 等） |
| **FCP** | 非关键图片懒加载，减少首屏带宽竞争；关键图片不阻塞 CSSOM |

---

## 九、面试杀招

### 杀招 1：为什么 `loading="lazy"` 对 LCP 图片是灾难？

- 浏览器在 HTML 解析时看到 `loading="lazy"`，会把该图片的加载**推迟到它接近视口时**
- 如果该图片是首屏最大内容，LCP 计时必须等它下载 + 解码 + 显示
- LCP 可能从 1.5s 恶化到 3s+

**例外：** 如果图片在**首屏视口外**（如长页面底部的大图），它本来就不是 LCP 候选，懒加载是正确的。

### 杀招 2：`srcset` 和 `sizes` 的调试

Chrome DevTools Network 面板可以模拟 DPR 和视口尺寸，验证浏览器是否选择了正确的图片。面试时可以提到：
- 打开 DevTools → Network → 右键表头 → 勾选 `Transferred Size` 和 `Rendered Size`
- 对比 `Rendered Size`（实际显示像素）和 `Transferred Size`（下载体积），验证是否下载了过大的图片

### 杀招 3：Web Font 图标 vs SVG 图标 vs 图片图标

| | 体积 | 可缩放 | 颜色控制 | CLS 风险 | LCP 影响 |
|---|---|---|---|---|---|
| **图片图标（PNG/Sprite）** | 较大 | 有限 | 难 | 中（需预留尺寸） | 中 |
| **字体图标（Icon Font）** | 小（字体文件复用） | 无限 | CSS `color` | **高**（字体加载失败时显示方框或空白，布局可能跳动） | 低 |
| **SVG 内联** | 极小（矢量） | 无限 | CSS `fill`/`stroke` | **无**（尺寸固定，无加载过程） | **无** |

**面试金句：** 图标优先用 **SVG 内联**，其次是 **字体图标**（需配 `font-display: optional`），避免用图片图标。

### 杀招 4：HTTP/3 对图片加载的影响

- HTTP/3（QUIC）的 **0-RTT** 减少连接建立时间
- **多路复用无队头阻塞**：大量小图并发时，不会因为某个大图阻塞而延迟其他图
- 但 HTTP/3 的 **拥塞控制** 仍在演进，某些场景下吞吐量不如 TCP BBR

---

## 十、可扩展点

1. **AVIF 的动画（AVIS）vs WebP 动画**：浏览器支持度、解码性能、体积对比
2. **HDR 图片（JPEG XL / AVIF）**：`color-gamut` CSS 媒体查询、`hdr` 图片格式对 LCP 的影响
3. **图片的 Content-DPR 响应式**：服务端根据 `Sec-CH-DPR` 请求头自动返回对应 DPR 的图片，客户端无需 `srcset`
4. **Canvas / WebGL 中的图片加载**：`ImageBitmap` 的异步解码、`createImageBitmap` 的 `premultiplyAlpha` 选项
5. **Next.js Image 组件的底层**：自动 `srcset` 生成、`placeholder="blur"` 的 LQIP 机制、`priority` 属性的 `preload` 自动注入

---
