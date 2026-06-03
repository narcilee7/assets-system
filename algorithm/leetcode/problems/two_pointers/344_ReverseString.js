// 题目链接：https://leetcode.cn/problems/reverse-string/
// 题目描述：编写一个函数，将输入的字符串数组 s 原地反转。

// 输入: s = ['h','e','l','l','o']
const input = ['h','e','l','l','o'];
// 期望输出: ['o','l','l','e','h']
const expected = ['o','l','l','e','h'];

// 主函数
function reverseString(s) {
    let l = 0, r = s.length - 1
    while (l < r) {
        [s[l], s[r]] = [s[r], s[l]]
        l++
        r--
    }
    return s
}

// 测试
console.log('输出:', reverseString([...input]));
console.log('期望:', expected); 