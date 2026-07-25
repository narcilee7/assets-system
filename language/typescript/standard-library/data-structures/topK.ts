/**
 * 手写 Top K
 *
 * 考点：
 * - 使用小顶堆维护前 K 大元素。
 */

export function topK<T>(items: Iterable<T>, k: number, key?: (item: T) => number): T[] {
  if (k <= 0) return [];
  const heap = new MinHeap<T>(key);
  for (const item of items) {
    if (heap.size < k) {
      heap.push(item);
    } else if ((key ? key(item) : (item as unknown as number)) > heap.peek()!) {
      heap.pop();
      heap.push(item);
    }
  }
  return heap.toArray().sort((a, b) => (key ? key(a) : (a as unknown as number)) - (key ? key(b) : (b as unknown as number)));
}

class MinHeap<T> {
  private data: T[] = [];

  constructor(private key?: (item: T) => number) {}

  get size(): number {
    return this.data.length;
  }

  push(item: T): void {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const end = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = end;
      this.bubbleDown(0);
    }
    return top;
  }

  peek(): number | undefined {
    if (this.data.length === 0) return undefined;
    return this.key ? this.key(this.data[0]) : (this.data[0] as unknown as number);
  }

  toArray(): T[] {
    return [...this.data];
  }

  private value(item: T): number {
    return this.key ? this.key(item) : (item as unknown as number);
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.value(this.data[index]) >= this.value(this.data[parent])) break;
      [this.data[index], this.data[parent]] = [this.data[parent], this.data[index]];
      index = parent;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      let smallest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      if (left < this.data.length && this.value(this.data[left]) < this.value(this.data[smallest])) {
        smallest = left;
      }
      if (right < this.data.length && this.value(this.data[right]) < this.value(this.data[smallest])) {
        smallest = right;
      }
      if (smallest === index) break;
      [this.data[index], this.data[smallest]] = [this.data[smallest], this.data[index]];
      index = smallest;
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(topK([3, 1, 5, 12, 2, 11], 3));
  console.log(topK(["apple", "banana", "cherry"], 2, (w) => w.length));
}
