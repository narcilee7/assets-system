# Go 分布式 ID 生成

分布式系统中，全局唯一 ID 是数据分片、日志追踪和去重的基础。Go 生态中主流的分布式 ID 方案包括：雪花算法（Snowflake）、数据库自增（号段模式）、UUID、ULID 和基于 Redis 的递增。不同方案在唯一性、有序性、性能和可读性之间有不同的权衡。

## 核心概念

雪花算法由 Twitter 开源，是分布式 ID 的工业标准。它使用 64 位 long 类型，结构为：1 位符号位 + 41 位时间戳（毫秒）+ 10 位机器标识 + 12 位序列号，单机每秒可生成约 409.6 万个 ID，且趋势递增，对数据库索引友好。

号段模式（Segment）从数据库批量获取 ID 区间（如 [1, 1000]），在内存中分配，用完后再申请新号段。美团开源的 Leaf 是这一模式的代表，兼具数据库的可靠性和内存的高性能。

UUID（v4）是完全随机生成的 128 位标识，虽然全局唯一但无序且占用空间大，不适合做数据库主键。ULID 是 UUID 的替代方案，26 字符的 Crockford Base32 编码，包含 48 位时间戳和 80 位随机数，字典序递增且 URL 安全。

## 代码实现

```go
// snowflake.go
package idgen

import (
	"errors"
	"fmt"
	"sync"
	"time"
)

// Snowflake 结构：
// 0 - 41 bits: timestamp (毫秒)
// 41 - 51 bits: worker id (10 bits, 0-1023)
// 51 - 63 bits: sequence (12 bits, 0-4095)
const (
	workerBits  uint8 = 10
	sequenceBits uint8 = 12

	workerMax   int64 = -1 ^ (-1 << workerBits)
	sequenceMax int64 = -1 ^ (-1 << sequenceBits)

	timeShift   uint8 = workerBits + sequenceBits
	workerShift uint8 = sequenceBits
)

// SnowflakeGenerator 雪花算法生成器
type SnowflakeGenerator struct {
	mu        sync.Mutex
	workerID  int64
	sequence  int64
	lastTime  int64
	epoch     int64 // 自定义起始时间戳
}

func NewSnowflakeGenerator(workerID int64, epoch time.Time) (*SnowflakeGenerator, error) {
	if workerID < 0 || workerID > workerMax {
		return nil, fmt.Errorf("worker ID must be between 0 and %d", workerMax)
	}
	return &SnowflakeGenerator{
		workerID: workerID,
		epoch:    epoch.UnixMilli(),
	}, nil
}

func (g *SnowflakeGenerator) NextID() (int64, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	now := time.Now().UnixMilli()
	if now < g.lastTime {
		return 0, errors.New("clock moved backwards")
	}

	if now == g.lastTime {
		g.sequence = (g.sequence + 1) & sequenceMax
		if g.sequence == 0 {
			// 当前毫秒的序列号用完，等待下一毫秒
			for now <= g.lastTime {
				now = time.Now().UnixMilli()
			}
		}
	} else {
		g.sequence = 0
	}

	g.lastTime = now

	id := ((now - g.epoch) << timeShift) |
		(g.workerID << workerShift) |
		g.sequence

	return id, nil
}

// ParseSnowflake 解析雪花 ID
func ParseSnowflake(id int64, epoch time.Time) (timestamp time.Time, workerID int64, sequence int64) {
	timestamp = time.UnixMilli((id >> timeShift) + epoch.UnixMilli())
	workerID = (id >> workerShift) & workerMax
	sequence = id & sequenceMax
	return
}
```

```go
// ulid.go
package idgen

import (
	"crypto/rand"
	"io"
	"time"

	"github.com/oklog/ulid/v2"
)

// ULIDGenerator ULID 生成器
type ULIDGenerator struct {
	entropy io.Reader
}

func NewULIDGenerator() *ULIDGenerator {
	return &ULIDGenerator{
		entropy: rand.Reader,
	}
}

func (g *ULIDGenerator) NextID() (string, error) {
	id, err := ulid.New(ulid.Timestamp(time.Now()), g.entropy)
	if err != nil {
		return "", err
	}
	return id.String(), nil
}

// MonotonicULID 单调递增 ULID（同一毫秒内保证递增）
type MonotonicULID struct {
	mu      sync.Mutex
	entropy *ulid.MonotonicEntropy
}

func NewMonotonicULID() *MonotonicULID {
	return &MonotonicULID{
		entropy: ulid.Monotonic(rand.Reader, 0),
	}
}

func (g *MonotonicULID) NextID() (string, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	id, err := ulid.New(ulid.Timestamp(time.Now()), g.entropy)
	if err != nil {
		return "", err
	}
	return id.String(), nil
}
```

