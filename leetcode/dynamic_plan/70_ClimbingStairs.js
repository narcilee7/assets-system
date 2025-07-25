// 题目链接：https://leetcode.cn/problems/climbing-stairs/
// 题目描述：假设你正在爬楼梯。需要 n 阶你才能到达楼顶。每次你可以爬 1 或 2 个台阶。请问有多少种不同的方法可以爬到楼顶？

// 输入: n = 5
const input = 5;
// 期望输出: 8
const expected = 8;

// 动态规划主函数
function climbStairs(n) {
  if (n <= 2) return n;
  let dp = [0, 1, 2];
  for (let i = 3; i <= n; i++) {
    dp[i] = dp[i - 1] + dp[i - 2];
  }
  return dp[n];
}

// 测试
console.log('输出:', climbStairs(input));
console.log('期望:', expected); 