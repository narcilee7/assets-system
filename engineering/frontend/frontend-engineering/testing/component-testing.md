# 组件测试

## 1. React Testing Library

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Counter } from './Counter';

it('should increment on click', async () => {
  render(<Counter />);

  // 查询元素（优先可访问性）
  const button = screen.getByRole('button', { name: /increment/i });
  const count = screen.getByText(/count: 0/i);

  // 交互
  await userEvent.click(button);

  // 断言
  expect(screen.getByText(/count: 1/i)).toBeInTheDocument();
});

it('should show loading state', async () => {
  render(<UserList />);

  expect(screen.getByText(/loading/i)).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText(/john/i)).toBeInTheDocument();
  });
});
```

## 2. Vue Test Utils

```ts
import { mount } from '@vue/test-utils';
import Counter from './Counter.vue';

it('should increment', async () => {
  const wrapper = mount(Counter);

  await wrapper.find('button').trigger('click');

  expect(wrapper.find('span').text()).toBe('1');
});
```

## 3. Storybook + Testing

```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};

export const Primary: StoryObj = {
  args: {
    variant: 'primary',
    children: 'Click me',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button'));
  },
};
```
