// 题目链接：https://leetcode.cn/problems/path-sum/

// 输入二叉树: [5,4,8,11,null,13,4,7,2,null,null,null,1], sum = 22
const input = [5,4,8,11,null,13,4,7,2,null,null,null,1];
const sum = 22;
// 期望输出: true
const expected = true;

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

// 路径总和主函数
function hasPathSum(root, targetSum) {
  if (!root) return false;
  if (!root.left && !root.right) return root.val === targetSum;
  return hasPathSum(root.left, targetSum - root.val) || hasPathSum(root.right, targetSum - root.val);
}

// 测试
const root = arrayToTree(input);
console.log('输出:', hasPathSum(root, sum));
console.log('期望:', expected); 