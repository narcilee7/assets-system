const INPUTS = [100, 4, 200, 1, 3, 2];
const TARGET = 4;

const solution = (nums) => {
  const set = new Set(nums);
  let maxLen = 0;

  for (const num of set) {
    if (set.has(num - 1)) continue;

    let curNum = num;
    let curLen = 1;

    while (set.has(curNum + 1)) {
      curNum++;
      curLen++;
    }

    maxLen = Math.max(maxLen, curLen);
  }

  return maxLen;
};
