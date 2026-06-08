# 手写 D3 完整图表（Enter/Update/Exit）

## 目标

实现一个完整的 D3 柱状图，展示：
1. 数据绑定与 Enter/Update/Exit 模式
2. 比例尺与坐标轴
3. 过渡动画
4. 交互（Tooltip + Hover）
5. 响应式更新

## 实现

```javascript
// d3-bar-chart.js
import { select, Selection } from 'd3-selection';
import { scaleBand, scaleLinear } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { max } from 'd3-array';
import { transition } from 'd3-transition';

class D3BarChart {
  constructor(container, options = {}) {
    this.container = select(container);
    this.width = options.width || 800;
    this.height = options.height || 400;
    this.margin = options.margin || { top: 20, right: 20, bottom: 40, left: 60 };

    this.innerWidth = this.width - this.margin.left - this.margin.right;
    this.innerHeight = this.height - this.margin.top - this.margin.bottom;

    this.color = options.color || '#3b82f6';
    this.hoverColor = options.hoverColor || '#2563eb';

    this.duration = options.duration || 750;
    this.tooltipFormatter = options.tooltipFormatter || ((d) => `${d.name}: ${d.value}`);

    this._initSVG();
    this._initScales();
    this._initAxes();
    this._initTooltip();
  }

  _initSVG() {
    // 清理旧内容
    this.container.selectAll('*').remove();

    this.svg = this.container
      .append('svg')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    // 主绘图区域
    this.g = this.svg
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    // 裁剪区域（防止内容溢出）
    this.svg
      .append('defs')
      .append('clipPath')
      .attr('id', 'chart-clip')
      .append('rect')
      .attr('width', this.innerWidth)
      .attr('height', this.innerHeight);
  }

  _initScales() {
    this.xScale = scaleBand()
      .range([0, this.innerWidth])
      .padding(0.2);

    this.yScale = scaleLinear()
      .range([this.innerHeight, 0]);
  }

  _initAxes() {
    // X 轴
    this.xAxisGroup = this.g
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${this.innerHeight})`);

    // Y 轴
    this.yAxisGroup = this.g
      .append('g')
      .attr('class', 'y-axis');

    // 轴样式
    this.g.selectAll('.domain').attr('stroke', '#e5e7eb');
    this.g.selectAll('.tick line').attr('stroke', '#e5e7eb');
    this.g.selectAll('.tick text').attr('fill', '#6b7280').attr('font-size', '12px');
  }

  _initTooltip() {
    this.tooltip = select('body')
      .selectAll('.d3-chart-tooltip')
      .data([null])
      .join('div')
      .attr('class', 'd3-chart-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', 'rgba(0,0,0,0.8)')
      .style('color', 'white')
      .style('padding', '8px 12px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '1000');
  }

  render(data) {
    // 更新比例尺域
    this.xScale.domain(data.map((d) => d.name));
    this.yScale.domain([0, max(data, (d) => d.value) * 1.1]);

    // 更新轴（带动画）
    const t = transition().duration(this.duration);

    this.xAxisGroup
      .transition(t)
      .call(axisBottom(this.xScale).tickSize(0).tickPadding(10));

    this.yAxisGroup
      .transition(t)
      .call(axisLeft(this.yScale).ticks(5).tickSize(-this.innerWidth))
      .call((g) => g.select('.domain').remove())  // 移除 Y 轴线
      .call((g) => g.selectAll('.tick line').attr('stroke', '#f3f4f6'));  // 网格线

    // ===== Enter / Update / Exit 模式 =====

    const bars = this.g
      .selectAll('.bar')
      .data(data, (d) => d.name);  // key function：按 name 识别数据

    // ---- EXIT：移除旧元素 ----
    bars.exit()
      .transition(t)
      .attr('y', this.innerHeight)
      .attr('height', 0)
      .style('opacity', 0)
      .remove();

    // ---- ENTER：创建新元素 ----
    const barsEnter = bars.enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (d) => this.xScale(d.name))
      .attr('y', this.innerHeight)  // 从底部开始
      .attr('width', this.xScale.bandwidth())
      .attr('height', 0)  // 初始高度为 0
      .attr('fill', this.color)
      .attr('rx', 4)  // 圆角
      .style('cursor', 'pointer');

    // 绑定交互事件
    barsEnter
      .on('mouseenter', (event, d) => {
        select(event.currentTarget)
          .transition().duration(200)
          .attr('fill', this.hoverColor)
          .attr('transform', `translate(0, -2)`);

        this._showTooltip(event, d);
      })
      .on('mousemove', (event, d) => {
        this._moveTooltip(event);
      })
      .on('mouseleave', (event) => {
        select(event.currentTarget)
          .transition().duration(200)
          .attr('fill', this.color)
          .attr('transform', 'translate(0, 0)');

        this._hideTooltip();
      })
      .on('click', (event, d) => {
        console.log('Clicked:', d);
        // 可以触发回调
      });

    // ---- UPDATE + ENTER 合并：更新所有元素到最终状态 ----
    barsEnter.merge(bars)
      .transition(t)
      .attr('x', (d) => this.xScale(d.name))
      .attr('y', (d) => this.yScale(d.value))
      .attr('width', this.xScale.bandwidth())
      .attr('height', (d) => this.innerHeight - this.yScale(d.value))
      .attr('fill', this.color);

    // 添加数值标签（可选）
    this._renderLabels(data, t);
  }

  _renderLabels(data, t) {
    const labels = this.g
      .selectAll('.label')
      .data(data, (d) => d.name);

    labels.exit().remove();

    const labelsEnter = labels.enter()
      .append('text')
      .attr('class', 'label')
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#6b7280')
      .attr('opacity', 0);

    labelsEnter.merge(labels)
      .transition(t)
      .attr('x', (d) => this.xScale(d.name) + this.xScale.bandwidth() / 2)
      .attr('y', (d) => this.yScale(d.value) - 6)
      .text((d) => d.value)
      .attr('opacity', 1);
  }

  _showTooltip(event, d) {
    this.tooltip
      .style('visibility', 'visible')
      .html(this.tooltipFormatter(d));
    this._moveTooltip(event);
  }

  _moveTooltip(event) {
    this.tooltip
      .style('left', `${event.pageX + 10}px`)
      .style('top', `${event.pageY - 30}px`);
  }

  _hideTooltip() {
    this.tooltip.style('visibility', 'hidden');
  }

  // 响应式更新
  resize(width, height) {
    this.width = width;
    this.height = height;
    this.innerWidth = width - this.margin.left - this.margin.right;
    this.innerHeight = height - this.margin.top - this.margin.bottom;

    this.xScale.range([0, this.innerWidth]);
    this.yScale.range([this.innerHeight, 0]);

    this.svg.attr('viewBox', `0 0 ${width} ${height}`);
    this.g.attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    // 重新渲染当前数据
    const currentData = this.g.selectAll('.bar').data();
    if (currentData.length > 0) {
      this.render(currentData);
    }
  }

  destroy() {
    this.tooltip.remove();
    this.svg.remove();
  }
}

// 使用示例
const chart = new D3BarChart('#chart-container', {
  width: 800,
  height: 400,
  color: '#3b82f6',
  hoverColor: '#2563eb',
  duration: 750,
  tooltipFormatter: (d) => `
    <div style="font-weight:bold">${d.name}</div>
    <div>Value: ${d.value}</div>
  `,
});

// 初始渲染
chart.render([
  { name: 'A', value: 30 },
  { name: 'B', value: 80 },
  { name: 'C', value: 45 },
  { name: 'D', value: 60 },
  { name: 'E', value: 20 },
]);

// 更新数据（自动执行 Enter/Update/Exit）
setTimeout(() => {
  chart.render([
    { name: 'A', value: 50 },
    { name: 'B', value: 40 },
    { name: 'C', value: 70 },
    { name: 'D', value: 90 },
    { name: 'E', value: 30 },
    { name: 'F', value: 65 },  // 新增
  ]);
}, 2000);

// 响应式
window.addEventListener('resize', () => {
  const container = document.getElementById('chart-container');
  chart.resize(container.clientWidth, 400);
});
```
