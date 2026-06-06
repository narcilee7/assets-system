# LeetCode 215 — Kth Largest Element in an Array

## 模式
堆 / 快速选择

## 识别信号
- 找第 k 大的元素
- 不排序全部
- O(n) 期望

## 边界
- k = 1
- k = n
- k = n/2

## 实现要点
- 堆：建大小为 k 的小顶堆，遍历维护
- 快速选择：类似快排 partition，找第 k 大时只用一半
- 堆 O(n log k)，快速选择 O(n) 期望

## 复杂度
- 时间: O(n log k) 堆 或 O(n) 快速选择
- 空间: O(1) 原地

## 追问
- 排序做法？→ O(n log n)
- 如果流式数据？→ 堆更适合
- 如果要返回前 k 大？→ 堆弹出 k 次
