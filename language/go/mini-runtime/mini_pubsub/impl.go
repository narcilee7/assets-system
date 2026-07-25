package minipubsub

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
)

// Message 消息
type Message struct {
	Topic   string
	Payload []byte
}

// Subscriber 订阅者
type Subscriber struct {
	id     string
	ch     chan Message
	closed atomic.Bool
}

// Ch 消费通道
func (s *Subscriber) Ch() <-chan Message {
	return s.ch
}

// Close 标记关闭，不再接收新消息
func (s *Subscriber) Close() {
	s.closed.Store(true)
}

type PubSub struct {
	mu       sync.RWMutex
	subs     map[string][]*Subscriber // topic -> subscribers
	closed   atomic.Bool
	dropped  atomic.Int64 // 因 channel 满丢弃的消息数
}

func New() *PubSub {
	return &PubSub{
		subs: make(map[string][]*Subscriber),
	}
}

// Subscribe 订阅指定 topic，buffer 为 channel 缓冲大小
func (ps *PubSub) Subscribe(topic string, buffer int) *Subscriber {
	if ps.closed.Load() {
		return nil
	}

	sub := &Subscriber{
		id: fmt.Sprintf("sub-%d", atomic.AddInt64(&subCounter, 1)),
		ch: make(chan Message, buffer),
	}

	ps.mu.Lock()
	ps.subs[topic] = append(ps.subs[topic], sub)
	ps.mu.Unlock()

	return sub
}

// Unsubscribe 取消订阅并关闭 channel
func (ps *PubSub) Unsubscribe(topic string, sub *Subscriber) {
	if sub == nil {
		return
	}

	ps.mu.Lock()
	subs := ps.subs[topic]
	filtered := make([]*Subscriber, 0, len(subs))
	for _, s := range subs {
		if s != sub {
			filtered = append(filtered, s)
		}
	}
	if len(filtered) == 0 {
		delete(ps.subs, topic)
	} else {
		ps.subs[topic] = filtered
	}
	ps.mu.Unlock()

	sub.Close()
	// 安全关闭：确保没有 sender 在写后再关
	// 这里简单处理，生产环境应 sync.Once
	select {
	case <-sub.ch:
	default:
		close(sub.ch)
	}
}

// Publish fan-out 广播消息到所有订阅者
// 每个 subscriber 独立发送，channel 满则丢弃（不阻塞 publish 和其他 subscriber）
func (ps *PubSub) Publish(ctx context.Context, msg Message) error {
	if ps.closed.Load() {
		return errors.New("pubsub is closed")
	}

	// 检查 context
	if err := ctx.Err(); err != nil {
		return fmt.Errorf("publish cancelled: %w", err)
	}

	// 读锁 copy subscribers
	ps.mu.RLock()
	subs := make([]*Subscriber, len(ps.subs[msg.Topic]))
	copy(subs, ps.subs[msg.Topic])
	ps.mu.RUnlock()

	if len(subs) == 0 {
		return nil
	}

	for _, sub := range subs {
		if sub.closed.Load() {
			continue
		}

		select {
		case sub.ch <- msg:
			// 发送成功
		case <-ctx.Done():
			// context 取消，停止发送（已发送的不撤回）
			return fmt.Errorf("publish interrupted: %w", ctx.Err())
		default:
			// channel 满，丢弃该 subscriber 的消息
			ps.dropped.Add(1)
		}
	}

	return nil
}

// PublishSync 阻塞版本：等所有 subscriber 消费完（或 channel 满）
// 用于需要确认投递的场景，但可能阻塞
func (ps *PubSub) PublishSync(ctx context.Context, msg Message) error {
	if ps.closed.Load() {
		return errors.New("pubsub is closed")
	}

	ps.mu.RLock()
	subs := make([]*Subscriber, len(ps.subs[msg.Topic]))
	copy(subs, ps.subs[msg.Topic])
	ps.mu.RUnlock()

	if len(subs) == 0 {
		return nil
	}

	var wg sync.WaitGroup
	errCh := make(chan error, 1)

	for _, sub := range subs {
		if sub.closed.Load() {
			continue
		}
		wg.Add(1)
		go func(s *Subscriber) {
			defer wg.Done()
			select {
			case s.ch <- msg:
			case <-ctx.Done():
				select {
				case errCh <- ctx.Err():
				default:
				}
			}
		}(sub)
	}

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		select {
		case err := <-errCh:
			return fmt.Errorf("publish sync partial failure: %w", err)
		default:
			return nil
		}
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Stats 返回当前订阅和丢弃统计
func (ps *PubSub) Stats() (topics int, subscribers int, dropped int64) {
	ps.mu.RLock()
	defer ps.mu.RUnlock()
	topics = len(ps.subs)
	for _, subs := range ps.subs {
		subscribers += len(subs)
	}
	return topics, subscribers, ps.dropped.Load()
}

// Close 优雅关闭：关闭所有 subscriber channel
func (ps *PubSub) Close() error {
	if !ps.closed.CompareAndSwap(false, true) {
		return errors.New("already closed")
	}

	ps.mu.Lock()
	defer ps.mu.Unlock()

	for topic, subs := range ps.subs {
		for _, sub := range subs {
			sub.Close()
			close(sub.ch)
		}
		delete(ps.subs, topic)
	}

	return nil
}

var subCounter int64