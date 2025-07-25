// 题目链接：https://leetcode.cn/problems/move-zeroes/
// 题目描述：给定一个数组 nums，编写一个函数将所有 0 移动到数组的末尾，同时保持非零元素的相对顺序。

// 输入: nums = [0,1,0,3,12]
const input = [0,1,0,3,12];
// 期望输出: [1,3,12,0,0]
const expected = [1,3,12,0,0];

// 主函数
function moveZeroes(nums) {
    // 下一次插入的位置
    let insertPosition = 0
    for (let num of nums) {
        if (num !== 0) {
            // 将非零元素插入到插入位置
            nums[insertPosition++] = num
        }
    }
    // 将剩余位置填充为0
    while (insertPosition < nums.length) {
        nums[insertPosition++] = 0
    }
    return nums
}

// 测试
console.log('输出:', moveZeroes([...input]));
console.log('期望:', expected); 