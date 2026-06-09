# Go 分布式锁

分布式锁用于在分布式系统中协调多个节点对共享资源的访问。Go 生态中常见的分布式锁实现包括：基于 Redis 的 Redlock、基于 etcd 的租约锁、基于 ZooKeeper 的临时顺序节点锁和基于数据库的唯一索引锁。Go 的并发原语（channel、select、context）使得实现分布式锁的客户端非常优雅。

## 核心概念

分布式锁必须满足四个核心属性：互斥性（Mutual Exclusion）、防死锁（Deadlock Free）、容错性（Fault Tolerance）和可重入性（Reentrancy，可选）。在分布式环境下，网络分区是最大挑战：如果持有锁的节点崩溃，锁必须能自动释放（通过 TTL 或租约）。

Redis Redlock 是 Redis 作者提出的算法，在 N 个独立的 Redis 节点上获取锁，当在大多数节点（N/2+1）上成功获取且总耗时小于锁有效期时，认为加锁成功。etcd 通过 Lease（租约）和 Transaction（事务）实现更可靠的分布式锁，支持自动续约（KeepAlive）。

## 代码实现

```go
// redis_lock.go
package distlock

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisLock 基于单节点 Redis 的分布式锁
type RedisLock struct {
	client *redis.Client
	key    string
	value  string // 随机值，防止误释放他人锁
	ttl    time.Duration
}

func NewRedisLock(client *redis.Client, key string, ttl time.Duration) *RedisLock {
	b := make([]byte, 16)
	rand.Read(b)
	return &RedisLock{
		client: client,
		key:    key,
		value:  hex.EncodeToString(b),
		ttl:    ttl,
	}
}

// Lock 加锁，支持阻塞等待
func (l *RedisLock) Lock(ctx context.Context) error {
	for {
		ok, err := l.client.SetNX(ctx, l.key, l.value, l.ttl).Result()
		if err != nil {
			return err
		}
		if ok {
			return nil
		}

		// 等待后重试
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(100 * time.Millisecond):
		}
	}
}

// Unlock 释放锁，使用 Lua 保证原子性
func (l *RedisLock) Unlock(ctx context.Context) error {
	script := `
		if redis.call("get", KEYS[1]) == ARGV[1] then
			return redis.call("del", KEYS[1])
		else
			return 0
		end
	`
	_, err := l.client.Eval(ctx, script, []string{l.key}, l.value).Result()
	return err
}

// Extend 续约锁
func (l *RedisLock) Extend(ctx context.Context, ttl time.Duration) error {
	script := `
		if redis.call("get", KEYS[1]) == ARGV[1] then
			return redis.call("pexpire", KEYS[1], ARGV[2])
		else
			return 0
		end
	`
	_, err := l.client.Eval(ctx, script, []string{l.key}, l.value, ttl.Milliseconds()).Result()
	return err
}

// AutoRefresh 后台自动续约
func (l *RedisLock) AutoRefresh(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := l.Extend(ctx, l.ttl); err != nil {
				return
			}
		}
	}
}
```

```go
// etcd_lock.go
package distlock

import (
	"context"
	"fmt"
	"time"

	clientv3 "go.etcd.io/etcd/client/v3"
	"go.etcd.io/etcd/client/v3/concurrency"
)

// EtcdLock 基于 etcd 的分布式锁
type EtcdLock struct {
	client *clientv3.Client
	session *concurrency.Session
	mutex   *concurrency.Mutex
}

func NewEtcdLock(client *clientv3.Client, key string, ttl int) (*EtcdLock, error) {
	// ttl 单位为秒，etcd 要求至少 1 秒
	session, err := concurrency.NewSession(client, concurrency.WithTTL(ttl))
	if err != nil {
		return nil, err
	}

	mutex := concurrency.NewMutex(session, key)
	return &EtcdLock{
		client:  client,
		session: session,
		mutex:   mutex,
	}, nil
}

func (l *EtcdLock) Lock(ctx context.Context) error {
	return l.mutex.Lock(ctx)
}

func (l *EtcdLock) Unlock(ctx context.Context) error {
	defer l.session.Close()
	return l.mutex.Unlock(ctx)
}

// TryLock 非阻塞尝试加锁
func (l *EtcdLock) TryLock(ctx context.Context, timeout time.Duration) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	err := l.Lock(ctx)
	if err == context.DeadlineExceeded {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}
```

