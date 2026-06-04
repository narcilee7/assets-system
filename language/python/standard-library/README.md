# Standard Library

这一层训练 Python 标准库的核心数据结构与算法实现。

## 必会概念

- `collections.deque` 的双端队列实现，O(1) 两端操作。
- LRU Cache 的哈希表 + 双向链表结构。
- Trie（前缀树）用于字符串检索和自动补全。
- Top K 问题的堆（heapq）解法。
- 图的 BFS/DFS 遍历与拓扑排序。

## 已有资产

| 资产 | 目录 | 状态 | 目标 |
|------|------|------|------|
| 数据结构 | `data_structures/` | seed | LRU、Trie、Top K、BFS、DFS |

## 题单

| 题目 | 文件/目录 | 状态 | 关键点 |
|------|----------|------|--------|
| LRU Cache | `data_structures/lru.py` | todo | 哈希表 + 双向链表 |
| Trie | `data_structures/trie.py` | todo | 前缀树、节点设计 |
| Top K | `data_structures/top_k.py` | todo | 堆、快速选择 |
| 二分查找 | `data_structures/binary_search.py` | todo | 边界处理、循环不变式 |
| BFS / DFS | `data_structures/graph_traversal.py` | todo | 队列、栈、访问标记 |
| 拓扑排序 | `data_structures/topological_sort.py` | todo | 入度表、Kahn 算法 |
