# PM2 Process Management

PM2 是 Node.js 生产环境最常用的进程管理器，提供集群模式、日志切割、监控和自动重启。

## 配置文件

```js
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'api',
      script: './dist/main.js',
      instances: 'max', // 使用所有 CPU 核心
      exec_mode: 'cluster',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      merge_logs: true,
      kill_timeout: 5000,
      listen_timeout: 10000,
      // 平滑重启
      wait_ready: true,
      // 崩溃后延迟重启
      exp_backoff_restart_delay: 100,
    },
  ],
};
```

## 常用命令

```bash
pm2 start ecosystem.config.js
pm2 reload api          # 0-downtime reload
pm2 scale api +2        # 增加 2 个实例
pm2 monit               # 实时监控
pm2 logs api --lines 100
pm2 startup systemd     # 开机自启
pm2 save                # 保存当前进程列表
```

## 集群模式 vs Fork 模式

| 模式 | 适用 |
| --- | --- |
| cluster | 无状态 HTTP 服务，利用多核 |
| fork | 需要单一进程（如定时任务、WebSocket 服务） |

> 注意：cluster 模式不共享内存，WebSocket / SSE 需配合 Redis Adapter 使用。
