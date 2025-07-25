// 题目链接：https://leetcode.cn/problems/add-two-numbers/

// 输入链表: l1 = [2,4,3], l2 = [5,6,4]
const input1 = [2, 4, 3];
const input2 = [5, 6, 4];
// 期望输出: [7, 0, 8]
const expected = [7, 0, 8];

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

// 两数相加主函数
function addTwoNumbers(l1, l2) {
  let dummy = new ListNode(0);
  let curr = dummy;
  let carry = 0;
  while (l1 || l2 || carry) {
    let sum = (l1 ? l1.val : 0) + (l2 ? l2.val : 0) + carry
    // 计算进位
    carry = Math.floor(sum / 10)
    // 创建新节点
    curr.next = new ListNode(sum % 10)
    // 移动指针
    curr = curr.next
    // 移动l1和l2的指针
    if (l1) l1 = l1.next
    if (l2) l2 = l2.next
  }
  return dummy.next;
}

// 测试
const l1 = arrayToList(input1);
const l2 = arrayToList(input2);
const result = addTwoNumbers(l1, l2);
console.log('输出:', listToArray(result));
console.log('期望:', expected); 