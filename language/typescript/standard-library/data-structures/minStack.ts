/**
 * 手写 MinStack
 *
 * 考点：
 * - 辅助栈同步保存当前最小值。
 */

export class MinStack<T> {
  private stack: { value: T; min: T }[] = [];

  push(value: T): void {
    const min = this.stack.length === 0 ? value : (value < this.stack[this.stack.length - 1].min ? value : this.stack[this.stack.length - 1].min);
    this.stack.push({ value, min });
  }

  pop(): T {
    if (this.stack.length === 0) throw new Error("pop from empty stack");
    return this.stack.pop()!.value;
  }

  top(): T {
    if (this.stack.length === 0) throw new Error("top from empty stack");
    return this.stack[this.stack.length - 1].value;
  }

  getMin(): T {
    if (this.stack.length === 0) throw new Error("min from empty stack");
    return this.stack[this.stack.length - 1].min;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = new MinStack<number>();
  s.push(3);
  s.push(1);
  s.push(2);
  console.log(s.getMin()); // 1
  s.pop();
  console.log(s.getMin()); // 1
}
