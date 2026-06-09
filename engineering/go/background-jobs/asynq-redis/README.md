# Asynq (Redis Queue)

Asynq 是 Go 的分布式任务队列，基于 Redis，API 设计类似 Python Celery。

## 核心实现

```go
// asynq_example.go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/hibiken/asynq"
)

const (
	TypeEmailDelivery = "email:deliver"
	TypeImageResize   = "image:resize"
)

type EmailDeliveryPayload struct {
	UserID     int
	TemplateID string
}

// Redis 连接配置
func getRedisClientOpt() asynq.RedisClientOpt {
	return asynq.RedisClientOpt{Addr: "localhost:6379"}
}

// Worker 处理器
func HandleEmailDelivery(ctx context.Context, t *asynq.Task) error {
	var p EmailDeliveryPayload
	if err := json.Unmarshal(t.Payload(), &p); err != nil {
		return fmt.Errorf("json.Unmarshal failed: %v: %w", err, asynq.SkipRetry)
	}
	log.Printf("Sending Email to User: user_id=%d, template_id=%s", p.UserID, p.TemplateID)
	// 发送邮件逻辑
	return nil
}

func main() {
	// 启动 Worker
	srv := asynq.NewServer(
		getRedisClientOpt(),
		asynq.Config{
			Concurrency: 10,
			Queues: map[string]int{
				"critical": 6,
				"default":  3,
				"low":      1,
			},
		},
	)

	mux := asynq.NewServeMux()
	mux.HandleFunc(TypeEmailDelivery, HandleEmailDelivery)

	if err := srv.Run(mux); err != nil {
		log.Fatalf("could not run server: %v", err)
	}
}

// Client 发布任务
func enqueueEmail(client *asynq.Client, userID int, templateID string) {
	payload, _ := json.Marshal(EmailDeliveryPayload{UserID: userID, TemplateID: templateID})
	task := asynq.NewTask(TypeEmailDelivery, payload)

	info, err := client.Enqueue(task, asynq.Queue("critical"), asynq.MaxRetry(5))
	if err != nil {
		log.Fatalf("could not enqueue task: %v", err)
	}
	log.Printf("enqueued task: id=%s queue=%s", info.ID, info.Queue)
}
```

## 定时任务

```go
// 使用 asynq/scheduler
scheduler := asynq.NewScheduler(getRedisClientOpt(), nil)

// 每5分钟执行一次
entryID, err := scheduler.Register("*/5 * * * *", asynq.NewTask("cleanup", nil))

scheduler.Run()
```
