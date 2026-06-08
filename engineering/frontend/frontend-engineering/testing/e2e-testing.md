# E2E 测试

## 1. Playwright（推荐）

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
```

```typescript
// e2e/checkout.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Checkout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/products');
    await page.getByTestId('add-to-cart').first().click();
    await page.goto('/checkout');
  });

  test('should complete checkout', async ({ page }) => {
    await page.fill('[name="email"]', 'user@example.com');
    await page.fill('[name="card"]', '4242424242424242');
    await page.click('[type="submit"]');

    await expect(page.locator('h1')).toContainText('Thank you');
  });

  test('should show error for invalid card', async ({ page }) => {
    await page.fill('[name="card"]', 'invalid');
    await page.click('[type="submit"]');

    await expect(page.locator('.error')).toContainText('Invalid card');
  });
});
```

## 2. 最佳实践

```typescript
// 使用 Page Object Model
class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.fill('[name="email"]', email);
    await this.page.fill('[name="password"]', password);
    await this.page.click('[type="submit"]');
  }
}

// 测试中使用
const loginPage = new LoginPage(page);
await loginPage.goto();
await loginPage.login('user@example.com', 'password');
```
