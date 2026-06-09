# 手写 LRU Cache

## 目标

实现一个 LRU（Least Recently Used）缓存，支持：
1. O(1) 的 get 和 put
2. 容量限制，超出时淘汰最久未使用的数据
3. 可选 TTL（Time-To-Live）支持

这是 Redis 的 `allkeys-lru` / `volatile-lru` 淘汰策略的核心数据结构，也是几乎所有缓存系统的基石。

## 实现

```javascript
// lru-cache.js

class LRUCacheNode {
  constructor(key, value, ttl = null) {
    this.key = key;
    this.value = value;
    this.prev = null;
    this.next = null;
    this.expiresAt = ttl ? Date.now() + ttl : null;
  }

  isExpired() {
    return this.expiresAt !== null && Date.now() > this.expiresAt;
  }
}

class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();  // key -> node
    this.head = new LRUCacheNode(null, null);  // 哨兵头（最近使用）
    this.tail = new LRUCacheNode(null, null);  // 哨兵尾（最久未使用）
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.size = 0;
  }

  // ========== 核心操作 ==========

  get(key) {
    const node = this.cache.get(key);
    if (!node) return null;

    if (node.isExpired()) {
      this._removeNode(node);
      this.cache.delete(key);
      this.size--;
      return null;
    }

    // 移到头部（最近使用）
    this._moveToHead(node);
    return node.value;
  }

  put(key, value, ttl = null) {
    const node = this.cache.get(key);

    if (node) {
      // 更新现有节点
      node.value = value;
      node.expiresAt = ttl ? Date.now() + ttl : null;
      this._moveToHead(node);
      return;
    }

    // 新建节点
    const newNode = new LRUCacheNode(key, value, ttl);
    this.cache.set(key, newNode);
    this._addToHead(newNode);
    this.size++;

    // 超出容量，淘汰尾部
    if (this.size > this.capacity) {
      const removed = this._removeTail();
      this.cache.delete(removed.key);
      this.size--;
    }
  }

  delete(key) {
    const node = this.cache.get(key);
    if (!node) return false;

    this._removeNode(node);
    this.cache.delete(key);
    this.size--;
    return true;
  }

  // ========== 链表操作 ==========

  _addToHead(node) {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next.prev = node;
    this.head.next = node;
  }

  _removeNode(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  _moveToHead(node) {
    this._removeNode(node);
    this._addToHead(node);
  }

  _removeTail() {
    const node = this.tail.prev;
    this._removeNode(node);
    return node;
  }

  // ========== 辅助方法 ==========

  keys() {
    const result = [];
    let current = this.head.next;
    while (current !== this.tail) {
      if (!current.isExpired()) {
        result.push(current.key);
      }
      current = current.next;
    }
    return result;
  }

  entries() {
    const result = [];
    let current = this.head.next;
    while (current !== this.tail) {
      if (!current.isExpired()) {
        result.push([current.key, current.value]);
      }
      current = current.next;
    }
    return result;
  }

  clear() {
    this.cache.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.size = 0;
  }

  getSize() {
    return this.size;
  }
}

// ========== 使用 ==========

const cache = new LRUCache(3);

cache.put('a', 1);
cache.put('b', 2);
cache.put('c', 3);

console.log(cache.keys());  // ['c', 'b', 'a']（头到尾）

cache.get('a');  // a 变为最近使用
console.log(cache.keys());  // ['a', 'c', 'b']

cache.put('d', 4);  // 超出容量，淘汰 b
console.log(cache.keys());  // ['d', 'a', 'c']
console.log(cache.get('b'));  // null（已被淘汰）

// TTL 示例
const cacheWithTTL = new LRUCache(100);
cacheWithTTL.put('session:123', { user: 'Alice' }, 5000);  // 5秒过期
console.log(cacheWithTTL.get('session:123'));  // { user: 'Alice' }

setTimeout(() => {
  console.log(cacheWithTTL.get('session:123'));  // null（已过期）
}, 6000);

// ========== 进阶：LFU 混合策略 ==========

class LFUCacheNode extends LRUCacheNode {
  constructor(key, value) {
    super(key, value);
    this.freq = 1;
  }
}

class LFUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.minFreq = 0;
    this.size = 0;
    this.keyTable = new Map();  // key -> node
    this.freqTable = new Map(); // freq -> DoublyLinkedList
  }

  get(key) {
    const node = this.keyTable.get(key);
    if (!node) return null;
    this._increaseFreq(node);
    return node.value;
  }

  put(key, value) {
    if (this.capacity === 0) return;

    const node = this.keyTable.get(key);
    if (node) {
      node.value = value;
      this._increaseFreq(node);
      return;
    }

    if (this.size >= this.capacity) {
      this._evictMinFreq();
    }

    const newNode = new LFUCacheNode(key, value);
    this.keyTable.set(key, newNode);
    this._addToFreqList(1, newNode);
    this.minFreq = 1;
    this.size++;
  }

  _increaseFreq(node) {
    const oldFreq = node.freq;
    this._removeFromFreqList(oldFreq, node);

    if (oldFreq === this.minFreq && this.freqTable.get(oldFreq).size === 0) {
      this.minFreq++;
    }

    node.freq++;
    this._addToFreqList(node.freq, node);
  }

  _evictMinFreq() {
    const list = this.freqTable.get(this.minFreq);
    const node = list.removeTail();
    this.keyTable.delete(node.key);
    this.size--;
  }

  _addToFreqList(freq, node) {
    if (!this.freqTable.has(freq)) {
      this.freqTable.set(freq, new DoublyLinkedList());
    }
    this.freqTable.get(freq).addToHead(node);
  }

  _removeFromFreqList(freq, node) {
    this.freqTable.get(freq).remove(node);
  }
}

class DoublyLinkedList {
  constructor() {
    this.head = new LFUCacheNode(null, null);
    this.tail = new LFUCacheNode(null, null);
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.size = 0;
  }

  addToHead(node) {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next.prev = node;
    this.head.next = node;
    this.size++;
  }

  remove(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
    this.size--;
  }

  removeTail() {
    if (this.size === 0) return null;
    const node = this.tail.prev;
    this.remove(node);
    return node;
  }
}

module.exports = { LRUCache, LFUCache };
```
