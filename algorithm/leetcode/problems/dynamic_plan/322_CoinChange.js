// 题目链接：https://leetcode.cn/problems/coin-change/
// 题目描述：给定不同面额的硬币 coins 和一个总金额 amount。计算凑成总金额所需的最少硬币个数。如果没有任何一种硬币组合能组成总金额，返回 -1。

// 输入: coins = [1,2,5], amount = 11
const coins = [1,2,5];
const amount = 11;
// 期望输出: 3
const expected = 3;

// 动态规划主函数
function coinChange(coins, amount) {
  let dp = Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let coin of coins) {
    for (let i = coin; i <= amount; i++) {
      dp[i] = Math.min(dp[i], dp[i - coin] + 1);
    }
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}

// 测试
console.log('输出:', coinChange(coins, amount));
console.log('期望:', expected); 