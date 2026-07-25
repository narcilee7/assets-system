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