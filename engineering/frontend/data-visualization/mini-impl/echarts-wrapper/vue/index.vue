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