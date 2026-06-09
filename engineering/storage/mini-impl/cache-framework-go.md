# 手写缓存框架（Go）

## 目标

实现一个简化版缓存框架，支持：
1. TTL 过期
2. LRU / LFU / FIFO 淘汰策略
3. 并发安全（sync.RWMutex）
4. 事件回调
5. 统计监控
6. Write-Through / Write-Behind 适配

## 实现

```go
// cache.go

package cache

import (
	"container/list"
	"context"
	"fmt"
	"sync"
	"time"
)

// EventType 缓存事件类型
type EventType int

const (
	EventGetHit EventType = iota
	EventGetMiss
	EventSet
	EventExpire
	EventEvict
	EventDelete
)

func (e EventType) String() string {
	switch e {
	case EventGetHit:
		return "GET_HIT"
	case EventGetMiss:
		return "GET_MISS"
	case EventSet:
		return "SET"
	case EventExpire:
		return "EXPIRE"
	case EventEvict:
		return "EVICT"
	case EventDelete:
		return "DELETE"
	default:
		return "UNKNOWN"
	}
}

// Event 缓存事件
type Event struct {
	Type      EventType
	Key       string
	Value     interface{}
	Timestamp time.Time
}

// Entry 缓存条目
type Entry struct {
	Key         string
	Value       interface{}
	CreatedAt   time.Time
	ExpireAt    *time.Time // nil = 永不过期
	LastAccess  time.Time
	AccessCount int64
}

func (e *Entry) IsExpired() bool {
	if e.ExpireAt == nil {
		return false
	}
	return time.Now().After(*e.ExpireAt)
}

// Cache 接口
type Cache interface {
	Get(key string) (interface{}, bool)
	Set(key string, value interface{}, ttl time.Duration)
	Delete(key string) bool
	Has(key string) bool
	Keys() []string
	Clear()
	Stats() Stats
	Close()
}

// Stats 统计
type Stats struct {
	Hits       int64
	Misses     int64
	Evictions  int64
	Expirations int64
}

func (s Stats) HitRate() float64 {
	total := s.Hits + s.Misses
	if total == 0 {
		return 0
	}
	return float64(s.Hits) / float64(total)
}

// EventListener 事件监听器
type EventListener func(Event)

// LocalCache 本地缓存实现
type LocalCache struct {
	mu        sync.RWMutex
	maxSize   int
	defaultTTL time.Duration
	policy    EvictionPolicy
	
	store     map[string]*list.Element // key -> lru list element
	lruList   *list.List               // 用于 LRU: value = *Entry
	
	stats     Stats
	listeners []EventListener
	
	cleanupTicker *time.Ticker
	stopCleanup   chan struct{}
}

// EvictionPolicy 淘汰策略
type EvictionPolicy int

const (
	LRU EvictionPolicy = iota
	LFU
	FIFO
)

// Config 缓存配置
type Config struct {
	MaxSize     int
	DefaultTTL  time.Duration
	Policy      EvictionPolicy
	CleanupInterval time.Duration
}

func NewLocalCache(config Config) *LocalCache {
	if config.MaxSize <= 0 {
		config.MaxSize = 1000
	}
	if config.CleanupInterval <= 0 {
		config.CleanupInterval = 60 * time.Second
	}

	c := &LocalCache{
		maxSize:    config.MaxSize,
		defaultTTL: config.DefaultTTL,
		policy:     config.Policy,
		store:      make(map[string]*list.Element),
		lruList:    list.New(),
		stopCleanup: make(chan struct{}),
	}

	c.cleanupTicker = time.NewTicker(config.CleanupInterval)
	go c.cleanupLoop()

	return c
}

// Get 获取
func (c *LocalCache) Get(key string) (interface{}, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	elem, ok := c.store[key]
	if !ok {
		c.stats.Misses++
		c.emit(Event{Type: EventGetMiss, Key: key, Timestamp: time.Now()})
		return nil, false
	}

	entry := elem.Value.(*Entry)
	if entry.IsExpired() {
		c.removeElement(elem)
		c.stats.Expirations++
		c.emit(Event{Type: EventExpire, Key: key, Value: entry.Value, Timestamp: time.Now()})
		c.stats.Misses++
		return nil, false
	}

	// 更新访问记录
	entry.LastAccess = time.Now()
	entry.AccessCount++
	
	// LRU: 移到队尾（最新）
	if c.policy == LRU {
		c.lruList.MoveToBack(elem)
	}

	c.stats.Hits++
	c.emit(Event{Type: EventGetHit, Key: key, Value: entry.Value, Timestamp: time.Now()})
	return entry.Value, true
}

// Set 设置
func (c *LocalCache) Set(key string, value interface{}, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	var expireAt *time.Time
	if ttl > 0 {
		t := time.Now().Add(ttl)
		expireAt = &t
	} else if c.defaultTTL > 0 {
		t := time.Now().Add(c.defaultTTL)
		expireAt = &t
	}

	now := time.Now()
	entry := &Entry{
		Key:         key,
		Value:       value,
		CreatedAt:   now,
		ExpireAt:    expireAt,
		LastAccess:  now,
		AccessCount: 1,
	}

	// 已存在则更新
	if elem, ok := c.store[key]; ok {
		c.lruList.Remove(elem)
	}

	// 检查容量
	if len(c.store) >= c.maxSize {
		c.evict()
	}

	elem := c.lruList.PushBack(entry)
	c.store[key] = elem

	c.emit(Event{Type: EventSet, Key: key, Value: value, Timestamp: time.Now()})
}

// Delete 删除
func (c *LocalCache) Delete(key string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()

	elem, ok := c.store[key]
	if !ok {
		return false
	}

	entry := c.removeElement(elem)
	c.emit(Event{Type: EventDelete, Key: key, Value: entry.Value, Timestamp: time.Now()})
	return true
}

// Has 检查存在
func (c *LocalCache) Has(key string) bool {
	_, ok := c.Get(key)
	return ok
}

// Keys 获取所有 key
func (c *LocalCache) Keys() []string {
	c.mu.RLock()
	defer c.mu.RUnlock()

	keys := make([]string, 0, len(c.store))
	for key, elem := range c.store {
		entry := elem.Value.(*Entry)
		if !entry.IsExpired() {
			keys = append(keys, key)
		}
	}
	return keys
}

// Clear 清空
func (c *LocalCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.store = make(map[string]*list.Element)
	c.lruList.Init()
}

// Stats 统计
func (c *LocalCache) Stats() Stats {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.stats
}

// AddListener 添加监听器
func (c *LocalCache) AddListener(fn EventListener) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.listeners = append(c.listeners, fn)
}

// GetOrSet 获取或设置
func (c *LocalCache) GetOrSet(key string, factory func() (interface{}, error), ttl time.Duration) (interface{}, error) {
	if val, ok := c.Get(key); ok {
		return val, nil
	}

	val, err := factory()
	if err != nil {
		return nil, err
	}

	c.Set(key, val, ttl)
	return val, nil
}

// GetOrSetAsync 异步获取或设置（带单飞）
func (c *LocalCache) GetOrSetAsync(ctx context.Context, key string, factory func(context.Context) (interface{}, error), ttl time.Duration) (interface{}, error) {
	if val, ok := c.Get(key); ok {
		return val, nil
	}

	// 单飞：只有一个 goroutine 执行 factory
	// 简化版：实际需用 singleflight
	val, err := factory(ctx)
	if err != nil {
		return nil, err
	}

	c.Set(key, val, ttl)
	return val, nil
}

// evict 淘汰
func (c *LocalCache) evict() {
	if c.lruList.Len() == 0 {
		return
	}

	var elem *list.Element

	switch c.policy {
	case LRU:
		// 淘汰队首（最久未使用）
		elem = c.lruList.Front()
	case FIFO:
		// 淘汰队首（最早创建）
		elem = c.lruList.Front()
	case LFU:
		// 找到访问次数最少的
		minCount := int64(^uint64(0) >> 1)
		for e := c.lruList.Front(); e != nil; e = e.Next() {
			entry := e.Value.(*Entry)
			if entry.AccessCount < minCount {
				minCount = entry.AccessCount
				elem = e
			}
		}
	}

	if elem != nil {
		entry := c.removeElement(elem)
		c.stats.Evictions++
		c.emit(Event{Type: EventEvict, Key: entry.Key, Value: entry.Value, Timestamp: time.Now()})
	}
}

// removeElement 从数据结构中移除
func (c *LocalCache) removeElement(elem *list.Element) *Entry {
	entry := elem.Value.(*Entry)
	delete(c.store, entry.Key)
	c.lruList.Remove(elem)
	return entry
}

// cleanupLoop 定期清理
func (c *LocalCache) cleanupLoop() {
	for {
		select {
		case <-c.cleanupTicker.C:
			c.cleanup()
		case <-c.stopCleanup:
			return
		}
	}
}

// cleanup 清理过期
func (c *LocalCache) cleanup() {
	c.mu.Lock()
	defer c.mu.Unlock()

	for key, elem := range c.store {
		entry := elem.Value.(*Entry)
		if entry.IsExpired() {
			c.removeElement(elem)
			c.stats.Expirations++
			c.emit(Event{Type: EventExpire, Key: key, Value: entry.Value, Timestamp: time.Now()})
		}
	}
}

// emit 发送事件
func (c *LocalCache) emit(event Event) {
	for _, fn := range c.listeners {
		go fn(event) // 异步触发
	}
}

// Close 关闭
func (c *LocalCache) Close() {
	close(c.stopCleanup)
	c.cleanupTicker.Stop()
	c.Clear()
}

// ========== 多级缓存 ==========

type MultiLevelCache struct {
	L1 Cache      // 本地缓存
	L2 Cache      // 分布式缓存（如 Redis）
}

func (m *MultiLevelCache) Get(key string) (interface{}, bool) {
	// L1
	if val, ok := m.L1.Get(key); ok {
		return val, true
	}

	// L2
	if m.L2 != nil {
		if val, ok := m.L2.Get(key); ok {
			m.L1.Set(key, val, 0) // 回填 L1
			return val, true
		}
	}

	return nil, false
}

func (m *MultiLevelCache) Set(key string, value interface{}, l1TTL, l2TTL time.Duration) {
	m.L1.Set(key, value, l1TTL)
	if m.L2 != nil {
		m.L2.Set(key, value, l2TTL)
	}
}

// ========== 使用 ==========

// func main() {
// 	cache := NewLocalCache(Config{
// 		MaxSize:    100,
// 		DefaultTTL: 5 * time.Minute,
// 		Policy:     LRU,
// 	})
// 	defer cache.Close()
//
// 	cache.AddListener(func(e Event) {
// 		fmt.Printf("[Cache] %s key=%s\n", e.Type, e.Key)
// 	})
//
// 	cache.Set("user:1", "Alice", 10*time.Minute)
// 	if val, ok := cache.Get("user:1"); ok {
// 		fmt.Println(val)
// 	}
//
// 	stats := cache.Stats()
// 	fmt.Printf("Hit rate: %.2f%%\n", stats.HitRate()*100)
// }
```
