# 手写有限状态机

## 目标

实现一个简化版有限状态机（FSM），支持：
1. 状态定义与转换
2. 进入/退出钩子
3. 守卫条件（Guard）
4. 上下文（Context）
5. 可视化输出

## 实现

```javascript
// state-machine.js

class StateMachine {
  constructor(config) {
    this.id = config.id || 'fsm';
    this.initial = config.initial;
    this.context = config.context || {};
    this.states = config.states || {};

    this.currentState = this.initial;
    this.previousState = null;
    this.history = [];

    // 执行初始状态的 onEnter
    this._executeHook(this.currentState, 'onEnter', { type: 'xstate.init' });
  }

  // ========== 核心 API ==========

  // 触发事件（状态转换）
  send(event, payload = {}) {
    const eventName = typeof event === 'string' ? event : event.type;
    const currentConfig = this.states[this.currentState];

    if (!currentConfig || !currentConfig.on) {
      console.warn(`No transitions defined for state "${this.currentState}"`);
      return this;
    }

    const transition = currentConfig.on[eventName];
    if (!transition) {
      console.warn(`Event "${eventName}" not handled in state "${this.currentState}"`);
      return this;
    }

    // 处理数组形式的 transitions（先匹配的优先）
    const transitions = Array.isArray(transition) ? transition : [transition];

    for (const t of transitions) {
      // 检查守卫条件
      if (t.cond && !t.cond(this.context, payload)) {
        continue;
      }

      this._transition(t, eventName, payload);
      return this;
    }

    return this;
  }

  // 获取当前状态
  getState() {
    return {
      value: this.currentState,
      previous: this.previousState,
      context: this.context,
    };
  }

  // 检查是否处于某状态
  matches(state) {
    return this.currentState === state;
  }

  // 检查是否可以触发某事件
  can(eventName) {
    const currentConfig = this.states[this.currentState];
    return currentConfig?.on?.[eventName] !== undefined;
  }

  // ========== 内部方法 ==========

  _transition(transition, eventName, payload) {
    const target = transition.target;
    const source = this.currentState;

    // 如果没有 target，是自转换（不退出/进入）
    const isSelfTransition = !target || target === source;

    // 执行当前状态的 onExit
    if (!isSelfTransition) {
      this._executeHook(source, 'onExit', { type: eventName, payload });
    }

    // 执行转换动作
    if (transition.actions) {
      const actions = Array.isArray(transition.actions)
        ? transition.actions
        : [transition.actions];
      for (const action of actions) {
        this._executeAction(action, { type: eventName, payload });
      }
    }

    // 更新上下文（assign）
    if (transition.assign) {
      Object.assign(this.context, transition.assign);
    }

    // 记录历史
    this.previousState = source;
    this.history.push({
      from: source,
      to: target || source,
      event: eventName,
      timestamp: Date.now(),
    });

    // 切换状态
    if (!isSelfTransition) {
      this.currentState = target;
      // 执行新状态的 onEnter
      this._executeHook(target, 'onEnter', { type: eventName, payload });
    }

    // 自动转换（always）
    const newConfig = this.states[this.currentState];
    if (newConfig?.always) {
      const alwaysTransitions = Array.isArray(newConfig.always)
        ? newConfig.always
        : [newConfig.always];

      for (const t of alwaysTransitions) {
        if (!t.cond || t.cond(this.context, payload)) {
          this._transition(t, 'always', payload);
          break;
        }
      }
    }
  }

  _executeHook(stateName, hookName, event) {
    const stateConfig = this.states[stateName];
    if (!stateConfig) return;

    const hook = stateConfig[hookName];
    if (hook) {
      this._executeAction(hook, event);
    }
  }

  _executeAction(action, event) {
    if (typeof action === 'function') {
      action(this.context, event);
    } else if (typeof action === 'string') {
      console.log(`[Action] ${action}`, this.context);
    } else if (Array.isArray(action)) {
      for (const a of action) {
        this._executeAction(a, event);
      }
    }
  }

  // ========== 可视化 ==========

  toMermaid() {
    const lines = ['stateDiagram-v2'];
    lines.push(`  [*] --> ${this.initial}`);

    for (const [stateName, config] of Object.entries(this.states)) {
      if (config.on) {
        for (const [event, transition] of Object.entries(config.on)) {
          const transitions = Array.isArray(transition) ? transition : [transition];
          for (const t of transitions) {
            const target = t.target || stateName;
            lines.push(`  ${stateName} --> ${target}: ${event}`);
          }
        }
      }

      if (config.always) {
        const alwaysTransitions = Array.isArray(config.always)
          ? config.always
          : [config.always];
        for (const t of alwaysTransitions) {
          lines.push(`  ${stateName} --> ${t.target}: [always]`);
        }
      }
    }

    return lines.join('\n');
  }

  toGraphviz() {
    const lines = ['digraph {'];
    lines.push('  rankdir=LR;');
    lines.push(`  "*" -> "${this.initial}" [style=dashed];`);

    const edges = new Set();
    for (const [stateName, config] of Object.entries(this.states)) {
      if (config.on) {
        for (const [event, transition] of Object.entries(config.on)) {
          const transitions = Array.isArray(transition) ? transition : [transition];
          for (const t of transitions) {
            const target = t.target || stateName;
            const edgeKey = `${stateName}->${target}:${event}`;
            if (!edges.has(edgeKey)) {
              lines.push(`  "${stateName}" -> "${target}" [label="${event}"];`);
              edges.add(edgeKey);
            }
          }
        }
      }
    }

    lines.push('}');
    return lines.join('\n');
  }
}

// ========== 使用示例 ==========

// 1. 简单的加载状态机
const loadMachine = new StateMachine({
  id: 'loader',
  initial: 'idle',
  context: { data: null, error: null },
  states: {
    idle: {
      on: {
        FETCH: { target: 'loading' },
      },
    },
    loading: {
      onEnter: () => console.log('Loading started...'),
      on: {
        SUCCESS: {
          target: 'success',
          assign: { error: null },
        },
        FAILURE: {
          target: 'error',
          assign: (ctx, event) => ({ error: event.payload }),
        },
      },
    },
    success: {
      onEnter: (ctx) => console.log('Data loaded:', ctx.data),
      on: {
        RESET: { target: 'idle', assign: { data: null, error: null } },
      },
    },
    error: {
      on: {
        RETRY: { target: 'loading' },
        RESET: { target: 'idle', assign: { data: null, error: null } },
      },
    },
  },
});

loadMachine.send('FETCH');
loadMachine.send('SUCCESS', { payload: { users: [] } });
console.log(loadMachine.getState().value);  // 'success'

// 2. 带守卫条件的订单状态机
const orderMachine = new StateMachine({
  id: 'order',
  initial: 'pending',
  context: { paid: false, items: [] },
  states: {
    pending: {
      on: {
        PAY: {
          target: 'paid',
          cond: (ctx) => ctx.items.length > 0,
          actions: () => console.log('Payment processing...'),
        },
        CANCEL: { target: 'cancelled' },
      },
    },
    paid: {
      onEnter: () => console.log('Order paid!'),
      always: [
        { target: 'shipped', cond: (ctx) => ctx.paid },
      ],
    },
    shipped: {
      on: {
        DELIVER: { target: 'delivered' },
      },
    },
    delivered: {
      on: {
        RETURN: { target: 'returned' },
      },
    },
    cancelled: {},
    returned: {},
  },
});

orderMachine.context.items = [{ id: 1 }];
orderMachine.send('PAY');
console.log(orderMachine.toMermaid());
// stateDiagram-v2
//   [*] --> pending
//   pending --> paid: PAY
//   pending --> cancelled: CANCEL
//   paid --> shipped: [always]
//   shipped --> delivered: DELIVER
//   delivered --> returned: RETURN

// 3. 表单验证状态机
const formMachine = new StateMachine({
  id: 'form',
  initial: 'editing',
  context: { values: {}, errors: {}, touched: {} },
  states: {
    editing: {
      on: {
        CHANGE: {
          target: 'editing',
          assign: (ctx, event) => ({
            values: { ...ctx.values, [event.field]: event.value },
            touched: { ...ctx.touched, [event.field]: true },
          }),
          actions: (ctx) => {
            // 验证
            ctx.errors = validate(ctx.values);
          },
        },
        SUBMIT: {
          target: 'submitting',
          cond: (ctx) => Object.keys(ctx.errors).length === 0,
        },
      },
    },
    submitting: {
      onEnter: (ctx) => console.log('Submitting:', ctx.values),
      on: {
        SUCCESS: { target: 'success' },
        FAILURE: { target: 'editing', assign: (ctx, event) => ({ errors: event.errors }) },
      },
    },
    success: {
      onEnter: () => console.log('Form submitted successfully!'),
    },
  },
});

formMachine.send('CHANGE', { field: 'email', value: 'test@example.com' });
formMachine.send('CHANGE', { field: 'password', value: '123456' });

module.exports = { StateMachine };
```
