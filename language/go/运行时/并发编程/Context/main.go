package main

import (
	"context"
	"fmt"
	"time"
)

type valueCtx struct {
	context.Context
	key, value interface{}
}

func (c *valueCtx) Value(key interface{}) interface{} {
	if c.key == key {
		return c.value
	}
	return c.Context.Value(key)
}

func main() {
	// 过期时间1s，处理时间500ms
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	// go handle(ctx, 1500*time.Millisecond)
	go handle(ctx, 500*time.Microsecond)
	select {
	case <-ctx.Done():
		fmt.Println("main", ctx.Err())
	}
}

func handle(ctx context.Context, duration time.Duration) {
	select {
	case <-ctx.Done():
		fmt.Println("handle", ctx.Err())
	case <-time.After(duration):
		fmt.Println("process request with", duration)
	}
}