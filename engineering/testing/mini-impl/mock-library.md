# 手写 Mock/Stub 库

## 目标

实现一个简化版 Mock 库，支持：
1. 函数 Mock（记录调用、预设返回值）
2. Spy（包装真实函数）
3. 部分 Mock（模块级别的 mock）
4. 验证调用（次数、参数）

## 实现

```javascript
// tiny-mock.js

class MockFunction {
  constructor(impl) {
    this.calls = [];
    this.returnValues = [];
    this.throwError = null;
    this._impl = impl;
    this._defaultReturn = undefined;
    this._mockImplementation = null;
  }

  // 执行 mock 函数
  _execute(...args) {
    const call = { args, timestamp: Date.now() };
    this.calls.push(call);

    if (this.throwError) {
      throw this.throwError;
    }

    if (this._mockImplementation) {
      const result = this._mockImplementation(...args);
      call.returnValue = result;
      this.returnValues.push(result);
      return result;
    }

    if (this._impl) {
      const result = this._impl(...args);
      call.returnValue = result;
      this.returnValues.push(result);
      return result;
    }

    this.returnValues.push(this._defaultReturn);
    return this._defaultReturn;
  }

  // 链式配置
  mockReturnValue(value) {
    this._defaultReturn = value;
    this._mockImplementation = null;
    return this;
  }

  mockReturnValueOnce(value) {
    const prev = this._mockImplementation;
    let called = false;
    this._mockImplementation = (...args) => {
      if (!called) {
        called = true;
        this._mockImplementation = prev;
        return value;
      }
      return prev ? prev(...args) : this._defaultReturn;
    };
    return this;
  }

  mockResolvedValue(value) {
    this._mockImplementation = () => Promise.resolve(value);
    return this;
  }

  mockRejectedValue(error) {
    this._mockImplementation = () => Promise.reject(error);
    return this;
  }

  mockImplementation(fn) {
    this._mockImplementation = fn;
    return this;
  }

  mockReset() {
    this.calls = [];
    this.returnValues = [];
    this.throwError = null;
    this._mockImplementation = null;
    return this;
  }

  // 验证
  get mock() {
    return {
      calls: this.calls,
      results: this.returnValues,
      lastCall: this.calls[this.calls.length - 1] || null,
    };
  }
}

// ========== 工厂函数 ==========

function fn(impl) {
  const mock = new MockFunction(impl);
  const callable = (...args) => mock._execute(...args);
  // 把 mock 的方法复制到 callable
  Object.setPrototypeOf(callable, MockFunction.prototype);
  Object.keys(MockFunction.prototype).forEach((key) => {
    if (key !== '_execute') {
      callable[key] = mock[key].bind(mock);
    }
  });
  Object.defineProperty(callable, 'mock', {
    get: () => mock.mock,
  });
  callable._mockFn = mock;
  return callable;
}

function spyOn(object, methodName) {
  const original = object[methodName];
  const mock = new MockFunction(original);
  object[methodName] = (...args) => mock._execute(...args);
  object[methodName]._mockFn = mock;
  object[methodName].mockRestore = () => {
    object[methodName] = original;
  };
  return object[methodName];
}

// ========== 验证工具 ==========

const matchers = {
  toHaveBeenCalled(received) {
    const pass = received.mock.calls.length > 0;
    return {
      pass,
      message: () =>
        pass
          ? `Expected mock not to have been called`
          : `Expected mock to have been called`,
    };
  },

  toHaveBeenCalledTimes(received, expected) {
    const pass = received.mock.calls.length === expected;
    return {
      pass,
      message: () =>
        pass
          ? `Expected mock not to have been called ${expected} times`
          : `Expected mock to have been called ${expected} times, but was called ${received.mock.calls.length} times`,
    };
  },

  toHaveBeenCalledWith(received, ...expectedArgs) {
    const pass = received.mock.calls.some((call) =>
      deepEqual(call.args, expectedArgs)
    );
    return {
      pass,
      message: () =>
        pass
          ? `Expected mock not to have been called with ${JSON.stringify(expectedArgs)}`
          : `Expected mock to have been called with ${JSON.stringify(expectedArgs)}`,
    };
  },

  toHaveBeenLastCalledWith(received, ...expectedArgs) {
    const lastCall = received.mock.lastCall;
    const pass = lastCall && deepEqual(lastCall.args, expectedArgs);
    return {
      pass,
      message: () =>
        pass
          ? `Expected last call not to be ${JSON.stringify(expectedArgs)}`
          : `Expected last call to be ${JSON.stringify(expectedArgs)}, but was ${JSON.stringify(lastCall?.args)}`,
    };
  },
};

// ========== 模块 Mock ==========

class ModuleMocker {
  constructor() {
    this.mocks = new Map();
    this.originals = new Map();
  }

  mock(modulePath, factory) {
    const resolved = require.resolve(modulePath);
    this.originals.set(resolved, require.cache[resolved]);

    const mockModule = factory();
    require.cache[resolved] = {
      id: resolved,
      filename: resolved,
      loaded: true,
      exports: mockModule,
    };
    this.mocks.set(resolved, mockModule);
    return mockModule;
  }

  resetAllMocks() {
    for (const [path, original] of this.originals) {
      if (original) {
        require.cache[path] = original;
      } else {
        delete require.cache[path];
      }
    }
    this.mocks.clear();
    this.originals.clear();
  }
}

const moduleMocker = new ModuleMocker();

// ========== 深比较辅助 ==========

function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// ========== 导出 ==========

module.exports = {
  fn,
  spyOn,
  matchers,
  moduleMocker,
  MockFunction,
};
```

