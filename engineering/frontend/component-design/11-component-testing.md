# 组件测试

## 1. 测试金字塔（组件层）

```
        ┌─────────────┐
        │   E2E       │  用户旅程（登录→操作→验证）
        ├─────────────┤
        │ Integration │  组件组合（Form + Validation）
        ├─────────────┤
        │   Unit      │  单组件渲染、交互、状态
        ├─────────────┤
        │  Snapshot   │  UI 结构回归
        └─────────────┘
```

## 2. 单元测试

```tsx
// Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows loading state', () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('disabled');
    expect(document.querySelector('.spinner')).toBeInTheDocument();
  });

  it('forwards ref correctly', () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
```

## 3. 可访问性测试

```tsx
// a11y.test.tsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Modal } from './Modal';

expect.extend(toHaveNoViolations);

describe('Accessibility', () => {
  it('Modal has no accessibility violations', async () => {
    const { container } = render(
      <Modal isOpen={true} onClose={() => {}} title="Test">
        Content
      </Modal>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('Button has correct ARIA attributes', () => {
    render(<Button aria-label="Delete item">×</Button>);
    expect(screen.getByLabelText('Delete item')).toBeInTheDocument();
  });

  it('Form input has associated label', () => {
    render(
      <>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" />
      </>
    );

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });
});
```

## 4. 交互测试

```tsx
// Select.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './Select';

describe('Select', () => {
  it('opens menu on click', async () => {
    render(
      <Select>
        <Select.Trigger>Open</Select.Trigger>
        <Select.Menu>
          <Select.Option value="a">A</Select.Option>
          <Select.Option value="b">B</Select.Option>
        </Select.Menu>
      </Select>
    );

    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('selects option on click', async () => {
    const handleSelect = vi.fn();
    render(
      <Select onSelect={handleSelect}>
        <Select.Trigger>Open</Select.Trigger>
        <Select.Menu>
          <Select.Option value="a">A</Select.Option>
        </Select.Menu>
      </Select>
    );

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByRole('option'));

    expect(handleSelect).toHaveBeenCalledWith('a');
  });

  it('supports keyboard navigation', async () => {
    render(
      <Select>
        <Select.Trigger>Open</Select.Trigger>
        <Select.Menu>
          <Select.Option value="a">A</Select.Option>
          <Select.Option value="b">B</Select.Option>
        </Select.Menu>
      </Select>
    );

    await userEvent.click(screen.getByRole('button'));
    await userEvent.keyboard('{ArrowDown}');

    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
  });
});
```