```go
// segment.go
package idgen

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
)

// SegmentIDGenerator 数据库号段模式
type SegmentIDGenerator struct {
	mu        sync.Mutex
	current   Segment
	db        *sql.DB
	bizTag    string
	step      int64
}

type Segment struct {
	min   int64
	max   int64
	cur   int64
}

func NewSegmentIDGenerator(db *sql.DB, bizTag string, step int64) (*SegmentIDGenerator, error) {
	g := &SegmentIDGenerator{
		db:     db,
		bizTag: bizTag,
		step:   step,
	}
	if err := g.loadNextSegment(); err != nil {
		return nil, err
	}
	return g, nil
}

func (g *SegmentIDGenerator) NextID() (int64, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.current.cur >= g.current.max {
		if err := g.loadNextSegment(); err != nil {
			return 0, err
		}
	}

	id := g.current.cur
	g.current.cur++
	return id, nil
}

func (g *SegmentIDGenerator) loadNextSegment() error {
	tx, err := g.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var maxID int64
	err = tx.QueryRow(
		`SELECT max_id FROM id_segment WHERE biz_tag = ? FOR UPDATE`,
		g.bizTag,
	).Scan(&maxID)
	if err == sql.ErrNoRows {
		_, err = tx.Exec(
			`INSERT INTO id_segment (biz_tag, max_id, step) VALUES (?, ?, ?)`,
			g.bizTag, g.step, g.step,
		)
		if err != nil {
			return err
		}
		maxID = 0
	} else if err != nil {
		return err
	}

	_, err = tx.Exec(
		`UPDATE id_segment SET max_id = max_id + ? WHERE biz_tag = ?`,
		g.step, g.bizTag,
	)
	if err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	g.current = Segment{
		min: maxID,
		max: maxID + g.step,
		cur: maxID,
	}
	return nil
}
```

```go
// id_generator.go
package idgen

import (
	"fmt"
	"sync"
)

// IDGenerator 统一接口
type IDGenerator interface {
	NextID() (string, error)
}

// SafeGenerator 线程安全包装器
type SafeGenerator struct {
	gen IDGenerator
	mu  sync.Mutex
}

func (s *SafeGenerator) NextID() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.gen.NextID()
}
```

## 选型对比

| 方案 | 位数 | 有序性 | 可读性 | 性能 | 依赖 | 适用场景 |
| --- | --- | --- | --- | --- | --- | --- |
| Snowflake | 64 | 趋势递增 | 低 | ⭐⭐⭐ | 无 | **分布式系统首选** |
| 号段模式 | 64 | 严格递增 | 中 | ⭐⭐⭐ | 数据库 | 强有序需求 |
| UUID v4 | 128 | 无序 | 低 | ⭐⭐⭐ | 无 | 无中心协调 |
| ULID | 128 | 字典序递增 | 中 | ⭐⭐⭐ | 无 | 需要 URL 安全 |
| Redis Incr | 64 | 严格递增 | 高 | ⭐⭐⭐ | Redis | 简单计数场景 |
| MongoDB ObjectId | 96 | 时间有序 | 低 | ⭐⭐⭐ | MongoDB | MongoDB 环境 |

## 最佳实践

- **Snowflake WorkerID 分配**：通过 K8s Pod IP 或 etcd 一致性哈希分配 WorkerID，避免冲突
- **时钟回拨处理**：NTP 同步导致时间回拨时，Snowflake 应等待或返回错误，不可生成重复 ID
- **号段双缓冲**：Leaf 的双缓冲模式在内存中维护两个号段，切换时无阻塞
- **主键选择**：数据库主键优先选择趋势递增的整数（Snowflake/号段），避免 UUID 导致页分裂
- **业务编码**：ID 中可嵌入业务标识（如 `O` 开头表示订单，`P` 表示支付），提升可读性
- **ID 防遍历**：对外暴露的 ID 可加密或转 Base62，防止被遍历攻击
- **监控告警**：ID 生成速率接近理论上限时触发扩容告警
