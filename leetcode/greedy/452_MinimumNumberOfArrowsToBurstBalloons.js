// 题目链接：https://leetcode.cn/problems/minimum-number-of-arrows-to-burst-balloons/
// 题目描述：有一些气球，用水平线上的点表示。气球的开始和结束坐标分别为 xstart 和 xend。你可以沿 x 轴射出箭，求引爆所有气球所需的最小箭数。

// 输入: points = [[10,16],[2,8],[1,6],[7,12]]
const input = [[10,16],[2,8],[1,6],[7,12]];
// 期望输出: 2
const expected = 2;

// 主函数
function findMinArrowShots(points) {
  if (!points.length) return 0;
  points.sort((a, b) => a[1] - b[1]);
  let arrows = 1, end = points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (points[i][0] > end) {
      arrows++;
      end = points[i][1];
    }
  }
  return arrows;
}

// 测试
console.log('输出:', findMinArrowShots(input));
console.log('期望:', expected); 