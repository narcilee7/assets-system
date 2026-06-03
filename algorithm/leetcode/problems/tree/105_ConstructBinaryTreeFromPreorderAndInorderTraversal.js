// 题目链接：https://leetcode.cn/problems/construct-binary-tree-from-preorder-and-inorder-traversal/

// 输入: preorder = [3,9,20,15,7], inorder = [9,3,15,20,7]
const preorder = [3,9,20,15,7];
const inorder = [9,3,15,20,7];
// 期望输出: [3,9,20,null,null,15,7]（层序遍历）
const expected = [3,9,20,null,null,15,7];

function TreeNode(val, left, right) {
  this.val = val;
  this.left = left || null;
  this.right = right || null;
}

// 构造二叉树主函数
function buildTree(preorder, inorder) {
  if (!preorder.length || !inorder.length) return null;
  let rootVal = preorder[0];
  let root = new TreeNode(rootVal);
  let idx = inorder.indexOf(rootVal);
  root.left = buildTree(preorder.slice(1, idx+1), inorder.slice(0, idx));
  root.right = buildTree(preorder.slice(idx+1), inorder.slice(idx+1));
  return root;
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
const root = buildTree(preorder, inorder);
console.log('输出:', treeToArray(root));
console.log('期望:', expected); 