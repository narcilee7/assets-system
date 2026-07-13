Linked List（链表）是面试中的第二大基础数据结构。它和 Array 正好形成鲜明对比，很多面试官会连续问："数组和链表有什么区别？为什么 LRU 用双向链表？为什么 Go 的 runtime 很少使用链表？"

所以学习链表，不只是会反转链表，而是理解**内存布局 → 指针操作 → 工程应用**。

---

# 第一章 Linked List 的本质

一句话定义：

> **Linked List 是由若干个节点组成，每个节点保存数据和指向下一个（或前一个）节点的指针，节点在内存中不要求连续。**

例如：

```text
+---------+    +---------+    +---------+
| val = 1 | -> | val = 2 | -> | val = 3 | -> nil
| next ---|    | next ---|    | next ---|
+---------+    +---------+    +---------+
```

内存可能是：

```text
0x1000  Node(1)

0x8F20  Node(2)

0x3150  Node(3)
```

彼此完全不连续。

---

# 第二章 为什么查找是 O(n)

访问第 3 个节点：

```text
head

↓

1

↓

2

↓

3
```

必须一个一个沿着 `next` 指针走。

不像数组：

```text
base + index * sizeof(T)
```

因此：

* 按下标访问：不存在
* 查找第 k 个节点：O(n)

---

# 第三章 插入为什么快

例如：

```text
1 -> 2 -> 4
```

插入 3：

```text
1 -> 2 -> 3 -> 4
```

真正修改的只有两个指针：

```go
newNode.Next = node.Next
node.Next = newNode
```

不需要移动后面的元素。

已知插入位置时：

**O(1)**。

注意这里有一个经典陷阱：

> **找到插入位置仍然需要 O(n)。**

因此常说：

* 已知节点：O(1)
* 找节点：O(n)

---

# 第四章 删除为什么快

删除：

```text
1 -> 2 -> 3 -> 4
```

删除 3：

```text
1 -> 2 -----> 4
```

只需要：

```go
prev.Next = cur.Next
```

也是 O(1)。

---

# 第五章 单链表 vs 双向链表

## 单链表

```text
1 -> 2 -> 3
```

优点：

* 节省空间
* 实现简单

缺点：

不能回退。

---

## 双向链表

```text
nil <- 1 <-> 2 <-> 3 -> nil
```

每个节点：

```go
type Node struct {
    Prev *Node
    Next *Node
}
```

优点：

* 可以向前
* 可以向后
* 删除节点 O(1)

缺点：

多一个指针。

---

# 第六章 为什么 LRU 用双向链表？

这是高频面试题。

LRU 要求：

最近访问：

```text
放头部
```

淘汰：

```text
删尾部
```

如果单链表：

删除尾节点需要：

```text
head

↓

...

↓

tail
```

必须找到：

```text
tail 的前驱
```

O(n)。

双向链表：

```go
tail.Prev
```

直接得到。

因此：

HashMap + Double Linked List

就是经典 LRU。

---

# 第七章 Dummy Head（哑节点）

几乎所有链表题都建议使用 Dummy Head。

例如：

```text
dummy -> 1 -> 2 -> 3
```

这样：

删除头节点：

```text
dummy -> 2 -> 3
```

不用特殊处理。

很多 LeetCode 官方题解都采用这种写法。

---

# 第八章 Fast & Slow Pointer（快慢指针）

链表最重要技巧。

例如：

```text
slow

↓

1 → 2 → 3 → 4 → 5

↓

fast
```

每次：

```text
slow +=1

fast +=2
```

用途：

* 找中点
* 判断环
* 找倒数第 K 个
* 判断回文

几乎所有链表题都会出现。

---

# 第九章 环（Cycle）

经典：

```text
1 → 2 → 3
     ↑   ↓
     ← 4
```

为什么快慢指针能检测？

数学证明：

设：

慢：

```text
1 步
```

快：

```text
2 步
```

进入环后：

快指针每轮：

```text
比慢多走一步
```

一定追上。

这是 Floyd Cycle Detection。

时间：

O(n)

空间：

O(1)

---

# 第十章 Reverse Linked List（反转链表）

这是所有公司都会考。

模板：

```go
var prev *ListNode
cur := head

for cur != nil {
    next := cur.Next
    cur.Next = prev
    prev = cur
    cur = next
}

return prev
```

理解三个指针：

* prev
* cur
* next

比死记代码更重要。

---

# 第十一章 工程中的链表

很多人认为链表无处不在，其实现代系统中并非如此。

链表的问题：

* Cache 不友好
* 每个节点额外存储指针
* 内存碎片严重
* CPU Prefetch 几乎失效

因此：

现代高性能系统（Go runtime、Java GC、数据库存储引擎）更多使用：

* Array
* Slice
* Vector
* Ring Buffer

链表主要保留在：

* LRU Cache
* LFU Cache
* Linux Kernel 链表
* Free List（内存分配器）
* Hash Bucket（部分实现）
* Undo/Redo 链

因此可以总结一句：

> **链表的优势来自 O(1) 指针修改，劣势来自随机内存访问和缓存局部性差。现代工程中，只在确实需要频繁插入、删除且已知节点位置时才会优先考虑链表。**

---

# LeetCode 推荐题目

建议按这个顺序完成：

| 题号  | 题目                                 | 核心知识点               |
| --- | ---------------------------------- | ------------------- |
| 206 | Reverse Linked List                | 三指针、迭代              |
| 21  | Merge Two Sorted Lists             | 双指针                 |
| 83  | Remove Duplicates from Sorted List | 链表遍历                |
| 203 | Remove Linked List Elements        | Dummy Head          |
| 876 | Middle of the Linked List          | 快慢指针                |
| 141 | Linked List Cycle                  | Floyd 判环            |
| 142 | Linked List Cycle II               | 环入口证明               |
| 19  | Remove Nth Node From End           | 快慢指针                |
| 234 | Palindrome Linked List             | 快慢指针 + 反转           |
| 160 | Intersection of Two Linked Lists   | 双指针相遇技巧             |
| 138 | Copy List with Random Pointer      | 哈希表 / 原地复制          |
| 146 | LRU Cache                          | HashMap + 双向链表（设计题） |

对于后端岗位来说，这些题已经覆盖了链表相关的大部分考点。真正重要的是能够总结出几类固定模式：**Dummy Head、双指针、快慢指针、三指针反转，以及 HashMap + 双向链表**。掌握这些模板后，大多数链表题都可以归类求解。
