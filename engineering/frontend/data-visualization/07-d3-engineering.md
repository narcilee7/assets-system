# D3.js 工程化

## 1. 模块化导入

```javascript
// D3 v7 采用 ES Modules，可以精确导入所需模块

// ❌ 不推荐：全量导入 (~300KB)
import * as d3 from 'd3';

// ✅ 推荐：按需导入 (~30-50KB)
import { select, selectAll } from 'd3-selection';
import { scaleLinear, scaleBand, scaleTime } from 'd3-scale';
import { line, area, curveMonotoneX } from 'd3-shape';
import { axisBottom, axisLeft } from 'd3-axis';
import { extent, max, min, bisector } from 'd3-array';
import { zoom, zoomIdentity } from 'd3-zoom';
import { brushX } from 'd3-brush';
import { transition } from 'd3-transition';
import { format } from 'd3-format';
import { timeFormat } from 'd3-time-format';

// 常用组合（折线图）
import { select } from 'd3-selection';
import { scaleLinear, scaleTime } from 'd3-scale';
import { line, area, curveMonotoneX } from 'd3-shape';
import { axisBottom, axisLeft } from 'd3-axis';
import { extent, max } from 'd3-array';
import { zoom } from 'd3-zoom';
```

## 2. 数据绑定与更新模式

```javascript
// D3 的核心：数据驱动 DOM 更新
function renderChart(container, data) {
  const svg = select(container)
    .selectAll('svg')
    .data([null])
    .join('svg')
    .attr('viewBox', `0 0 ${width} ${height}`);

  const margin = { top: 20, right: 30, bottom: 40, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.selectAll('.chart-content')
    .data([null])
    .join('g')
    .attr('class', 'chart-content')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // 比例尺
  const xScale = scaleTime()
    .domain(extent(data, (d) => d.date))
    .range([0, innerWidth]);

  const yScale = scaleLinear()
    .domain([0, max(data, (d) => d.value) * 1.1])
    .range([innerHeight, 0]);

  // 生成器
  const lineGenerator = line()
    .x((d) => xScale(d.date))
    .y((d) => yScale(d.value))
    .curve(curveMonotoneX);  // 平滑曲线

  // Enter / Update / Exit 模式
  const path = g.selectAll('.line-path')
    .data([data]);  // 单条线的数据

  // Enter
  path.enter()
    .append('path')
    .attr('class', 'line-path')
    .attr('fill', 'none')
    .attr('stroke', '#3b82f6')
    .attr('stroke-width', 2)
    .attr('d', lineGenerator)
    .attr('stroke-dasharray', function() { return this.getTotalLength(); })
    .attr('stroke-dashoffset', function() { return this.getTotalLength(); })
    .transition()
    .duration(1000)
    .attr('stroke-dashoffset', 0);

  // Update
  path.transition()
    .duration(500)
    .attr('d', lineGenerator);

  // 数据点
  const circles = g.selectAll('.data-point')
    .data(data, (d) => d.date);  // key function 用于识别数据

  circles.enter()
    .append('circle')
    .attr('class', 'data-point')
    .attr('cx', (d) => xScale(d.date))
    .attr('cy', (d) => yScale(d.value))
    .attr('r', 0)
    .attr('fill', '#3b82f6')
    .transition()
    .delay((_, i) => i * 50)
    .duration(300)
    .attr('r', 4);

  circles.transition()
    .duration(500)
    .attr('cx', (d) => xScale(d.date))
    .attr('cy', (d) => yScale(d.value));

  circles.exit()
    .transition()
    .duration(300)
    .attr('r', 0)
    .remove();
}
```

## 3. React / Vue 集成

```jsx
// React + D3 集成模式
import { useRef, useEffect } from 'react';
import { select } from 'd3-selection';
import { scaleLinear, scaleBand } from 'd3-scale';

function D3BarChart({ data, width, height }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!data.length) return;

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();  // 清理旧内容

    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = scaleBand()
      .domain(data.map((d) => d.name))
      .range([0, innerWidth])
      .padding(0.2);

    const yScale = scaleLinear()
      .domain([0, max(data, (d) => d.value)])
      .range([innerHeight, 0]);

    // 绘制柱子
    g.selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', (d) => xScale(d.name))
      .attr('y', (d) => yScale(d.value))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => innerHeight - yScale(d.value))
      .attr('fill', '#3b82f6')
      .on('mouseenter', function(event, d) {
        select(this).attr('fill', '#2563eb');
        // 显示 tooltip
      })
      .on('mouseleave', function() {
        select(this).attr('fill', '#3b82f6');
      });

  }, [data, width, height]);

  return <svg ref={svgRef} width={width} height={height} />;
}

// Vue 3 + D3
<script setup>
import { ref, onMounted, watch } from 'vue';
import * as d3 from 'd3';

const chartRef = ref(null);
const props = defineProps(['data']);

function render() {
  const svg = d3.select(chartRef.value);
  // ... D3 渲染逻辑
}

onMounted(render);
watch(() => props.data, render, { deep: true });
</script>

<template>
  <svg ref="chartRef"></svg>
</template>
```

