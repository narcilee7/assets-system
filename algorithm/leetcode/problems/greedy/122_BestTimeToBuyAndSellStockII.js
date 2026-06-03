// 题目链接：https://leetcode.cn/problems/best-time-to-buy-and-sell-stock-ii/
// 题目描述：给定一个数组 prices ，其中 prices[i] 表示股票第 i 天的价格。你可以进行任意次交易（买入和卖出），但同一时刻只能持有一支股票。求最大利润。

// 输入: prices = [7,1,5,3,6,4]
const input = [7,1,5,3,6,4];
// 期望输出: 7
const expected = 7;

// 主函数
function maxProfit(prices) {
    let profit = 0
    for (let i = 1; i < prices.length; i++) {
        // 每次比较相邻两个元素，如果后一个元素大于前一个元素，则将差值累加到profit中
        if (prices[i] > prices[i - 1]) profit += prices[i] - prices[i - 1]
    }
    return profit
}

// 测试
console.log('输出:', maxProfit(input));
console.log('期望:', expected); 