import { useSyncExternalStore } from 'react';
import type { BaseStore } from './store.js';
// import { BaseStore } from './BaseStore';

// 封装自定义 Hook，支持传入 selector 提取部分状态，防止不相关的组件渲染
export function useFluxStore<TState, TSelected>(
  store: BaseStore<TState>,
  selector: (state: TState) => TSelected
): TSelected {
  return useSyncExternalStore(
    (callback) => store.subscribe(callback), // 订阅方法
    () => selector(store.getState())        // 获取当前切片快照的方法
  );
}