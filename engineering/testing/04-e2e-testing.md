# E2E 测试

## 1. E2E 框架选择

```
主流 E2E 框架

Playwright（推荐）
├── 微软出品，维护活跃
├── 支持 Chromium/Firefox/WebKit
├── 自动等待、可靠的重试
├── 并行执行、Trace Viewer
├── API 测试 + UI 测试
└── 语言：JS/TS/Python/Java/C#

Cypress
├── 开发体验好，实时重载
├── 内置断言、Mock、截图
├── 只支持 Chromium 系浏览器
├── 不支持多标签页/多域名
└── 语言：JS/TS

Selenium WebDriver
├── 最老牌，浏览器支持最全
├── WebDriver W3C 标准
├── 配置复杂、稳定性差
├── 需要显式等待
└── 语言：多语言

Puppeteer
├── Chrome DevTools Protocol
├── 仅 Chromium
├── 适合爬虫、截图、PDF
└── 语言：JS/TS

选择建议
├── 新项目 → Playwright
├── 已有 Cypress 且满足需求 → 继续用
├── 多浏览器要求 → Playwright / Selenium
└── Chrome-only + 简单场景 → Cypress
```

```typescript
// Playwright 示例
import { test, expect } from '@playwright/test';

test('user can login and view dashboard', async ({ page }) => {
  // 访问登录页
  await page.goto('/login');

  // 填写表单
  await page.fill('[data-testid="email"]', 'alice@example.com');
  await page.fill('[data-testid="password"]', 'secret');

  // 点击登录
  await page.click('[data-testid="login-button"]');

  // 验证跳转
  await expect(page).toHaveURL('/dashboard');

  // 验证页面内容
  await expect(page.locator('h1')).toContainText('Dashboard');
  await expect(page.locator('[data-testid="welcome-message"]'))
    .toContainText('Welcome, Alice');
});

// API + UI 混合测试
test('user can create order', async ({ page, request }) => {
  // 先通过 API 准备数据
  await request.post('/api/products', {
    data: { name: 'Test Product', price: 99.99, stock: 10 },
  });

  // UI 操作
  await page.goto('/products');
  await page.click('text=Test Product');
  await page.click('[data-testid="add-to-cart"]');
  await page.click('[data-testid="checkout"]');

  // 验证
  await expect(page.locator('[data-testid="order-success"]')).toBeVisible();
});
```

## 2. Page Object Model（POM）

```typescript
// POM 模式：将页面逻辑封装，测试只关注业务

// pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.fill('[data-testid="email"]', email);
    await this.page.fill('[data-testid="password"]', password);
    await this.page.click('[data-testid="login-button"]');
  }

  async getErrorMessage() {
    return this.page.locator('[data-testid="error-message"]').textContent();
  }
}

// pages/DashboardPage.ts
export class DashboardPage {
  constructor(private page: Page) {}

  async getWelcomeMessage() {
    return this.page.locator('[data-testid="welcome-message"]').textContent();
  }

  async navigateToUsers() {
    await this.page.click('[data-testid="nav-users"]');
  }
}

// tests/login.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';

test('successful login', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('alice@example.com', 'secret');

  const dashboardPage = new DashboardPage(page);
  await expect(dashboardPage.getWelcomeMessage()).resolves.toContain('Alice');
});
```

## 3. 视觉回归测试

```typescript
// Playwright 截图对比
import { test, expect } from '@playwright/test';

test('homepage visual regression', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png', {
    fullPage: true,
    threshold: 0.2,
  });
});

// 组件级视觉回归（Storybook + Chromatic/Loki）
// .storybook/test-runner.ts
import { injectAxe, checkA11y } from 'axe-playwright';

export default {
  async postRender(page) {
    await injectAxe(page);
    await checkA11y(page, '#storybook-root');
  },
};
```

```
视觉回归策略
├── 全页面截图：关键页面（首页、仪表盘）
├── 组件截图：设计系统组件
├── 阈值设置：允许少量像素差异
├── 动态内容处理：
│   ├── Mock 日期、随机数据
│   ├── 隐藏动态元素（时间、动画）
│   └── 使用稳定测试数据
└── 工具：Chromatic（付费）、Percy、Loki、Playwright
```
