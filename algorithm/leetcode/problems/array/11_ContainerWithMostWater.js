// 题目链接：https://leetcode.cn/problems/container-with-most-water/
// 题目描述：给定一个长度为 n 的整数数组 height。有 n 条垂线，第 i 条线的两个端点是 (i, 0) 和 (i, height[i])。找出其中的两条线，使得它们与 x 轴共同构成的容器可以容纳最多的水。

// 输入: height = [1,8,6,2,5,4,8,3,7]
const input = [1,8,6,2,5,4,8,3,7];
// 期望输出: 49
const expected = 49;

// 主函数
function maxArea(height) {
    let left = 0, right = height.length - 1
    let maxArea = 0
    while (left < right) {
        maxArea = Math.max(maxArea, Math.min(height[left], height[right]) * (right - left))
        // 移动较短的边，因为移动较长的边，面积只会更小
        if (height[left] < height[right]) left++
        else right--
    }
    return maxArea
}

// 测试
console.log('输出:', maxArea(input));
console.log('期望:', expected); 