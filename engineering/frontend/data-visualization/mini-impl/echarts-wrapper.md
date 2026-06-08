# 手写 ECharts React/Vue 封装组件

## 目标

实现一个生产级 ECharts 封装组件，支持：
1. React/Vue 声明式 API
2. 自动 Resize
3. 主题切换
4. 事件透传
5. 内存管理（dispose）
6. Loading 状态

## React 实现

```tsx
// EChartsReact.tsx
import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as echarts from 'echarts/core';
import type { ECharts, EChartsOption, SetOptionOpts } from 'echarts';

export interface EChartsReactProps {
  option: EChartsOption;
  theme?: string | object;
  opts?: {
    renderer?: 'canvas' | 'svg';
    locale?: string;
    useDirtyRect?: boolean;
  };
  style?: React.CSSProperties;
  className?: string;
  loading?: boolean;
  loadingOption?: object;
  notMerge?: boolean;
  lazyUpdate?: boolean;
  onEvents?: Record<string, (params: any) => void>;
  onChartReady?: (chart: ECharts) => void;
}

export interface EChartsReactRef {
  getInstance: () => ECharts | null;
  getDataURL: (opts?: object) => string;
  getConnectedDataURL: (opts?: object) => string;
  resize: () => void;
  dispatchAction: (payload: object) => void;
  setOption: (option: EChartsOption, opts?: SetOptionOpts) => void;
}

const EChartsReact = forwardRef<EChartsReactRef, EChartsReactProps>((
  {
    option,
    theme,
    opts = {},
    style = { width: '100%', height: '400px' },
    className,
    loading = false,
    loadingOption,
    notMerge = false,
    lazyUpdate = false,
    onEvents = {},
    onChartReady,
  },
  ref
) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<ECharts | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);

  // 初始化图表
  const initChart = useCallback(() => {
    if (!chartRef.current) return;

    // 如果已存在实例，先销毁
    if (chartInstance.current) {
      chartInstance.current.dispose();
    }

    const instance = echarts.init(chartRef.current, theme, opts);
    chartInstance.current = instance;

    // 绑定事件
    Object.entries(onEvents).forEach(([eventName, handler]) => {
      instance.on(eventName, handler);
    });

    // 设置初始 option
    instance.setOption(option, { notMerge, lazyUpdate });

    // 设置 ResizeObserver
    resizeObserver.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          instance.resize();
        }
      }
    });
    resizeObserver.current.observe(chartRef.current);

    // 通知就绪
    onChartReady?.(instance);
  }, [theme, opts, onEvents, onChartReady]);

  // 暴露方法
  useImperativeHandle(ref, () => ({
    getInstance: () => chartInstance.current,
    getDataURL: (opts) => chartInstance.current?.getDataURL(opts) || '',
    getConnectedDataURL: (opts) => chartInstance.current?.getConnectedDataURL(opts) || '',
    resize: () => chartInstance.current?.resize(),
    dispatchAction: (payload) => chartInstance.current?.dispatchAction(payload),
    setOption: (opt, settings) => chartInstance.current?.setOption(opt, settings),
  }));

  // 首次挂载
  useEffect(() => {
    initChart();

    return () => {
      resizeObserver.current?.disconnect();
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  // 主题变化时重新初始化
  useEffect(() => {
    initChart();
  }, [theme]);

  // option 更新
  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.setOption(option, { notMerge, lazyUpdate });
    }
  }, [option, notMerge, lazyUpdate]);

  // loading 状态
  useEffect(() => {
    if (!chartInstance.current) return;

    if (loading) {
      chartInstance.current.showLoading(loadingOption);
    } else {
      chartInstance.current.hideLoading();
    }
  }, [loading, loadingOption]);

  return <div ref={chartRef} style={style} className={className} />;
});

EChartsReact.displayName = 'EChartsReact';

export default EChartsReact;

// 使用示例
function SalesDashboard() {
  const chartRef = useRef<EChartsReactRef>(null);
  const [isDark, setIsDark] = useState(false);

  const option: EChartsOption = {
    title: { text: '月度销售' },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: ['Jan', 'Feb', 'Mar'] },
    yAxis: { type: 'value' },
    series: [{ type: 'line', data: [120, 200, 150] }],
  };

  return (
    <>
      <button onClick={() => setIsDark(!isDark)}>
        Toggle Theme
      </button>
      <EChartsReact
        ref={chartRef}
        option={option}
        theme={isDark ? 'dark' : undefined}
        style={{ width: '100%', height: 400 }}
        onEvents={{
          click: (params) => console.log('Clicked:', params),
        }}
        onChartReady={(chart) => {
          console.log('Chart ready');
        }}
      />
    </>
  );
}
```

## Vue 3 实现

```vue
<!-- EChartsVue.vue -->
<template>
  <div ref="chartRef" :style="mergedStyle" :class="className"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import * as echarts from 'echarts/core';
import type { ECharts, EChartsOption } from 'echarts';

interface Props {
  option: EChartsOption;
  theme?: string | object;
  renderer?: 'canvas' | 'svg';
  style?: Record<string, string>;
  className?: string;
  loading?: boolean;
  loadingOption?: object;
  notMerge?: boolean;
  lazyUpdate?: boolean;
  autoResize?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  renderer: 'canvas',
  notMerge: false,
  lazyUpdate: false,
  autoResize: true,
});

const emit = defineEmits<{
  ready: [chart: ECharts];
  click: [params: any];
  mouseover: [params: any];
}>();

const chartRef = ref<HTMLDivElement>();
let chartInstance: ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;

const mergedStyle = computed(() => ({
  width: '100%',
  height: '400px',
  ...props.style,
}));

function init() {
  if (!chartRef.value) return;

  dispose();

  chartInstance = echarts.init(chartRef.value, props.theme, {
    renderer: props.renderer,
  });

  // 绑定事件
  chartInstance.on('click', (params) => emit('click', params));
  chartInstance.on('mouseover', (params) => emit('mouseover', params));

  // 设置 option
  chartInstance.setOption(props.option, {
    notMerge: props.notMerge,
    lazyUpdate: props.lazyUpdate,
  });

  // ResizeObserver
  if (props.autoResize) {
    resizeObserver = new ResizeObserver(() => {
      chartInstance?.resize();
    });
    resizeObserver.observe(chartRef.value);
  }

  emit('ready', chartInstance);
}

function dispose() {
  resizeObserver?.disconnect();
  resizeObserver = null;
  chartInstance?.dispose();
  chartInstance = null;
}

function setOption(option: EChartsOption, settings?: object) {
  chartInstance?.setOption(option, settings);
}

function dispatchAction(payload: object) {
  chartInstance?.dispatchAction(payload);
}

function resize() {
  chartInstance?.resize();
}

function getDataURL(opts?: object) {
  return chartInstance?.getDataURL(opts) || '';
}

// 暴露方法
defineExpose({
  getInstance: () => chartInstance,
  setOption,
  dispatchAction,
  resize,
  getDataURL,
});

onMounted(init);
onUnmounted(dispose);

// 监听 option 变化
watch(
  () => props.option,
  (newOption) => {
    chartInstance?.setOption(newOption, {
      notMerge: props.notMerge,
      lazyUpdate: props.lazyUpdate,
    });
  },
  { deep: true }
);

// 监听 theme 变化
watch(() => props.theme, init);

// 监听 loading
watch(() => props.loading, (loading) => {
  if (loading) {
    chartInstance?.showLoading(props.loadingOption);
  } else {
    chartInstance?.hideLoading();
  }
});
</script>
```
