# 字体优化

## 1. FOIT vs FOUT vs FOPT

```
FOIT (Flash of Invisible Text):
  字体加载前 → 文字不可见 → 字体加载后 → 显示文字
  体验差（文字消失）

FOUT (Flash of Unstyled Text):
  字体加载前 → 显示后备字体 → 字体加载后 → 切换
  体验可接受

FOPT (Flash of Faux Text):
  使用合成字体（粗体/斜体模拟）→ 加载真实字体
  介于两者之间
```

## 2. font-display 策略

```css
@font-face {
  font-family: 'Custom';
  src: url('/font.woff2') format('woff2');
  font-display: swap;     /* 推荐：先显示后备字体 */
  /* font-display: optional; */  /* 0.1s 内加载完成才使用，否则用后备 */
  /* font-display: block; */     /* FOIT，最多阻塞 3s */
  /* font-display: fallback; */  /* 阻塞时间短，超时不换 */
}
```

## 3. 预加载关键字体

```html
<!-- 预加载首屏字体 -->
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>

<!-- 字体子集化（只加载需要的字符） -->
<!-- 中文：常用 3500 字 vs 完整 2w+ 字 -->
<link rel="preload" href="/fonts/main-subset.woff2" as="font" crossorigin>
```

## 4. 系统字体栈

```css
/* 优先使用系统字体，无需加载 */
body {
  font-family:
    -apple-system,      /* macOS/iOS */
    BlinkMacSystemFont, /* Chrome macOS */
    'Segoe UI',         /* Windows */
    Roboto,             /* Android */
    'Helvetica Neue',
    Arial,
    sans-serif;
}
```

## 5. 字体加载 API

```javascript
// 检测字体加载完成
const font = new FontFace('Custom', 'url(/font.woff2)');
await font.load();
document.fonts.add(font);

// 或
await document.fonts.ready;
// 所有字体加载完成
```
