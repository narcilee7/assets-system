// 题目链接：https://leetcode.cn/problems/squares-of-a-sorted-array/
// 题目描述：给你一个按非递减顺序排序的整数数组 nums，返回每个数字的平方组成的新数组，要求也按非递减顺序排序。

// 输入: nums = [-4,-1,0,3,10]
const input = [-4,-1,0,3,10];
// 期望输出: [0,1,9,16,100]
const expected = [0,1,9,16,100];

// 主函数
function sortedSquares(nums) {
  let res = Array(nums.length);
  let left = 0, right = nums.length - 1, pos = nums.length - 1;
  while (left <= right) {
    if (Math.abs(nums[left]) > Math.abs(nums[right])) {
      res[pos--] = nums[left] * nums[left++];
    } else {
      res[pos--] = nums[right] * nums[right--];
    }
  }
  return res;
}

// 测试
console.log('输出:', sortedSquares(input));
console.log('期望:', expected); 