## 4. 交互系统（Zoom + Brush）

```javascript
import { zoom, zoomIdentity } from 'd3-zoom';
import { brushX } from 'd3-brush';

function setupZoom(svg, xScale, xAxis, width, height) {
  const zoomBehavior = zoom()
    .scaleExtent([1, 10])  // 缩放范围
    .extent([[0, 0], [width, height]])
    .on('zoom', (event) => {
      const newXScale = event.transform.rescaleX(xScale);

      // 更新轴
      svg.select('.x-axis')
        .call(xAxis.scale(newXScale));

      // 更新路径
      svg.select('.line-path')
        .attr('d', lineGenerator.x((d) => newXScale(d.date)));
    });

  svg.call(zoomBehavior);

  // 重置缩放
  return {
    reset: () => svg.transition().duration(750).call(zoomBehavior.transform, zoomIdentity),
  };
}

function setupBrush(svg, xScale, onBrushEnd) {
  const brush = brushX()
    .extent([[0, 0], [width, height]])
    .on('end', (event) => {
      if (!event.selection) return;

      const [x0, x1] = event.selection.map(xScale.invert);
      onBrushEnd({ start: x0, end: x1 });
    });

  svg.append('g')
    .attr('class', 'brush')
    .call(brush);
}

// 结合使用：Brush 控制 Zoom
function setupBrushAndZoom(svg, xScale, width) {
  const brush = brushX()
    .extent([[0, 0], [width, 40]])
    .on('end', (event) => {
      if (event.selection) {
        const [x0, x1] = event.selection;
        const scale = (width) / (x1 - x0);
        const translate = -x0 * scale;
        svg.call(zoomBehavior.transform, zoomIdentity.translate(translate, 0).scale(scale));
      }
    });

  // 底部小图用于 brush
  const contextSvg = svg.append('g')
    .attr('transform', `translate(0, ${height + 20})`);

  contextSvg.append('g')
    .attr('class', 'brush')
    .call(brush)
    .call(brush.move, xScale.range());
}
```

## 5. 地理可视化

```javascript
import { geoMercator, geoPath } from 'd3-geo';
import { json } from 'd3-fetch';

async function renderMap(container, geoData, data) {
  const width = 800;
  const height = 500;

  const svg = select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`);

  // 投影
  const projection = geoMercator()
    .fitSize([width, height], geoData);

  const pathGenerator = geoPath().projection(projection);

  // 颜色比例尺
  const colorScale = scaleSequential(interpolateBlues)
    .domain([0, max(data, (d) => d.value)]);

  // 绘制地图
  svg.selectAll('path')
    .data(geoData.features)
    .join('path')
    .attr('d', pathGenerator)
    .attr('fill', (d) => {
      const value = data.find((item) => item.id === d.id)?.value || 0;
      return colorScale(value);
    })
    .attr('stroke', '#fff')
    .attr('stroke-width', 0.5)
    .on('mouseenter', function(event, d) {
      select(this).attr('stroke', '#333').attr('stroke-width', 1.5);
    })
    .on('mouseleave', function() {
      select(this).attr('stroke', '#fff').attr('stroke-width', 0.5);
    });
}
```

## 6. 力导向图

```javascript
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from 'd3-force';

function renderForceGraph(container, nodes, links) {
  const width = 800;
  const height = 600;

  const svg = select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`);

  // 创建力模拟
  const simulation = forceSimulation(nodes)
    .force('link', forceLink(links).id((d) => d.id).distance(100))
    .force('charge', forceManyBody().strength(-300))
    .force('center', forceCenter(width / 2, height / 2))
    .force('collision', forceCollide().radius(30));

  // 绘制连线
  const linkElements = svg.selectAll('.link')
    .data(links)
    .join('line')
    .attr('class', 'link')
    .attr('stroke', '#999')
    .attr('stroke-opacity', 0.6);

  // 绘制节点
  const nodeElements = svg.selectAll('.node')
    .data(nodes)
    .join('circle')
    .attr('class', 'node')
    .attr('r', (d) => d.size || 20)
    .attr('fill', (d) => d.color || '#3b82f6')
    .call(drag(simulation));  // 拖拽交互

  // 每帧更新位置
  simulation.on('tick', () => {
    linkElements
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);

    nodeElements
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.y);
  });
}

// 拖拽行为
function drag(simulation) {
  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }

  return d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);
}
```
