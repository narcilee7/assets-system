# 渲染架构

## 1. 四种渲染技术对比

| 维度 | DOM (HTML/CSS) | SVG | Canvas 2D | WebGL |
|------|---------------|-----|-----------|-------|
| **渲染方式** | 声明式，浏览器排版 | 声明式，矢量图形 | 命令式，像素操作 | 命令式，GPU 着色器 |
| **元素数量** | < 3,000 | < 10,000 | > 100,000 | > 1,000,000 |
| **交互实现** | 原生事件 | 原生事件 | 手动计算命中测试 | 手动计算命中测试 |
| **可访问性** | 最佳 | 好（title/desc） | 差（需手动实现） | 差 |
| **动画性能** | 一般（CSS） | 一般 | 好（rAF） | 极佳（GPU） |
| **分辨率** | 依赖 CSS | 无限缩放 | 固定分辨率 | 固定分辨率 |
| **学习曲线** | 低 | 中 | 中 | 高 |
| **包体积** | 0 | 0 | 0 | 较大（Three.js ~600KB） |

## 2. SVG 渲染

```svg
<!-- 基础 SVG 柱状图 -->
<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <!-- 坐标轴 -->
  <line x1="50" y1="250" x2="350" y2="250" stroke="#333" />
  <line x1="50" y1="250" x2="50" y2="50" stroke="#333" />

  <!-- 柱子（带交互） -->
  <g class="bar-group">
    <rect x="60" y="150" width="40" height="100" fill="#3b82f6"
          role="img" aria-label="Q1: 100">
      <title>Q1: 100</title>
    </rect>
    <rect x="120" y="100" width="40" height="150" fill="#10b981"
          role="img" aria-label="Q2: 150">
      <title>Q2: 150</title>
    </rect>
  </g>

  <!-- 标签 -->
  <text x="80" y="270" text-anchor="middle">Q1</text>
  <text x="140" y="270" text-anchor="middle">Q2</text>
</svg>
```

```javascript
// React 中封装 SVG 组件
function BarChart({ data, width, height }) {
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xScale = (i) => (i * innerWidth) / data.length;
  const yScale = (v) => innerHeight - (v / maxValue) * innerHeight;
  const maxValue = Math.max(...data.map((d) => d.value));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Bar chart">
      <g transform={`translate(${margin.left},${margin.top})`}>
        {data.map((d, i) => (
          <rect
            key={d.label}
            x={xScale(i) + 5}
            y={yScale(d.value)}
            width={innerWidth / data.length - 10}
            height={innerHeight - yScale(d.value)}
            fill={d.color}
          >
            <title>{`${d.label}: ${d.value}`}</title>
          </rect>
        ))}
      </g>
    </svg>
  );
}
```

## 3. Canvas 渲染

```javascript
class CanvasChart {
  constructor(canvas, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.width = options.width;
    this.height = options.height;

    // 高清屏适配
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.scale(this.dpr, this.dpr);
  }

  render(data) {
    const ctx = this.ctx;
    const { width, height } = this;

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    // 绘制坐标轴
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(50, 250);
    ctx.lineTo(350, 250);
    ctx.moveTo(50, 250);
    ctx.lineTo(50, 50);
    ctx.stroke();

    // 绘制柱子
    const barWidth = (width - 100) / data.length - 10;
    const maxValue = Math.max(...data.map((d) => d.value));

    data.forEach((d, i) => {
      const x = 60 + i * (barWidth + 10);
      const barHeight = (d.value / maxValue) * 200;
      const y = 250 - barHeight;

      ctx.fillStyle = d.color;
      ctx.fillRect(x, y, barWidth, barHeight);

      // 文字标签
      ctx.fillStyle = '#333';
      ctx.textAlign = 'center';
      ctx.fillText(d.label, x + barWidth / 2, 270);
      ctx.fillText(d.value, x + barWidth / 2, y - 5);
    });
  }

  // 命中测试（手动计算）
  hitTest(x, y, data) {
    const barWidth = (this.width - 100) / data.length - 10;
    const maxValue = Math.max(...data.map((d) => d.value));

    for (let i = 0; i < data.length; i++) {
      const bx = 60 + i * (barWidth + 10);
      const barHeight = (data[i].value / maxValue) * 200;
      const by = 250 - barHeight;

      if (x >= bx && x <= bx + barWidth && y >= by && y <= 250) {
        return data[i];
      }
    }
    return null;
  }
}
```

## 4. WebGL 渲染（大规模数据）

```javascript
// 使用 regl 简化 WebGL（或直接用原生 WebGL）
const regl = require('regl')(canvas);

// 点云渲染（10万+ 点）
const drawPoints = regl({
  frag: `
    precision mediump float;
    uniform vec3 color;
    void main() {
      float dist = length(gl_PointCoord - 0.5);
      if (dist > 0.5) discard;
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  vert: `
    precision mediump float;
    attribute vec2 position;
    uniform vec2 scale;
    uniform vec2 translate;
    void main() {
      gl_Position = vec4((position + translate) * scale, 0, 1);
      gl_PointSize = 4.0;
    }
  `,
  attributes: {
    position: regl.prop('points'),
  },
  uniforms: {
    color: regl.prop('color'),
    scale: regl.prop('scale'),
    translate: regl.prop('translate'),
  },
  primitive: 'points',
  count: regl.prop('count'),
});

// 渲染
const points = new Float32Array(100000 * 2); // 10万点
// ... 填充数据 ...

drawPoints({
  points: points,
  count: 100000,
  color: [0.23, 0.51, 0.96],
  scale: [1, 1],
  translate: [0, 0],
});
```

## 5. 混合渲染策略（最佳实践）

```html
<!-- Canvas + SVG 叠加层 -->
<div class="chart-container" style="position: relative; width: 800px; height: 400px;">
  <!-- 底层：Canvas 主渲染 -->
  <canvas id="main-canvas" style="position: absolute; top: 0; left: 0;"></canvas>

  <!-- 上层：SVG 交互层（半透明） -->
  <svg id="interaction-layer" style="position: absolute; top: 0; left: 0; pointer-events: none;">
    <!-- 高亮区域 -->
    <rect id="highlight" fill="rgba(59, 130, 246, 0.1)" style="display: none;" />
    <!-- Tooltip -->
    <foreignObject id="tooltip" style="display: none;">
      <div xmlns="http://www.w3.org/1999/xhtml" class="tooltip"></div>
    </foreignObject>
  </svg>
</div>
```

```javascript
class HybridChart {
  constructor(container) {
    // Canvas 层：高性能渲染
    this.canvas = container.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');

    // SVG 层：交互元素
    this.svg = container.querySelector('svg');
    this.tooltip = this.svg.querySelector('#tooltip');

    this._setupInteraction();
  }

  render(data) {
    // 1. Canvas 绘制数据
    this._renderCanvas(data);

    // 2. SVG 更新交互区域（热力图、选区等）
    this._updateInteractionLayer(data);
  }

  _setupInteraction() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // 命中测试
      const point = this._hitTest(x, y);
      if (point) {
        this._showTooltip(x, y, point);
      } else {
        this._hideTooltip();
      }
    });
  }

  _showTooltip(x, y, data) {
    this.tooltip.style.display = 'block';
    this.tooltip.setAttribute('x', x + 10);
    this.tooltip.setAttribute('y', y - 30);
    this.tooltip.querySelector('.tooltip').textContent =
      `${data.label}: ${data.value}`;
  }
}
```
