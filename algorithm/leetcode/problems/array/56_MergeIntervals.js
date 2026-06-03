// 题目链接：https://leetcode.cn/problems/merge-intervals/
// 题目描述：以数组 intervals 表示若干个区间的集合，请合并所有重叠的区间。

// 输入: intervals = [[1,3],[2,6],[8,10],[15,18]]
const input = [[1,3],[2,6],[8,10],[15,18]];
// 期望输出: [[1,6],[8,10],[15,18]]
const expected = [[1,6],[8,10],[15,18]];

// 主函数
function merge(intervals) {
    if (!intervals.length) return []
    intervals.sort((a, b) => a[0] - b[0])
    // 初始化结果数组
    const res = [intervals[0]]
    for (let i = 1; i < intervals.length; i++) {
        const last = s[res.length - 1]
        if (intervals[i][0] <= last[1]) {
            last[1] = Math.max(last[1], intervals[i][1])
        } else {
            res.push(intervals[i])
        }
    }
    return res
}

// 测试
console.log('输出:', merge(input));
console.log('期望:', expected); 