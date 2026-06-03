class TreeNode {
  constructor(val, left, right) {
    this.val = val
    this.left = left
    this.right = right
  }
}

/**
 * 二叉树的前序遍历 根-左-右
 */

// 递归
function preOrderRecursive(root) {
  if (root === null) return null
  const result = []
  // 先打印根节点
  console.log(root.val)
  result.push(root.val)
  // 再打印左子树
  preOrderRecursive(root.left)
  // 再打印右子树
  preOrderRecursive(root.right)
}

// 迭代
function preOrderIteractive(root) {
  if (root === null) return null
  const helperStack = [root]
  const result = []
  while (helperStack.length) {
    const item = helperStack.pop()
    result.push(item.val)
    // 先入栈右子树，再入栈左子树
    if (item.right) {
      helperStack.push(item.right)
    }
    if (item.left) {
      helperStack.push(item.left)
    }
  }
  return result
}

/**
 * 二叉树的中序遍历 左-根-右
 */
function inOrderRecursive(root) {
  if (root === null) return null
  const result = []
  inOrderRecursive(root.left)
  result.push(root.val)
  inOrderRecursive(root.right)
  return result
}

function inOrderIteractive(root) {
  if (root === null) return null
  const result = []
  const helperStack = []
  let current = root
  while (current || helperStack.length) {
    while (current) {
      helperStack.push(current)
      current = current.left
    }
    current = helperStack.pop()
    result.push(current.val)
    current = current.right
  }
  return result
}

/**
 * 二叉树的后序遍历 左-右-根
 */
function postOrderRecursive(root) {
  if (root === null) return null
  const result = []
  postOrderRecursive(root.left)
  postOrderRecursive(root.right)
  result.push(root.val)
  return result
}

function postOrderIteractive(root) {
  /**
   * 左子树 -> 右子树 -> 根节点
   */
  const result = []
  if (!root) return result

  const stack = [root]
  const visited = new Set()

  while (stack.length > 0) {
    const node = stack[stack.length - 1]

    // 如果没有被访问过
    if (!visited.has(node)) {
      if (node.right && !visited.has(node.right)) {
        stack.push(node.right)
      }
      if (node.left && !visited.has(node.left)) {
        stack.push(node.left)
      }
      visited.add(node)
    } else {
      result.push(node.val)
      stack.pop()
    }
  }
  return result
}

function levelOrderTraversal(root) {
  if (!root) return []
  const result = []
  const queue = [root]
  while (queue.length > 0) {
    const node = queue.shift()
    result.push(node.val)
    if (node.left) queue.push(node.left)
    if (node.right) queue.push(node.right)
  }
  return result
}