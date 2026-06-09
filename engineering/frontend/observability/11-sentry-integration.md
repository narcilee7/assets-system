# Sentry 深度集成

## 1. 基础配置

```javascript
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/browser';

Sentry.init({
  dsn: 'https://xxx@o0.ingest.sentry.io/0',
  environment: process.env.NODE_ENV,
  release: process.env.RELEASE_VERSION,
  integrations: [
    new BrowserTracing({
      tracePropagationTargets: ['localhost', /^https:\/\/api\.example\.com/],
    }),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  tracesSampleRate: 1.0,      // 性能追踪采样率
  replaysSessionSampleRate: 0.1,   // Session Replay 采样率
  replaysOnErrorSampleRate: 1.0,   // 错误时自动录制 Replay

  beforeSend(event, hint) {
    // 过滤敏感信息
    if (event.exception) {
      event.exception.values?.forEach((value) => {
        if (value.stacktrace) {
          value.stacktrace.frames = value.stacktrace.frames.map((frame) => {
            if (frame.vars?.password) frame.vars.password = '***';
            return frame;
          });
        }
      });
    }
    return event;
  },
});
```

## 2. 上下文与标签

```javascript
// 设置用户信息
Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.name,
  segment: user.plan,  // 分组
});

// 设置标签
Sentry.setTag('page', 'checkout');
Sentry.setTag('ab_test', 'variant_b');

// 设置上下文
Sentry.setContext('cart', {
  items: cart.items.length,
  total: cart.total,
  currency: 'USD',
});

// 面包屑（用户操作路径）
Sentry.addBreadcrumb({
  category: 'navigation',
  message: 'User navigated to checkout',
  level: 'info',
  data: { from: '/cart', to: '/checkout' },
});

Sentry.addBreadcrumb({
  category: 'ui.click',
  message: 'User clicked apply coupon',
  level: 'info',
  data: { couponCode: 'SUMMER20' },
});
```

## 3. 自定义错误捕获

```javascript
// 捕获特定错误
try {
  await processPayment();
} catch (error) {
  Sentry.captureException(error, {
    tags: { component: 'PaymentForm' },
    extra: { orderId, amount },
  });
}

// 捕获消息（非错误）
Sentry.captureMessage('Slow API response', {
  level: 'warning',
  extra: { endpoint, duration: 5000 },
});

// 手动设置事件级别
Sentry.withScope((scope) => {
  scope.setLevel('fatal');
  scope.setTag('area', 'checkout');
  Sentry.captureException(new Error('Payment gateway down'));
});
```

## 4. Source Map 上传

```bash
# 安装 sentry-cli
npm install -g @sentry/cli

# 配置
export SENTRY_AUTH_TOKEN=your-token
export SENTRY_ORG=your-org
export SENTRY_PROJECT=your-project

# 创建 release
sentry-cli releases new "1.2.3"

# 上传 source map
sentry-cli releases files "1.2.3" upload-sourcemaps ./dist \
  --url-prefix '~/static/' \
  --validate

# 关联 commits（可选）
sentry-cli releases set-commits "1.2.3" --auto

# 部署标记
sentry-cli releases deploys "1.2.3" new -e production
```

## 5. React Error Boundary

```javascript
import * as Sentry from '@sentry/react';

const SentryErrorBoundary = Sentry.withErrorBoundary(App, {
  fallback: <ErrorFallback />,
  showDialog: true,  // 显示用户反馈对话框
  dialogOptions: {
    title: '出错了',
    subtitle: '我们的团队已经收到通知',
    subtitle2: '请告诉我们发生了什么',
    labelName: '姓名',
    labelEmail: '邮箱',
    labelComments: '描述',
    labelClose: '关闭',
    labelSubmit: '提交',
  },
});
```
