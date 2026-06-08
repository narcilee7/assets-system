# 代码分割与懒加载

## 1. 路由级分割

```javascript
// React
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}

// Vue
const Dashboard = () => import('./pages/Dashboard.vue');

// 预加载
const Admin = lazy(() => import(
  /* webpackPrefetch: true */
  './pages/Admin'
));
```

## 2. 组件级分割

```javascript
// 大组件懒加载
const Chart = lazy(() => import('./components/Chart'));
const Editor = lazy(() => import('./components/Editor'));

// 条件加载（只在需要时加载）
function Modal({ isOpen }) {
  if (!isOpen) return null;
  return <LazyModal />;
}
```

## 3. 图片懒加载

```html
<!-- 原生懒加载 -->
<img src="image.jpg" loading="lazy" alt="Description">

<!-- 背景图懒加载（CSS） -->
<div class="lazy-bg" data-bg="url(image.jpg)"></div>
```

```javascript
// Intersection Observer 实现
const imageObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
      img.classList.remove('lazy');
      imageObserver.unobserve(img);
    }
  });
});

document.querySelectorAll('img.lazy').forEach((img) => imageObserver.observe(img));
```

## 4. 第三方库懒加载

```javascript
// 只在需要时加载重型库
async function loadChartLibrary() {
  const { default: Chart } = await import('heavy-chart-library');
  return new Chart(container);
}

// 用户点击"查看图表"时才加载
button.addEventListener('click', async () => {
  const chart = await loadChartLibrary();
  chart.render(data);
});
```

## 5. 预加载策略

```html
<!-- 当前页面关键资源 -->
<link rel="preload" href="/fonts/main.woff2" as="font" crossorigin>
<link rel="preload" href="/css/critical.css" as="style">

<!-- 下一页资源（低优先级） -->
<link rel="prefetch" href="/about">

<!-- 用户悬停时预加载（ anticipation） -->
<script>
  document.querySelectorAll('a[href^="/"]').forEach((link) => {
    link.addEventListener('mouseenter', () => {
      const prefetchLink = document.createElement('link');
      prefetchLink.rel = 'prefetch';
      prefetchLink.href = link.href;
      document.head.appendChild(prefetchLink);
    });
  });
</script>
```
