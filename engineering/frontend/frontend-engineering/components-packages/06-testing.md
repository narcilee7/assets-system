# 测试体系

## 1. 单元测试

```tsx
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'test/', '*.stories.*', '*.config.*'],
    },
  },
});
```

```tsx
// button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when loading', () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies correct variant class', () => {
    const { container } = render(<Button variant="danger">Danger</Button>);
    expect(container.firstChild).toHaveClass('ui-button--danger');
  });

  it('forwards ref', () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
```

## 2. 可访问性测试

```tsx
// a11y.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Button } from './button';
import { Modal } from './modal';

expect.extend(toHaveNoViolations);

describe('Accessibility', () => {
  it('Button has no violations', async () => {
    const { container } = render(<Button>Click</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Modal has correct ARIA attributes', () => {
    render(<Modal isOpen title="Test" onClose={() => {}}>Content</Modal>);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
  });
});
```

## 3. 视觉回归测试

```bash
# Chromatic
npm install --save-dev chromatic

# .github/workflows/visual.yml
name: Visual Tests
on: push
jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Chromatic 需要完整 Git 历史
      - run: npm ci
      - run: npx chromatic --project-token=${{ secrets.CHROMATIC_TOKEN }}
```

```tsx
// button.stories.tsx
export const Chromatic: Story = {
  parameters: {
    chromatic: {
      viewports: [320, 768, 1280],  // 多分辨率测试
      delay: 300,                    // 等待动画完成
      modes: {
        light: { theme: 'light' },
        dark: { theme: 'dark' },
      },
    },
  },
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="danger">Danger</Button>
      <Button loading>Loading</Button>
      <Button disabled>Disabled</Button>
    </div>
  ),
};
```

## 4. 跨浏览器测试

```yaml
# Playwright 跨浏览器测试
# playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],
});
```
