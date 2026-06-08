# 现代 CSS

## 1. Container Queries

```css
/* 容器查询：基于容器大小而非视口 */
.card-container {
  container-type: inline-size;
  container-name: card;
}

@container card (min-width: 400px) {
  .card {
    display: flex;
    gap: 1rem;
  }
  .card__image {
    width: 40%;
    flex-shrink: 0;
  }
}

@container card (min-width: 600px) {
  .card {
    display: grid;
    grid-template-columns: 1fr 2fr;
  }
}
```

```html
<!-- 同一个组件在不同容器中自适应 -->
<aside style="width: 300px">
  <div class="card-container">
    <article class="card"><!-- 垂直堆叠 --></article>
  </div>
</aside>

<main style="width: 800px">
  <div class="card-container">
    <article class="card"><!-- 水平布局 --></article>
  </div>
</main>
```

## 2. @layer

```css
/* 显式控制层叠优先级 */
@layer reset, base, components, utilities;

@layer reset {
  *, *::before, *::after { box-sizing: border-box; }
}

@layer base {
  body { font-family: system-ui; }
}

@layer components {
  .btn { padding: 0.5em 1em; }
}

@layer utilities {
  .text-center { text-align: center; }
}

/* 层优先级：reset < base < components < utilities < 未分层 */

/* 引入外部层 */
@import url('framework.css') layer(framework);

/* 嵌套层 */
@layer framework {
  @layer layout, components;
}

/* 框架层内的 components 子层 */
@layer framework.components {
  .card { /* 覆盖框架默认 */ }
}
```

## 3. :has()

```css
/* 父选择器 */
/* 当 .card 包含 .badge 时 */
.card:has(.badge) {
  border-color: var(--color-primary);
}

/* 兄弟选择器增强 */
/* 当后面跟着 .error 时 */
.input:has(+ .error) {
  border-color: red;
}

/* 状态组合 */
.form-group:has(:focus-visible) {
  outline: 2px solid var(--color-primary);
}

/* 数量查询 */
.list:has(> :nth-child(5)) {
  /* 至少有 5 个子项 */
  grid-template-columns: repeat(5, 1fr);
}

/* 空状态 */
.cart:has(.cart-item) .empty-message {
  display: none;
}
```

## 4. @property

```css
/* 注册自定义属性，支持类型和插值 */
@property --progress {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 0%;
}

@property --hue {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

.progress-bar {
  --progress: 0%;
  background: linear-gradient(to right, 
    var(--color-primary) var(--progress), 
    transparent var(--progress)
  );
  transition: --progress 0.5s ease;
}

.progress-bar.is-loaded {
  --progress: 100%;
}

/* 渐变动画 */
.animated-gradient {
  --hue: 0deg;
  background: hsl(var(--hue) 70% 50%);
  transition: --hue 2s linear;
}

.animated-gradient:hover {
  --hue: 360deg;
}
```

## 5. Subgrid

```css
/* 子网格：继承父网格轨道 */
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.card {
  display: grid;
  grid-template-rows: subgrid;  /* 使用父网格的行轨道 */
  grid-row: span 3;             /* 占据 3 行 */
}

.card__header { }
.card__body { }
.card__footer { }
```

```html
<div class="grid">
  <article class="card">
    <header class="card__header">Title</header>
    <div class="card__body">Content that may vary in height</div>
    <footer class="card__footer">Footer</footer>
  </article>
  <!-- 所有卡片的 header/body/footer 自动对齐 -->
</div>
```

## 6. 其他现代特性

```css
/* @supports 特性检测 */
@supports (container-type: inline-size) {
  /* Container Queries 支持 */
}

@supports not (container-type: inline-size) {
  /* 回退到 Media Queries */
}

/* 范围语法 */
@media (width >= 768px) and (width < 1024px) { }

/* 嵌套（原生 CSS Nesting） */
.card {
  padding: 1rem;

  &:hover {
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  }

  .dark & {
    background: #1f2937;
  }
}

/* :is() 和 :where() */
:is(h1, h2, h3) a { }        /* 0-0-2 */
:where(h1, h2, h3) a { }     /* 0-0-1 */

/* accent-color */
input[type="checkbox"] {
  accent-color: var(--color-primary);
}

/* aspect-ratio */
.video-container {
  aspect-ratio: 16 / 9;
}

/* color-mix */
.button:hover {
  background: color-mix(in srgb, var(--color-primary) 80%, white);
}

/* scroll-driven animations */
@keyframes reveal {
  from { opacity: 0; transform: translateY(50px); }
  to { opacity: 1; transform: translateY(0); }
}

.section {
  animation: reveal linear both;
  animation-timeline: view();
  animation-range: entry 25% cover 50%;
}
```
