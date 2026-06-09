# 手写图表组件系统

## 目标

实现一个简化版声明式图表组件系统，支持：
1. 可组合组件（Grid/Axis/Line/Bar 等）
2. 主题化（注入式主题）
3. 声明式配置
4. 响应式更新

## 实现

```javascript
// chart-component.js

/**
 * 基础图表容器
 */
class ChartContainer {
  constructor(selector, options = {}) {
    this.container = typeof selector === 'string'
      ? document.querySelector(selector)
      : selector;

    this.width = options.width || this.container.clientWidth || 800;
    this.height = options.height || this.container.clientHeight || 400;
    this.margin = options.margin || { top: 20, right: 20, bottom: 40, left: 50 };
    this.theme = options.theme || defaultTheme;

    this.innerWidth = this.width - this.margin.left - this.margin.right;
    this.innerHeight = this.height - this.margin.top - this.margin.bottom;

    this.components = [];
    this.scales = {};

    this._initRenderer();
  }

  _initRenderer() {
    this.renderer = new HybridRenderEngine(this.container, {
      width: this.width,
      height: this.height,
    });
  }

  // 注册组件
  add(component) {
    component.chart = this;
    this.components.push(component);
    return this;
  }

  // 设置比例尺
  scale(name, scaleFn) {
    this.scales[name] = scaleFn;
    return this;
  }

  // 渲染所有组件
  render(data) {
    this.data = data;
    this.renderer.clear();

    // 绘制背景
    this.renderer.drawRect(
      0, 0, this.width, this.height,
      { fill: this.theme.background }
    );

    // 裁剪区域（考虑 margin）
    this.renderer.ctx.save();
    this.renderer.ctx.beginPath();
    this.renderer.ctx.rect(
      this.margin.left,
      this.margin.top,
      this.innerWidth,
      this.innerHeight
    );
    this.renderer.ctx.clip();

    // 渲染各组件
    for (const component of this.components) {
      component.render(this.renderer, data, this.scales);
    }

    this.renderer.ctx.restore();

    // 渲染非裁剪组件（如轴标签）
    for (const component of this.components) {
      if (component.renderOverlay) {
        component.renderOverlay(this.renderer, data, this.scales);
      }
    }
  }
}

/**
 * 网格组件
 */
class Grid {
  constructor(options = {}) {
    this.xTicks = options.xTicks || 5;
    this.yTicks = options.yTicks || 5;
  }

  render(renderer, data, scales) {
    const chart = this.chart;
    const { innerWidth, innerHeight, margin, theme } = chart;

    renderer.ctx.save();
    renderer.ctx.strokeStyle = theme.grid;
    renderer.ctx.lineWidth = 0.5;

    // 横向网格线
    for (let i = 0; i <= this.yTicks; i++) {
      const y = margin.top + (innerHeight * i) / this.yTicks;
      renderer.drawLine(margin.left, y, margin.left + innerWidth, y, {
        stroke: theme.grid,
        lineWidth: 0.5,
      });
    }

    // 纵向网格线
    for (let i = 0; i <= this.xTicks; i++) {
      const x = margin.left + (innerWidth * i) / this.xTicks;
      renderer.drawLine(x, margin.top, x, margin.top + innerHeight, {
        stroke: theme.grid,
        lineWidth: 0.5,
      });
    }

    renderer.ctx.restore();
  }
}

/**
 * 坐标轴组件
 */
class Axis {
  constructor(field, options = {}) {
    this.field = field;
    this.position = options.position || 'bottom'; // bottom, left, right, top
  }

  renderOverlay(renderer, data, scales) {
    const chart = this.chart;
    const { margin, innerWidth, innerHeight, width, height, theme } = chart;

    const scale = scales[this.field];
    if (!scale) return;

    renderer.ctx.save();
    renderer.ctx.fillStyle = theme.foreground;
    renderer.ctx.font = `${theme.font.size}px ${theme.font.family}`;
    renderer.ctx.textAlign = 'center';

    if (this.position === 'bottom') {
      const ticks = scale.ticks ? scale.ticks() : data.map((d) => d[this.field]);
      ticks.forEach((tick, i) => {
        const x = margin.left + (innerWidth * i) / (ticks.length - 1 || 1);
        renderer.drawText(String(tick), x, height - 10, {
          fill: theme.foreground,
          align: 'center',
          baseline: 'top',
        });
      });
    }

    if (this.position === 'left') {
      const ticks = scale.ticks ? scale.ticks() : 5;
      for (let i = 0; i <= ticks; i++) {
        const value = scale.domain[0] + ((scale.domain[1] - scale.domain[0]) * i) / ticks;
        const y = margin.top + innerHeight - (innerHeight * i) / ticks;
        renderer.drawText(String(Math.round(value)), margin.left - 10, y, {
          fill: theme.foreground,
          align: 'right',
          baseline: 'middle',
        });
      }
    }

    renderer.ctx.restore();
  }
}

/**
 * 柱状图组件
 */
class Bars {
  constructor(options = {}) {
    this.x = options.x;
    this.y = options.y;
    this.color = options.color || ((_, i) => defaultTheme.colors[i % defaultTheme.colors.length]);
    this.barWidth = options.barWidth || 0.8;
  }

  render(renderer, data, scales) {
    const chart = this.chart;
    const { margin, innerHeight } = chart;
    const xScale = scales.x;
    const yScale = scales.y;

    const barWidth = (innerHeight / data.length) * this.barWidth;

    data.forEach((d, i) => {
      const x = margin.left + xScale(d[this.x]);
      const y = margin.top + innerHeight - yScale(d[this.y]);
      const height = yScale(d[this.y]);
      const width = barWidth;

      renderer.drawRect(x - width / 2, y, width, height, {
        fill: typeof this.color === 'function' ? this.color(d, i) : this.color,
      });
    });
  }
}

/**
 * 折线图组件
 */
class Line {
  constructor(options = {}) {
    this.x = options.x;
    this.y = options.y;
    this.stroke = options.stroke || '#3b82f6';
    this.strokeWidth = options.strokeWidth || 2;
  }

  render(renderer, data, scales) {
    const chart = this.chart;
    const { margin, innerHeight } = chart;
    const xScale = scales.x;
    const yScale = scales.y;

    const points = data.map((d) => ({
      x: margin.left + xScale(d[this.x]),
      y: margin.top + innerHeight - yScale(d[this.y]),
    }));

    renderer.drawPath(points, {
      stroke: this.stroke,
      lineWidth: this.strokeWidth,
      fill: null,
    });
  }
}

/**
 * 散点图组件
 */
class Scatter {
  constructor(options = {}) {
    this.x = options.x;
    this.y = options.y;
    this.r = options.r || 4;
    this.color = options.color || '#3b82f6';
  }

  render(renderer, data, scales) {
    const chart = this.chart;
    const { margin, innerHeight } = chart;
    const xScale = scales.x;
    const yScale = scales.y;

    data.forEach((d, i) => {
      const cx = margin.left + xScale(d[this.x]);
      const cy = margin.top + innerHeight - yScale(d[this.y]);
      const radius = typeof this.r === 'function' ? this.r(d, i) : this.r;
      const color = typeof this.color === 'function' ? this.color(d, i) : this.color;

      renderer.drawCircle(cx, cy, radius, { fill: color });
    });
  }
}

// 默认主题
const defaultTheme = {
  background: '#ffffff',
  foreground: '#1f2937',
  grid: '#e5e7eb',
  colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
  font: { family: 'sans-serif', size: 12 },
};

// 使用示例
const chart = new ChartContainer('#chart', {
  width: 800,
  height: 400,
  theme: defaultTheme,
});

const data = [
  { month: 'Jan', sales: 120, profit: 80 },
  { month: 'Feb', sales: 150, profit: 100 },
  { month: 'Mar', sales: 180, profit: 120 },
  { month: 'Apr', sales: 140, profit: 90 },
  { month: 'May', sales: 200, profit: 150 },
];

// 配置比例尺
chart
  .scale('x', {
    domain: [0, data.length - 1],
    range: [0, chart.innerWidth],
    ticks: () => data.map((d) => d.month),
  })
  .scale('y', {
    domain: [0, 250],
    range: [0, chart.innerHeight],
    ticks: 5,
  });

// 添加组件
chart
  .add(new Grid())
  .add(new Axis('x', { position: 'bottom' }))
  .add(new Axis('y', { position: 'left' }))
  .add(new Bars({ x: 'month', y: 'sales', color: '#3b82f6' }))
  .add(new Line({ x: 'month', y: 'profit', stroke: '#ef4444' }));

// 渲染
chart.render(data);
```
