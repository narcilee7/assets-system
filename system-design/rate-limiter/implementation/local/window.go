package local

import (
	"context"
	"sync"
	"time"
)

// SlidingWindow 单机滑动窗口
type SlidingWindow struct {
	limit      int64
	windowSize int64 // 窗口大小（毫秒）
	subWindow  int64 // 子窗口大小（毫秒）

	mu         sync.Mutex
	counts     map[int64]int64 // 子窗口 -> 计数
	lastWindow int64           // 最新子窗口
}

// NewSlidingWindow 创建滑动窗口
// limit: 窗口内最大请求数
// windowSize: 窗口大小
func NewSlidingWindow(limit int64, windowSize time.Duration) *SlidingWindow {
	sub := windowSize / 10 // 10个子窗口
	if sub < time.Millisecond {
		sub = time.Millisecond
	}
	return &SlidingWindow{
		limit:      limit,
		windowSize: int64(windowSize / time.Millisecond),
		subWindow:  int64(sub / time.Millisecond),
		counts:     make(map[int64]int64),
	}
}

func (w *SlidingWindow) nowMs() int64 {
	return time.Now().UnixMilli()
}

func (w *SlidingWindow) subWindowKey(ts int64) int64 {
	return ts / w.subWindow * w.subWindow
}

// Allow 判断是否允许通过
func (w *SlidingWindow) Allow(n int64) bool {
	w.mu.Lock()
	defer w.mu.Unlock()

	now := w.nowMs()
	currentSub := w.subWindowKey(now)

	// 清理过期窗口
	cutoff := now - w.windowSize
	for k := range w.counts {
		if k < cutoff {
			delete(w.counts, k)
		}
	}

	// 计算当前窗口总请求数
	var total int64
	for k, v := range w.counts {
		if k >= cutoff {
			total += v
		}
	}

	if total+n > w.limit {
		return false
	}

	w.counts[currentSub] += n
	w.lastWindow = currentSub
	return true
}

// Status 返回当前状态
func (w *SlidingWindow) Status() (remaining int64, resetAt int64) {
	w.mu.Lock()
	defer w.mu.Unlock()

	now := w.nowMs()
	cutoff := now - w.windowSize
	var total int64
	for k, v := range w.counts {
		if k >= cutoff {
			total += v
		}
	}

	remaining = max(0, w.limit-total)
	// 下一个子窗口的结束时间
	nextSub := w.subWindowKey(now) + w.subWindow
	resetAt = nextSub
	return remaining, resetAt
}

// SlidingWindowLimiter 适配统一接口
type SlidingWindowLimiter struct {
	window *SlidingWindow
	limit  int64
}

func NewSlidingWindowLimiter(limit int64, windowSize time.Duration) *SlidingWindowLimiter {
	return &SlidingWindowLimiter{
		window: NewSlidingWindow(limit, windowSize),
		limit:  limit,
	}
}

func (l *SlidingWindowLimiter) Allow(ctx context.Context) (bool, int64, int64) {
	ok := l.window.Allow(1)
	remaining, resetAt := l.window.Status()
	return ok, remaining, resetAt
}

func (l *SlidingWindowLimiter) Limit() int64 { return l.limit }
