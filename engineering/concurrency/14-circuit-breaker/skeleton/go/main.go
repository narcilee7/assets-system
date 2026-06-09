package main

import (
	"errors"
	"fmt"
	"sync"
	"time"
)

type State int

const (
	StateClosed State = iota
	StateOpen
	StateHalfOpen
)

// CircuitBreaker 熔断器。
// TODO: 添加状态、失败计数、成功计数、最后失败时间、配置等字段。
type CircuitBreaker struct {
	mu sync.Mutex
	// TODO
}

// Config 熔断器配置。
type Config struct {
	FailureThreshold int           // 触发熔断的连续失败阈值
	RecoveryTimeout  time.Duration // 开启状态持续多久后进入半开
	HalfOpenMaxCalls int           // 半开状态最多允许多少个探测请求
}

func NewCircuitBreaker(cfg Config) *CircuitBreaker {
	// TODO: 初始化
	return &CircuitBreaker{}
}

// Call 执行被保护函数。如果熔断器开启，直接返回错误。
func (cb *CircuitBreaker) Call(fn func() error) error {
	cb.mu.Lock()
	// TODO: 检查当前状态
	// 如果是 Open，检查是否过了 RecoveryTimeout，尝试转为 HalfOpen
	// 如果是 HalfOpen，限制探测请求数量
	cb.mu.Unlock()

	// TODO: 执行 fn，根据结果更新状态（成功/失败计数、状态转换）
	return fn()
}

func main() {
	cb := NewCircuitBreaker(Config{
		FailureThreshold: 3,
		RecoveryTimeout:  200 * time.Millisecond,
		HalfOpenMaxCalls: 1,
	})

	failFn := func() error { return errors.New("service down") }
	okFn := func() error { return nil }

	// 阶段 1：连续失败触发熔断
	for i := 0; i < 5; i++ {
		cb.Call(failFn)
	}

	// 阶段 2：熔断器应处于开启状态，快速失败
	err := cb.Call(okFn)
	if err == nil {
		fmt.Println("FAIL: expected rejection when circuit is open")
		return
	}

	// 阶段 3：等待恢复超时
	time.Sleep(250 * time.Millisecond)

	// 阶段 4：半开探测成功，恢复关闭
	err = cb.Call(okFn)
	if err != nil {
		fmt.Printf("FAIL: expected success on half-open probe, got %v\n", err)
		return
	}

	// 阶段 5：再次验证正常通过
	err = cb.Call(okFn)
	if err != nil {
		fmt.Printf("FAIL: expected success after recovery, got %v\n", err)
		return
	}

	fmt.Println("PASS: circuit breaker state transitions correct")
}
