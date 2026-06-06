# LeetCode 104 — Maximum Depth of Binary Tree

## 模式
树 / DFS / BFS

## 识别信号
- 二叉树最大深度
- 根到最深叶节点的路径长度
- 递归分治 or 层序遍历

## 边界
- 空树 → 0
- 单节点 → 1
- 只有左子树或右子树

## 实现要点
- DFS: `depth = max(left, right) + 1`
- BFS: 层数计数

## 复杂度
- 时间: O(n)
- 空间: O(h) 递归栈深度，h 为树高，最坏 O(n)

## 追问
- 如何在 O(1) 空间（迭代）？→ 栈模拟
- Minimum Depth 怎么写？注意叶子节点的定义
