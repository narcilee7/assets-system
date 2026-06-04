# Standard Library

这一层训练 Java 标准库的核心 API：Collections、Stream、NIO、Comparator。

## 必会概念

- HashMap：数组 + 链表/红黑树，负载因子 0.75，扩容 2 倍。
- ArrayList：动态数组，扩容 1.5 倍。
- ConcurrentHashMap：分段锁（Java 7）或 CAS + synchronized（Java 8+）。
- Stream：数据源 → 中间操作 → 终止操作。
- NIO：Channel + Buffer + Selector，非阻塞 I/O。

## 题单

| 题目 | 文件/目录 | 状态 | 关键点 |
|------|----------|------|--------|
| HashMap 原理 | `hashmap-internals/` | todo | hash、索引、链表转红黑树 |
| ArrayList vs LinkedList | `list-comparison/` | todo | 随机访问、插入删除 |
| ConcurrentHashMap | `concurrent-hashmap/` | todo | 分段锁、size 估计 |
| Comparator 与排序 | `comparator-sort/` | todo | 自然排序、定制排序、稳定性 |
| NIO Buffer | `nio-buffer/` | todo | 读模式、写模式、flip、clear |
