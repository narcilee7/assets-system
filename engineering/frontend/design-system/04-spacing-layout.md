# 间距与布局

## 1. 间距比例

```
Spacing Scale（4px 基准）：
  0:   0px
  px:  1px
  0.5: 2px
  1:   4px       ← 基准单位
  2:   8px
  3:   12px
  4:   16px
  5:   20px
  6:   24px
  8:   32px
  10:  40px
  12:  48px
  16:  64px
  20:  80px
  24:  96px
```

```css
:root {
  --space-0: 0px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

## 2. Grid 系统

```css
/* 12 列 Grid */
.container {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 var(--space-4);
}

.row {
  display: flex;
  flex-wrap: wrap;
  margin: 0 calc(-1 * var(--space-2));
}

.col {
  flex: 1 0 0%;
  padding: 0 var(--space-2);
}

/* 响应式列 */
.col-6 { flex: 0 0 50%; }
.col-4 { flex: 0 0 33.333%; }
.col-3 { flex: 0 0 25%; }

@media (max-width: 768px) {
  .col-sm-12 { flex: 0 0 100%; }
}
```

## 3. 断点系统

```css
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;
}
```

```javascript
// JS 中断点检测
const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
};

function useBreakpoint() {
  const [bp, setBp] = useState('lg');

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      if (w >= breakpoints.xl) setBp('xl');
      else if (w >= breakpoints.lg) setBp('lg');
      else if (w >= breakpoints.md) setBp('md');
      else setBp('sm');
    };
    window.addEventListener('resize', check);
    check();
    return () => window.removeEventListener('resize', check);
  }, []);

  return bp;
}
```

## 4. 容器查询

```css
/* 现代方案：容器查询（优于媒体查询） */
.card-container {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card {
    display: flex;
    flex-direction: row;
  }
}

@container (max-width: 399px) {
  .card {
    display: flex;
    flex-direction: column;
  }
}
```
