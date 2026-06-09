# LeetCode 121 — Best Time to Buy and Sell Stock

## 模式
贪心 / 前缀最小值

## 识别信号
- 只允许一次交易
- 最大化 prices[j] - prices[i] 且 j > i
- 边遍历边记录历史最低价

## 边界
- 单日或单调递减 → 利润 0
- 任意两日相同 → 0

## 实现要点
- 维护 `minPrice`（之前最低买入价）
- 每天计算 `price - minPrice` 更新最大利润
- 最终利润 >= 0

## 复杂度
- 时间: O(n)
- 空间: O(1)

## 追问
- 如果允许无限次交易但有冷冻期？→ DP
- 如果限制交易次数 k？→ DP with k 次交易
- 如果有手续费？→ 在 DP 转移时减去
