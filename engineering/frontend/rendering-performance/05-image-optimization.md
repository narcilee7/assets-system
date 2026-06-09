# 图片优化

## 1. 格式选择

| 格式 | 压缩率 | 透明度 | 动画 | 浏览器支持 | 适用场景 |
|------|--------|--------|------|-----------|----------|
| **AVIF** | 最高 | ✅ | ✅ | 现代 | 首屏大图 |
| **WebP** | 高 | ✅ | ✅ | 广泛 | 通用 |
| **JPEG XL** | 最高 | ✅ | ✅ | 有限 | 未来格式 |
| **JPEG** | 中 | ❌ | ❌ | 全部 | 照片 |
| **PNG** | 低 | ✅ | ❌ | 全部 | 图标、截图 |
| **SVG** | 矢量 | ✅ | ✅ | 全部 | Logo、图标 |
| **GIF** | 极低 | ✅ | ✅ | 全部 | 避免使用 |

```html
<!-- 响应式图片格式 -->
<picture>
  <source
    srcset="image-400.avif 400w, image-800.avif 800w, image-1200.avif 1200w"
    sizes="(max-width: 600px) 400px, (max-width: 1000px) 800px, 1200px"
    type="image/avif"
  >
  <source
    srcset="image-400.webp 400w, image-800.webp 800w, image-1200.webp 1200w"
    sizes="..."
    type="image/webp"
  >
  <img
    src="image-800.jpg"
    srcset="image-400.jpg 400w, image-800.jpg 800w, image-1200.jpg 1200w"
    sizes="..."
    alt="Description"
    width="800"
    height="600"
    loading="lazy"
    decoding="async"
  >
</picture>
```

## 2. 懒加载策略

```html
<!-- 原生懒加载 -->
<img src="image.jpg" loading="lazy" alt="Description">

<!-- 优先级控制 -->
<img src="hero.jpg" fetchpriority="high" alt="Hero">     <!-- 首屏 -->
<img src="below.jpg" fetchpriority="low" alt="Below">    <!-- 下方 -->
```

```javascript
// 渐进式加载：模糊占位 → 清晰图片
<img
  src="placeholder-blur.jpg"      <!-- 极小模糊图（1-2KB） -->
  data-src="full-image.jpg"
  class="lazy-image"
  alt="Description"
>

// CSS
.lazy-image {
  filter: blur(10px);
  transition: filter 0.3s;
}
.lazy-image.loaded {
  filter: blur(0);
}
```

## 3. CDN 图片处理

```html
<!-- Cloudinary / Imgix 动态优化 -->
<img src="https://cdn.example.com/image.jpg?w=800&h=600&fit=crop&q=80&fm=webp">

<!-- 参数说明 -->
<!-- w=800: 宽度 800px -->
<!-- q=80: 质量 80% -->
<!-- fm=webp: 输出 WebP -->
<!-- fit=crop: 裁剪填充 -->
```

## 4. SVG 优化

```html
<!-- 内联 SVG（避免额外请求） -->
<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor"/>
</svg>

<!-- SVG Sprite（多个图标合并） -->
<svg><use href="/icons.svg#search"/></svg>
```

```bash
# SVG 压缩
npx svgo icon.svg --pretty
```
