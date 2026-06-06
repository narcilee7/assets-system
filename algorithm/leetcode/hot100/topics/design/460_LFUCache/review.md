# LeetCode 460 — LFU Cache

## 模式
哈希 + 链表

## 识别信号
- 最近最不常用缓存
- O(1) get 和 put
- 按使用频率淘汰

## 边界
- 容量已满
- 多次访问同一 key
- 新 key 插入

## 实现要点
- 频率映射：freq -> LinkedHashSet
- 维护 minFreq
- get 时移动到高频率 set
- put 时新 key 加入 freq=1，超容量淘汰 freq 最低的

## 复杂度
- 时间: O(1)
- 空间: O(capacity)

## 追问
- LRU 和 LFU 区别？→ LRU 最近时间，LFU 频次
- 线程安全？→ 加锁
- 为什么用 LinkedHashSet？→ 按插入顺序维护淘汰顺序
