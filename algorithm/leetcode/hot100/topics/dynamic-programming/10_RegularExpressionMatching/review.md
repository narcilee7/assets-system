# LeetCode 10 — Regular Expression Matching

## 模式
动态规划

## 识别信号
- . 和 * 的正则匹配
- * 匹配零个或多个前面的字符
- 二维 DP

## 边界
- 模式中无 . 和 *
- * 连续出现
- s 和 p 都为空

## 实现要点
- dp[i][j] = s 前 i 个匹配 p 前 j 个
- p[j-1] 是字母：dp[i][j] = dp[i-1][j-1] && s[i-1]==p[j-1]
- p[j-1] 是 .：直接匹配任意字符
- p[j-1] 是 *：min one char = dp[i][j-1]（用1个）or zero char = dp[i][j-2]（不用）

## 复杂度
- 时间: O(mn)
- 空间: O(mn)

## 追问
- 贪心能做吗？→ 不能，有 * 必须 DP
- 如果正则支持 +？→ 类似 *，只是至少一个
- 递归怎么做？→ 自顶向下 + memo
