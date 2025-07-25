// 题目链接：https://leetcode.cn/problems/merge-two-sorted-lists/

// 输入链表: l1 = [1,2,4], l2 = [1,3,4]
const input1 = [1, 2, 4];
const input2 = [1, 3, 4];
// 期望输出: [1,1,2,3,4,4]
const expected = [1, 1, 2, 3, 4, 4];

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

// 合并两个有序链表主函数
function mergeTwoLists(l1, l2) {
  let dummy = new ListNode(0)
  let curr = dummy
  while (l1 && l2) {
    if (l1.val < l2.val) {
      curr.next = l1
      l1 = l1.next
    } else {
      curr.next = l2
      l2 = l2.next
    }
    // 移动curr指针
    curr = curr.next
  }
  // 将剩余的节点连接到新链表的末尾
  curr.next = l1 || l2
  return dummy.next
}

// 测试
const l1 = arrayToList(input1);
const l2 = arrayToList(input2);
const result = mergeTwoLists(l1, l2);
console.log('输出:', listToArray(result));
console.log('期望:', expected); 