# 手写 Hydration 优化器

## 目标

实现一个简化版 Hydration 优化器，支持：
1. Islands 架构（仅标记组件注水）
2. 选择性 Hydration（按优先级）
3. 延迟 Hydration（视口外/低优先级）

## 实现

```javascript
// hydration-optimizer.js

/**
 * Islands Hydration 管理器
 * 只给标记了 data-island 的元素注水
 */
class IslandsHydrator {
  constructor(options = {}) {
    this.rootSelector = options.rootSelector || '[data-island]';
    this.observer = null;
    this.hydratedIslands = new Set();
  }

  // 初始化：扫描所有 islands
  init() {
    const islands = document.querySelectorAll(this.rootSelector);

    for (const island of islands) {
      const strategy = island.dataset.island;

      switch (strategy) {
        case 'load':
          this._hydrateImmediately(island);
          break;
        case 'idle':
          this._hydrateWhenIdle(island);
          break;
        case 'visible':
          this._hydrateWhenVisible(island);
          break;
        case 'media':
          this._hydrateWhenMediaMatches(island);
          break;
        case 'never':
          // 纯静态，永不注水
          break;
        default:
          this._hydrateImmediately(island);
      }
    }
  }

  // 立即注水
  _hydrateImmediately(island) {
    this._hydrate(island);
  }

  // 浏览器空闲时注水
  _hydrateWhenIdle(island) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => this._hydrate(island), { timeout: 2000 });
    } else {
      setTimeout(() => this._hydrate(island), 200);
    }
  }

  // 进入视口时注水
  _hydrateWhenVisible(island) {
    if (!this.observer) {
      this.observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this._hydrate(entry.target);
            this.observer.unobserve(entry.target);
          }
        }
      }, { rootMargin: '100px' }); // 提前 100px 开始加载
    }
    this.observer.observe(island);
  }

  // 媒体查询匹配时注水
  _hydrateWhenMediaMatches(island) {
    const mediaQuery = island.dataset.islandMedia;
    if (!mediaQuery) {
      this._hydrateImmediately(island);
      return;
    }

    const mql = window.matchMedia(mediaQuery);
    if (mql.matches) {
      this._hydrate(island);
    } else {
      mql.addEventListener('change', (e) => {
        if (e.matches) this._hydrate(island);
      });
    }
  }

  // 执行注水
  _hydrate(island) {
    if (this.hydratedIslands.has(island)) return;
    this.hydratedIslands.add(island);

    const componentName = island.dataset.islandComponent;
    const props = JSON.parse(island.dataset.islandProps || '{}');

    // 动态导入组件
    import(`/components/${componentName}.js`).then((module) => {
      const Component = module.default;
      // 渲染组件到 island
      this._renderComponent(island, Component, props);
    });
  }

  _renderComponent(container, Component, props) {
    // 简化版：假设是 React/Vue/原生组件
    // 实际实现取决于框架
    if (window.React && window.ReactDOM) {
      const root = window.ReactDOM.createRoot(container);
      root.render(window.React.createElement(Component, props));
    } else {
      // 原生组件
      const instance = new Component(container, props);
      instance.mount();
    }
  }
}

// 服务端输出带标记的 HTML
function renderIsland(componentName, props, strategy = 'load') {
  const propsJson = JSON.stringify(props).replace(/"/g, '&quot;');

  return `
    <div
      data-island="${strategy}"
      data-island-component="${componentName}"
      data-island-props="${propsJson}"
    >
      <!-- 服务端预渲染的内容 -->
      ${renderToString(componentName, props)}
    </div>
  `;
}

// 使用
// 服务端生成：
// <div data-island="visible" data-island-component="Comments" data-island-props="{&quot;postId&quot;:123}">
//   <div class="comments">...</div>  <!-- 预渲染 -->
// </div>

// 客户端初始化：
const hydrator = new IslandsHydrator();
hydrator.init();

/**
 * 选择性 Hydration（按交互优先级）
 */
class SelectiveHydrator {
  constructor() {
    this.pending = [];
    this.isHydrating = false;
  }

  // 注册需要注水的区域
  register(element, priority = 'normal') {
    this.pending.push({ element, priority });
    this._schedule();
  }

  _schedule() {
    if (this.isHydrating) return;

    // 按优先级排序
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    this.pending.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    this.isHydrating = true;

    // 使用 scheduler 优先级（React 18）
    if (window.scheduler) {
      scheduler.unstable_scheduleCallback(
        scheduler.unstable_NormalPriority,
        () => this._hydrateNext()
      );
    } else {
      requestAnimationFrame(() => this._hydrateNext());
    }
  }

  _hydrateNext() {
    if (this.pending.length === 0) {
      this.isHydrating = false;
      return;
    }

    const { element } = this.pending.shift();

    // 检查元素是否仍在 DOM 中
    if (!document.contains(element)) {
      this._hydrateNext();
      return;
    }

    // 执行 Hydration
    this._performHydration(element);

    // 让出主线程
    if (this.pending.length > 0) {
      requestAnimationFrame(() => this._hydrateNext());
    } else {
      this.isHydrating = false;
    }
  }

  _performHydration(element) {
    // 触发 React/Vue Hydration
    const event = new CustomEvent('hydrate', { bubbles: true });
    element.dispatchEvent(event);
  }
}

// 使用
const selective = new SelectiveHydrator();

// 关键区域立即注水
selective.register(document.querySelector('nav'), 'critical');
selective.register(document.querySelector('.hero-cta'), 'high');

// 次要区域延后
selective.register(document.querySelector('.sidebar'), 'normal');
selective.register(document.querySelector('.footer'), 'low');
```
