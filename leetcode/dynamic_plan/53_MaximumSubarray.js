// 题目链接：https://leetcode.cn/problems/maximum-subarray/
// 题目描述：给定一个整数数组 nums，找到一个具有最大和的连续子数组（子数组最少包含一个元素），返回其最大和。

// 输入: nums = [-2,1,-3,4,-1,2,1,-5,4]
const input = [-2,1,-3,4,-1,2,1,-5,4];
// 期望输出: 6
const expected = 6;

// 动态规划主函数
function maxSubArray(nums) {
  let maxSum = nums[0];
  let currSum = nums[0];
  for (let i = 1; i < nums.length; i++) {
    currSum = Math.max(nums[i], currSum + nums[i]);
    maxSum = Math.max(maxSum, currSum);
  }
  return maxSum;
}

// 测试
console.log('输出:', maxSubArray(input));
console.log('期望:', expected); 