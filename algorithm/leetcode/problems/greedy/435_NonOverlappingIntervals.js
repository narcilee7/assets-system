// 题目链接：https://leetcode.cn/problems/non-overlapping-intervals/
// 题目描述：给定一个区间的集合 intervals，找到需要移除区间的最小数量，使剩余区间互不重叠。

// 输入: intervals = [[1,2],[2,3],[3,4],[1,3]]
const input = [[1,2],[2,3],[3,4],[1,3]];
// 期望输出: 1
const expected = 1;

// 主函数
function eraseOverlapIntervals(intervals) {
  if (!intervals.length) return 0;
  intervals.sort((a, b) => a[1] - b[1]);
  let count = 1, end = intervals[0][1];
  for (let i = 1; i < intervals.length; i++) {
    if (intervals[i][0] >= end) {
      count++;
      end = intervals[i][1];
    }
  }
  return intervals.length - count;
}

// 测试
console.log('输出:', eraseOverlapIntervals(input));
console.log('期望:', expected); 