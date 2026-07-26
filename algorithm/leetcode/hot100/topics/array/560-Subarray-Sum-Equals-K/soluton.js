function solution(nums, k) {
  const map = new Map();
  map.set(0, 1); // 前缀和为0出现1次，处理从索引0开始的子数组

  let count = 0;
  let sum = 0;

  for (const num of nums) {
    sum += num;
    // 如果之前存在前缀和sum - k，说明存在和为k的子数组
    if (map.has(sum - k)) {
      count += map.get(sum - k);
    }
    // 记录当前前缀和出现的次数
    map.set(sum, (map.get(sum) || 0) + 1);
  }

  return count;
}
