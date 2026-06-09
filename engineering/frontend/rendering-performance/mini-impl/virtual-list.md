# 手写虚拟列表

## 1. 固定高度版本

```javascript
// FixedVirtualList.js

class FixedVirtualList {
  constructor(container, options) {
    this.container = container;
    this.itemHeight = options.itemHeight;
    this.totalCount = options.totalCount;
    this.renderItem = options.renderItem;
    this.overscan = options.overscan || 2;

    this.visibleCount = Math.ceil(container.clientHeight / this.itemHeight);
    this.startIndex = 0;
    this.endIndex = 0;

    this.init();
  }

  init() {
    // 创建内容层
    this.contentEl = document.createElement('div');
    this.contentEl.style.position = 'relative';
    this.contentEl.style.height = `${this.totalCount * this.itemHeight}px`;
    this.container.appendChild(this.contentEl);

    // 创建可见层
    this.visibleEl = document.createElement('div');
    this.contentEl.appendChild(this.visibleEl);

    // 绑定滚动
    this.container.addEventListener('scroll', () => this.onScroll());

    // 初始渲染
    this.onScroll();
  }

  onScroll() {
    const scrollTop = this.container.scrollTop;

    // 计算可见范围
    this.startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.overscan);
    this.endIndex = Math.min(
      this.totalCount,
      Math.ceil((scrollTop + this.container.clientHeight) / this.itemHeight) + this.overscan
    );

    // 更新可见内容
    this.updateVisibleItems();
  }

  updateVisibleItems() {
    // 清空当前内容
    this.visibleEl.innerHTML = '';

    // 设置偏移
    this.visibleEl.style.transform = `translateY(${this.startIndex * this.itemHeight}px)`;

    // 渲染可见项
    for (let i = this.startIndex; i < this.endIndex; i++) {
      const el = this.renderItem(i);
      el.style.height = `${this.itemHeight}px`;
      this.visibleEl.appendChild(el);
    }
  }

  destroy() {
    this.container.removeEventListener('scroll', this.onScroll);
    this.container.innerHTML = '';
  }
}

// ============ 使用 ============

const list = new FixedVirtualList(
  document.getElementById('list'),
  {
    itemHeight: 50,
    totalCount: 10000,
    overscan: 3,
    renderItem: (index) => {
      const el = document.createElement('div');
      el.className = 'list-item';
      el.textContent = `Item ${index}`;
      return el;
    },
  }
);
```

## 2. 动态高度版本

```javascript
// DynamicVirtualList.js

class DynamicVirtualList {
  constructor(container, options) {
    this.container = container;
    this.totalCount = options.totalCount;
    this.renderItem = options.renderItem;
    this.estimateHeight = options.estimateHeight || 50;
    this.overscan = options.overscan || 2;

    // 测量缓存
    this.measurements = Array(this.totalCount).fill(null);

    this.init();
  }

  getItemHeight(index) {
    return this.measurements[index] || this.estimateHeight;
  }

  getOffset(index) {
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += this.getItemHeight(i);
    }
    return offset;
  }

  // 二分查找 startIndex
  findStartIndex(scrollTop) {
    let low = 0, high = this.totalCount - 1;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.getOffset(mid) < scrollTop) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  }

  onScroll() {
    const scrollTop = this.container.scrollTop;
    const start = Math.max(0, this.findStartIndex(scrollTop) - this.overscan);
    const end = Math.min(
      this.totalCount,
      this.findStartIndex(scrollTop + this.container.clientHeight) + this.overscan
    );

    this.updateVisibleItems(start, end);
  }

  updateVisibleItems(start, end) {
    this.visibleEl.innerHTML = '';
    this.visibleEl.style.transform = `translateY(${this.getOffset(start)}px)`;

    for (let i = start; i < end; i++) {
      const el = this.renderItem(i);
      this.visibleEl.appendChild(el);

      // 测量实际高度
      requestAnimationFrame(() => {
        const height = el.getBoundingClientRect().height;
        if (this.measurements[i] !== height) {
          this.measurements[i] = height;
          this.contentEl.style.height = `${this.getOffset(this.totalCount)}px`;
        }
      });
    }
  }

  init() {
    this.contentEl = document.createElement('div');
    this.contentEl.style.position = 'relative';
    this.contentEl.style.height = `${this.totalCount * this.estimateHeight}px`;
    this.container.appendChild(this.contentEl);

    this.visibleEl = document.createElement('div');
    this.contentEl.appendChild(this.visibleEl);

    this.container.addEventListener('scroll', () => this.onScroll());
    this.onScroll();
  }
}
```
