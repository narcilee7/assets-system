# ECharts 深度工程化

## 1. 配置层设计（Option 拆分与合并）

```typescript
// 大型项目中 option 需要分层管理
interface ChartConfig {
  base: EChartsOption;      // 基础配置（主题、网格、工具箱）
  data: SeriesOption[];     // 数据系列
  interaction: {            // 交互配置
    zoom?: boolean;
    brush?: boolean;
    tooltip?: TooltipOption;
  };
}

// 配置合并策略
function mergeChartConfig(base: ChartConfig, overrides: Partial<ChartConfig>): EChartsOption {
  return deepMerge(
    base.base,
    {
      series: base.data,
      ...base.interaction,
    },
    overrides
  );
}

// 实践：按模块拆分配置
// config/base.ts
export const baseOption: EChartsOption = {
  grid: { top: 60, right: 40, bottom: 60, left: 60 },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'cross' },
  },
  toolbox: {
    feature: {
      dataZoom: {},
      restore: {},
      saveAsImage: {},
    },
  },
};

// config/series.ts
export function createLineSeries(data: DataPoint[]): LineSeriesOption {
  return {
    type: 'line',
    smooth: true,
    symbol: 'circle',
    symbolSize: 8,
    data: data.map((d) => [d.time, d.value]),
    lineStyle: { width: 2 },
    areaStyle: {
      opacity: 0.1,
      color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
        { offset: 1, color: 'rgba(59, 130, 246, 0)' },
      ]),
    },
  };
}

// 组件中使用
const option = {
  ...baseOption,
  series: [
    createLineSeries(salesData),
    createBarSeries(inventoryData),
  ],
};
```

## 2. 大数据量优化

```javascript
// ECharts 大数据量配置策略
const bigDataOption = {
  // 1. 使用 Canvas 渲染器（默认）
  renderer: 'canvas',

  // 2. 数据采样（减少渲染点数）
  series: [{
    type: 'line',
    data: largeDataset,  // 100万+ 数据点
    sampling: 'lttb',    // Largest Triangle Three Buckets 算法
    // sampling: 'average',  // 简单平均
    // sampling: 'max',      // 取最大值
    showSymbol: false,   // 不显示数据点标记
  }],

  // 3. 渐进式渲染（分块渲染，不阻塞 UI）
  progressive: 1000,     // 每帧渲染 1000 个元素
  progressiveThreshold: 2000,  // 超过此数量启用渐进渲染

  // 4. 数据区域缩放
  dataZoom: [
    { type: 'inside', start: 0, end: 10 },    // 内置缩放
    { type: 'slider', start: 0, end: 10 },    // 滑动条
  ],

  // 5. 关闭不必要的动画
  animation: false,

  // 6. 使用 appendData 增量更新（替代 setOption）
};

// 增量数据更新（实时流）
const chart = echarts.init(dom);

// 首次设置
chart.setOption({
  series: [{ data: initialData }],
});

// 后续增量追加（性能更好）
setInterval(() => {
  chart.appendData({
    seriesIndex: 0,
    data: newDataPoints,
  });
}, 1000);

// 大数据量动态更新策略
class BigDataChart {
  constructor(dom, maxPoints = 100000) {
    this.chart = echarts.init(dom);
    this.maxPoints = maxPoints;
    this.data = [];
  }

  addPoint(point) {
    this.data.push(point);

    // 滑动窗口：超出最大点数时移除旧数据
    if (this.data.length > this.maxPoints) {
      this.data = this.data.slice(-this.maxPoints);
    }

    // 使用 setOption 的 notMerge: false 实现增量更新
    this.chart.setOption({
      series: [{
        data: this.data,
      }],
    }, {
      replaceMerge: ['series'],  // 只替换 series 部分
      lazyUpdate: true,          // 延迟更新，合并多次变更
    });
  }
}
```

## 3. 主题系统

```javascript
// 自定义主题注册
const customTheme = {
  color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
  backgroundColor: 'transparent',
  textStyle: { fontFamily: '-apple-system, sans-serif' },
  title: { textStyle: { fontSize: 16, fontWeight: 'bold' } },
  line: { smooth: true, symbol: 'circle' },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#e5e7eb' } },
    axisLabel: { color: '#6b7280' },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisLabel: { color: '#6b7280' },
    splitLine: { lineStyle: { color: '#f3f4f6' } },
  },
  tooltip: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderColor: 'transparent',
    textStyle: { color: '#fff' },
    padding: [8, 12],
  },
};

// 注册主题
echarts.registerTheme('custom', customTheme);

// 初始化时使用
const chart = echarts.init(dom, 'custom');

// 动态主题切换
function switchTheme(isDark) {
  const theme = isDark ? 'dark' : 'custom';
  chart.dispose();
  const newChart = echarts.init(dom, theme);
  newChart.setOption(option);
  return newChart;
}
```

