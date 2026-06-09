# 手写数据库连接池（Go）

## 目标

实现一个简化版数据库连接池，支持：
1. 连接复用（基于 `database/sql` 接口或通用接口）
2. 最大/最小连接数控制
3. 连接超时获取（Context 支持）
4. 空闲连接检测与回收
5. 连接泄漏检测
6. 连接健康检查

## 实现

```go
// connection_pool.go

package pool

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

var (
	ErrPoolClosed    = errors.New("pool is closed")
	ErrConnBusy      = errors.New("connection is busy")
	ErrConnWaitTimeout = errors.New("connection wait timeout")
)

// Conn 是池化的连接接口
type Conn interface {
	Close() error
	Ping() error
}

// ConnFactory 创建新连接
type ConnFactory func() (Conn, error)

// PooledConn 包装连接并附加元数据
type PooledConn struct {
	Conn
	id          string
	createdAt   time.Time
	lastUsedAt  time.Time
	pool        *Pool
	inUse       int32
}

// Release 将连接归还到池中
func (c *PooledConn) Release() {
	if c.pool == nil {
		c.Conn.Close()
		return
	}
	c.pool.release(c)
}

// Pool 配置
type Config struct {
	MaxOpen     int           // 最大活跃连接数
	MaxIdle     int           // 最大空闲连接数
	MaxLifetime time.Duration // 连接最大生命周期
	IdleTimeout time.Duration // 空闲超时
	WaitTimeout time.Duration // 等待连接超时
	ConnFactory ConnFactory   // 连接工厂
}

// Pool 连接池
type Pool struct {
	config Config

	mu          sync.Mutex
	idle        []*PooledConn      // 空闲连接
	active      map[*PooledConn]time.Time // 活跃连接 -> 借出时间
	waiters     []chan *PooledConn // 等待队列
	closed      bool
	opened      int32 // 当前总连接数

	// 统计
	stats Stats
}

// Stats 统计信息
type Stats struct {
	Hits       int64
	Misses     int64
	Timeouts   int64
	Waiters    int
	OpenConns  int32
	IdleConns  int
	ActiveConns int
}

type PoolStats struct {
	MaxOpen     int
	MaxIdle     int
	OpenConns   int32
	IdleConns   int
	ActiveConns int
	Waiters     int
	Hits        int64
	Misses      int64
}

func NewPool(config Config) *Pool {
	if config.MaxOpen <= 0 {
		config.MaxOpen = 10
	}
	if config.MaxIdle <= 0 {
		config.MaxIdle = 2
	}
	if config.MaxLifetime <= 0 {
		config.MaxLifetime = 30 * time.Minute
	}
	if config.IdleTimeout <= 0 {
		config.IdleTimeout = 10 * time.Minute
	}
	if config.WaitTimeout <= 0 {
		config.WaitTimeout = 30 * time.Second
	}

	p := &Pool{
		config: config,
		idle:   make([]*PooledConn, 0, config.MaxIdle),
		active: make(map[*PooledConn]time.Time),
	}

	// 初始化最小连接
	for i := 0; i < config.MaxIdle; i++ {
		if conn, err := p.newConn(); err == nil {
			p.idle = append(p.idle, conn)
		}
	}

	// 启动 house keeper
	go p.houseKeeper()

	return p
}

// Acquire 获取连接
func (p *Pool) Acquire(ctx context.Context) (*PooledConn, error) {
	p.mu.Lock()

	if p.closed {
		p.mu.Unlock()
		return nil, ErrPoolClosed
	}

	// 1. 尝试获取空闲连接
	if len(p.idle) > 0 {
		conn := p.idle[len(p.idle)-1]
		p.idle = p.idle[:len(p.idle)-1]
		if p.isValid(conn) {
			p.active[conn] = time.Now()
			atomic.AddInt64(&p.stats.Hits, 1)
			p.mu.Unlock()
			conn.lastUsedAt = time.Now()
			return conn, nil
		}
		// 无效，关闭并继续
		p.closeConn(conn)
		p.mu.Unlock()
		return p.Acquire(ctx)
	}

	// 2. 尝试创建新连接
	if p.opened < int32(p.config.MaxOpen) {
		atomic.AddInt32(&p.opened, 1)
		p.mu.Unlock()
		conn, err := p.newConn()
		if err != nil {
			atomic.AddInt32(&p.opened, -1)
			return nil, err
		}
		p.mu.Lock()
		p.active[conn] = time.Now()
		atomic.AddInt64(&p.stats.Misses, 1)
		p.mu.Unlock()
		return conn, nil
	}

	// 3. 等待
	atomic.AddInt64(&p.stats.Misses, 1)
	waiter := make(chan *PooledConn, 1)
	p.waiters = append(p.waiters, waiter)
	p.mu.Unlock()

	select {
	case conn := <-waiter:
		if conn == nil {
			return nil, ErrPoolClosed
		}
		return conn, nil
	case <-ctx.Done():
		p.mu.Lock()
		for i, w := range p.waiters {
			if w == waiter {
				p.waiters = append(p.waiters[:i], p.waiters[i+1:]...)
				break
			}
		}
		p.mu.Unlock()
		atomic.AddInt64(&p.stats.Timeouts, 1)
		return nil, ctx.Err()
	}
}

// release 归还连接
func (p *Pool) release(conn *PooledConn) {
	p.mu.Lock()
	defer p.mu.Unlock()

	delete(p.active, conn)

	if p.closed {
		p.closeConn(conn)
		return
	}

	if !p.isValid(conn) || time.Since(conn.createdAt) > p.config.MaxLifetime {
		p.closeConn(conn)
		return
	}

	// 优先给等待者
	if len(p.waiters) > 0 {
		waiter := p.waiters[0]
		p.waiters = p.waiters[1:]
		p.active[conn] = time.Now()
		waiter <- conn
		return
	}

	// 放回空闲队列
	if len(p.idle) < p.config.MaxIdle {
		conn.lastUsedAt = time.Now()
		p.idle = append(p.idle, conn)
	} else {
		p.closeConn(conn)
	}
}

// newConn 创建新连接
func (p *Pool) newConn() (*PooledConn, error) {
	if p.config.ConnFactory == nil {
		return nil, errors.New("conn factory not set")
	}

	raw, err := p.config.ConnFactory()
	if err != nil {
		return nil, err
	}

	return &PooledConn{
		Conn:       raw,
		id:         fmt.Sprintf("conn-%d", time.Now().UnixNano()),
		createdAt:  time.Now(),
		lastUsedAt: time.Now(),
		pool:       p,
	}, nil
}

// isValid 检查连接是否有效
func (p *Pool) isValid(conn *PooledConn) bool {
	if conn == nil {
		return false
	}
	if err := conn.Ping(); err != nil {
		return false
	}
	return true
}

// closeConn 关闭连接
func (p *Pool) closeConn(conn *PooledConn) {
	if conn == nil {
		return
	}
	atomic.AddInt32(&p.opened, -1)
	conn.Conn.Close()
}

// houseKeeper 定期清理
func (p *Pool) houseKeeper() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		p.mu.Lock()
		if p.closed {
			p.mu.Unlock()
			return
		}

		// 清理超时空闲连接
		now := time.Now()
		validIdle := p.idle[:0]
		for _, conn := range p.idle {
			if now.Sub(conn.lastUsedAt) > p.config.IdleTimeout {
				p.closeConn(conn)
			} else {
				validIdle = append(validIdle, conn)
			}
		}
		p.idle = validIdle
		p.mu.Unlock()
	}
}

// Stats 获取统计
func (p *Pool) Stats() PoolStats {
	p.mu.Lock()
	defer p.mu.Unlock()

	return PoolStats{
		MaxOpen:     p.config.MaxOpen,
		MaxIdle:     p.config.MaxIdle,
		OpenConns:   p.opened,
		IdleConns:   len(p.idle),
		ActiveConns: len(p.active),
		Waiters:     len(p.waiters),
		Hits:        atomic.LoadInt64(&p.stats.Hits),
		Misses:      atomic.LoadInt64(&p.stats.Misses),
	}
}

// Close 关闭池
func (p *Pool) Close() error {
	p.mu.Lock()
	p.closed = true

	// 唤醒等待者
	for _, w := range p.waiters {
		w <- nil
	}
	p.waiters = nil

	// 关闭活跃连接
	for conn := range p.active {
		p.closeConn(conn)
	}
	p.active = nil

	// 关闭空闲连接
	for _, conn := range p.idle {
		p.closeConn(conn)
	}
	p.idle = nil

	p.mu.Unlock()
	return nil
}

// ========== 使用示例 ==========

// func main() {
// 	pool := NewPool(Config{
// 		MaxOpen: 10,
// 		MaxIdle: 2,
// 		ConnFactory: func() (Conn, error) {
// 			return sql.Open("mysql", "user:pass@/db")
// 		},
// 	})
// 	defer pool.Close()
//
// 	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
// 	defer cancel()
//
// 	conn, err := pool.Acquire(ctx)
// 	if err != nil {
// 		panic(err)
// 	}
// 	defer conn.Release()
//
// 	// 使用 conn...
// }
```
