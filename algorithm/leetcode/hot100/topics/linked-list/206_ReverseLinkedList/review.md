# LeetCode 206 — Reverse Linked List

## 模式
链表 / 递归 / 双指针

## 识别信号
- 反转链表方向
- 头节点变尾节点
- 迭代三指针 or 递归

## 边界
- 空链表 → null
- 单节点 → 本身
- 两节点

## 实现要点
- 迭代: prev=null, curr=head，边走边反转
- 递归: head.next 反转后，把 head 接到尾部

## 复杂度
- 时间: O(n)
- 空间: 迭代 O(1)，递归 O(n) 栈

## 追问
- 如果要 in-place？→ 迭代 already in-place
- 如果要求返回新头指针？→ 递归的返回值
- 反转前 N 个节点？→ 记录第 N+1 个节点
