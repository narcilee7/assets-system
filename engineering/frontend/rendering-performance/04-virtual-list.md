# 虚拟列表

虚拟列表的本质不是"少渲染 DOM"，而是布局欺骗——让用户以为有 10000 行，实际上只渲染视口内的 20 行，并通过精确的高度计算让滚动条 behaves 正确。
它的复杂度不在"隐藏"，而在动态高度下的偏移校正和滚动时的帧稳定性。

## 三种实现模型的精确对比

| 模型                | 原理                                               | 代表库                        | 优点                    | 缺点                         |
| ----------------- | ------------------------------------------------ | -------------------------- | --------------------- | -------------------------- |
| **绝对定位型**         | 每个可见项 `position: absolute`，通过 `top` 定位           | react-window               | 实现简单，DOM 结构扁平         | 快速滚动时 DOM 节点频繁创建/销毁，GC 压力大 |
| **Transform 位移型** | 渲染一个固定大小的窗口，通过 `transform: translateY` 移动内容      | 早期 react-virtualized       | 节点复用率高，不频繁创建 DOM      | 需要精确计算窗口偏移，动态高度下校正复杂       |
| **Padding 撑开型**   | 上下用 `paddingTop` / `paddingBottom` 撑出总高度，中间渲染可见项 | react-virtualized (modern) | 最符合文档流语义，浏览器原生滚动行为最自然 | padding 值巨大时，某些浏览器有渲染边界问题  |

现代虚拟列表库（如 @tanstack/react-virtual、react-window）通常混合使用 Padding 型 + 节点复用：上下用 padding 撑高度，中间用一个固定大小的容器，内部节点复用而非销毁。

## 核心计算：从scrollTop到startIndex

### 固定高度(Easy Mode)

```js
const startIndex = Math.floor(scrollTop / itemHeight);
const endIndex = Math.min(
  startIndex + Math.ceil(viewportHeight / itemHeight) + overscan,
  totalCount - 1
);
const offsetY = startIndex * itemHeight;
```

### 动态高度(Dynamic Mode)

```js
const heights = [50, 120, 80, 220, ...] // 缓存每个项的测量高度
const offsets = [0, 50, 170, 250, 450, ...] // 前缀和：第i项的top偏移

function findIndex(scrollTop) {
  let left = 0, right = offset.length - 1
  while (left < right) {
    const mid = Math.floor((left + right) / 2)
    if (offsets[mid] < scrollTop) {
      left = mid + 1
    } else {
      right = mid
    }
  }
  return left
}
```

为什么不用线性扫描？10000 项时，每次滚动都 O(n) 扫描前缀和，主线程会被拖慢，滚动帧率下降。
二分查找是 O(log n)，但 offsets 数组必须实时维护。当新数据追加、或已有项高度变化时，该数组需要增量更新（从变化点往后全部重算）。

### 预估高度+测量矫正
动态高度下，项在渲染前高度未知，必须先给一个预估高度（estimatedItemHeight）占位：

1. 用 estimatedHeight 计算 offsets，渲染可见项
2. 项渲染到 DOM 后，用 ResizeObserver / getBoundingClientRect 测量实际高度
3. 如果实际 ≠ 预估，校正 offsets 数组
4. 如果校正导致 scrollTop 对应的项发生变化，可能需要重新渲染

校正时如果当前项的总高度增加，而用户正在向下滚动，会导致什么？
1. 用户的 scrollTop 不变，但 offsets 变了，startIndex 可能回退
2. 表现就是：用户向下滚，内容反而向上跳（或出现空白）
3. 解决：校正时调整 scrollTop 或 只在用户不滚动时批量校正

### 滚动性能

#### 主线程阻塞点

虚拟列表滚动时，主线程在做什么？
监听 scroll 事件（或 onScroll）
计算新的 startIndex / endIndex
更新 React/Vue 状态 → 触发重渲染
DOM 更新（节点复用或创建）
如果这一过程 > 16ms（一帧），用户就会感知卡顿。

#### 解决方案

| 策略                          | 原理                                                       | 面试点                                           |
| --------------------------- | -------------------------------------------------------- | --------------------------------------------- |
| **RAF 节流**                  | 用 `requestAnimationFrame` 批量处理滚动更新                       | 不是 `setTimeout`/`throttle`，RAF 与浏览器渲染周期对齐     |
| **Overscan（缓冲行）**           | 上下多渲染 2-5 行，避免快速滚动时白屏                                    | 缓冲太多失去虚拟列表意义，太少白屏。通常 **viewport 的 0.5-1 倍高度** |
| **节点复用（Pooling）**           | 不销毁 DOM 节点，只更新内容和 transform                              | 减少 GC 和 DOM 创建开销。但 React 的 `key` 管理会变复杂       |
| **Passive Scroll Listener** | `addEventListener('scroll', handler, { passive: true })` | 默认 `passive: false` 时，浏览器必须等 JS 执行完才滚动，卡顿     |
| **Will-Change**             | 给滚动容器加 `will-change: transform`                          | 提示浏览器提升为合成层，但合成层过多有内存代价                       |

#### 快速滚动的白屏问题

即使有了 Overscan，超高速滚动（如鼠标滚轮一下子滚 10 屏）仍然会白屏，因为：
scroll 事件触发频率跟不上滚动速度
计算和渲染跟不上
解决：
虚拟滚动条：不用浏览器原生滚动条，自己用 div 模拟。滚动时只更新一个 transform，列表内容延迟同步。但实现复杂，且失去原生滚动行为（如 iOS 弹性滚动、Mac 触控板惯性）。
降级策略：滚动速度超过阈值时，显示骨架屏/模糊占位，等滚动停止后再渲染真实内容。

#### React/Vue的协作陷阱

```jsx
// ❌ 坏代码：每次滚动都创建新数组，导致所有子组件重渲染
function VirtualList({ items }) {
  const [scrollTop, setScrollTop] = useState(0);
  const visibleItems = items.slice(startIndex, endIndex); // 新数组引用
  
  return (
    <div onScroll={e => setScrollTop(e.target.scrollTop)}>
      {visibleItems.map(item => (
        <Row key={item.id} data={item} /> // key 稳定，但父组件重渲染可能触发子组件
      ))}
    </div>
  );
}
```

优化：
- Row用`React.memo`包裹，且用data稳定引用
- `onScroll`用RAF节流，避免每像素滚动都触发setState
- 或者把滚动状态放到 ref 中，手动操作 DOM，不走 React 的渲染周期：

```jsx
const containerRef = useRef();
const contentRef = useRef();

useEffect(() => {
  const handler = () => {
    const st = containerRef.current.scrollTop;
    // 直接操作 DOM，不 setState
    contentRef.current.style.transform = `translateY(${st}px)`;
  };
  containerRef.current.addEventListener('scroll', handler, { passive: true });
}, []);
```

##### Vue问题

```vue
<!-- ❌ 响应式数组的监听开销 -->
<div v-for="item in visibleItems" :key="item.id">
  <Row :data="item" />
</div>
```

Vue 的 visibleItems 是计算属性，每次滚动重新计算时，如果 items 是深层响应式的，Vue 会遍历依赖。大数据量下，响应式追踪本身成为瓶颈。
优化： 用 shallowRef 或 markRaw 处理原始数据，只在必要时触发更新。
