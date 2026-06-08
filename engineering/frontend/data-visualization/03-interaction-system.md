# 交互系统

## 1. 缩放与平移

```javascript
class ViewportController {
  constructor(canvas, options) {
    this.canvas = canvas;
    this.scale = 1;
    this.translate = { x: 0, y: 0 };
    this.isDragging = false;
    this.lastMouse = { x: 0, y: 0 };

    this._bindEvents();
  }

  _bindEvents() {
    const canvas = this.canvas;

    // 鼠标拖拽平移
    canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMouse = { x: e.offsetX, y: e.offsetY };
      canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;

      const dx = e.offsetX - this.lastMouse.x;
      const dy = e.offsetY - this.lastMouse.y;

      this.translate.x += dx / this.scale;
      this.translate.y += dy / this.scale;

      this.lastMouse = { x: e.offsetX, y: e.offsetY };
      this.emit('transform', { scale: this.scale, translate: this.translate });
    });

    canvas.addEventListener('mouseup', () => {
      this.isDragging = false;
      canvas.style.cursor = 'grab';
    });

    // 滚轮缩放（以鼠标位置为中心）
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.1, Math.min(10, this.scale * zoomFactor));

      // 以鼠标位置为中心缩放
      this.translate.x = mouseX / newScale - (mouseX / this.scale - this.translate.x);
      this.translate.y = mouseY / newScale - (mouseY / this.scale - this.translate.y);
      this.scale = newScale;

      this.emit('transform', { scale: this.scale, translate: this.translate });
    });
  }

  emit(event, data) {
    // 触发渲染更新
    if (this.onTransform) {
      this.onTransform(data);
    }
  }

  // 将屏幕坐标转换为数据坐标
  screenToData(screenX, screenY) {
    return {
      x: (screenX / this.scale) - this.translate.x,
      y: (screenY / this.scale) - this.translate.y,
    };
  }

  // 将数据坐标转换为屏幕坐标
  dataToScreen(dataX, dataY) {
    return {
      x: (dataX + this.translate.x) * this.scale,
      y: (dataY + this.translate.y) * this.scale,
    };
  }
}
```

## 2. 刷选（Brush）

```javascript
class BrushInteraction {
  constructor(canvas, onBrushEnd) {
    this.canvas = canvas;
    this.onBrushEnd = onBrushEnd;
    this.isBrushing = false;
    this.startPoint = null;
    this.endPoint = null;
  }

  _bindEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      this.isBrushing = true;
      this.startPoint = { x: e.offsetX, y: e.offsetY };
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.isBrushing) return;
      this.endPoint = { x: e.offsetX, y: e.offsetY };
      this._drawSelection();
    });

    this.canvas.addEventListener('mouseup', () => {
      if (!this.isBrushing) return;
      this.isBrushing = false;

      // 通知选中区域
      this.onBrushEnd({
        x: Math.min(this.startPoint.x, this.endPoint.x),
        y: Math.min(this.startPoint.y, this.endPoint.y),
        width: Math.abs(this.endPoint.x - this.startPoint.x),
        height: Math.abs(this.endPoint.y - this.startPoint.y),
      });

      this._clearSelection();
    });
  }

  _drawSelection() {
    // 在 overlay canvas 上绘制选区
    const ctx = this.overlayCtx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const x = Math.min(this.startPoint.x, this.endPoint.x);
    const y = Math.min(this.startPoint.y, this.endPoint.y);
    const w = Math.abs(this.endPoint.x - this.startPoint.x);
    const h = Math.abs(this.endPoint.y - this.endPoint.y);

    ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  }
}
```

## 3. Tooltip 系统

```javascript
class TooltipManager {
  constructor(container) {
    this.container = container;
    this.tooltipEl = this._createTooltipElement();
    this.hideTimer = null;
  }

  _createTooltipElement() {
    const el = document.createElement('div');
    el.className = 'chart-tooltip';
    el.style.cssText = `
      position: absolute;
      pointer-events: none;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
      display: none;
      white-space: nowrap;
    `;
    this.container.appendChild(el);
    return el;
  }

  show(x, y, content) {
    clearTimeout(this.hideTimer);

    this.tooltipEl.innerHTML = content;
    this.tooltipEl.style.display = 'block';

    // 边界检测：避免超出容器
    const rect = this.container.getBoundingClientRect();
    const tooltipRect = this.tooltipEl.getBoundingClientRect();

    let left = x + 10;
    let top = y - tooltipRect.height - 10;

    if (left + tooltipRect.width > rect.width) {
      left = x - tooltipRect.width - 10;
    }
    if (top < 0) {
      top = y + 10;
    }

    this.tooltipEl.style.left = `${left}px`;
    this.tooltipEl.style.top = `${top}px`;
  }

  hide() {
    this.hideTimer = setTimeout(() => {
      this.tooltipEl.style.display = 'none';
    }, 100);
  }
}
```

## 4. 联动（Chart Linkage）

```javascript
class ChartLinkage {
  constructor() {
    this.charts = new Map();
    this.sharedState = {
      selectedRange: null,
      hoveredPoint: null,
      filters: {},
    };
  }

  register(id, chart) {
    this.charts.set(id, chart);

    // 监听该图表的事件
    chart.on('brush', (range) => {
      this.sharedState.selectedRange = range;
      this._broadcast('rangeChanged', range, id);
    });

    chart.on('hover', (point) => {
      this.sharedState.hoveredPoint = point;
      this._broadcast('hoverChanged', point, id);
    });
  }

  _broadcast(event, data, sourceId) {
    for (const [id, chart] of this.charts) {
      if (id !== sourceId) {
        chart.trigger(event, data);
      }
    }
  }

  // 用法：
  // linkage.register('line-chart', lineChart);
  // linkage.register('bar-chart', barChart);
  // linkage.register('pie-chart', pieChart);
  //
  // 刷选折线图时，柱状图和饼图自动联动更新
}
```

## 5. 事件委托

```javascript
class EventDelegator {
  constructor(canvas) {
    this.canvas = canvas;
    this.hitRegions = [];  // 存储可点击区域

    canvas.addEventListener('mousemove', (e) => this._handleMouseMove(e));
    canvas.addEventListener('click', (e) => this._handleClick(e));
  }

  // 注册可点击区域
  addHitRegion(region) {
    this.hitRegions.push(region);
  }

  _handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hit = this._hitTest(x, y);
    this.canvas.style.cursor = hit ? 'pointer' : 'default';

    if (hit && hit.onHover) {
      hit.onHover(hit.data, e);
    }
  }

  _handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hit = this._hitTest(x, y);
    if (hit && hit.onClick) {
      hit.onClick(hit.data, e);
    }
  }

  _hitTest(x, y) {
    // 倒序查找（后绘制的在上层）
    for (let i = this.hitRegions.length - 1; i >= 0; i--) {
      const region = this.hitRegions[i];
      if (this._pointInRegion(x, y, region)) {
        return region;
      }
    }
    return null;
  }

  _pointInRegion(x, y, region) {
    switch (region.type) {
      case 'rect':
        return (
          x >= region.x &&
          x <= region.x + region.width &&
          y >= region.y &&
          y <= region.y + region.height
        );
      case 'circle':
        const dx = x - region.cx;
        const dy = y - region.cy;
        return dx * dx + dy * dy <= region.r * region.r;
      case 'path':
        // 使用 Canvas isPointInPath
        const ctx = this.canvas.getContext('2d');
        ctx.beginPath();
        // ... 重建路径 ...
        return ctx.isPointInPath(x, y);
      default:
        return false;
    }
  }
}
```
