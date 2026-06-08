# 列表组件

## 1. 虚拟列表

```tsx
// VirtualList.tsx（简化版）
interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  height: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
}

export function VirtualList<T>({
  items,
  itemHeight,
  height,
  renderItem,
  keyExtractor,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const visibleCount = Math.ceil(height / itemHeight);
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleCount + 1, items.length);

  const visibleItems = items.slice(startIndex, endIndex);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  return (
    <div
      ref={containerRef}
      style={{ height, overflow: 'auto' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, i) => (
            <div key={keyExtractor(item, startIndex + i)} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

## 2. 可选择列表

```tsx
// SelectableList.tsx
interface SelectableListProps<T> {
  items: T[];
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  renderItem: (item: T, isSelected: boolean) => React.ReactNode;
  keyExtractor: (item: T) => string;
}

export function SelectableList<T>({
  items,
  selectedIds,
  onSelect,
  onSelectAll,
  renderItem,
  keyExtractor,
}: SelectableListProps<T>) {
  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(keyExtractor(item)));

  return (
    <div role="listbox" aria-multiselectable="true">
      <div className="list-header">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={onSelectAll}
          aria-label="Select all"
        />
        <span>{selectedIds.size} selected</span>
      </div>
      {items.map((item) => {
        const id = keyExtractor(item);
        const isSelected = selectedIds.has(id);

        return (
          <div
            key={id}
            role="option"
            aria-selected={isSelected}
            className={isSelected ? 'selected' : ''}
            onClick={() => onSelect(id)}
          >
            <input type="checkbox" checked={isSelected} readOnly />
            {renderItem(item, isSelected)}
          </div>
        );
      })}
    </div>
  );
}
```

## 3. 无限滚动

```tsx
// InfiniteScroll.tsx
interface InfiniteScrollProps {
  onLoadMore: () => Promise<void>;
  hasMore: boolean;
  loading?: boolean;
  children: React.ReactNode;
}

export function InfiniteScroll({ onLoadMore, hasMore, loading, children }: InfiniteScrollProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          onLoadMore();
        }
      },
      { rootMargin: '100px' }
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, onLoadMore]);

  return (
    <div>
      {children}
      {hasMore && (
        <div ref={loadMoreRef} className="load-more">
          {loading ? 'Loading...' : 'Load more'}
        </div>
      )}
    </div>
  );
}
```
