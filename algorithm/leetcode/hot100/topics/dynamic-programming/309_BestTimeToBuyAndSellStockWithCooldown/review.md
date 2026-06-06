# LeetCode 309 — Best Time to Buy and Sell Stock with Cooldown

## 模式
动态规划（状态机）

## 识别信号
- 无限次交易，有冷冻期
- 三种状态：持有、不持有但可买、冷冻
- 状态转移

## 边界
- 单日
- 全下跌
- 都在冷冻期

## 实现要点
- hold[i] = max(hold[i-1], rest[i-1] - price)
- rest[i] = max(rest[i-1], cool[i-1])
- cool[i] = hold[i-1] + price
- 空间优化到 O(1)

## 复杂度
- 时间: O(n)
- 空间: O(1)

## 追问
- 为什么 rest 和 cool 分开？→ 区分"不持有且不能买"和"刚卖掉"
- 如果有多天冷冻期？→ 状态扩展
- 如果有手续费？→ 每个状态转移时减 fee
