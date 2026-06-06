# LeetCode 230 — Kth Smallest Element in a BST

## 模式
BST / 中序遍历

## 识别信号
- BST 中第 k 小的元素
- BST 中序遍历有序
- 第 k 个元素

## 边界
- k > 节点数
- k = 1
- 单边树

## 实现要点
- 中序遍历 BST（递归或迭代）
- 第 k 个访问即答案
- 迭代 O(h) 空间

## 复杂度
- 时间: O(n)
- 空间: O(h)

## 追问
- 如果要 O(1) 空间？→ Morris 中序遍历
- 如果是普通二叉树？→ 同样的中序遍历
- 如果频繁查询不同 k？→ 缓存中序序列或 augment tree
