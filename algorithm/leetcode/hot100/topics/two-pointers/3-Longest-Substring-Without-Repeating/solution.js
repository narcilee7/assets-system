function solution(strs) {
  let maxLength = 0;
  let start = 0;
  const chartMap = new Map();

  for (let end = 0; end < strs.length; end++) {
    if (chartMap.get(strs[end])) {
      start = Math.max(start, chartMap.get(strs[end]) + 1);
    }
    chartMap.set(strs[end], end);
    maxLength = Math.max(maxLength, end - start + 1);
  }

  return maxLength;
}
