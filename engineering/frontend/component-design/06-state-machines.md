# 组件状态机

## 1. 有限状态机（FSM）

```
Toggle 组件状态机：

   ┌─────────┐
   │  idle   │
   └────┬────┘
        │ toggle
        ▼
   ┌─────────┐
   │ checked │
   └────┬────┘
        │ toggle
        ▼
   (回到 idle)

Modal 组件状态机：

   ┌─────────┐
   │ closed  │
   └────┬────┘
        │ open
        ▼
   ┌─────────┐
   │opening  │ ──动画──┐
   └─────────┘         ▼
                 ┌─────────┐
                 │  open   │
                 └────┬────┘
                      │ close
                      ▼
                 ┌─────────┐
                 │closing  │ ──动画──┐
                 └─────────┘         ▼
                               ┌─────────┐
                               │ closed  │
                               └─────────┘
```

## 2. 手动实现

```tsx
// 使用 useReducer 实现状态机
type State = 'closed' | 'opening' | 'open' | 'closing';
type Action = { type: 'OPEN' } | { type: 'CLOSE' } | { type: 'ANIMATION_END' };

const machine = {
  closed: {
    OPEN: 'opening',
  },
  opening: {
    ANIMATION_END: 'open',
  },
  open: {
    CLOSE: 'closing',
  },
  closing: {
    ANIMATION_END: 'closed',
  },
};

function transition(state: State, action: Action): State {
  return (machine[state] as any)?.[action.type] || state;
}

function useModalMachine() {
  const [state, dispatch] = useReducer(transition, 'closed');

  const open = () => dispatch({ type: 'OPEN' });
  const close = () => dispatch({ type: 'CLOSE' });
  const onAnimationEnd = () => dispatch({ type: 'ANIMATION_END' });

  return { state, open, close, onAnimationEnd };
}
```

## 3. XState

```tsx
import { useMachine } from '@xstate/react';
import { createMachine } from 'xstate';

const modalMachine = createMachine({
  id: 'modal',
  initial: 'closed',
  states: {
    closed: {
      on: { OPEN: 'opening' },
    },
    opening: {
      on: { ANIMATION_END: 'open' },
      entry: 'focusTrigger',
    },
    open: {
      on: { CLOSE: 'closing' },
      entry: 'focusContent',
    },
    closing: {
      on: { ANIMATION_END: 'closed' },
      entry: 'restoreFocus',
    },
  },
});

function Modal() {
  const [state, send] = useMachine(modalMachine, {
    actions: {
      focusTrigger: () => triggerRef.current?.focus(),
      focusContent: () => contentRef.current?.focus(),
      restoreFocus: () => triggerRef.current?.focus(),
    },
  });

  const isOpen = state.matches('open') || state.matches('closing');

  return (
    <>
      <button ref={triggerRef} onClick={() => send('OPEN')}>
        Open
      </button>
      {isOpen && (
        <div
          ref={contentRef}
          onAnimationEnd={() => send('ANIMATION_END')}
          className={state.matches('closing') ? 'closing' : ''}
        >
          Content
          <button onClick={() => send('CLOSE')}>Close</button>
        </div>
      )}
    </>
  );
}
```
