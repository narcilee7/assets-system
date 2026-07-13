package retry

import (
	"context"
	"errors"
	"fmt"
	"math"
	"math/rand"
	"time"
)

// ErrMaxRetries 超过最大重试次数
var ErrMaxRetries = errors.New("max retries exceeded")

// Policy 定义重试策略
type Policy struct {
	// MaxRetries: 最大重试次数，0 表示只执行一次
	MaxRetries int
	// BaseDelay: 第一次重试的等待时间
	BaseDelay time.Duration
	// MaxDelay: 单次等待上限
	MaxDelay time.Duration
	// Multiplier: 指数退避乘数，通常 2
	Multiplier float64
	// Jitter: 是否启用抖动（防止惊群）
	Jitter float64 // 0~1，表示在计算出的 delay 基础上随机波动比例
	// Retryable: 判断错误是否可重试；nil 表示所有错误都重试
	Retryable func(error) bool
}

// DefaultPolicy 一个合理的默认配置
var DefaultPolicy = Policy{
	MaxRetries: 3,
	BaseDelay:  100 * time.Millisecond,
	MaxDelay:   10 * time.Second,
	Multiplier: 2.0,
	Jitter:     0.2, // 20% 抖动
}

// Do 执行带重试的函数
// fn 返回的 error 如果是 nil，直接成功返回
// 如果 fn 返回 error，根据 Policy 判断是否重试
func Do(ctx context.Context, p Policy, fn func() error) error {
	if p.MaxRetries < 0 {
		p.MaxRetries = 0
	}
	if p.BaseDelay <= 0 {
		p.BaseDelay = DefaultPolicy.BaseDelay
	}
	if p.MaxDelay <= 0 {
		p.MaxDelay = DefaultPolicy.MaxDelay
	}
	if p.Multiplier <= 1 {
		p.Multiplier = DefaultPolicy.Multiplier
	}

	var lastErr error

	for attempt := 0; attempt <= p.MaxRetries; attempt++ {
		// 每次尝试前检查 context
		if err := ctx.Err(); err != nil {
			// 把根因带出来，不吞
			return fmt.Errorf("retry interrupted at attempt %d: %w (last error: %v)", attempt, err, lastErr)
		}

		err := fn()
		if err == nil {
			return nil // 成功
		}

		lastErr = err

		// 判断是否需要重试
		if p.Retryable != nil && !p.Retryable(err) {
			// 不可重试的错误，直接返回，不包装成 ErrMaxRetries
			return fmt.Errorf("non-retryable error at attempt %d: %w", attempt, err)
		}

		// 最后一次不需要等了
		if attempt == p.MaxRetries {
			break
		}

		// 计算退避时间
		delay := backoffDelay(attempt, p)

		// 用 context 可中断的 sleep
		if err := sleepCtx(ctx, delay); err != nil {
			return fmt.Errorf("retry sleep interrupted at attempt %d: %w (last error: %w)", attempt+1, err, lastErr)
		}
	}

	// 所有重试耗尽
	return fmt.Errorf("%w after %d attempts: %w", ErrMaxRetries, p.MaxRetries+1, lastErr)
}

// DoWithResult 带返回值版本
func DoWithResult[T any](ctx context.Context, p Policy, fn func() (T, error)) (T, error) {
	var zero T
	if p.MaxRetries < 0 {
		p.MaxRetries = 0
	}
	if p.BaseDelay <= 0 {
		p.BaseDelay = DefaultPolicy.BaseDelay
	}
	if p.MaxDelay <= 0 {
		p.MaxDelay = DefaultPolicy.MaxDelay
	}
	if p.Multiplier <= 1 {
		p.Multiplier = DefaultPolicy.Multiplier
	}

	var lastErr error

	for attempt := 0; attempt <= p.MaxRetries; attempt++ {
		if err := ctx.Err(); err != nil {
			return zero, fmt.Errorf("retry interrupted at attempt %d: %w (last error: %v)", attempt, err, lastErr)
		}

		res, err := fn()
		if err == nil {
			return res, nil
		}

		lastErr = err

		if p.Retryable != nil && !p.Retryable(err) {
			return zero, fmt.Errorf("non-retryable error at attempt %d: %w", attempt, err)
		}

		if attempt == p.MaxRetries {
			break
		}

		delay := backoffDelay(attempt, p)
		if err := sleepCtx(ctx, delay); err != nil {
			return zero, fmt.Errorf("retry sleep interrupted at attempt %d: %w (last error: %w)", attempt+1, err, lastErr)
		}
	}

	return zero, fmt.Errorf("%w after %d attempts: %w", ErrMaxRetries, p.MaxRetries+1, lastErr)
}

// backoffDelay 计算第 attempt 次重试的等待时间（attempt 从 0 开始）
func backoffDelay(attempt int, p Policy) time.Duration {
	// 指数退避: base * multiplier^attempt
	delay := float64(p.BaseDelay) * math.Pow(p.Multiplier, float64(attempt))

	// 上限截断
	if delay > float64(p.MaxDelay) {
		delay = float64(p.MaxDelay)
	}

	// Jitter: 在 [delay*(1-jitter), delay*(1+jitter)] 之间随机
	if p.Jitter > 0 {
		half := delay * p.Jitter
		// rand 不是并发安全的，但这里每次调用都是独立的，问题不大
		// 生产环境建议用 crypto/rand 或全局 seeded source
		jittered := delay - half + 2*half*rand.Float64()
		delay = jittered
	}

	return time.Duration(delay)
}

// sleepCtx 可中断的 sleep
func sleepCtx(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

// IsRetryable 判断错误是否是重试耗尽导致的
func IsRetryable(err error) bool {
	return errors.Is(err, ErrMaxRetries)
}