## 使用

```javascript
// example.mock.test.js
const { fn, spyOn, matchers } = require('./tiny-mock');

// ========== fn：创建 Mock 函数 ==========

const mockAdd = fn();
mockAdd.mockReturnValue(10);

console.log(mockAdd(2, 3));        // 10
console.log(mockAdd(5, 7));        // 10
console.log(mockAdd.mock.calls);   // [{ args: [2, 3] }, { args: [5, 7] }]

// 序列返回值
const mockRandom = fn();
mockRandom
  .mockReturnValueOnce(1)
  .mockReturnValueOnce(2)
  .mockReturnValue(99);

console.log(mockRandom());  // 1
console.log(mockRandom());  // 2
console.log(mockRandom());  // 99
console.log(mockRandom());  // 99

// Mock 实现
const mockFetch = fn();
mockFetch.mockImplementation((url) => ({ data: `Response for ${url}` }));
console.log(mockFetch('/api/users'));  // { data: 'Response for /api/users' }

// Async Mock
const mockAsync = fn();
mockAsync.mockResolvedValue({ id: 1, name: 'Alice' });
mockAsync('/api/user/1').then(console.log);  // { id: 1, name: 'Alice' }

// ========== spyOn：包装真实函数 ==========

const calculator = {
  add(a, b) {
    return a + b;
  },
  multiply(a, b) {
    return a * b;
  },
};

const addSpy = spyOn(calculator, 'add');
calculator.add(2, 3);  // 返回 5（原始行为）
calculator.add(4, 5);  // 返回 9

console.log(addSpy.mock.calls);  // [{ args: [2, 3] }, { args: [4, 5] }]

addSpy.mockReturnValue(100);
console.log(calculator.add(1, 1));  // 100（被 mock）

addSpy.mockRestore();  // 恢复原始函数
console.log(calculator.add(1, 1));  // 2

// ========== 验证 ==========

const mockSend = fn();
mockSend('hello', { to: 'Alice' });
mockSend('world', { to: 'Bob' });

console.log(matchers.toHaveBeenCalled(mockSend).pass);              // true
console.log(matchers.toHaveBeenCalledTimes(mockSend, 2).pass);      // true
console.log(matchers.toHaveBeenCalledWith(mockSend, 'hello', { to: 'Alice' }).pass); // true
console.log(matchers.toHaveBeenLastCalledWith(mockSend, 'world', { to: 'Bob' }).pass); // true

// ========== 模块 Mock ==========

const { moduleMocker } = require('./tiny-mock');

moduleMocker.mock('./api', () => ({
  fetchUser: fn().mockResolvedValue({ id: 1, name: 'Mocked Alice' }),
}));

const api = require('./api');
api.fetchUser(1).then(console.log);  // { id: 1, name: 'Mocked Alice' }

moduleMocker.resetAllMocks();
```
