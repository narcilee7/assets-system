// 题目链接：https://leetcode.cn/problems/maximum-depth-of-binary-tree/

// 输入二叉树: [3,9,20,null,null,15,7]
const input = [3, 9, 20, null, null, 15, 7];
// 期望输出: 3
const expected = 3;

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

// 最大深度主函数
function maxDepth(root) {
  if (!root) return 0;
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}

function maxDepth2(root) {
  if (!root) return 0
  const queue = [root]
  let depth = 0
  while (queue.length) {
    const len = queue.length
    for (let i = 0; i < len; i++) {
      const node = queue.shift()
      if (node.left) queue.push(node.left)
      if (node.right) queue.push(node.right)
    }
    depth++
  }
  return depth
}

// 测试
const root = arrayToTree(input);
console.log('输出:', maxDepth(root));
console.log('期望:', expected); 