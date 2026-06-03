// 题目链接：https://leetcode.cn/problems/remove-nth-node-from-end-of-list/

// 输入链表: [1,2,3,4,5], n = 2
const input = [1, 2, 3, 4, 5];
const n = 2;
// 期望输出: [1,2,3,5]
const expected = [1, 2, 3, 5];

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

function listToArray(head) {
  let arr = [];
  while (head) {
    arr.push(head.val);
    head = head.next;
  }
  return arr;
}

// 删除倒数第N个节点主函数
function removeNthFromEnd(head, n) {
  let dummy = new ListNode(0, head)
  let fast = dummy, slow = dummy
  // 先让fast走n+1步，然后fast和slow同时走，当fast走到链表末尾时，slow正好走到倒数第n个节点
  for (let i = 0; i < n + 1; i++) fast = fast.next
  while (fast) {
    fast = fast.next
    slow = slow.next
  }
  slow.next = slow.next.next
  return dummy.next
}

// 测试
const head = arrayToList(input);
const result = removeNthFromEnd(head, n);
console.log('输出:', listToArray(result));
console.log('期望:', expected); 