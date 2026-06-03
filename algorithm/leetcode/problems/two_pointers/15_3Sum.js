// 题目链接：https://leetcode.cn/problems/3sum/
// 题目描述：给你一个包含 n 个整数的数组 nums，判断 nums 中是否存在三个元素 a，b，c ，使得 a + b + c = 0？请你找出所有和为 0 且不重复的三元组。

// 输入: nums = [-1,0,1,2,-1,-4]
const input = [-1,0,1,2,-1,-4];
// 期望输出: [[-1,-1,2],[-1,0,1]]
const expected = [[-1,-1,2],[-1,0,1]];

// 主函数
function threeSum(nums) {
  nums.sort((a, b) => a - b);
  let res = [];
  for (let i = 0; i < nums.length - 2; i++) {
    if (i > 0 && nums[i] === nums[i - 1]) continue;
    let left = i + 1, right = nums.length - 1;
    while (left < right) {
      let sum = nums[i] + nums[left] + nums[right];
      if (sum === 0) {
        res.push([nums[i], nums[left], nums[right]]);
        while (left < right && nums[left] === nums[left + 1]) left++;
        while (left < right && nums[right] === nums[right - 1]) right--;
        left++;
        right--;
      } else if (sum < 0) {
        left++;
      } else {
        right--;
      }
    }
  }
  return res;
}

// 测试
console.log('输出:', threeSum(input));
console.log('期望:', expected); 