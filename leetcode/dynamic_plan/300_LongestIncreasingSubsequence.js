// 题目链接：https://leetcode.cn/problems/longest-increasing-subsequence/
// 题目描述：给你一个整数数组 nums，找到其中最长严格递增子序列的长度。

// 输入: nums = [10,9,2,5,3,7,101,18]
const input = [10,9,2,5,3,7,101,18];
// 期望输出: 4
const expected = 4;

// 动态规划主函数
function lengthOfLIS(nums) {
  if (!nums.length) return 0;
  let dp = Array(nums.length).fill(1);
  for (let i = 1; i < nums.length; i++) {
    for (let j = 0; j < i; j++) {
      if (nums[i] > nums[j]) {
        dp[i] = Math.max(dp[i], dp[j] + 1);
      }
    }
  }
  return Math.max(...dp);
}

// 测试
console.log('输出:', lengthOfLIS(input));
console.log('期望:', expected); 