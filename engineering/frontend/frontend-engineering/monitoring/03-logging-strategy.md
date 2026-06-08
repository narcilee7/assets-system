# 日志策略

## 1. 日志分级

```javascript
// 日志级别（从低到高）
const LogLevel = {
  DEBUG: 0,   // 调试信息，开发环境使用
  INFO: 1,    // 一般信息，正常流程
  WARN: 2,    // 警告，不影响功能但需注意
  ERROR: 3,   // 错误，功能受影响
  FATAL: 4,   // 致命错误，系统不可用
};

class Logger {
  constructor(options = {}) {
    this.level = options.level || LogLevel.INFO;
    this.reporter = options.reporter;
    this.context = options.context || {};
  }

  log(level, message, meta = {}) {
    if (level < this.level) return;

    const entry = {
      level: Object.keys(LogLevel)[level],
      message,
      timestamp: Date.now(),
      context: { ...this.context, ...meta },
    };

    // 控制台输出
    const method = ['debug', 'info', 'warn', 'error', 'error'][level];
    console[method](`[${entry.level}]`, message, meta);

    // 上报（ERROR 及以上自动上报）
    if (level >= LogLevel.ERROR && this.reporter) {
      this.reporter(entry);
    }
  }

  debug(msg, meta) { this.log(LogLevel.DEBUG, msg, meta); }
  info(msg, meta) { this.log(LogLevel.INFO, msg, meta); }
  warn(msg, meta) { this.log(LogLevel.WARN, msg, meta); }
  error(msg, meta) { this.log(LogLevel.ERROR, msg, meta); }
  fatal(msg, meta) { this.log(LogLevel.FATAL, msg, meta); }

  // 创建子 Logger（带上下文）
  child(context) {
    return new Logger({
      level: this.level,
      reporter: this.reporter,
      context: { ...this.context, ...context },
    });
  }
}

// 使用
const logger = new Logger({
  level: process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.DEBUG,
  reporter: (entry) => {
    fetch('/api/log', { method: 'POST', body: JSON.stringify(entry) });
  },
  context: { userId: 'anonymous', sessionId: 'abc123' },
});

const authLogger = logger.child({ module: 'auth' });
authLogger.info('User logged in', { userId: 'user123' });
// 输出：[INFO] User logged in { module: 'auth', userId: 'user123', ... }
```

## 2. 采样策略

```javascript
// 按用户采样（固定比例）
function shouldSample(rate = 0.1) {
  const userId = getUserId();
  // 用用户 ID 的哈希值决定采样，保证同一用户始终采样或不采样
  const hash = hashString(userId);
  return (hash % 100) < (rate * 100);
}

// 按错误类型采样（高优先级错误全量）
function shouldReportError(error) {
  if (error.type === 'fatal') return true;       // 致命错误 100%
  if (error.type === 'js_error') return shouldSample(0.5);  // JS 错误 50%
  if (error.type === 'api_error') return shouldSample(0.1); // API 错误 10%
  return shouldSample(0.01);  // 其他 1%
}

// 按性能阈值采样（只上报异常值）
function shouldReportMetric(metric) {
  const thresholds = {
    LCP: 2500,
    FID: 100,
    CLS: 0.1,
  };
  return metric.value > (thresholds[metric.name] || Infinity);
}
```

## 3. 日志去重

```javascript
// 相同错误在短时间只上报一次
class ErrorDeduper {
  constructor(windowMs = 60000) {
    this.seen = new Map();
    this.windowMs = windowMs;
  }

  getKey(error) {
    // 用 message + stack 前 3 行作为指纹
    const stack = error.stack?.split('\n').slice(0, 3).join('\n') || '';
    return hashString(`${error.message}:${stack}`);
  }

  shouldReport(error) {
    const key = this.getKey(error);
    const lastSeen = this.seen.get(key);

    if (lastSeen && Date.now() - lastSeen < this.windowMs) {
      return false; // 去重窗口内，不上报
    }

    this.seen.set(key, Date.now());
    return true;
  }

  // 定期清理过期记录
  cleanup() {
    const now = Date.now();
    for (const [key, time] of this.seen.entries()) {
      if (now - time > this.windowMs) {
        this.seen.delete(key);
      }
    }
  }
}
```

## 4. 批量上报

```javascript
class BatchReporter {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 10;
    this.flushInterval = options.flushInterval || 5000;
    this.queue = [];
    this.timer = null;
  }

  add(entry) {
    this.queue.push(entry);

    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  flush() {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.batchSize);

    fetch('/api/log/batch', {
      method: 'POST',
      body: JSON.stringify(batch),
      keepalive: true,
    }).catch((err) => {
      // 失败时放回队列（有限重试）
      if (batch[0].retryCount < 3) {
        batch.forEach((e) => {
          e.retryCount = (e.retryCount || 0) + 1;
          this.queue.unshift(e);
        });
      }
    });

    clearTimeout(this.timer);
    this.timer = null;
  }
}
```