```go
// redlock.go
package distlock

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedLock 基于多节点 Redis 的 Redlock 算法
type RedLock struct {
	clients []*redis.Client
	quorum  int
	ttl     time.Duration
}

func NewRedLock(clients []*redis.Client, ttl time.Duration) *RedLock {
	return &RedLock{
		clients: clients,
		quorum:  len(clients)/2 + 1,
		ttl:     ttl,
	}
}

func (rl *RedLock) Lock(ctx context.Context, resource string) (*RedLockInstance, error) {
	value := generateUniqueValue()

	for {
		start := time.Now()
		successCount := 0

		for _, client := range rl.clients {
			ok, err := client.SetNX(ctx, resource, value, rl.ttl).Result()
			if err == nil && ok {
				successCount++
			}
		}

		elapsed := time.Since(start)
		validity := rl.ttl - elapsed - 2*time.Millisecond // 时钟漂移容错

		if successCount >= rl.quorum && validity > 0 {
			return &RedLockInstance{
				resource: resource,
				value:    value,
				validity: validity,
				clients:  rl.clients,
			}, nil
		}

		// 失败时释放已获取的锁
		for _, client := range rl.clients {
			client.Del(ctx, resource)
		}

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(time.Millisecond * time.Duration(rand.Intn(100)+10)):
		}
	}
}

type RedLockInstance struct {
	resource string
	value    string
	validity time.Duration
	clients  []*redis.Client
}

func (ri *RedLockInstance) Unlock(ctx context.Context) {
	script := `
		if redis.call("get", KEYS[1]) == ARGV[1] then
			return redis.call("del", KEYS[1])
		else
			return 0
		end
	`
	for _, client := range ri.clients {
		client.Eval(ctx, script, []string{ri.resource}, ri.value)
	}
}
```

```go
// mutex_wrapper.go
package distlock

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// DistributedMutex 统一的分布式锁接口
type DistributedMutex interface {
	Lock(ctx context.Context) error
	Unlock(ctx context.Context) error
}

// LockContext 封装锁的自动释放和超时控制
func WithLock(ctx context.Context, mutex DistributedMutex, fn func() error) error {
	if err := mutex.Lock(ctx); err != nil {
		return fmt.Errorf("lock failed: %w", err)
	}
	defer mutex.Unlock(ctx)
	return fn()
}
```

## 选型对比

| 方案 | 可靠性 | 性能 | 自动续约 | 实现复杂度 | 推荐场景 |
| --- | --- | --- | --- | --- | --- |
| Redis 单节点 | 中 | ⭐⭐⭐ | 手动 | 低 | 非关键资源，允许偶发错误 |
| Redlock | 高 | ⭐⭐⭐ | 手动 | 中 | Redis 已部署，高可用要求 |
| etcd | ⭐⭐⭐ | ⭐⭐ | 原生支持 | 中 | K8s 环境，强一致需求 |
| ZooKeeper | ⭐⭐⭐ | ⭐⭐ | 原生支持 | 高 | 已有 ZK 集群 |
| MySQL/PostgreSQL | 高 | ⭐ | 手动 | 低 | 无额外基础设施 |
| Consul | 高 | ⭐⭐ | 原生支持 | 低 | Consul 已部署 |

## 最佳实践

- **TTL 必须大于业务耗时**：设置 TTL 为业务预期的最大执行时间的 2-3 倍
- **谁加锁谁释放**：通过随机 value 校验，防止 A 的锁被 B 释放（Redis）
- **自动续约**：长任务必须启动后台 goroutine 续约，防止锁过期导致并发问题
- **Lua 原子操作**：Redis 的加锁判断和释放必须用 Lua 脚本保证原子性
- **时钟安全**：Redlock 依赖时钟同步，生产环境应配置 NTP 并考虑时钟漂移
- **锁粒度**：锁的 key 尽量细化（如 `lock:order:12345`），避免大锁降低并发
- **降级策略**：获取锁超时后，根据业务决定失败重试或降级执行
