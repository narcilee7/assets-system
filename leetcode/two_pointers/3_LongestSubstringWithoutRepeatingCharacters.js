// 题目链接：https://leetcode.cn/problems/longest-substring-without-repeating-characters/
// 题目描述：给定一个字符串 s ，请你找出其中不含有重复字符的 最长子串 的长度。

// 输入: s = 'abcabcbb'
const input = 'abcabcbb';
// 期望输出: 3
const expected = 3;

// 主函数
function lengthOfLongestSubstring(s) {
    const set = new Set()
    let l = 0, maxLen = 0
    for (let r = 0; r < s.length; r++) {
        while (set.has(s[r])) {
            set.delete(s[l++])
        }
        set.add(s[r])
        maxLen = Math.max(maxLen, r - l + 1)
    }
    return maxLen
}

// 测试
console.log('输出:', lengthOfLongestSubstring(input));
console.log('期望:', expected); 