## 4. 事件系统与联动

```javascript
const chart1 = echarts.init(document.getElementById('chart1'));
const chart2 = echarts.init(document.getElementById('chart2'));

// 1. 图表联动（connect）
echarts.connect(['chart1', 'chart2']);  // 通过 group ID 联动

// 2. 自定义事件处理
chart1.on('click', (params) => {
  console.log('Clicked:', params.name, params.value);

  // 联动更新其他图表
  chart2.dispatchAction({
    type: 'highlight',
    seriesIndex: 0,
    dataIndex: params.dataIndex,
  });
});

// 3. 图例选择事件
chart1.on('legendselectchanged', (params) => {
  const { name, selected } = params;
  // 同步其他图表的图例状态
  chart2.dispatchAction({
    type: selected[name] ? 'legendSelect' : 'legendUnSelect',
    name,
  });
});

// 4. 数据区域缩放事件
chart1.on('datazoom', (params) => {
  const { start, end } = params;
  // 同步另一个图表的缩放范围
  chart2.dispatchAction({
    type: 'dataZoom',
    start,
    end,
  });
});

// 5. 自定义 tooltip 格式化
const richTooltip = {
  trigger: 'axis',
  formatter: (params) => {
    let html = `<div style="font-weight:bold;margin-bottom:4px">${params[0].axisValue}</div>`;
    params.forEach((p) => {
      html += `
        <div style="display:flex;align-items:center;gap:6px">
          <span style="width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
          <span>${p.seriesName}:</span>
          <span style="font-weight:bold">${p.value}</span>
        </div>
      `;
    });
    return html;
  },
};
```

## 5. 扩展开发

```javascript
// 自定义系列（Custom Series）
// 实现特殊图形，如桑基图、词云等

const customSeries = {
  type: 'custom',
  renderItem: (params, api) => {
    const categoryIndex = api.value(0);
    const start = api.coord([api.value(1), categoryIndex]);
    const end = api.coord([api.value(2), categoryIndex]);
    const height = api.size([0, 1])[1] * 0.6;

    return {
      type: 'rect',
      shape: {
        x: start[0],
        y: start[1] - height / 2,
        width: end[0] - start[0],
        height,
      },
      style: api.style({ fill: api.visual('color') }),
    };
  },
  data: [
    [0, 10, 50],   // [categoryIndex, startValue, endValue]
    [1, 20, 80],
    [2, 5, 40],
  ],
};

// 自定义图形组件
class WatermarkExtension {
  constructor(text, options = {}) {
    this.text = text;
    this.options = options;
  }

  install(ec) {
    ec.registerUpdateLifecycle('series:afterupdate', (params, chart) => {
      this.render(chart);
    });
  }

  render(chart) {
    const canvas = chart.getZr().painter.getViewportRoot();
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.font = '24px sans-serif';
    ctx.fillStyle = '#000';
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.fillText(this.text, -ctx.measureText(this.text).width / 2, 0);
    ctx.restore();
  }
}
```

## 6. Tree Shaking 按需加载

```javascript
// 全量导入（不推荐，~800KB）
import * as echarts from 'echarts';

// 按需导入（推荐，~200KB）
import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart } from 'echarts/charts';
import {
  GridComponent, TooltipComponent, LegendComponent,
  DataZoomComponent, ToolboxComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { LabelLayout, UniversalTransition } from 'echarts/features';

// 注册必要的组件
echarts.use([
  LineChart, BarChart, PieChart,
  GridComponent, TooltipComponent, LegendComponent,
  DataZoomComponent, ToolboxComponent,
  CanvasRenderer,
  LabelLayout, UniversalTransition,
]);

// Vite 配置：自动按需导入
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    visualizer({ open: true }),  // 分析打包体积
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          echarts: ['echarts'],
        },
      },
    },
  },
});
```

## 7. SSR / 服务端渲染

```javascript
// 服务端使用 echarts 生成图片
const { createCanvas } = require('canvas');
const echarts = require('echarts');

async function renderChartToImage(option, width = 800, height = 400) {
  const canvas = createCanvas(width, height);
  const chart = echarts.init(canvas);

  chart.setOption(option);

  // 等待渲染完成
  await new Promise((resolve) => setTimeout(resolve, 100));

  const buffer = canvas.toBuffer('image/png');
  chart.dispose();

  return buffer;
}

// Next.js API Route
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const data = JSON.parse(searchParams.get('data'));

  const option = {
    xAxis: { type: 'category', data: data.map((d) => d.name) },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: data.map((d) => d.value) }],
  };

  const imageBuffer = await renderChartToImage(option);

  return new Response(imageBuffer, {
    headers: { 'Content-Type': 'image/png' },
  });
}
```
