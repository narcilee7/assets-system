# 手写 Event Bus（发布订阅）

## 目标

实现一个生产级 Event Bus，支持：
1. 发布/订阅模式
2. 一次性监听
3. 命名空间
4. 优先级队列
5. 异步事件处理
6. 中间件（拦截器）

## 实现

```javascript
// event-bus.js

class EventBus {
  constructor(options = {}) {
    this.events = new Map();       // eventName → Listener[]
    this.middlewares = [];         // 全局中间件
    this.maxListeners = options.maxListeners || 100;
    this.wildcard = options.wildcard !== false;  // 支持通配符
  }

  // ========== 订阅 API ==========

  on(eventName, handler, options = {}) {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }

    const listeners = this.events.get(eventName);

    if (listeners.length >= this.maxListeners) {
      console.warn(`Max listeners (${this.maxListeners}) exceeded for event "${eventName}"`);
    }

    listeners.push({
      handler,
      priority: options.priority || 0,
      once: options.once || false,
      namespace: options.namespace || null,
    });

    // 按优先级排序（高优先级在前）
    listeners.sort((a, b) => b.priority - a.priority);

    // 返回取消订阅函数
    return () => this.off(eventName, handler);
  }

  once(eventName, handler, options = {}) {
    return this.on(eventName, handler, { ...options, once: true });
  }

  off(eventName, handler) {
    const listeners = this.events.get(eventName);
    if (!listeners) return this;

    if (handler) {
      const index = listeners.findIndex((l) => l.handler === handler);
      if (index > -1) listeners.splice(index, 1);
    } else {
      this.events.delete(eventName);
    }

    return this;
  }

  offByNamespace(namespace) {
    for (const [eventName, listeners] of this.events) {
      const filtered = listeners.filter((l) => l.namespace !== namespace);
      if (filtered.length === 0) {
        this.events.delete(eventName);
      } else {
        this.events.set(eventName, filtered);
      }
    }
  }

  // ========== 发布 API ==========

  async emit(eventName, payload) {
    const listeners = this._getListeners(eventName);
    if (listeners.length === 0) return [];

    // 构建上下文
    const context = {
      eventName,
      payload,
      stopped: false,
      stopPropagation() { this.stopped = true; },
    };

    // 执行中间件
    for (const middleware of this.middlewares) {
      await middleware(context);
      if (context.stopped) return [];
    }

    // 执行监听器
    const results = [];
    const toRemove = [];

    for (const listener of listeners) {
      if (context.stopped) break;

      try {
        const result = await listener.handler(context.payload, context);
        results.push(result);

        if (listener.once) {
          toRemove.push({ eventName, handler: listener.handler });
        }
      } catch (error) {
        console.error(`Error in listener for "${eventName}":`, error);
      }
    }

    // 清理一次性监听器
    for (const { eventName, handler } of toRemove) {
      this.off(eventName, handler);
    }

    return results;
  }

  // 同步 emit（不等待异步监听器）
  emitSync(eventName, payload) {
    const listeners = this._getListeners(eventName);

    const context = {
      eventName,
      payload,
      stopped: false,
      stopPropagation() { this.stopped = true; },
    };

    for (const middleware of this.middlewares) {
      middleware(context);
      if (context.stopped) return;
    }

    const toRemove = [];

    for (const listener of listeners) {
      if (context.stopped) break;

      try {
        const result = listener.handler(context.payload, context);

        // 如果返回 Promise，不等待
        if (result instanceof Promise) {
          result.catch((err) =>
            console.error(`Async error in listener for "${eventName}":`, err)
          );
        }

        if (listener.once) {
          toRemove.push({ eventName, handler: listener.handler });
        }
      } catch (error) {
        console.error(`Error in listener for "${eventName}":`, error);
      }
    }

    for (const { eventName, handler } of toRemove) {
      this.off(eventName, handler);
    }
  }

  // ========== 中间件 ==========

  use(middleware) {
    this.middlewares.push(middleware);
    return this;
  }

  // ========== 工具方法 ==========

  _getListeners(eventName) {
    const direct = this.events.get(eventName) || [];

    if (!this.wildcard) return direct;

    // 通配符匹配："user.*" 匹配 "user.created", "user.deleted"
    const wildcard = [];
    for (const [pattern, listeners] of this.events) {
      if (pattern === eventName) continue;
      if (this._matchWildcard(eventName, pattern)) {
        wildcard.push(...listeners);
      }
    }

    return [...direct, ...wildcard].sort((a, b) => b.priority - a.priority);
  }

  _matchWildcard(eventName, pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(eventName);
  }

  listenerCount(eventName) {
    return this.events.get(eventName)?.length || 0;
  }

  eventNames() {
    return Array.from(this.events.keys());
  }

  clear() {
    this.events.clear();
    this.middlewares = [];
  }
}

// ========== 使用示例 ==========

const bus = new EventBus({ maxListeners: 50 });

// 基本使用
bus.on('user:login', (payload) => {
  console.log(`User ${payload.userId} logged in`);
});

bus.emit('user:login', { userId: '123' });

// 一次性监听
bus.once('app:ready', () => {
  console.log('App is ready!');
});

// 命名空间（方便批量取消）
bus.on('modal:open', handler1, { namespace: 'modal' });
bus.on('modal:close', handler2, { namespace: 'modal' });
// 组件卸载时：bus.offByNamespace('modal');

// 优先级
bus.on('data:change', lowPriorityHandler, { priority: 1 });
bus.on('data:change', highPriorityHandler, { priority: 10 });
// highPriorityHandler 先执行

// 中间件（日志）
bus.use((context) => {
  console.log(`[Event] ${context.eventName}`, context.payload);
});

// 中间件（权限检查）
bus.use((context) => {
  if (context.eventName.startsWith('admin:') && !context.payload.isAdmin) {
    context.stopPropagation();
    console.warn('Unauthorized admin action');
  }
});

// 通配符
bus.on('user.*', (payload, ctx) => {
  console.log(`User event: ${ctx.eventName}`, payload);
});

bus.emit('user.created', { userId: '1' });
bus.emit('user.deleted', { userId: '2' });

module.exports = { EventBus };
```
