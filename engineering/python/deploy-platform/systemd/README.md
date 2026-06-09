# Python Systemd Deployment

在 Linux 服务器上，systemd 是管理 Python 服务的标准方式。

## Service 配置

```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=My Python API Service
After=network.target

[Service]
Type=simple
User=app
Group=app
WorkingDirectory=/opt/myapp
Environment="DATABASE_URL=postgresql://localhost:5432/myapp"
Environment="PYTHONPATH=/opt/myapp"
Environment="PYTHONUNBUFFERED=1"

# 使用虚拟环境
ExecStart=/opt/myapp/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4

Restart=on-failure
RestartSec=5

# 资源限制
LimitNOFILE=65536
MemoryLimit=512M

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
sudo journalctl -u myapp -f
```

## 环境变量文件

```ini
# /etc/systemd/system/myapp.service.d/override.conf
[Service]
EnvironmentFile=/opt/myapp/.env
```
