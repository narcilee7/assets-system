# 手写测试框架

## 目标

实现一个简化版测试框架，支持：
1. 测试用例注册与执行
2. `describe` / `test` / `beforeEach` / `afterEach`
3. 断言库（`expect` / `toBe` / `toEqual` / `toThrow`）
4. 异步测试支持
5. 测试报告输出

## 实现

```javascript
// tiny-test-framework.js

class TestFramework {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
    this.results = [];
  }

  describe(name, fn) {
    const suite = {
      name,
      tests: [],
      beforeEach: [],
      afterEach: [],
      beforeAll: [],
      afterAll: [],
    };

    const prevSuite = this.currentSuite;
    this.currentSuite = suite;
    this.suites.push(suite);

    try {
      fn();
    } catch (error) {
      console.error(`Suite "${name}" failed to load:`, error.message);
    }

    this.currentSuite = prevSuite;
  }

  test(name, fn) {
    if (!this.currentSuite) {
      throw new Error('test() must be called inside describe()');
    }
    this.currentSuite.tests.push({ name, fn, skipped: false });
  }

  skip(name, fn) {
    if (!this.currentSuite) return;
    this.currentSuite.tests.push({ name, fn, skipped: true });
  }

  beforeEach(fn) {
    if (this.currentSuite) this.currentSuite.beforeEach.push(fn);
  }

  afterEach(fn) {
    if (this.currentSuite) this.currentSuite.afterEach.push(fn);
  }

  beforeAll(fn) {
    if (this.currentSuite) this.currentSuite.beforeAll.push(fn);
  }

  afterAll(fn) {
    if (this.currentSuite) this.currentSuite.afterAll.push(fn);
  }

  async run() {
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    const failures = [];

    for (const suite of this.suites) {
      console.log(`\n  ${suite.name}`);

      // beforeAll
      for (const hook of suite.beforeAll) {
        try {
          await hook();
        } catch (e) {
          console.error(`    beforeAll failed: ${e.message}`);
        }
      }

      for (const test of suite.tests) {
        total++;

        if (test.skipped) {
          skipped++;
          console.log(`    ○ ${test.name}`);
          continue;
        }

        // beforeEach
        for (const hook of suite.beforeEach) {
          try {
            await hook();
          } catch (e) {
            console.error(`    beforeEach failed: ${e.message}`);
          }
        }

        try {
          await test.fn();
          passed++;
          console.log(`    ✓ ${test.name}`);
        } catch (error) {
          failed++;
          console.log(`    ✗ ${test.name}`);
          console.log(`      ${error.message}`);
          failures.push({ suite: suite.name, test: test.name, error });
        }

        // afterEach
        for (const hook of suite.afterEach) {
          try {
            await hook();
          } catch (e) {
            console.error(`    afterEach failed: ${e.message}`);
          }
        }
      }

      // afterAll
      for (const hook of suite.afterAll) {
        try {
          await hook();
        } catch (e) {
          console.error(`    afterAll failed: ${e.message}`);
        }
      }
    }

    // 汇总
    console.log(`\nTest Suites: ${this.suites.length}`);
    console.log(`Tests:       ${total} total, ${passed} passed, ${failed} failed, ${skipped} skipped`);

    if (failures.length > 0) {
      console.log('\nFailures:');
      for (const f of failures) {
        console.log(`  ${f.suite} > ${f.test}`);
        console.log(`    ${f.error.stack}`);
      }
      process.exitCode = 1;
    }

    return { total, passed, failed, skipped, failures };
  }
}

// ========== 断言库 ==========

class AssertionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AssertionError';
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (!Object.is(actual, expected)) {
        throw new AssertionError(
          `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
        );
      }
    },

    toEqual(expected) {
      const pass = deepEqual(actual, expected);
      if (!pass) {
        throw new AssertionError(
          `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
        );
      }
    },

    toBeTruthy() {
      if (!actual) {
        throw new AssertionError(`Expected truthy but got ${JSON.stringify(actual)}`);
      }
    },

    toBeFalsy() {
      if (actual) {
        throw new AssertionError(`Expected falsy but got ${JSON.stringify(actual)}`);
      }
    },

    toBeNull() {
      if (actual !== null) {
        throw new AssertionError(`Expected null but got ${JSON.stringify(actual)}`);
      }
    },

    toBeDefined() {
      if (actual === undefined) {
        throw new AssertionError(`Expected defined but got undefined`);
      }
    },

    toContain(item) {
      if (!actual.includes(item)) {
        throw new AssertionError(
          `Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(item)}`
        );
      }
    },

    toHaveLength(expected) {
      if (actual.length !== expected) {
        throw new AssertionError(
          `Expected length ${expected} but got ${actual.length}`
        );
      }
    },

    toThrow(expectedMessage) {
      let threw = false;
      let thrownError;
      try {
        actual();
      } catch (error) {
        threw = true;
        thrownError = error;
      }
      if (!threw) {
        throw new AssertionError('Expected function to throw but it did not');
      }
      if (expectedMessage && !thrownError.message.includes(expectedMessage)) {
        throw new AssertionError(
          `Expected error message to include "${expectedMessage}" but got "${thrownError.message}"`
        );
      }
    },

    toBeInstanceOf(expectedClass) {
      if (!(actual instanceof expectedClass)) {
        throw new AssertionError(
          `Expected instance of ${expectedClass.name} but got ${actual?.constructor?.name}`
        );
      }
    },

    // 反向断言
    get not() {
      return {
        toBe: (expected) => {
          if (Object.is(actual, expected)) {
            throw new AssertionError(`Expected not ${JSON.stringify(expected)}`);
          }
        },
        toEqual: (expected) => {
          if (deepEqual(actual, expected)) {
            throw new AssertionError(`Expected not ${JSON.stringify(expected)}`);
          }
        },
        toContain: (item) => {
          if (actual.includes(item)) {
            throw new AssertionError(
              `Expected ${JSON.stringify(actual)} not to contain ${JSON.stringify(item)}`
            );
          }
        },
      };
    },
  };
}

// 深比较
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

// ========== 全局注册 ==========

const framework = new TestFramework();

global.describe = framework.describe.bind(framework);
global.test = framework.test.bind(framework);
global.it = framework.test.bind(framework);
global.skip = framework.skip.bind(framework);
global.beforeEach = framework.beforeEach.bind(framework);
global.afterEach = framework.afterEach.bind(framework);
global.beforeAll = framework.beforeAll.bind(framework);
global.afterAll = framework.afterAll.bind(framework);
global.expect = expect;

// 自动运行
process.on('beforeExit', () => {
  if (framework.results.length === 0) {
    framework.run();
  }
});

module.exports = { TestFramework, expect, AssertionError };
```

## 使用

```javascript
// example.test.js
require('./tiny-test-framework');

function sum(a, b) {
  return a + b;
}

function divide(a, b) {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}

describe('Math operations', () => {
  let counter;

  beforeEach(() => {
    counter = 0;
  });

  test('sum adds two numbers', () => {
    expect(sum(1, 2)).toBe(3);
    expect(sum(-1, -2)).toBe(-3);
  });

  test('sum with zero', () => {
    expect(sum(5, 0)).toBe(5);
  });

  test('divide works', () => {
    expect(divide(10, 2)).toBe(5);
  });

  test('divide by zero throws', () => {
    expect(() => divide(10, 0)).toThrow('Division by zero');
  });

  test('deep equality', () => {
    expect({ a: 1, b: 2 }).toEqual({ a: 1, b: 2 });
  });

  test('arrays', () => {
    expect([1, 2, 3]).toContain(2);
    expect([1, 2, 3]).toHaveLength(3);
  });

  test('async operations', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });

  test('counter increments', () => {
    counter++;
    expect(counter).toBe(1);
  });
});

// 运行: node example.test.js
```
