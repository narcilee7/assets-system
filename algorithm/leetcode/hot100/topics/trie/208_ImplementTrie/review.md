# LeetCode 208 — Implement Trie

## 模式
前缀树

## 识别信号
- 前缀树（字典树）实现
- insert/search/startsWith
- 字符串集合操作

## 边界
- 空字符串插入/搜索
- 前缀存在但完整单词不存在
- 重复插入

## 实现要点
- 节点包含 children Map 和 isEnd 标记
- insert: 逐字符创建/遍历子节点，末尾标记
- search: 逐字符查找，未找到或未标记结尾 → false
- startsWith: 同 search 但不要求结尾标记

## 复杂度
- 时间: O(len) 每个操作
- 空间: O(total chars)

## 追问
- 如果用数组代替 Map？→ 26字母固定数组，省空间但占内存
- 如果要删除操作？→ isEnd 标记 + 引用计数
- 如果要前缀计数？→ 每个节点维护 count
