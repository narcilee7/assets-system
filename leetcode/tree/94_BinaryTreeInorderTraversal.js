// 题目链接：https://leetcode.cn/problems/binary-tree-inorder-traversal/

// 输入二叉树: [1,null,2,3]
const input = [1, null, 2, 3];
// 期望输出: [1,3,2]
const expected = [1, 3, 2];

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

// 中序遍历主函数
function inorderTraversal(root) {
    const res = []
    const dfs = (node) => {
        if (!node) return
        dfs(node.left)
        res.push(node.val)
        dfs(node.right)
    }
    dfs(root)
    return res
}

function inorderTraversal2(root) {
    const res = []
    const stack = [root]
    while (stack.length) {
        const node = stack.pop()
        if (!node) continue
        res.push(node.val)
        stack.push(node.right)
        stack.push(node.left)
    }
    return res
}
// 测试
const root = arrayToTree(input);
console.log('输出:', inorderTraversal(root));
console.log('期望:', expected); 