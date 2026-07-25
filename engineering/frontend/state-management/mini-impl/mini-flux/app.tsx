import React from 'react';
import { AppDispatcher } from './dispatcher.js';
import { counterStore } from './domain.js';
import { useFluxStore } from './view.js';

export const CounterView: React.FC = () => {
  // 1. 精准订阅 count，只有 count 改变时才触发渲染，lastUpdated 改变不会触发当前组件重绘
  const count = useFluxStore(counterStore, (state) => state.count);

  // 2. 发起动作的辅助函数
  const handleAdd = () => {
    AppDispatcher.dispatch({
      type: 'COUNTER_INCREMENT',
      payload: 1
    });
  };

  const handleMinus = () => {
    AppDispatcher.dispatch({
      type: 'COUNTER_DECREMENT',
      payload: 1
    });
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc' }}>
      <h2>Flux 架构计数器</h2>
      <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{count}</p>

      {/* 视图绝对没有修改权，必须绕回单向数据流的起点 */}
      <button onClick={handleAdd}>+ 1</button>
      <button onClick={handleMinus} style={{ marginLeft: '8px' }}>- 1</button>
    </div>
  );
};