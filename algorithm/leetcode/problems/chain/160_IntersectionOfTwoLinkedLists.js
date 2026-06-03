// 题目链接：https://leetcode.cn/problems/intersection-of-two-linked-lists/

// 输入链表: A = [4,1,8,4,5], B = [5,6,1,8,4,5]
// 交点值为8（A[2]和B[3]开始为同一节点）
const inputA = [4, 1];
const inputB = [5, 6, 1];
const common = [8, 4, 5];
// 期望输出: 8
const expected = 8;

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

// 构造相交链表
function buildIntersectList(a, b, common) {
  let commonHead = arrayToList(common);
  let headA = arrayToList(a);
  let headB = arrayToList(b);
  let currA = headA;
  while (currA && currA.next) currA = currA.next;
  if (currA) currA.next = commonHead;
  let currB = headB;
  while (currB && currB.next) currB = currB.next;
  if (currB) currB.next = commonHead;
  return [headA, headB, commonHead];
}

// 相交链表主函数
function getIntersectionNode(headA, headB) {
  let a = headA, b = headB;
  while (a !== b) {
    a = a ? a.next : headB;
    b = b ? b.next : headA;
  }
  return a;
}

// 测试
const [headA, headB, commonHead] = buildIntersectList(inputA, inputB, common);
const result = getIntersectionNode(headA, headB);
console.log('输出:', result ? result.val : null);
console.log('期望:', expected); 