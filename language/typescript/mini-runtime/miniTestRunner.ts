/**
 * 手写 mini test runner
 *
 * 考点：
 * - 测试收集、断言、异步支持。
 * - 简单报告。
 */

export function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}

export function assertTrue(value: boolean): void {
  if (!value) throw new Error("Expected truthy");
}

export interface TestCase {
  name: string;
  fn: () => void | Promise<void>;
}

export class MiniTestRunner {
  private tests: TestCase[] = [];

  test(name: string, fn: () => void | Promise<void>): void {
    this.tests.push({ name, fn });
  }

  async run(): Promise<void> {
    let passed = 0;
    let failed = 0;
    for (const { name, fn } of this.tests) {
      try {
        await fn();
        console.log(`✓ ${name}`);
        passed++;
      } catch (error) {
        console.log(`✗ ${name}: ${error}`);
        failed++;
      }
    }
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new MiniTestRunner();
  runner.test("adds numbers", () => assertEqual(1 + 1, 2));
  runner.run();
}
