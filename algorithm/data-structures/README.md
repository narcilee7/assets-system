如果目标是**Go/Python 后端、基础架构、AI Infra、分布式系统**岗位，那么数据结构面试不会像算法竞赛一样考偏题，而是重点考察：

> 是否理解数据结构的设计思想、复杂度分析、工程实现以及如何解决实际问题。

建议按照下面这套 RoadMap 复习。

---

# 第一部分：基础数据结构（100%必考）

## 1. Array（数组）

知识点：

* 连续内存
* 随机访问 O(1)
* 插入删除 O(n)
* Cache Friendly
* 动态数组扩容

经典问题：

* 两数之和
* 删除元素
* Merge Sorted Array
* Rotate Array
* Prefix Sum

面试问题：

> Array 为什么查询快？

> 为什么插入慢？

> 为什么 CPU 更喜欢数组？

> Go slice 为什么快？

---

## 2. Linked List（链表）

知识点

* 单链表
* 双向链表
* 循环链表
* Dummy Head

经典问题

* Reverse Linked List
* Merge List
* Detect Cycle
* Find Middle
* Remove Nth Node

面试喜欢问

为什么链表查找慢？

为什么 Redis LRU 不直接使用单链表？

双向链表有什么优势？

---

## 3. Stack（栈）

特点

LIFO

应用

表达式计算

DFS

括号匹配

浏览器历史

单调栈

经典题

Valid Parentheses

Min Stack

Largest Rectangle

Daily Temperatures

---

## 4. Queue（队列）

FIFO

扩展

Deque

Priority Queue

Circular Queue

Blocking Queue

经典题

Sliding Window Maximum

Top K

BFS

---

# 第二部分：Hash

这是面试频率最高的数据结构。

知识点

Hash Function

Hash Collision

开放寻址

链地址法

Load Factor

Rehash

时间复杂度

平均 O(1)

最坏 O(n)

经典问题

Two Sum

Group Anagrams

LRU

LFU

为什么 Go map 查询快？

为什么 HashMap 会退化？

Go map 为什么不是线程安全？

Redis Dictionary 怎么实现？

---

# 第三部分：Tree

这是整个数据结构核心。

---

## Binary Tree

必须会

前序

中序

后序

层序

递归

迭代

经典题

Maximum Depth

Lowest Common Ancestor

Path Sum

Invert Tree

Serialize Tree

---

## Binary Search Tree

知识点

BST 性质

查找

插入

删除

前驱

后继

复杂度

经典题

Validate BST

Kth Smallest

Recover BST

---

## AVL

为什么出现 AVL

旋转

LL

RR

LR

RL

复杂度

O(log n)

面试通常不会要求手写。

---

## Red Black Tree

这是工程重点。

需要理解：

为什么不用 AVL？

五条性质

为什么高度不会太高？

左旋

右旋

重新染色

应用

Java TreeMap

Linux Scheduler

Go runtime

---

## B Tree

数据库最爱。

需要理解

为什么不是二叉树？

为什么阶数高？

为什么减少 IO？

节点大小为什么一般 4KB 或 16KB？

---

## B+ Tree

数据库必考。

重点

为什么所有数据都在叶子

为什么叶子链表

为什么范围查询快

为什么 MySQL 使用它

---

## Trie

字符串结构

应用

自动补全

搜索提示

词典

经典题

Implement Trie

Word Search

---

## Segment Tree

区间查询

区间修改

Lazy Tag

应用

统计

在线算法

比赛出现较多。

---

## Fenwick Tree（BIT）

Prefix Sum

动态更新

复杂度

O(log n)

---

# 第四部分：Heap

非常重要。

知识点

完全二叉树

最大堆

最小堆

Heapify

Push

Pop

应用

Top K

Priority Queue

Scheduler

Timer

Go container/heap

经典题

Kth Largest

Merge K Lists

Top K Frequent

Median Finder

---

# 第五部分：Graph

后端越来越喜欢。

知识点

表示方法

Adjacency Matrix

Adjacency List

遍历

DFS

BFS

拓扑排序

最短路

Dijkstra

Bellman Ford

Floyd

最小生成树

Kruskal

Prim

并查集

Union Find

经典题

Course Schedule

Number of Islands

Clone Graph

Accounts Merge

