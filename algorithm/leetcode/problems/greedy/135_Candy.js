// 题目链接：https://leetcode.cn/problems/candy/
// 题目描述：老师要给孩子们分发糖果，每个孩子至少分到1颗糖果。相邻的孩子中，评分高的孩子必须获得更多的糖果。求最少需要多少颗糖果。

// 输入: ratings = [1,0,2]
const input = [1,0,2];
// 期望输出: 5
const expected = 5;

// 主函数
function candy(ratings) {
  let n = ratings.length;
  let candies = Array(n).fill(1);
  for (let i = 1; i < n; i++) {
    if (ratings[i] > ratings[i - 1]) candies[i] = candies[i - 1] + 1;
  }
  for (let i = n - 2; i >= 0; i--) {
    if (ratings[i] > ratings[i + 1]) candies[i] = Math.max(candies[i], candies[i + 1] + 1);
  }
  return candies.reduce((a, b) => a + b, 0);
}

// 测试
console.log('输出:', candy(input));
console.log('期望:', expected); 