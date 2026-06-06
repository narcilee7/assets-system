# LeetCode 322 — Coin Change

## 模式
动态规划 / BFS

## 识别信号
- 最少硬币数凑成 amount
- 完全背包变体
- 无序组合

## 边界
- amount = 0 → 0
- coin 面值大于 amount
- 无法凑成（返回 -1）

## 实现要点
- dp[i] = 凑成 i 最少硬币数
- dp[i] = min(dp[i], dp[i-coin] + 1)
- 初始化 dp[0]=0，其余 INF
- 最终 dp[amount] 或 -1

## 复杂度
- 时间: O(amount * n)
- 空间: O(amount)

## 追问
- 如果要返回具体硬币？→ 记录转移路径
- 如果求组合数？→ dp[i] += dp[i-coin]
- BFS 最短路径方法？→ 图论视角，每枚硬币是边
