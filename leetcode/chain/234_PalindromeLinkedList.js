// 题目链接：https://leetcode.cn/problems/palindrome-linked-list/

// 输入链表: [1,2,2,1]
const input = [1, 2, 2, 1];
// 期望输出: true
const expected = true;

function ListNode(val, next) {
  this.val = val;
  this.next = next || null;
}

function arrayToList(arr) {
  let dummy = new ListNode(0);
  let curr = dummy;
  for (let v of arr) {
    curr.next = new ListNode(v);
    curr = curr.next;
  }
  return dummy.next;
}

// 回文链表主函数
function isPalindrome(head) {
  let arr = [];
  while (head) {
    arr.push(head.val);
    head = head.next;
  }
  for (let i = 0, j = arr.length - 1; i < j; i++, j--) {
    if (arr[i] !== arr[j]) return false;
  }
  return true;
}

// 测试
const head = arrayToList(input);
console.log('输出:', isPalindrome(head));
console.log('期望:', expected); 