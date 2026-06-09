# 手写混合渲染引擎

## 目标

实现一个简化版混合渲染引擎，支持：
1. Canvas 层主渲染（高性能）
2. SVG 叠加层交互（事件 + Tooltip）
3. 自动 DPR 适配
4. 分层渲染策略

## 实现

```javascript
// render-engine.js
class HybridRenderEngine {
  constructor(container, options = {}) {
    this.container = container;
    this.width = options.width || 800;
    this.height = options.height || 400;
    this.dpr = window.devicePixelRatio || 1;

    this._initLayers();
    this._bindResize();
  }

  _initLayers() {
    const { width, height, dpr } = this;

    // 1. Canvas 主渲染层
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position: absolute; top: 0; left: 0; z-index: 1;';
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(dpr, dpr);

    // 2. SVG 交互层
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.style.cssText = 'position: absolute; top: 0; left: 0; z-index: 2; pointer-events: none;';
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.svg.setAttribute('width', width);
    this.svg.setAttribute('height', height);

    // 3. 组装
    this.container.style.cssText = `position: relative; width: ${width}px; height: ${height}px;`;
    this.container.appendChild(this.canvas);
    this.container.appendChild(this.svg);
  }

  // 清除所有层
  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    while (this.svg.firstChild) {
      this.svg.removeChild(this.svg.firstChild);
    }
  }

  // Canvas 绘制 API
  drawRect(x, y, w, h, options = {}) {
    const { ctx } = this;
    ctx.save();

    if (options.fill) {
      ctx.fillStyle = options.fill;
      ctx.fillRect(x, y, w, h);
    }

    if (options.stroke) {
      ctx.strokeStyle = options.stroke;
      ctx.lineWidth = options.lineWidth || 1;
      ctx.strokeRect(x, y, w, h);
    }

    ctx.restore();
    return this;
  }

  drawCircle(cx, cy, r, options = {}) {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);

    if (options.fill) {
      ctx.fillStyle = options.fill;
      ctx.fill();
    }

    if (options.stroke) {
      ctx.strokeStyle = options.stroke;
      ctx.lineWidth = options.lineWidth || 1;
      ctx.stroke();
    }

    ctx.restore();
    return this;
  }

  drawLine(x1, y1, x2, y2, options = {}) {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = options.stroke || '#000';
    ctx.lineWidth = options.lineWidth || 1;
    ctx.stroke();
    ctx.restore();
    return this;
  }

  drawPath(points, options = {}) {
    if (points.length < 2) return this;

    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    if (options.fill) {
      ctx.fillStyle = options.fill;
      ctx.fill();
    }

    if (options.stroke) {
      ctx.strokeStyle = options.stroke;
      ctx.lineWidth = options.lineWidth || 1;
      ctx.stroke();
    }

    ctx.restore();
    return this;
  }

  drawText(text, x, y, options = {}) {
    const { ctx } = this;
    ctx.save();
    ctx.font = options.font || '12px sans-serif';
    ctx.fillStyle = options.fill || '#000';
    ctx.textAlign = options.align || 'left';
    ctx.textBaseline = options.baseline || 'alphabetic';
    ctx.fillText(text, x, y);
    ctx.restore();
    return this;
  }

  // SVG 交互层 API
  addInteractiveRect(id, x, y, w, h, callbacks = {}) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('fill', 'transparent');
    rect.setAttribute('cursor', 'pointer');
    rect.style.pointerEvents = 'all';

    if (callbacks.onClick) {
      rect.addEventListener('click', callbacks.onClick);
    }
    if (callbacks.onMouseEnter) {
      rect.addEventListener('mouseenter', callbacks.onMouseEnter);
    }
    if (callbacks.onMouseLeave) {
      rect.addEventListener('mouseleave', callbacks.onMouseLeave);
    }
    if (callbacks.onMouseMove) {
      rect.addEventListener('mousemove', callbacks.onMouseMove);
    }

    this.svg.appendChild(rect);
    return rect;
  }

  addTooltip(x, y, content) {
    // 移除旧 tooltip
    const oldTooltip = this.svg.querySelector('.chart-tooltip');
    if (oldTooltip) oldTooltip.remove();

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('chart-tooltip');

    // 背景
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('rx', '4');
    rect.setAttribute('fill', 'rgba(0,0,0,0.8)');

    // 文字
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('fill', 'white');
    text.setAttribute('font-size', '12');
    text.setAttribute('x', '8');
    text.setAttribute('y', '18');
    text.textContent = content;

    g.appendChild(rect);
    g.appendChild(text);

    // 计算尺寸并调整位置
    this.svg.appendChild(g);
    const bbox = text.getBBox();
    const padding = 8;
    rect.setAttribute('width', bbox.width + padding * 2);
    rect.setAttribute('height', bbox.height + padding * 2);

    // 边界检测
    let tx = x + 10;
    let ty = y - bbox.height - 10;
    if (tx + bbox.width + padding * 2 > this.width) tx = x - bbox.width - 20;
    if (ty < 0) ty = y + 10;

    g.setAttribute('transform', `translate(${tx}, ${ty})`);
  }

  removeTooltip() {
    const tooltip = this.svg.querySelector('.chart-tooltip');
    if (tooltip) tooltip.remove();
  }

  // 响应式
  _bindResize() {
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width !== this.width || height !== this.height) {
          this.resize(width, height);
        }
      }
    });
    this.resizeObserver.observe(this.container);
  }

  resize(width, height) {
    this.width = width;
    this.height = height;

    // 更新 Canvas
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // 更新 SVG
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.svg.setAttribute('width', width);
    this.svg.setAttribute('height', height);

    this.container.style.width = `${width}px`;
    this.container.style.height = `${height}px`;
  }

  destroy() {
    this.resizeObserver?.disconnect();
    this.container.removeChild(this.canvas);
    this.container.removeChild(this.svg);
  }
}

// 使用示例
const engine = new HybridRenderEngine(document.getElementById('chart'));

// Canvas 绘制数据
engine
  .drawRect(50, 50, 100, 150, { fill: '#3b82f6' })
  .drawRect(180, 100, 100, 100, { fill: '#10b981' })
  .drawText('Sales', 60, 40, { fill: '#666' });

// SVG 添加交互
engine.addInteractiveRect('bar1', 50, 50, 100, 150, {
  onMouseEnter: () => engine.addTooltip(100, 125, 'Q1: 150'),
  onMouseLeave: () => engine.removeTooltip(),
});

engine.addInteractiveRect('bar2', 180, 100, 100, 100, {
  onMouseEnter: () => engine.addTooltip(230, 150, 'Q2: 100'),
  onMouseLeave: () => engine.removeTooltip(),
});
```
