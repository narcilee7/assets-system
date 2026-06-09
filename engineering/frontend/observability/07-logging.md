# 日志管理

## 1. 结构化日志

```javascript
// ❌ 非结构化日志
console.log('User login failed:', userId, error.message);

// ✅ 结构化日志
log.info({
  event: 'user_login',
  outcome: 'failure',
  userId,
  error: error.message,
  timestamp: new Date().toISOString(),
  traceId: getTraceId(),
});
```

## 2. 日志级别

```javascript
const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4 };

class Logger {
  constructor(options = {}) {
    this.level = LEVELS[options.level] ?? LEVELS.INFO;
    this.handlers = options.handlers || [consoleHandler];
    this.context = options.context || {};
  }

  log(level, message, meta = {}) {
    if (LEVELS[level] < this.level) return;

    const entry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.context,
      ...meta,
    };

    this.handlers.forEach((h) => h(entry));
  }

  debug(msg, meta) { this.log('DEBUG', msg, meta); }
  info(msg, meta) { this.log('INFO', msg, meta); }
  warn(msg, meta) { this.log('WARN', msg, meta); }
  error(msg, meta) { this.log('ERROR', msg, meta); }
  fatal(msg, meta) { this.log('FATAL', msg, meta); }

  child(context) {
    return new Logger({
      level: Object.keys(LEVELS).find((k) => LEVELS[k] === this.level),
      handlers: this.handlers,
      context: { ...this.context, ...context },
    });
  }
}

// 使用
const logger = new Logger({ level: 'INFO', context: { app: 'my-app', version: '1.2.3' } });
const userLogger = logger.child({ userId: 'abc123' });

userLogger.info('User action', { action: 'click_buy', productId: 'p456' });
// {
//   level: 'INFO',
//   message: 'User action',
//   timestamp: '2024-01-15T10:30:00Z',
//   app: 'my-app',
//   version: '1.2.3',
//   userId: 'abc123',
//   action: 'click_buy',
//   productId: 'p456'
// }
```

## 3. 日志采样

```javascript
// 高频日志采样（避免淹没监控系统）
class SampledLogger {
  constructor(logger, rate = 0.1) {
    this.logger = logger;
    this.rate = rate;
    this.counters = new Map();
  }

  log(level, message, meta) {
    const key = `${level}:${message}`;
    const count = (this.counters.get(key) || 0) + 1;
    this.counters.set(key, count);

    // 每 N 条记录 1 条，但总是记录第一条和最后一条
    if (count === 1 || count % Math.ceil(1 / this.rate) === 0) {
      this.logger.log(level, message, { ...meta, sampleRate: this.rate, sampleCount: count });
    }
  }
}
```

## 4. 日志脱敏

```javascript
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'creditCard', 'ssn', 'phone'];

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key of Object.keys(sanitized)) {
    if (SENSITIVE_FIELDS.some((f) => key.toLowerCase().includes(f))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitize(sanitized[key]);
    }
  }

  return sanitized;
}

// 自动脱敏所有上报数据
function safeReport(data) {
  report(sanitize(data));
}
```
