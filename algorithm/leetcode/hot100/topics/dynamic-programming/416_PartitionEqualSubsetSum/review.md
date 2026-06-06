# LeetCode 416 — Partition Equal Subset Sum

## 模式
动态规划（子集和）

## 识别信号
- 数组能否分成两个和相等的子集
- 子集和背包
- sum 必须为偶数

## 边界
- sum 为奇数 → false
- 存在元素 > sum/2 → false
- 全相同元素

## 实现要点
- target = sum/2
- dp[i] = 是否能凑出和 i
- 01 背包：一维从后往前遍历
- dp[target] 即答案

## 复杂度
- 时间: O(n * sum)
- 空间: O(sum)

## 追问
- 如果要返回具体分割？→ 记录转移路径
- 如果是找最小差值？→ 类似 DP
- 如果用 bitset 优化？→ 位运算加速
