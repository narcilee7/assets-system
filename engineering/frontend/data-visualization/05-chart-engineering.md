# 图表工程化

## 1. 主题系统

```javascript
// 主题定义
const themes = {
  light: {
    background: '#ffffff',
    foreground: '#1f2937',
    grid: '#e5e7eb',
    colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
    tooltip: {
      background: 'rgba(0,0,0,0.8)',
      color: '#ffffff',
    },
    font: {
      family: '-apple-system, BlinkMacSystemFont, sans-serif',
      size: 12,
    },
  },
  dark: {
    background: '#111827',
    foreground: '#f9fafb',
    grid: '#374151',
    colors: ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#f472b6'],
    tooltip: {
      background: 'rgba(255,255,255,0.9)',
      color: '#1f2937',
    },
    font: {
      family: '-apple-system, BlinkMacSystemFont, sans-serif',
      size: 12,
    },
  },
};

class ThemeManager {
  constructor(defaultTheme = 'light') {
    this.currentTheme = defaultTheme;
    this.subscribers = [];
  }

  setTheme(name) {
    this.currentTheme = name;
    this.subscribers.forEach((cb) => cb(themes[name]));
  }

  getTheme() {
    return themes[this.currentTheme];
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) this.subscribers.splice(index, 1);
    };
  }
}

// CSS 变量方案
function injectThemeCSS(theme) {
  const root = document.documentElement;
  root.style.setProperty('--chart-bg', theme.background);
  root.style.setProperty('--chart-fg', theme.foreground);
  root.style.setProperty('--chart-grid', theme.grid);
  theme.colors.forEach((color, i) => {
    root.style.setProperty(`--chart-color-${i}`, color);
  });
}
```

## 2. 响应式图表

```javascript
class ResponsiveChart {
  constructor(container, options) {
    this.container = container;
    this.options = options;

    // ResizeObserver 监听容器变化
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.resize(width, height);
      }
    });

    this.resizeObserver.observe(container);
  }

  resize(width, height) {
    this.width = width;
    this.height = height;

    // 更新 canvas 尺寸
    if (this.canvas) {
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.ctx.scale(dpr, dpr);
    }

    // 重新渲染
    this.render();
  }

  destroy() {
    this.resizeObserver.disconnect();
  }
}
```

## 3. 可访问性（a11y for Charts）

```javascript
class AccessibleChart {
  constructor(container, data, options) {
    this.container = container;
    this.data = data;
    this.renderVisual();
    this.renderAccessibleFallback();
  }

  // 为屏幕阅读器生成替代内容
  renderAccessibleFallback() {
    const table = document.createElement('table');
    table.className = 'sr-only';
    table.innerHTML = `
      <caption>${this.options.title}</caption>
      <thead>
        <tr><th>Category</th><th>Value</th></tr>
      </thead>
      <tbody>
        ${this.data
          .map(
            (d) => `
          <tr>
            <td>${d.label}</td>
            <td>${d.value}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    `;

    this.container.appendChild(table);
  }

  // SVG 可访问性属性
  renderAccessibleSVG() {
    return `
      <svg
        role="img"
        aria-labelledby="chartTitle chartDesc"
      >
        <title id="chartTitle">${this.options.title}</title>
        <desc id="chartDesc">${this._generateDescription()}</desc>
        <!-- 数据点使用 aria-label -->
        ${this.data
          .map(
            (d) => `
          <rect
            role="graphics-symbol"
            aria-label="${d.label}: ${d.value}"
            tabindex="0"
          />
        `
          )
          .join('')}
      </svg>
    `;
  }

  _generateDescription() {
    const max = Math.max(...this.data.map((d) => d.value));
    const min = Math.min(...this.data.map((d) => d.value));
    const avg = this.data.reduce((sum, d) => sum + d.value, 0) / this.data.length;

    return `Bar chart showing ${this.data.length} categories. ` +
           `Maximum: ${max}, Minimum: ${min}, Average: ${avg.toFixed(1)}.`;
  }
}

// 色盲友好配色
const colorBlindSafePalette = [
  '#0173B2',  // 蓝
  '#DE8F05',  // 橙
  '#029E73',  // 绿
  '#D55E00',  // 红
  '#CC78BC',  // 紫
  '#CA9161',  // 棕
  '#FBAFE4',  // 粉
  '#949494',  // 灰
];

// 图案填充（黑白打印友好）
const patterns = [
  'none',
  'diagonal-lines',
  'crosshatch',
  'dots',
  'horizontal-lines',
];
```

## 4. 组件封装（声明式 API）

```jsx
// React 封装
function LineChart({ data, x, y, color, width, height }) {
  const theme = useTheme();

  return (
    <ChartContainer width={width} height={height} theme={theme}>
      <Grid x={x} y={y} />
      <Axis position="bottom" scale={x} />
      <Axis position="left" scale={y} />
      <Line
        data={data}
        x={(d) => x(d.date)}
        y={(d) => y(d.value)}
        stroke={color}
        strokeWidth={2}
      />
      <Points
        data={data}
        x={(d) => x(d.date)}
        y={(d) => y(d.value)}
        r={4}
        fill={color}
      >
        <Tooltip>
          {(d) => `${d.date}: ${d.value}`}
        </Tooltip>
      </Points>
    </ChartContainer>
  );
}

// Vue 封装
<template>
  <ChartContainer :width="width" :height="height">
    <Grid :x="xScale" :y="yScale" />
    <Axis position="bottom" :scale="xScale" />
    <Axis position="left" :scale="yScale" />
    <Line
      :data="data"
      :x="d => xScale(d.date)"
      :y="d => yScale(d.value)"
      :stroke="color"
    />
  </ChartContainer>
</template>
```

## 5. 测试策略

```javascript
// 图表单元测试
import { render } from '@testing-library/react';

describe('LineChart', () => {
  it('renders correct number of data points', () => {
    const data = [
      { date: '2024-01', value: 10 },
      { date: '2024-02', value: 20 },
      { date: '2024-03', value: 15 },
    ];

    const { container } = render(<LineChart data={data} />);
    const points = container.querySelectorAll('circle');
    expect(points).toHaveLength(3);
  });

  it('has accessible description', () => {
    const { container } = render(<LineChart data={data} title="Sales Chart" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('role', 'img');
    expect(svg.querySelector('title')).toHaveTextContent('Sales Chart');
  });

  it('responds to resize', () => {
    const chart = new LineChart(container, { width: 400, height: 300 });
    chart.resize(800, 600);
    expect(chart.canvas.width).toBe(800 * window.devicePixelRatio);
  });

  // 视觉回归测试（使用 Chromatic/Storybook）
  it('visual regression', () => {
    const { container } = render(<LineChart data={data} />);
    expect(container).toMatchSnapshot();
  });
});

// 性能测试
function benchmarkRender(chartClass, data, iterations = 100) {
  const chart = new chartClass();
  const times = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    chart.render(data);
    times.push(performance.now() - start);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const max = Math.max(...times);

  console.log(`Render ${data.length} points: avg=${avg.toFixed(2)}ms, max=${max.toFixed(2)}ms`);
  return { avg, max };
}
```
