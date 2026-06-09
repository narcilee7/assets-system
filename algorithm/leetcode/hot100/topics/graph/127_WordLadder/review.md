# LeetCode 127 — Word Ladder

## 模式
BFS / 图

## 识别信号
- 单词变换最短路径
- 每次只能变一个字母
- BFS 求最短步数

## 边界
- beginWord == endWord
- endWord 不在字典中
- 无法变换

## 实现要点
- 建图：每个单词的每个位置替换为 *，相同 pattern 的单词相连
- BFS 从 beginWord 到 endWord
- visited 集合防止重复访问

## 复杂度
- 时间: O(n * L^2) L 为单词长度
- 空间: O(n * L^2)

## 追问
- 双向 BFS？→ 从两端同时搜索更快
- 如何输出最短路径？→ BFS 时记录前驱
- 如果要最少变换次数？→ BFS 层数即变换次数
