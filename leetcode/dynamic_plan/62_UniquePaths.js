// 题目链接：https://leetcode.cn/problems/unique-paths/
// 题目描述：一个机器人位于 m x n 网格的左上角，只能向下或向右移动。机器人试图达到网格的右下角。问总共有多少条不同的路径？

// 输入: m = 3, n = 7
const m = 3;
const n = 7;
// 期望输出: 28
const expected = 28;

// 动态规划主函数
function uniquePaths(m, n) {
  let dp = Array(m).fill(0).map(() => Array(n).fill(1));
  for (let i = 1; i < m; i++) {
    for (let j = 1; j < n; j++) {
      dp[i][j] = dp[i - 1][j] + dp[i][j - 1];
    }
  }
  return dp[m - 1][n - 1];
}

// 测试
console.log('输出:', uniquePaths(m, n));
console.log('期望:', expected); 