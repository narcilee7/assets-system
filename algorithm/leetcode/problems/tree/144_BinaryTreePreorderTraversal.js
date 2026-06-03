// 题目链接：https://leetcode.cn/problems/binary-tree-preorder-traversal/

// 输入二叉树: [1,null,2,3]
const input = [1, null, 2, 3];
// 期望输出: [1,2,3]
const expected = [1, 2, 3];

// 二叉树节点定义
function TreeNode(val, left, right) {
  this.val = val;
  this.left = left || null;
  this.right = right || null;
}

// 数组转二叉树（按层序，null为占位）
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

// 前序遍历主函数
function preorderTraversal(root) {
  let res = [];
  function dfs(node) {
    if (!node) return;
    res.push(node.val);
    dfs(node.left);
    dfs(node.right);
  }
  dfs(root);
  return res;
}

// 测试
const root = arrayToTree(input);
console.log('输出:', preorderTraversal(root));
console.log('期望:', expected); 