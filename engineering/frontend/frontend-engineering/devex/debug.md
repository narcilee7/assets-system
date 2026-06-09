# 调试工具

## 1. Chrome DevTools

```
Sources:
  - 断点（Conditional breakpoint）
  - XHR/fetch 断点
  - DOM 断点（子树修改、属性修改、节点删除）
  - Event Listener 断点

Performance:
  - Record 录制性能
  - Main Thread 火焰图
  - Long Tasks 标记
  - Layout Shift 区域

Memory:
  - Heap Snapshot（内存泄漏）
  - Allocation Timeline
  - Detached DOM Trees

Network:
  - 请求瀑布图
  - 请求阻塞（Block request URL）
  - 网络条件模拟（3G/Offline）
```

## 2. React DevTools

```
Components:
  - 组件树查看
  - Props / Hooks 查看
  - 渲染高亮（Highlight updates）

Profiler:
  - 录制渲染时间
  - 为什么渲染（Why did this render?）
  - 提交时间线
```

## 3. 调试技巧

```javascript
// 条件断点
// 在 Sources 中右键断点 → Edit breakpoint
// 输入条件：i > 100 && user !== null

// debugger 语句
function complexLogic(data) {
  if (data.error) {
    debugger;  // 执行到这里会暂停
  }
}

// console.table
console.table(users, ['id', 'name', 'email']);

// console.group
console.group('API Call');
console.log('URL:', url);
console.log('Response:', data);
console.groupEnd();

// 监控函数调用
const original = Array.prototype.push;
Array.prototype.push = function (...args) {
  console.trace('Array.push called');
  return original.apply(this, args);
};
```
