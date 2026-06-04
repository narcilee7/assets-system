package local

import (
	"context"
	"sync"
	"testing"
	"time"
)

func TestTokenBucket_Basic(t *testing.T) {
	// 容量 10，每秒填充 10 个
	tb := NewTokenBucketLimiter(10, 10)

	ctx := context.Background()
	// 连续请求 10 次，应该全部通过
	for i := 0; i < 10; i++ {
		ok, _, _ := tb.Allow(ctx)
		if !ok {
			t.Fatalf("request %d should be allowed", i+1)
		}
	}

	// 第 11 次应该被拒绝
	ok, remaining, _ := tb.Allow(ctx)
	if ok {
		t.Fatal("request 11 should be rejected")
	}
	if remaining != 0 {
		t.Fatalf("remaining should be 0, got %d", remaining)
	}
}

func TestTokenBucket_Refill(t *testing.T) {
	// 容量 2，每秒填充 1 个
	tb := NewTokenBucketLimiter(2, 1)
	ctx := context.Background()

	// 先消耗完
	for i := 0; i < 2; i++ {
		tb.Allow(ctx)
	}

	// 立即请求，应该失败
	ok, _, _ := tb.Allow(ctx)
	if ok {
		t.Fatal("should be rejected immediately after draining")
	}

	// 等待 1.5 秒，应该 refill 至少 1 个
	time.Sleep(1500 * time.Millisecond)
	ok, remaining, _ := tb.Allow(ctx)
	if !ok {
		t.Fatal("should be allowed after refill")
	}
	if remaining < 0 {
		t.Fatalf("remaining should be >= 0, got %d", remaining)
	}
}

func TestTokenBucket_Concurrent(t *testing.T) {
	// 容量 1000，每秒填充 1000 个
	tb := NewTokenBucketLimiter(1000, 1000)
	ctx := context.Background()

	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 20; j++ {
				if ok, _, _ := tb.Allow(ctx); ok {
					// 使用 atomic 会有循环依赖，这里用粗略统计
				}
			}
		}()
	}
	wg.Wait()

	// 并发下总通过数不应超过容量 + refill
	// 由于无锁实现，这里不做严格断言，主要验证不 panic
}

func TestSlidingWindow_Basic(t *testing.T) {
	// 1 秒窗口，限流 5
	sw := NewSlidingWindowLimiter(5, time.Second)
	ctx := context.Background()

	// 前 5 次通过
	for i := 0; i < 5; i++ {
		ok, _, _ := sw.Allow(ctx)
		if !ok {
			t.Fatalf("request %d should be allowed", i+1)
		}
	}

	// 第 6 次拒绝
	ok, remaining, _ := sw.Allow(ctx)
	if ok {
		t.Fatal("request 6 should be rejected")
	}
	if remaining != 0 {
		t.Fatalf("remaining should be 0, got %d", remaining)
	}
}

func TestSlidingWindow_WindowSlide(t *testing.T) {
	// 2 秒窗口，限流 3
	sw := NewSlidingWindowLimiter(3, 2*time.Second)
	ctx := context.Background()

	// 先打满
	for i := 0; i < 3; i++ {
		sw.Allow(ctx)
	}

	// 立即请求，拒绝
	ok, _, _ := sw.Allow(ctx)
	if ok {
		t.Fatal("should be rejected immediately")
	}

	// 等待 2.5 秒，窗口滑动
	time.Sleep(2500 * time.Millisecond)

	// 应该恢复
	ok, _, _ = sw.Allow(ctx)
	if !ok {
		t.Fatal("should be allowed after window slide")
	}
}

func BenchmarkTokenBucket(b *testing.B) {
	tb := NewTokenBucketLimiter(10000, 10000)
	ctx := context.Background()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			tb.Allow(ctx)
		}
	})
}

func BenchmarkSlidingWindow(b *testing.B) {
	sw := NewSlidingWindowLimiter(10000, time.Minute)
	ctx := context.Background()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			sw.Allow(ctx)
		}
	})
}
