# LeetCode 494 — Target Sum

## 模式
动态规划 / DFS

## 识别信号
- 给数组每个元素加 + 或 -，结果为 target 的方式数
- 转换为子集和
- count 问题

## 边界
- target 为 0 → 2^n 种
- target 很大 → 0
- 全相同符号

## 实现要点
- sum(+) - sum(-) = target
- sum(+) = (target + total) / 2
- DP: dp[i] = 凑成 i 的方法数
- 需 (target + total) 为偶数

## 复杂度
- 时间: O(n * sum)
- 空间: O(sum)

## 追问
- DFS 怎么做？→ 递归尝试加减，指数级
- 如果是求是否存在？→ 改为 boolean DP
- 转移方程怎么理解？→ 设正集合 P，目标和 S，P 中元素和 = (target+total)/2
