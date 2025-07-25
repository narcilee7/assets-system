// 题目链接：https://leetcode.cn/problems/reverse-linked-list/

// 输入链表: 1 -> 2 -> 3 -> 4 -> 5
const input = [1, 2, 3, 4, 5];
// 期望输出: 5 -> 4 -> 3 -> 2 -> 1
const expected = [5, 4, 3, 2, 1];

// 链表节点定义
function ListNode(val, next) {
  this.val = val;
  this.next = next || null;
}

// 数组转链表
function arrayToList(arr) {
  let dummy = new ListNode(0);
  let curr = dummy;
  for (let v of arr) {
    curr.next = new ListNode(v);
    curr = curr.next;
  }
  return dummy.next;
}

// 链表转数组
function listToArray(head) {
  let arr = [];
  while (head) {
    arr.push(head.val);
    head = head.next;
  }
  return arr;
}

// 反转链表主函数
function reverseList(head) {
  let pre = null, cur = head
  while (cur) {
    // 先保存下一个节点
    let next = cur.next
    // 反转当前节点
    cur.next = pre
    // 移动pre指针
    pre = cur
    // 移动cur指针
    cur = next
  }
  return pre
}

// 测试
const head = arrayToList(input);
const reversed = reverseList(head);
console.log('输出:', listToArray(reversed));
console.log('期望:', expected); 