// 题目链接：https://leetcode.cn/problems/two-sum/
// 题目描述：给定一个整数数组 nums 和一个目标值 target，请你在该数组中找出和为目标值的那两个整数，并返回它们的数组下标。

// 输入: nums = [2,7,11,15], target = 9
const nums = [2,7,11,15];
const target = 9;
// 期望输出: [0,1]
const expected = [0,1];

// 主函数
function twoSum(nums, target) {
  const map = new Map()
  for (let i = 0; i < nums.length; i++) {
    const diff = target - nums[i]
    if (map.has(diff)) return [map.get(diff), i]
    map.set(nums[i], i)
  }
  return []
}

// 测试
console.log('输出:', twoSum(nums, target));
console.log('期望:', expected); 