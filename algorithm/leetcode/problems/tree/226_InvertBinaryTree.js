// 题目链接：https://leetcode.cn/problems/invert-binary-tree/

// 输入二叉树: [4,2,7,1,3,6,9]
const input = [4,2,7,1,3,6,9];
// 期望输出: [4,7,2,9,6,3,1]
const expected = [4,7,2,9,6,3,1];

function TreeNode(val, left, right) {
  this.val = val;
  this.left = left || null;
  this.right = right || null;
}

function arrayToTree(arr) {
  if (!arr.length) return null;
  let root = new TreeNode(arr[0]);
  let queue = [root];
  let i = 1;
  while (queue.length && i < arr.length) {
    let node = queue.shift();
    if (arr[i] != null) {
      node.left = new TreeNode(arr[i]);
      queue.push(node.left);
    }
    i++;
    if (i < arr.length && arr[i] != null) {
      node.right = new TreeNode(arr[i]);
      queue.push(node.right);
    }
    i++;
  }
  return root;
}

// 翻转二叉树主函数
function invertTree(root) {
    if (!root) return null
    const left = invertTree(root.left)
    const right = invertTree(root.right)
    root.left = right
    root.right = left
    return root
}

// 层序遍历输出
function treeToArray(root) {
  if (!root) return [];
  let res = [];
  let queue = [root];
  while (queue.length) {
    let node = queue.shift();
    if (node) {
      res.push(node.val);
      queue.push(node.left);
      queue.push(node.right);
    } else {
      res.push(null);
    }
  }
  // 去除末尾多余的null
  while (res[res.length-1] === null) res.pop();
  return res;
}

// 测试
const root = arrayToTree(input);
const inverted = invertTree(root);
console.log('输出:', treeToArray(inverted));
console.log('期望:', expected); 