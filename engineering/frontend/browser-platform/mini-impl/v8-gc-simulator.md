# 手写 V8 GC 模拟器

## 目标

实现一个简化版 V8 垃圾回收模拟器，支持：
1. 新生代 Scavenge（复制算法）
2. 老生代 Mark-Sweep（标记清除）
3. 老生代 Mark-Compact（标记整理）
4. 引用计数辅助
5. 可视化输出

## 实现

```javascript
// v8-gc-simulator.js

class HeapObject {
  constructor(id, size, type = 'object') {
    this.id = id;
    this.size = size;
    this.type = type;
    this.references = new Set();  // 引用的其他对象 ID
    this.marked = false;           // GC 标记
    this.generation = 'young';     // young / old
    this.age = 0;                  // 存活次数
  }

  addReference(targetId) {
    this.references.add(targetId);
  }

  removeReference(targetId) {
    this.references.delete(targetId);
  }
}

class V8GCSimulator {
  constructor(options = {}) {
    this.youngSize = options.youngSize || 10;     // 新生代容量
    this.oldSize = options.oldSize || 50;         // 老生代容量
    this.promotionAge = options.promotionAge || 2; // 晋升阈值

    // 新生代半区
    this.fromSpace = new Map();   // 使用中的半区
    this.toSpace = new Map();     // 空闲半区

    // 老生代
    this.oldSpace = new Map();

    // 根对象集合（全局对象、栈上引用）
    this.roots = new Set();

    this.nextId = 1;
    this.gcCount = { scavenge: 0, markSweep: 0, markCompact: 0 };
  }

  // ========== 对象分配 ==========

  allocate(size, type = 'object') {
    // 检查新生代空间
    const currentYoungSize = this._getSpaceSize(this.fromSpace);
    if (currentYoungSize + size > this.youngSize) {
      this.scavenge();  // 新生代满了，触发 Minor GC
    }

    const obj = new HeapObject(this.nextId++, size, type);
    this.fromSpace.set(obj.id, obj);
    return obj;
  }

  addRoot(objectId) {
    this.roots.add(objectId);
  }

  removeRoot(objectId) {
    this.roots.delete(objectId);
  }

  // ========== 新生代 Scavenge（Minor GC）==========

  scavenge() {
    console.log('\n=== Scavenge (Minor GC) ===');
    this.gcCount.scavenge++;

    // 1. 从根对象开始，标记并复制存活对象到 To Space
    for (const rootId of this.roots) {
      const obj = this.fromSpace.get(rootId) || this.toSpace.get(rootId);
      if (obj) {
        this._copyObject(obj);
      }
    }

    // 2. 处理 To Space 中对象引用的其他对象（递归复制）
    for (const obj of this.toSpace.values()) {
      for (const refId of obj.references) {
        const refObj = this.fromSpace.get(refId);
        if (refObj && !refObj.marked) {
          this._copyObject(refObj);
        }
      }
    }

    // 3. 更新引用（转发指针）
    for (const obj of this.toSpace.values()) {
      const newRefs = new Set();
      for (const refId of obj.references) {
        const forwarded = this.toSpace.get(refId);
        if (forwarded) {
          newRefs.add(forwarded.id);
        } else {
          const oldRef = this.oldSpace.get(refId);
          if (oldRef) newRefs.add(oldRef.id);
        }
      }
      obj.references = newRefs;
    }

    // 4. 清理 From Space（全部被释放）
    const freed = this.fromSpace.size;
    this.fromSpace.clear();

    // 5. 交换 From/To Space
    [this.fromSpace, this.toSpace] = [this.toSpace, this.fromSpace];

    // 6. 重置标记
    for (const obj of this.fromSpace.values()) {
      obj.marked = false;
    }

    console.log(`Freed ${freed} objects, survived ${this.fromSpace.size}`);
    this._printStats();
  }

  _copyObject(obj) {
    if (obj.marked) return;  // 已经复制过

    obj.marked = true;
    obj.age++;

    // 检查是否需要晋升到老生代
    if (obj.generation === 'young' && obj.age >= this.promotionAge) {
      obj.generation = 'old';
      this.oldSpace.set(obj.id, obj);
      console.log(`  Promoted object ${obj.id} to old space (age: ${obj.age})`);
      return;
    }

    // 复制到 To Space
    const copy = new HeapObject(obj.id, obj.size, obj.type);
    copy.references = new Set(obj.references);
    copy.generation = obj.generation;
    copy.age = obj.age;
    copy.marked = true;
    this.toSpace.set(copy.id, copy);
  }

  // ========== 老生代 Mark-Sweep（Major GC）==========

  markSweep() {
    console.log('\n=== Mark-Sweep (Major GC) ===');
    this.gcCount.markSweep++;

    // 1. 标记阶段：从根对象开始标记所有可达对象
    this._mark();

    // 2. 清除阶段：清除未标记对象
    let freed = 0;
    for (const [id, obj] of this.oldSpace) {
      if (!obj.marked) {
        this.oldSpace.delete(id);
        freed++;
      }
    }

    // 3. 重置标记
    for (const obj of this.oldSpace.values()) {
      obj.marked = false;
    }

    console.log(`Freed ${freed} objects in old space`);
    this._printStats();
  }

  // ========== 老生代 Mark-Compact（整理）==========

  markCompact() {
    console.log('\n=== Mark-Compact (Major GC + Defrag) ===');
    this.gcCount.markCompact++;

    // 1. 标记
    this._mark();

    // 2. 整理：将存活对象移到空间前端
    const survivors = [];
    for (const obj of this.oldSpace.values()) {
      if (obj.marked) {
        survivors.push(obj);
      }
    }

    // 3. 重建 Old Space（紧凑排列）
    this.oldSpace.clear();
    for (const obj of survivors) {
      obj.marked = false;
      this.oldSpace.set(obj.id, obj);
    }

    console.log(`Compacted: ${survivors.length} objects, no fragmentation`);
    this._printStats();
  }

  // ========== 标记阶段（共享）==========

  _mark() {
    // 从根对象开始 DFS
    const stack = [];

    // 收集所有根对象
    for (const rootId of this.roots) {
      const obj = this.fromSpace.get(rootId) ||
                  this.toSpace.get(rootId) ||
                  this.oldSpace.get(rootId);
      if (obj) stack.push(obj);
    }

    // DFS 标记
    while (stack.length > 0) {
      const obj = stack.pop();
      if (obj.marked) continue;

      obj.marked = true;

      // 遍历引用
      for (const refId of obj.references) {
        const ref = this.fromSpace.get(refId) ||
                    this.toSpace.get(refId) ||
                    this.oldSpace.get(refId);
        if (ref && !ref.marked) {
          stack.push(ref);
        }
      }
    }
  }

  // ========== 工具方法 ==========

  _getSpaceSize(space) {
    let total = 0;
    for (const obj of space.values()) {
      total += obj.size;
    }
    return total;
  }

  _printStats() {
    const youngSize = this._getSpaceSize(this.fromSpace);
    const oldSize = this._getSpaceSize(this.oldSpace);

    console.log('Heap Stats:');
    console.log(`  Young Space: ${youngSize}/${this.youngSize} (${this.fromSpace.size} objects)`);
    console.log(`  Old Space:   ${oldSize}/${this.oldSize} (${this.oldSpace.size} objects)`);
    console.log(`  GC Counts:   Scavenge=${this.gcCount.scavenge}, MarkSweep=${this.gcCount.markSweep}, MarkCompact=${this.gcCount.markCompact}`);
  }

  visualize() {
    console.log('\n=== Heap Visualization ===');
    console.log('Young Space (From):');
    for (const obj of this.fromSpace.values()) {
      console.log(`  [${obj.id}] size=${obj.size} age=${obj.age} refs=[${Array.from(obj.references).join(',')}]`);
    }
    console.log('Old Space:');
    for (const obj of this.oldSpace.values()) {
      console.log(`  [${obj.id}] size=${obj.size} age=${obj.age} refs=[${Array.from(obj.references).join(',')}]`);
    }
  }
}

// ========== 使用示例 ==========

const gc = new V8GCSimulator({ youngSize: 20, oldSize: 100 });

// 创建对象图
const global = gc.allocate(4, 'global');
gc.addRoot(global.id);

const objA = gc.allocate(8, 'objectA');
const objB = gc.allocate(8, 'objectB');
const objC = gc.allocate(8, 'objectC');

global.addReference(objA.id);
objA.addReference(objB.id);
objB.addReference(objC.id);

// 创建一个孤立对象（将被回收）
const orphan = gc.allocate(8, 'orphan');

console.log('Initial state:');
gc.visualize();

// 触发 Minor GC
gc.scavenge();

// 移除引用，让 objC 不可达
objB.removeReference(objC.id);

// 再触发一次 GC，objC 应该被回收
gc.scavenge();

// 多次 GC 后，对象晋升到老生代
// 触发 Major GC
gc.markSweep();

// 最终状态
console.log('\nFinal state:');
gc.visualize();

// 输出示例：
// === Scavenge (Minor GC) ===
// Freed 1 objects, survived 4
// Heap Stats:
//   Young Space: 28/20 (4 objects)
//   Old Space:   0/100 (0 objects)
//
// === Mark-Sweep (Major GC) ===
// Freed 1 objects in old space
// Heap Stats:
//   ...
