# 手写 B+Tree 索引

## 目标

实现一个简化版 B+Tree，支持：
1. 插入（保持平衡和有序）
2. 精确查找
3. 范围查询
4. 叶子节点链表（范围扫描）

## 实现

```javascript
// bptree.js

class BPTreeNode {
  constructor(isLeaf = false, order = 4) {
    this.isLeaf = isLeaf;
    this.keys = [];
    this.children = [];  // 内部节点：子节点引用；叶子节点：数据值
    this.next = null;    // 叶子节点链表
    this.order = order;  // 阶数：最多 order-1 个 key
  }

  isFull() {
    return this.keys.length >= this.order - 1;
  }
}

class BPTree {
  constructor(order = 4) {
    this.root = new BPTreeNode(true, order);
    this.order = order;
  }

  // ========== 查找 ==========

  search(key) {
    let node = this.root;

    while (!node.isLeaf) {
      let i = 0;
      while (i < node.keys.length && key >= node.keys[i]) {
        i++;
      }
      node = node.children[i];
    }

    const idx = node.keys.indexOf(key);
    return idx !== -1 ? node.children[idx] : null;
  }

  rangeQuery(start, end) {
    const results = [];
    let node = this._findLeaf(start);

    while (node) {
      for (let i = 0; i < node.keys.length; i++) {
        if (node.keys[i] >= start && node.keys[i] <= end) {
          results.push({ key: node.keys[i], value: node.children[i] });
        }
        if (node.keys[i] > end) {
          return results;
        }
      }
      node = node.next;
    }

    return results;
  }

  _findLeaf(key) {
    let node = this.root;
    while (!node.isLeaf) {
      let i = 0;
      while (i < node.keys.length && key >= node.keys[i]) {
        i++;
      }
      node = node.children[i];
    }
    return node;
  }

  // ========== 插入 ==========

  insert(key, value) {
    const leaf = this._findLeaf(key);

    // 叶子节点插入
    if (!leaf.isFull()) {
      this._insertIntoLeaf(leaf, key, value);
      return;
    }

    // 叶子节点已满，需要分裂
    this._insertIntoLeaf(leaf, key, value);
    this._splitLeaf(leaf);
  }

  _insertIntoLeaf(node, key, value) {
    let i = 0;
    while (i < node.keys.length && key > node.keys[i]) {
      i++;
    }
    node.keys.splice(i, 0, key);
    node.children.splice(i, 0, value);
  }

  _splitLeaf(node) {
    const mid = Math.floor(node.keys.length / 2);
    const newNode = new BPTreeNode(true, this.order);

    // 分裂 key 和 value
    newNode.keys = node.keys.splice(mid);
    newNode.children = node.children.splice(mid);
    newNode.next = node.next;
    node.next = newNode;

    const promotedKey = newNode.keys[0];
    this._insertIntoParent(node, promotedKey, newNode);
  }

  _insertIntoParent(leftNode, key, rightNode) {
    if (leftNode === this.root) {
      const newRoot = new BPTreeNode(false, this.order);
      newRoot.keys = [key];
      newRoot.children = [leftNode, rightNode];
      this.root = newRoot;
      return;
    }

    const parent = this._findParent(this.root, leftNode);
    if (!parent.isFull()) {
      let i = 0;
      while (i < parent.children.length && parent.children[i] !== leftNode) {
        i++;
      }
      parent.keys.splice(i, 0, key);
      parent.children.splice(i + 1, 0, rightNode);
      return;
    }

    // 父节点也满了，继续分裂
    let i = 0;
    while (i < parent.children.length && parent.children[i] !== leftNode) {
      i++;
    }
    parent.keys.splice(i, 0, key);
    parent.children.splice(i + 1, 0, rightNode);
    this._splitInternal(parent);
  }

  _splitInternal(node) {
    const mid = Math.floor(node.keys.length / 2);
    const promotedKey = node.keys[mid];
    const newNode = new BPTreeNode(false, this.order);

    newNode.keys = node.keys.splice(mid + 1);
    newNode.children = node.children.splice(mid + 1);

    node.keys.pop(); // 移除 promoted key

    this._insertIntoParent(node, promotedKey, newNode);
  }

  _findParent(current, target) {
    if (current.isLeaf) return null;

    for (const child of current.children) {
      if (child === target) return current;
      const found = this._findParent(child, target);
      if (found) return found;
    }
    return null;
  }

  // ========== 遍历 ==========

  traverse() {
    const result = [];
    let node = this._leftmostLeaf();

    while (node) {
      for (let i = 0; i < node.keys.length; i++) {
        result.push({ key: node.keys[i], value: node.children[i] });
      }
      node = node.next;
    }

    return result;
  }

  _leftmostLeaf() {
    let node = this.root;
    while (!node.isLeaf) {
      node = node.children[0];
    }
    return node;
  }

  // ========== 打印（调试用）==========

  print() {
    this._printNode(this.root, 0);
  }

  _printNode(node, depth) {
    const indent = '  '.repeat(depth);
    console.log(`${indent}${node.isLeaf ? 'LEAF' : 'NODE'}: [${node.keys.join(', ')}]`);
    if (!node.isLeaf) {
      for (const child of node.children) {
        this._printNode(child, depth + 1);
      }
    }
  }
}

// ========== 使用 ==========

const tree = new BPTree(4);  // 3 阶 B+Tree

// 插入
tree.insert(10, "value_10");
tree.insert(20, "value_20");
tree.insert(5, "value_5");
tree.insert(6, "value_6");
tree.insert(12, "value_12");
tree.insert(30, "value_30");
tree.insert(7, "value_7");
tree.insert(17, "value_17");

// 打印结构
tree.print();

// 查找
console.log('Search 12:', tree.search(12));     // value_12
console.log('Search 99:', tree.search(99));     // null

// 范围查询
console.log('Range [6, 15]:', tree.rangeQuery(6, 15));
// [{key: 6, value: 'value_6'}, {key: 7, value: 'value_7'}, {key: 10, value: 'value_10'}, {key: 12, value: 'value_12'}]

// 全量遍历
console.log('All:', tree.traverse());

module.exports = { BPTree };
```
