# 虚拟列表

## 1. 为什么需要虚拟列表

```
10000 条数据直接渲染：
  - DOM 节点：10000+ 个
  - 内存占用：巨大
  - 滚动性能：卡顿
  - 初始渲染：慢

虚拟列表：只渲染视口内的元素
  - DOM 节点：10-20 个（视口高度 / 行高）
  - 内存占用：恒定
  - 滚动性能：流畅
```

## 2. 固定高度虚拟列表

```javascript
function FixedSizeList({ items, itemHeight, height, renderItem }) {
  const containerRef = useRef();
  const [scrollTop, setScrollTop] = useState(0);

  // 可见区域
  const visibleCount = Math.ceil(height / itemHeight);
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleCount + 1, items.length);

  // 可见数据
  const visibleItems = items.slice(startIndex, endIndex);

  // 总高度
  const totalHeight = items.length * itemHeight;

  // 偏移量
  const offsetY = startIndex * itemHeight;

  return (
    <div
      ref={containerRef}
      style={{ height, overflow: 'auto' }}
      onScroll={(e) => setScrollTop(e.target.scrollTop)}
    >
      {/* 占位元素维持滚动条 */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* 实际渲染的列表 */}
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) =>
            renderItem(item, startIndex + index)
          )}
        </div>
      </div>
    </div>
  );
}
```

## 3. 动态高度虚拟列表

```javascript
function DynamicSizeList({ items, height, estimateHeight, renderItem }) {
  const [measurements, setMeasurements] = useState(
    items.map((_, i) => ({ index: i, height: estimateHeight }))
  );

  // 测量实际高度
  const measureElement = (index, el) => {
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    if (h !== measurements[index].height) {
      measurements[index].height = h;
      setMeasurements([...measurements]);
    }
  };

  // 计算累计高度（用于定位）
  const getOffset = (index) => {
    return measurements.slice(0, index).reduce((sum, m) => sum + m.height, 0);
  };

  const totalHeight = getOffset(items.length);
  const scrollTop = ...;

  // 二分查找确定 startIndex
  const findStartIndex = (scrollTop) => {
    let low = 0, high = measurements.length - 1;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (getOffset(mid) < scrollTop) low = mid + 1;
      else high = mid;
    }
    return low;
  };

  return (
    <div style={{ height, overflow: 'auto' }}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map((item, i) => (
          <div
            key={item.id}
            ref={(el) => measureElement(startIndex + i, el)}
            style={{ position: 'absolute', top: getOffset(startIndex + i) }}
          >
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## 4. 缓冲策略

```javascript
// 上下各多渲染 N 个元素，减少白屏
const OVERSCAN = 5;

const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - OVERSCAN);
const endIndex = Math.min(
  items.length,
  Math.ceil((scrollTop + height) / itemHeight) + OVERSCAN
);
```
