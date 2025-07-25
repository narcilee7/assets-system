// 题目链接：https://leetcode.cn/problems/remove-element/
// 题目描述：给你一个数组 nums 和一个值 val，你需要原地移除所有数值等于 val 的元素，并返回移除后数组的新长度。

// 输入: nums = [3,2,2,3], val = 3
const nums = [3,2,2,3];
const val = 3;
// 期望输出: 2
const expected = 2;

// 主函数
function removeElement(nums, val) {
    // let slow = 0
    // for (let fast = 0; fast < nums.length; fast++) {
    //     if (nums[fast] !== val) {
    //         nums[slow++] = nums[fast]
    //     }
    // }
    // return slow
    let slow = 0
    for (let fast = 0; fast < nums.length; fast++) {
        if (nums[fast] !== val) {
            nums[slow++] = nums[fast]
        }
    }
    return slow
}

// 测试
console.log('输出:', removeElement([...nums], val));
console.log('期望:', expected); 