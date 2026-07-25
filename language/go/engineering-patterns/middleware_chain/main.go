package main

import (
	"log/slog"
	"net/http"
	"os"
	"patterns/middleware_chain/middleware"
	"time"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	// 构造中间件链
	mws := middleware.Chain(
		middleware.Recovery(logger),
		middleware.Logger(logger),
		middleware.RequestID,
		middleware.Timeout(5*time.Second),
	)

	// 业务 handler
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 从 context 取 request_id
		if id, ok := r.Context().Value("request_id").(string); ok {
			logger.Info("handling", "id", id)
		}
		w.Write([]byte(`{"status":"ok"}`))
	})

	// 应用
	h := mws(handler)

	http.ListenAndServe(":8080", h)
}