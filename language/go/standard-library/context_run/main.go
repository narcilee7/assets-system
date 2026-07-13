package main

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// 1. context 超时控制
// func slowAPI(ctx context.Context) (string, error) {
// 	select {
// 	case <-time.After(3 * time.Second):
// 		return "success", nil
// 	case <- ctx.Done():
// 		return "", ctx.Err()
// 	}
// }

// func main() {
// 	ctx, cancel := context.WithTimeout(context.Background(), 3 *time.Second)
// 	defer cancel()

// 	result, err := slowAPI(ctx)
// 	if err != nil {
// 		fmt.Println("failed", err)
// 	}
// 	fmt.Println("result: ",result)
// }

// 2. 手动取消
// func worker(ctx context.Context, id int) {
// 	for {
// 		select {
// 		case <- ctx.Done():
// 			fmt.Printf("workder: %d: get sign, quit\n", id)
// 			return
// 		default:
// 			fmt.Printf("worker is working, id: %d\n", id)
// 			time.Sleep(500 * time.Millisecond)
// 		}
// 	}
// }

// func main() {
// 	ctx, cancel := context.WithCancel(context.Background())

// 	defer cancel()
// 	for i := 0; i < 3; i++ {
// 		go worker(ctx, i)
// 	}

// 	time.Sleep(1 * time.Second)
// 	fmt.Println("main: sent sign")

// 	time.Sleep(500 * time.Millisecond)
// }

// 3. 定时任务

// func main() {
// 	ddl := time.Date(2026, 7, 13, 10, 43, 1, 10, time.Local)

// 	ctx, cancel := context.WithDeadline(context.Background(), ddl)

// 	defer cancel()

// 	select {
// 	case <-time.After(2 * time.Second):
// 		fmt.Println("done")
// 	case <-ctx.Done():
// 		fmt.Println("timeouot: ", ctx.Err())
// 	}
// }

// type contextKey string

// const (
// 	traceIDKey contextKey = "traceID"
// 	userIDKey contextKey = "userID"
// )

// func middleware(ctx context.Context) context.Context {
// 	ctx = context.WithValue(ctx, traceIDKey, "tace-id-123")
// 	ctx = context.WithValue(ctx, userIDKey, 12)
// 	return ctx
// }

// func service(ctx context.Context) {
// 	traceID, _ := ctx.Value(traceIDKey).(string)
// 	userID, _ := ctx.Value(userIDKey).(string)

// 	fmt.Printf("get queuest: traceId=%s, userID=%s\n", traceID, userID)
// }

// func main() {
// 	ctx := context.Background()
// 	ctx = middleware(ctx)
// 	service(ctx)
// }

// func subTask(ctx context.Context, name string, duration time.Duration) {
// 	select {
// 	case <- time.After(duration):
// 		fmt.Printf("%s done \n", name)
// 	case <- ctx.Done():
// 		fmt.Printf("%s: 被父context取消 (%v) \n", name, ctx.Err())
// 	}
// }

// func main() {
// 	ctx, cancel := context.WithTimeout(context.Background(), 1500*time.Millisecond)
// 	defer cancel()

// 	go subTask(ctx, "Task-A", 1*time.Second)
// 	go subTask(ctx, "Task-B", 2*time.Second)

// 	time.Sleep(3 * time.Second)
// }

// func main() {
// 	db, _ := sql.Open("sqlite3", ":memory:")
// 	defer db.Close()

// 	// 查询必须在 2 秒内完成
// 	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
// 	defer cancel()

// 	var result int
// 	err := db.QueryRowContext(ctx, "SELECT 1").Scan(&result)
// 	if err != nil {
// 		panic(err)
// 	}
// }

// func main() {
// 	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
// 	defer stop()

// 	go func() {
// 		for {
// 			select {
// 			case <- ctx.Done():
// 				fmt.Println("get close ginal, clearing...")
// 				time.Sleep(1 * time.Second)
// 				fmt.Println("cleared, quit")
// 				return
// 			default:
// 				fmt.Println("server is running...")
// 				time.Sleep(500 * time.Millisecond)
// 			}
// 		}
// 	}()

// 	<-ctx.Done()
// 	fmt.Println("main quit.")
// }

// worker Pool
// func workerPool(ctx context.Context, jobs <- chan int, wg *sync.WaitGroup) {
// 	defer wg.Done()
// 	for {
// 		select{
// 		case j, ok := <-jobs:
// 			if !ok {
// 				return
// 			}
// 			fmt.Printf("process task %d\n", j)
// 			time.Sleep(100 * time.Millisecond)
// 		case <-ctx.Done():
// 			fmt.Println("worker quit globaly")
// 			return
// 		}
// 	}
// }

// func main() {
// 	ctx, cancel := context.WithCancel(context.Background())
// 	jobs := make(chan int, 10)
// 	var wg sync.WaitGroup

// 	for i := 0; i < 3; i++ {
// 		wg.Add(1)
// 		go workerPool(ctx, jobs, &wg)
// 	}

// 	for i := 0; i < 10; i++ {
// 		jobs <- i
// 	}

// 	time.Sleep(2 * time.Second)
// 	fmt.Println("send global quit")
// 	cancel()

// 	close(jobs)

// 	wg.Wait()

// 	fmt.Println("quit all")
// }


var errFail = errors.New("called error")

func unstableCall() error {
	if time.Now().UnixNano()%10 < 7 {
		return errFail
	}
	return nil
}

func retryWithContext(ctx context.Context, maxRetries int) error {
	for i := 0; i < maxRetries; i++ {
		select {
		case <-ctx.Done():
			return fmt.Errorf("重试耗尽的总时间：%w", ctx.Err())
		default:
			fmt.Println("running...")
		}
		if err := unstableCall(); err == nil {
			return nil
		}
		fmt.Printf("第 %d times retry failed", i + 1)
		time.Sleep(300 * time.Millisecond)
	}
	return errors.New("达到重试次数")
}
// func main() {
// 	ctx, cancel := context.WithTimeout(context.Background(), 2 * time.Second)
// 	defer cancel()

// 	if err := retryWithContext(ctx, 5); err != nil {
// 		fmt.Println("finally failed: ", err)
// 	} else {
// 		fmt.Println("success")
// 	}
// }

// func safeDo(ctx context.Context) {
// 	if ctx == nil {
// 		ctx = context.Background()
// 	}
// 	select {
// 	case <- ctx.Done():
// 		fmt.Println("取消：", ctx.Err())
// 	default:
// 		fmt.Println("正常执行")
// 	}
// }

// func main() {
// 	safeDo(nil)
// 	safeDo(context.Background())
// }