---

# 第六部分：Union Find

面试非常高频。

知识点

Parent

Path Compression

Union By Rank

复杂度

近似 O(1)

经典题

朋友圈

岛屿数量

冗余连接

---

# 第七部分：Skip List

Redis 高频。

知识点

为什么快

为什么随机层数

查询

插入

删除

复杂度

平均 O(log n)

应用

Redis ZSet

LevelDB

---

# 第八部分：LRU/LFU（设计题）

这是系统设计的入门。

LRU

HashMap

Double Linked List

复杂度

O(1)

LFU

HashMap

Freq List

Double Linked List

经典题

LRU Cache

LFU Cache

Redis Eviction

---

# 第九部分：Bloom Filter

后端非常喜欢。

知识点

Bitmap

Hash

误判

不会漏判

应用

Redis

数据库

爬虫

缓存穿透

经典问题

为什么会误判？

如何降低误判率？

Counting Bloom Filter 是什么？

---

# 第十部分：Bitmap

位图

应用

海量用户签到

权限系统

Redis Bitmap

Roaring Bitmap

---

# 第十一部分：一致性 Hash

分布式重点。

知识点

Hash Ring

Virtual Node

数据迁移

负载均衡

应用

Redis Cluster

CDN

分布式缓存

---

# 第十二部分：工程数据结构

这是高级岗位会问的。

* LSM Tree（LevelDB、RocksDB）
* WAL
* MemTable
* SSTable
* Log Structured Merge
* Rope（大文本编辑器）
* Radix Tree
* Patricia Trie
* HyperLogLog
* Cuckoo Hash
* Quotient Filter
* RingBuffer（Disruptor）
* MPSC Queue
* Lock-Free Queue

---

# 面试高频排序（按重要程度）

| 优先级   | 数据结构              | 面试频率     | 工程价值 |
| ----- | ----------------- | -------- | ---- |
| ⭐⭐⭐⭐⭐ | Array             | 极高       | 极高   |
| ⭐⭐⭐⭐⭐ | Hash Table        | 极高       | 极高   |
| ⭐⭐⭐⭐⭐ | Linked List       | 极高       | 高    |
| ⭐⭐⭐⭐⭐ | Binary Tree / BST | 极高       | 极高   |
| ⭐⭐⭐⭐⭐ | Heap              | 极高       | 极高   |
| ⭐⭐⭐⭐⭐ | Stack / Queue     | 极高       | 极高   |
| ⭐⭐⭐⭐☆ | Graph             | 高        | 高    |
| ⭐⭐⭐⭐☆ | Trie              | 高        | 高    |
| ⭐⭐⭐⭐☆ | LRU / LFU         | 极高       | 极高   |
| ⭐⭐⭐⭐☆ | Union Find        | 高        | 中    |
| ⭐⭐⭐⭐☆ | B+ Tree           | 极高（数据库）  | 极高   |
| ⭐⭐⭐⭐☆ | Skip List         | 高（Redis） | 高    |
| ⭐⭐⭐☆☆ | Bloom Filter      | 中高       | 高    |
| ⭐⭐⭐☆☆ | Bitmap            | 中        | 高    |
| ⭐⭐⭐☆☆ | Segment Tree      | 中        | 中    |
| ⭐⭐⭐☆☆ | Fenwick Tree      | 中        | 中    |
| ⭐⭐☆☆☆ | AVL               | 较低       | 中    |
| ⭐⭐☆☆☆ | Red-Black Tree    | 中高（原理）   | 高    |
| ⭐⭐☆☆☆ | 一致性 Hash          | 中高（分布式）  | 极高   |

对于你目前准备的方向（Go、Python、Node.js 全栈，目标 AI Infra/后端岗位），建议复习顺序为：

1. 数组、链表、栈、队列、哈希表（基础）
2. 二叉树、BST、堆（算法核心）
3. 图、并查集、Trie（常见扩展）
4. LRU/LFU、跳表、B+ 树（工程高频）
5. Bloom Filter、Bitmap、一致性 Hash（中间件与分布式）
6. LSM Tree、Ring Buffer、Lock-Free Queue 等工程数据结构（高级岗位）

这条路线覆盖了大多数一线互联网公司后端和 AI 基础设施岗位的数据结构考察范围。
