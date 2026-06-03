// 题目链接：https://leetcode.cn/problems/jump-game/
// 题目描述：给定一个非负整数数组 nums ，你最初位于数组的第一个下标。数组中的每个元素代表你在该位置可以跳跃的最大长度。判断你是否能够到达最后一个下标。

// 输入: nums = [2,3,1,1,4]
const input = [2,3,1,1,4];
// 期望输出: true
const expected = true;

// 主函数
function canJump(nums) {
    let curFarthest = 0
    for (let i = 0; i < nums.length; i++) {
        if (i > curFarthest) return false
        curFarthest = Math.max(curFarthest, i + nums[i])
    }
    return true
}

// 测试
console.log('输出:', canJump(input));
console.log('期望:', expected); 