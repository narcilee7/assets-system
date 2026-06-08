# AntV 生态工程化

## 1. AntV 产品矩阵

| 库 | 定位 | 适用场景 | 包体积 |
|-----|------|---------|--------|
| **G2** | 统计图表 | 通用可视化（对标 ECharts） | ~200KB |
| **G2Plot** | G2 封装 | 开箱即用图表 | ~100KB |
| **G6** | 图可视化 | 关系图、流程图、拓扑图 | ~300KB |
| **L7** | 地理空间 | 地图、地理数据可视化 | ~500KB |
| **S2** | 多维表格 | 透视表、交叉表 | ~150KB |
| **F2** | 移动端图表 | 手机端可视化 | ~80KB |

## 2. G2 / G2Plot 工程化

```typescript
// G2 声明式语法（Grammar of Graphics）
import { Chart } from '@antv/g2';

const chart = new Chart({
  container: 'container',
  width: 800,
  height: 400,
  theme: 'classic',
});

// 声明式配置：数据 → 变换 → 图形 → 坐标系 → 比例尺 → 轴
chart
  .data([
    { month: 'Jan', sales: 120 },
    { month: 'Feb', sales: 150 },
    { month: 'Mar', sales: 180 },
  ])
  .encode('x', 'month')
  .encode('y', 'sales')
  .encode('color', 'month')
  .scale('x', { type: 'band' })
  .scale('y', { type: 'linear', domain: [0, 300] })
  .axis('x', { title: 'Month' })
  .axis('y', { title: 'Sales' })
  .interval();  // 柱状图

chart.render();
```

```typescript
// G2Plot 封装（更简单）
import { Line } from '@antv/g2plot';

const line = new Line('container', {
  data: [
    { month: 'Jan', value: 120, category: 'A' },
    { month: 'Jan', value: 80, category: 'B' },
    { month: 'Feb', value: 150, category: 'A' },
  ],
  xField: 'month',
  yField: 'value',
  seriesField: 'category',
  smooth: true,
  animation: {
    appear: {
      animation: 'path-in',
      duration: 1000,
    },
  },
  interactions: [
    { type: 'marker-active' },
    { type: 'brush-x' },
  ],
});

line.render();
```

## 3. G6 图可视化

```typescript
import { Graph } from '@antv/g6';

const graph = new Graph({
  container: 'container',
  width: 800,
  height: 600,
  data: {
    nodes: [
      { id: 'node1', data: { label: 'Start' } },
      { id: 'node2', data: { label: 'Process' } },
      { id: 'node3', data: { label: 'End' } },
    ],
    edges: [
      { source: 'node1', target: 'node2' },
      { source: 'node2', target: 'node3' },
    ],
  },
  node: {
    style: {
      size: 40,
      fill: '#3b82f6',
      labelText: (d) => d.data.label,
      labelFill: '#fff',
    },
  },
  edge: {
    style: {
      stroke: '#999',
      endArrow: true,
    },
  },
  layout: {
    type: 'force',
    linkDistance: 150,
    nodeStrength: -200,
  },
  behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
});

graph.render();

// 自定义节点
const registerCustomNode = () => {
  graph.register('node', 'custom-node', {
    draw: (cfg, group) => {
      const keyShape = group.addShape('circle', {
        attrs: {
          x: 0,
          y: 0,
          r: cfg.size || 30,
          fill: cfg.color || '#3b82f6',
        },
      });

      group.addShape('text', {
        attrs: {
          x: 0,
          y: 0,
          text: cfg.label,
          fill: '#fff',
          textAlign: 'center',
          textBaseline: 'middle',
        },
      });

      return keyShape;
    },
  });
};
```

## 4. L7 地理可视化

```typescript
import { Scene, PointLayer } from '@antv/l7';
import { GaodeMap } from '@antv/l7-maps';

const scene = new Scene({
  id: 'map',
  map: new GaodeMap({
    style: 'dark',
    center: [120.12, 30.26],
    zoom: 10,
  }),
});

const pointLayer = new PointLayer({})
  .source([
    { lng: 120.12, lat: 30.26, value: 100 },
    { lng: 120.15, lat: 30.28, value: 200 },
  ], {
    parser: { type: 'json', x: 'lng', y: 'lat' },
  })
  .shape('circle')
  .size('value', [10, 40])
  .color('value', ['#e0f3f8', '#08519c'])
  .style({ opacity: 0.8 });

scene.addLayer(pointLayer);
```

## 5. S2 多维表格

```typescript
import { PivotSheet } from '@antv/s2';

const s2Options = {
  width: 800,
  height: 400,
  hierarchyType: 'grid',  // grid | tree | custom
};

const s2DataConfig = {
  fields: {
    rows: ['province', 'city'],
    columns: ['type'],
    values: ['price', 'cost'],
  },
  data: [
    { province: '浙江', city: '杭州', type: '家具', price: 100, cost: 80 },
    { province: '浙江', city: '杭州', type: '电子', price: 200, cost: 150 },
  ],
};

const s2 = new PivotSheet('container', s2DataConfig, s2Options);
s2.render();
```

## 6. 按需加载与 Tree Shaking

```javascript
// Vite 配置优化
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'antv-g2': ['@antv/g2'],
          'antv-g6': ['@antv/g6'],
          'antv-l7': ['@antv/l7'],
        },
      },
    },
  },
});

// 按需导入（G2 v5）
import { Chart } from '@antv/g2';
// 只导入需要的标记
import { Interval, Line, Point } from '@antv/g2';

// G2Plot 按需导入
import { Line as G2Line } from '@antv/g2plot';
// 比全量导入节省 ~50% 体积
```

## 7. AntV 与框架集成

```jsx
// React + G2
import { useRef, useEffect } from 'react';
import { Chart } from '@antv/g2';

function AntVChart({ data, spec }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = new Chart({
      container: containerRef.current,
      autoFit: true,
    });

    chart.options(spec);
    chart.data(data);
    chart.render();

    chartRef.current = chart;

    return () => {
      chart.destroy();
    };
  }, [spec]);

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.changeData(data);
    }
  }, [data]);

  return <div ref={containerRef} style={{ width: '100%', height: 400 }} />;
}
```
