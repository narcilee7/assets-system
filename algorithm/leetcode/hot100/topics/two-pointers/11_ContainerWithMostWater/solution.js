const INPUTS = [1, 8, 6, 2, 5, 4, 8, 3, 7];

function solution(heights) {
  let maxArea = 0;
  let left = 0;
  let right = heights.length - 1;

  while (left < right) {
    const area = (right - left) * Math.min(heights[right], heights[left]);
    maxArea = Math.max(maxArea, area);
    // 保留长板才能得到更大面积
    if (heights[left] < heights[right]) {
      left++;
    } else {
      right--;
    }
  }

  return maxArea;
}

console.log(solution(INPUTS));
