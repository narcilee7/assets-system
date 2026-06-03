/**
 * 114. 二叉树展开为链表
 */

class TreeNode {
  constructor(val, left, right) {
    this.val = val
    this.left = left
    this.right = right
  }
}

// 递归方法，通过记录上一次调用栈的right prev，本质上就是回溯
function flatten(root) {
  let prev = null

  const dfs = (node) => {
    if (!node) return
    dfs(node.right)
    dfs(node.left)
    node.right = prev
    node.left = null
    prev = node
  }
  
  dfs(root)
}

// 测试
const root = new TreeNode(1, new TreeNode(2, new TreeNode(3), new TreeNode(4)), new TreeNode(5, null, new TreeNode(6)))
flatten(root)
console.log(root);

// 迭代法，用栈处理
function flattenIterative(root) {
  if (!root) return
  const helperStack = [root]
  while (helperStack.length > 0) {
    const node = helperStack.pop()
    if (node?.right) {
      helperStack.push(node.right)
    }
    if (node?.left) {
      helperStack.push(node.left)
    }
    if (helperStack.length > 0) {
      node.right = helperStack[helperStack.length - 1]
    }
    node.left = null
  }
}

// 测试
const root2 = new TreeNode(1, new TreeNode(2, new TreeNode(3), new TreeNode(4)), new TreeNode(5, null, new TreeNode(6)))
flattenIterative(root2)
console.log(root2);
console.log(flatten(root).toString() === flattenIterative(root2).toString())