// 题目链接：https://leetcode.cn/problems/binary-tree-postorder-traversal/

// 输入二叉树: [1,null,2,3]
const input = [1, null, 2, 3];
// 期望输出: [3,2,1]
const expected = [3, 2, 1];

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

// 后序遍历主函数
function postorderTraversal(root) {
  let res = [];
  function dfs(node) {
    if (!node) return;
    dfs(node.left);
    dfs(node.right);
    res.push(node.val);
  }
  dfs(root);
  return res;
}

// 测试
const root = arrayToTree(input);
console.log('输出:', postorderTraversal(root));
console.log('期望:', expected); 