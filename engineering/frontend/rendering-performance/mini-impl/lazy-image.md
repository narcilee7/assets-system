# 手写图片懒加载

## 1. 基础实现

```javascript
// LazyImage.js

class LazyImageLoader {
  constructor(options = {}) {
    this.selector = options.selector || 'img[data-src]';
    this.rootMargin = options.rootMargin || '50px';
    this.threshold = options.threshold || 0.01;
    this.placeholderClass = options.placeholderClass || 'lazy-placeholder';
    this.loadedClass = options.loadedClass || 'lazy-loaded';

    this.observer = new IntersectionObserver(
      (entries) => this.handleEntries(entries),
      {
        rootMargin: this.rootMargin,
        threshold: this.threshold,
      }
    );

    this.init();
  }

  init() {
    document.querySelectorAll(this.selector).forEach((img) => {
      this.observer.observe(img);
    });
  }

  handleEntries(entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        this.loadImage(entry.target);
        this.observer.unobserve(entry.target);
      }
    });
  }

  loadImage(img) {
    const src = img.dataset.src;
    const srcset = img.dataset.srcset;

    if (!src) return;

    // 创建新图片预加载
    const preloadImg = new Image();

    preloadImg.onload = () => {
      img.src = src;
      if (srcset) img.srcset = srcset;
      img.classList.add(this.loadedClass);
      img.classList.remove(this.placeholderClass);
    };

    preloadImg.onerror = () => {
      img.classList.add('lazy-error');
      img.dispatchEvent(new CustomEvent('lazyError', { detail: { src } }));
    };

    preloadImg.src = src;
  }

  destroy() {
    this.observer.disconnect();
  }
}

// ============ 使用 ============

// HTML
// <img
//   class="lazy-placeholder"
//   data-src="real-image.jpg"
//   data-srcset="real-image-400.jpg 400w, real-image-800.jpg 800w"
//   alt="Description"
//   width="800"
//   height="600"
// >

const lazyLoader = new LazyImageLoader({
  selector: 'img[data-src]',
  rootMargin: '100px',  // 提前 100px 开始加载
});
```

## 2. 带模糊占位效果

```html
<style>
  .lazy-placeholder {
    filter: blur(10px);
    transition: filter 0.3s ease-out;
  }
  .lazy-loaded {
    filter: blur(0);
  }
</style>

<img
  class="lazy-placeholder"
  src="tiny-blur.jpg"         <!-- 1-2KB 的模糊小图 -->
  data-src="full-image.jpg"
  alt="Description"
>
```

## 3. 背景图懒加载

```javascript
class LazyBackground {
  constructor() {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          el.style.backgroundImage = el.dataset.bg;
          el.classList.add('bg-loaded');
          this.observer.unobserve(el);
        }
      });
    });

    document.querySelectorAll('[data-bg]').forEach((el) => {
      this.observer.observe(el);
    });
  }
}
```
