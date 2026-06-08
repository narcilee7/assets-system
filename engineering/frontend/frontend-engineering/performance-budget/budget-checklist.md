# 性能预算检查清单

## 1. Bundle 预算

```javascript
// bundlesize.config.js
module.exports = {
  files: [
    { path: './dist/*.js', maxSize: '200 kB', compression: 'gzip' },
    { path: './dist/vendor.*.js', maxSize: '500 kB', compression: 'gzip' },
    { path: './dist/*.css', maxSize: '50 kB', compression: 'gzip' },
    { path: './dist/*.html', maxSize: '20 kB', compression: 'gzip' },
  ],
};
```

## 2. Web Vitals 预算

| 指标 | Good | Needs Improvement | Poor |
|------|------|-------------------|------|
| LCP | < 2.5s | < 4s | > 4s |
| INP | < 200ms | < 500ms | > 500ms |
| CLS | < 0.1 | < 0.25 | > 0.25 |
| TTFB | < 800ms | < 1.8s | > 1.8s |
| FCP | < 1.8s | < 3s | > 3s |

## 3. 检查清单

- [ ] JS Bundle < 200KB（初始）
- [ ] 图片使用 WebP/AVIF
- [ ] 关键 CSS 内联
- [ ] 字体使用 font-display: swap
- [ ] 第三方脚本延迟加载
- [ ] 路由级代码分割
- [ ] Tree Shaking 生效
- [ ] 启用 gzip/brotli 压缩
- [ ] 静态资源 CDN 缓存
- [ ] Service Worker 缓存策略
