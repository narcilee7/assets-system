# Go Systemd Deployment

在 Linux 服务器上，systemd 是管理 Go 服务的标准方式。

## Service 配置

```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=My Go API Service
After=network.target

[Service]
Type=simple
User=app
Group=app
WorkingDirectory=/opt/myapp
ExecStart=/opt/myapp/myapp
Restart=on-failure
RestartSec=5
Environment="DATABASE_URL=postgres://localhost:5432/myapp"
Environment="LOG_LEVEL=info"

# 资源限制
LimitNOFILE=65536
MemoryLimit=512M
CPUQuota=200%

# 优雅关闭
TimeoutStopSec=30
KillSignal=SIGTERM

[Install]
WantedBy=multi-user.target
```

## 管理命令

```bash
sudo systemctl daemon-reload
sudo systemctl enable myapp
sudo systemctl start myapp
sudo systemctl status myapp
sudo systemctl restart myapp
sudo journalctl -u myapp -f
```

## Graceful Shutdown

```go
// graceful_shutdown.go
package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	srv := &http.Server{Addr: ":8080", Handler: router}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s\n", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}
	log.Println("Server exited")
}
```
