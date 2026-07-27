class PriorityQueue<T> {
  private heap: T[] = [];
  private compare: (a: T, b: T) => number;

  constructor(compare?: (a: T, b: T) => number) {
    this.compare = compare ?? ((a: any, b: any) => {
      const pa = typeof a === 'object' && 'priority' in a ? a.priority : a;
      const pb = typeof b === 'object' && 'priority' in b ? b.priority : b;
      return pa - pb;
    });
  }

  get size(): number { return this.heap.length; }
  get isEmpty(): boolean { return this.heap.length === 0; }

  peek(): T | undefined {
    return this.heap[0];
  }

  /** 安全出队：空队列返回 undefined */
  dequeue(): T | undefined {
    if (this.isEmpty) return undefined;

    const top = this.heap[0];
    const last = this.heap.pop();

    // 前面已判断非空，last 一定是 T；但用运行时检查代替 ! 断言
    if (last !== undefined && this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }

    return top;
  }

  /** 严格出队：空队列直接抛异常，调用方无需再判空 */
  dequeueOrThrow(): T {
    if (this.isEmpty) {
      throw new Error('PriorityQueue is empty');
    }
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  enqueue(item: T): void {
    this.heap.push(item);
    this.siftUp(this.heap.length - 1);
  }

  clear(): void {
    this.heap.length = 0;
  }

  private siftUp(idx: number): void {
    const item = this.heap[idx];
    while (idx > 0) {
      const parentIdx = (idx - 1) >> 1;
      const parent = this.heap[parentIdx];
      if (this.compare(item, parent) >= 0) break;
      this.heap[idx] = parent;
      idx = parentIdx;
    }
    this.heap[idx] = item;
  }

  private siftDown(idx: number): void {
    const len = this.heap.length;
    const half = len >> 1;
    const item = this.heap[idx];

    while (idx < half) {
      let childIdx = (idx << 1) + 1;
      const rightIdx = childIdx + 1;
      if (rightIdx < len && this.compare(this.heap[rightIdx], this.heap[childIdx]) < 0) {
        childIdx = rightIdx;
      }
      if (this.compare(this.heap[childIdx], item) >= 0) break;
      this.heap[idx] = this.heap[childIdx];
      idx = childIdx;
    }
    this.heap[idx] = item;
  }

  static from<T>(items: T[], compare?: (a: T, b: T) => number): PriorityQueue<T> {
    const pq = new PriorityQueue<T>(compare);
    pq.heap = items.slice();
    for (let i = (pq.heap.length >> 1) - 1; i >= 0; i--) {
      pq.siftDown(i);
    }
    return pq;
  }
}

// ============ 使用示例（全部带空值处理） ============

// 1. 循环消费：先判空，再 dequeue（安全模式）
const q = PriorityQueue.from([3, 1, 4, 1, 5]);
while (!q.isEmpty) {
  const val = q.dequeue();
  if (val !== undefined) {
    console.log(val); // 1, 1, 3, 4, 5
  }
}

// 2. 严格模式：信任业务逻辑保证非空，空了就抛异常
const taskQ = new PriorityQueue<{ id: string; priority: number }>();
taskQ.enqueue({ id: 'A', priority: 2 });
const task = taskQ.dequeueOrThrow(); // 直接拿到 T，无需 ?.
console.log(task.id);

// 3. peek 也必须判空
const next = taskQ.peek();
if (next) {
  console.log(next.id);
} else {
  console.log('队列已空');
}
