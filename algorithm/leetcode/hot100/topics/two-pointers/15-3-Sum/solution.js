const inputs = [-1, 0, 1, 2, -1, -4];

function solution(nums) {
  const result = [];
  // 排序
  nums.sort((a, b) => a - b);
  const n = nums.length;

  for (let i = 0; i < n - 2; i++) {
    // 去重
    if (i > 0 && nums[i] === nums[i - 1]) continue;

    if (nums[i] + nums[i + 1] + nums[i + 2] > 0) break;
    if (nums[i] + nums[i + 1] + nums[i + 2] < 0) continue;

    let left = i + 1;
    let right = n - 1;

    while (left < right) {
      const sum = nums[i] + nums[left] + nums[right];
      if (sum === 0) {
        result.push([nums[i], nums[left], nums[right]]);
        // 去重
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

  return result;
}
