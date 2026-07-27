/**
 * 原地哈希(鸽巢原理)
 *
 * 答案一定在`[1, n + 1]`范围内，
 * n为数组长度，数组本身有n个位置，正好可以当哈希表用
 * 让索引i上放值i+1
 */
function soluction(nums) {
  const n = nums.length;

  for (let i = 0; i < n; i++) {
    while (nums[i] >= 1 && nums[i] <= n && nums[i] !== nums[nums[i] - 1]) {
      const correctIndex = nums[i] - 1;
      [nums[i], nums[correctIndex]] = [nums[correctIndex], nums[i]];
    }
  }

  for (let i = 0; i < n; i++) {
    if (nums[i] !== i + 1) {
      return i + 1;
    }
  }

  return n + 1;
}
