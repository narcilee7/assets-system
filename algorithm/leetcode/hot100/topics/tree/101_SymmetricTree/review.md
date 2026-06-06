# LeetCode 101 — Symmetric Tree

## 模式
树 / DFS / 双指针

## 识别信号
- 判断二叉树是否对称
- 左子树和右子树互为镜像
- 递归比较左右子树

## 边界
- 空树 → true
- 单节点 → true
- 左右子树结构不对称

## 实现要点
- isMirror(t1, t2): t1.val === t2.val && isMirror(t1.left, t2.right) && isMirror(t1.right, t2.left)
- 或用队列迭代比较

## 复杂度
- 时间: O(n)
- 空间: O(h) 递归栈，最坏 O(n)

## 追问
- 如果不用递归？→ 队列迭代
- 如果比较两棵树是否相同？→ 类似但左右子树对称互换
- 对称和相同的区别？
