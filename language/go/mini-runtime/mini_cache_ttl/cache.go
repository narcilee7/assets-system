package minicache

import (
	"container/list"
	"context"
	"sync"
	"sync/atomic"
	"time"
)

// entry 缓存项
type entry[K comparable, V any] struct {
	key       K
	value     V
	expiresAt time.Time // 零值表示永不过期
}

// Cache 泛型 LRU + TTL 缓存
type Cache[K comparable, V any] struct {
	mu         sync.Mutex
	items      map[K]*list.Element // key -> list element
	lru        *list.List          // Front=最近使用, Back=最久未使用
	maxSize    int                 // 0=无上限
	defaultTTL time.Duration       // 0=永不过期

	onEvicted       func(key K, value V)
	cleanupInterval time.Duration

	stopCh chan struct{}
	wg     sync.WaitGroup

	hits      atomic.Int64
	misses    atomic.Int64
	evictions atomic.Int64
}

// Option 配置选项
type Option[K comparable, V any] func(*Cache[K, V])

func WithOnEvicted[K comparable, V any](fn func(K, V)) Option[K, V] {
	return func(c *Cache[K, V]) {
		c.onEvicted = fn
	}
}

func WithCleanupInterval[K comparable, V any](d time.Duration) Option[K, V] {
	return func(c *Cache[K, V]) {
		c.cleanupInterval = d
	}
}

// New 创建缓存
// maxSize: 最大容量，0 表示无上限
// defaultTTL: 默认过期时间，0 表示永不过期
func New[K comparable, V any](maxSize int, defaultTTL time.Duration, opts ...Option[K, V]) *Cache[K, V] {
	c := &Cache[K, V]{
		items:           make(map[K]*list.Element),
		lru:             list.New(),
		maxSize:         maxSize,
		defaultTTL:      defaultTTL,
		stopCh:          make(chan struct{}),
		cleanupInterval: 5 * time.Minute,
	}
	for _, opt := range opts {
		opt(c)
	}

	// 有 TTL 才启动后台清理
	if c.defaultTTL > 0 && c.cleanupInterval > 0 {
		c.wg.Add(1)
		go c.cleanup()
	}
	return c
}

// Get 读取，懒检查过期
func (c *Cache[K, V]) Get(ctx context.Context, key K) (V, bool) {
	if err := ctx.Err(); err != nil {
		var zero V
		return zero, false
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	elem, ok := c.items[key]
	if !ok {
		c.misses.Add(1)
		var zero V
		return zero, false
	}

	ent := elem.Value.(*entry[K, V])
	if c.defaultTTL > 0 && time.Now().After(ent.expiresAt) {
		// 懒过期：直接删除
		c.removeElement(elem)
		c.misses.Add(1)
		var zero V
		return zero, false
	}

	// 更新 LRU
	c.lru.MoveToFront(elem)
	c.hits.Add(1)
	return ent.value, true
}

// Set 写入
// ttl=0 时使用 defaultTTL；ttl<0 时永不过期
func (c *Cache[K, V]) Set(ctx context.Context, key K, value V, ttl time.Duration) {
	if err := ctx.Err(); err != nil {
		return
	}

	var expiresAt time.Time
	switch {
	case ttl > 0:
		expiresAt = time.Now().Add(ttl)
	case ttl == 0 && c.defaultTTL > 0:
		expiresAt = time.Now().Add(c.defaultTTL)
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if elem, ok := c.items[key]; ok {
		// 更新已有
		ent := elem.Value.(*entry[K, V])
		ent.value = value
		ent.expiresAt = expiresAt
		c.lru.MoveToFront(elem)
		return
	}

	// 新增
	ent := &entry[K, V]{key: key, value: value, expiresAt: expiresAt}
	elem := c.lru.PushFront(ent)
	c.items[key] = elem

	// 容量检查
	if c.maxSize > 0 && c.lru.Len() > c.maxSize {
		c.evictOldest()
	}
}

// Delete 主动删除
func (c *Cache[K, V]) Delete(key K) bool {
	c.mu.Lock()
	elem, ok := c.items[key]
	if !ok {
		c.mu.Unlock()
		return false
	}
	removed := c.removeElement(elem)
	c.mu.Unlock()

	if c.onEvicted != nil {
		c.onEvicted(removed.key, removed.value)
	}
	return true
}

// Len 当前缓存大小
func (c *Cache[K, V]) Len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.lru.Len()
}

// Stats 返回命中/未命中/驱逐次数
func (c *Cache[K, V]) Stats() (hits, misses, evictions int64) {
	return c.hits.Load(), c.misses.Load(), c.evictions.Load()
}

// Stop 优雅关闭后台清理
func (c *Cache[K, V]) Stop() {
	close(c.stopCh)
	c.wg.Wait()
}

// ===== 内部 =====

func (c *Cache[K, V]) removeElement(elem *list.Element) *entry[K, V] {
	ent := elem.Value.(*entry[K, V])
	c.lru.Remove(elem)
	delete(c.items, ent.key)
	return ent
}

func (c *Cache[K, V]) evictOldest() {
	elem := c.lru.Back()
	if elem == nil {
		return
	}
	c.removeElement(elem)
	c.evictions.Add(1)
}

// cleanup 后台定期清理过期项
func (c *Cache[K, V]) cleanup() {
	defer c.wg.Done()

	ticker := time.NewTicker(c.cleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-c.stopCh:
			return
		case <-ticker.C:
			c.deleteExpired()
		}
	}
}

// deleteExpired 扫描全表删除过期项
// onEvicted 回调在锁外执行，避免死锁
func (c *Cache[K, V]) deleteExpired() {
	now := time.Now()
	var expiredKeys []K
	var expiredVals []V

	c.mu.Lock()
	for key, elem := range c.items {
		ent := elem.Value.(*entry[K, V])
		if c.defaultTTL > 0 && now.After(ent.expiresAt) {
			c.removeElement(elem)
			expiredKeys = append(expiredKeys, key)
			expiredVals = append(expiredVals, ent.value)
		}
	}
	c.mu.Unlock()

	if c.onEvicted != nil {
		for i, key := range expiredKeys {
			c.onEvicted(key, expiredVals[i])
		}
	}
}