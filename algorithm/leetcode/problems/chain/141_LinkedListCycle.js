// 题目链接：https://leetcode.cn/problems/linked-list-cycle/

// 输入链表: [3,2,0,-4], pos = 1 (尾部连接到索引1)
const input = [3, 2, 0, -4];
const pos = 1;
// 期望输出: true
const expected = true;

function ListNode(val, next) {
  this.val = val;
  this.next = next || null;
}

// 构造带环链表
function arrayToCycleList(arr, pos) {
  let dummy = new ListNode(0);
  let curr = dummy;
  let nodes = [];
  for (let v of arr) {
    curr.next = new ListNode(v);
    curr = curr.next;
    nodes.push(curr);
  }
  if (pos >= 0) {
    curr.next = nodes[pos];
  }
  return dummy.next;
}

// 环形链表主函数
function hasCycle(head) {
  let slow = head, fast = head
  while (fast && fast.next) {
    slow = slow.next
    fast = fast.next.next
    if (slow === fast) return true
  }
  return false
}

// 测试
const head = arrayToCycleList(input, pos);
console.log('输出:', hasCycle(head));
console.log('期望:', expected); 