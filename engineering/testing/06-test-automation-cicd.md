# 测试自动化与 CI/CD

## 1. CI/CD 流水线中的测试

```
测试流水线设计

代码提交
    │
    ▼
┌─────────────┐
│  Lint + Type Check │  < 30s
│  (ESLint/tsc)       │
└─────────────┘
    │
    ▼
┌─────────────┐
│  单元测试    │  < 2min
│  (并行)      │  覆盖率报告
└─────────────┘
    │
    ▼
┌─────────────┐
│  集成测试    │  < 5min
│  (测试容器)   │
└─────────────┘
    │
    ▼
┌─────────────┐
│  构建镜像    │
└─────────────┘
    │
    ▼
┌─────────────┐
│  E2E 测试    │  < 10min
│  (staging)   │
└─────────────┘
    │
    ▼
┌─────────────┐
│  部署        │
└─────────────┘

关键原则
├── 快速反馈：单元测试 < 2min，整个流水线 < 15min
├── 并行执行：利用 CI 并行化缩短时间
├── 失败即停：早期阶段失败不运行后续阶段
├── 制品保留：测试报告、覆盖率、日志
└── 环境一致：开发/CI/staging/生产尽量一致
```

```yaml
# GitHub Actions 示例
name: CI

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  integration-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:integration
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/test

  e2e-test:
    runs-on: ubuntu-latest
    needs: [unit-test, integration-test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## 2. 并行测试执行

```bash
# Jest 并行
jest --maxWorkers=4
jest --runInBand  # 串行（CI 内存受限时）

# pytest 并行
pytest -n auto  # pytest-xdist
pytest -n 4

# Go 并行
go test -parallel 4 ./...

# Playwright 并行
# playwright.config.ts
export default defineConfig({
  workers: process.env.CI ? 4 : undefined,
  fullyParallel: true,
});
```

## 3. Flaky 测试处理

```
Flaky 测试：偶尔失败、偶尔通过的测试

危害
├── 摧毁团队对测试的信心
├── 浪费调试时间
├── 阻塞 CI/CD
└── 掩盖真正的问题

常见原因
├── 时间依赖：setTimeout、Date.now()
├── 异步竞争：回调顺序不确定
├── 外部依赖：网络、数据库、文件系统
├── 全局状态：测试间共享状态
├── 随机数据：未固定的随机种子
└── 资源竞争：端口冲突、文件锁

检测
├── 重跑统计：自动重跑 N 次，记录失败率
├── 持续跟踪：标记 flaky 测试
└── 工具：Jest --detectOpenHandles、pytest-flakefinder

处理策略
1. 立即隔离：标记为 skip 或单独运行
2. 根因分析：找到不稳定因素
3. 修复：
   ├── Mock 时间/随机数
   ├── 清理全局状态
   ├── 增加等待条件（而非固定 sleep）
   ├── 使用测试容器隔离资源
4. 监控：修复后持续观察
5. 零容忍政策：不允许合并 flaky 测试
```

```typescript
// 避免 flaky：用等待代替 sleep
// 差：
await page.click('button');
await sleep(1000);  // 时快时慢
await expect(page.locator('.result')).toBeVisible();

// 好：
await page.click('button');
await expect(page.locator('.result')).toBeVisible({ timeout: 5000 });

// 避免 flaky：清理全局状态
afterEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

// 标记 flaky（临时措施）
test.flaky('sometimes fails due to race condition', async () => {
  // 已知 flaky，正在修复
});
```

```yaml
# CI 中自动检测 flaky
# .github/workflows/flaky-detection.yml
name: Flaky Test Detection
on:
  schedule:
    - cron: '0 2 * * *'  # 每天凌晨运行

jobs:
  detect:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        run: [1, 2, 3, 4, 5]  # 运行 5 次
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
      - if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: flaky-run-${{ matrix.run }}
          path: test-results/
```

## 4. 测试报告与监控

```
测试报告
├── JUnit XML：CI 解析标准格式
├── HTML 报告：本地查看详情
├── Coverage 报告：行/分支覆盖率趋势
├── Allure：美观的测试报告
└── Test Analytics：CircleCI / GitHub Insights

测试监控指标
├── 测试总数趋势
├── 测试执行时间趋势
├── 失败率趋势
├── 覆盖率趋势
├── flaky 测试列表
└── 最慢测试 TOP 10
```

```typescript
// Jest JUnit 输出
// jest.config.js
module.exports = {
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './reports',
      outputName: 'junit.xml',
    }],
  ],
};
```
