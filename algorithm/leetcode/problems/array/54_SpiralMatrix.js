// 题目链接：https://leetcode.cn/problems/spiral-matrix/
// 题目描述：给你一个 m x n 的矩阵，请按照顺时针螺旋顺序，返回矩阵中的所有元素。

// 输入: matrix = [[1,2,3],[4,5,6],[7,8,9]]
const input = [[1,2,3],[4,5,6],[7,8,9]];
// 期望输出: [1,2,3,6,9,8,7,4,5]
const expected = [1,2,3,6,9,8,7,4,5];

// 主函数
function spiralOrder(matrix) {
  if (!matrix.length) return [];
  let res = [];
  let top = 0, bottom = matrix.length - 1;
  let left = 0, right = matrix[0].length - 1;
  while (top <= bottom && left <= right) {
    for (let i = left; i <= right; i++) res.push(matrix[top][i]);
    top++;
    for (let i = top; i <= bottom; i++) res.push(matrix[i][right]);
    right--;
    if (top <= bottom) {
      for (let i = right; i >= left; i--) res.push(matrix[bottom][i]);
      bottom--;
    }
    if (left <= right) {
      for (let i = bottom; i >= top; i--) res.push(matrix[i][left]);
      left++;
    }
  }
  return res;
}

// 测试
console.log('输出:', spiralOrder(input));
console.log('期望:', expected); 