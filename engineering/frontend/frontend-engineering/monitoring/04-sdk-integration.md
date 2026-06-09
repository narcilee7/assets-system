# SDK 集成工程化

## 1. Sentry 集成配置

```javascript
// sentry.config.ts
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.APP_VERSION,

  // 采样率
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.01,      // 1% 会话录制
  replaysOnErrorSampleRate: 1.0,        // 错误时 100% 录制

  // 集成
  integrations: [
    new BrowserTracing({
      routingInstrumentation: Sentry.reactRouterV6Instrumentation(
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes
      ),
    }),
    new Sentry.Replay({
      maskAllText: true,      // 脱敏：遮罩所有文本
      blockAllMedia: true,    // 脱敏：不录制媒体
    }),
  ],

  // 过滤敏感错误
  beforeSend(event) {
    // 忽略第三方脚本错误
    if (event.exception?.values?.[0]?.stacktrace?.frames?.[0]?.filename?.includes('chrome-extension')) {
      return null;
    }

    // 忽略已知无害错误
    const knownErrors = ['ResizeObserver loop limit exceeded'];
    if (knownErrors.some((e) => event.message?.includes(e))) {
      return null;
    }

    return event;
  },

  // 添加上下文
  beforeSend(event) {
    event.tags = {
      ...event.tags,
      appVersion: process.env.APP_VERSION,
      buildTime: process.env.BUILD_TIME,
    };
    return event;
  },
});
```

## 2. Source Map 上传（CI 流程）

```yaml
# .github/workflows/sourcemap.yml
name: Upload Source Maps
on:
  release:
    types: [published]
jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build

      # 上传 Source Map 到 Sentry
      - name: Upload Source Maps
        run: |
          npm install -g @sentry/cli
          sentry-cli sourcemaps upload dist/ \
            --release=${{ github.ref_name }} \
            --url-prefix='~/'
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: my-org
          SENTRY_PROJECT: my-project

      # 删除 Source Map 文件（不暴露给用户）
      - name: Remove Source Maps
        run: find dist/ -name '*.map' -delete

      # 部署产物（此时已无 .map 文件）
      - name: Deploy
        run: npm run deploy
```

## 3. 隐私过滤

```javascript
// 过滤敏感信息
Sentry.init({
  beforeSend(event) {
    // 过滤 URL 中的 token
    if (event.request?.url) {
      event.request.url = event.request.url.replace(/token=[^&]+/, 'token=***');
    }

    // 过滤请求头中的 Cookie
    if (event.request?.headers) {
      delete event.request.headers.Cookie;
      delete event.request.headers.Authorization;
    }

    // 过滤面包屑中的敏感信息
    event.breadcrumbs = event.breadcrumbs?.map((crumb) => {
      if (crumb.category === 'xhr') {
        crumb.data = sanitizeData(crumb.data);
      }
      return crumb;
    });

    return event;
  },
});

function sanitizeData(data) {
  if (!data) return data;
  const sensitiveKeys = ['password', 'token', 'secret', 'creditCard', 'ssn'];
  const sanitized = { ...data };
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = '***';
    }
  }
  return sanitized;
}
```

## 4. 多环境隔离

```javascript
// 不同环境使用不同 DSN 和采样率
const config = {
  development: {
    dsn: null,  // 开发环境不上报
    tracesSampleRate: 0,
  },
  staging: {
    dsn: process.env.SENTRY_DSN_STAGING,
    tracesSampleRate: 1.0,  // 全量采样用于测试
  },
  production: {
    dsn: process.env.SENTRY_DSN_PRODUCTION,
    tracesSampleRate: 0.1,  // 生产环境 10% 采样
  },
};

const env = process.env.NODE_ENV;
Sentry.init(config[env] || config.production);
```

## 5. 监控质量指标

```javascript
// 计算监控系统的覆盖率和误报率
class MonitoringQuality {
  constructor() {
    this.captured = 0;    // 捕获的错误数
    this.reported = 0;    // 上报的错误数
    this.falsePositives = 0;  // 误报数
  }

  // 标记已知错误（用于计算捕获率）
  markKnownError() {
    this.captured++;
  }

  // 标记已上报
  markReported() {
    this.reported++;
  }

  // 标记误报（如第三方脚本错误）
  markFalsePositive() {
    this.falsePositives++;
  }

  getMetrics() {
    return {
      captureRate: this.captured > 0 ? this.reported / this.captured : 0,
      falsePositiveRate: this.reported > 0 ? this.falsePositives / this.reported : 0,
      totalCaptured: this.captured,
      totalReported: this.reported,
    };
  }
}
```
