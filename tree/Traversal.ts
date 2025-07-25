export class TreeNode {
  value: number
  left: TreeNode | null
  right: TreeNode | null

  constructor(value: number) {
    this.value = value
    this.left = null
    this.right = null
  }
}

const root = new TreeNode(1);
root.left = new TreeNode(2);
root.right = new TreeNode(3);
root.left.left = new TreeNode(4);
root.left.right = new TreeNode(5);

// [1, 2, 3, 4, 5]

// 前序遍历
function preOrderTraversal(root: TreeNode | null): number[] {
  const result: number[] = []

  const traverse = (node: TreeNode | null) => {
    if (!node) return
    result.push(node.value)
    traverse(node.left)
    traverse(node.right)
  }
  traverse(root)
  return result
}

function preOrderTraversalIterative(root: TreeNode | null): number[] {
  if (!root) return []
  const result: number[] = []
  const stack: TreeNode[] = [root]
  while (stack.length > 0) {
    const item = stack.pop()!
    result.push(item.value)
    if (item.right) stack.push(item.right)
    if (item.left) stack.push(item.left)
  }
  return result
}

// 中序遍历
function inOrderTraversal(root: TreeNode | null): number[] {
  const result: number[] = []

  function traverse(node: TreeNode | null) {
    if (!node) return
    traverse(node.left)
    result.push(node.value)
    traverse(node.right)
  }
  traverse(root)
  return result
}

function inOrderTraversalIterative(root: TreeNode | null): number[] {
  const result: number[] = []
  const stack: TreeNode[] = []
  let current = root
  while (current || stack.length > 0) {
    while (current) {
      stack.push(current)
      current = current.left
    }
    current = stack.pop()!
    result.push(current.value)
    current = current.right
  }
  return result
}

// 后序遍历
function postOrderTraversal(root: TreeNode | null): number[] {
  const result: number[] = []
  function traverse(node: TreeNode | null) {
    if (!node) return
    traverse(node.left)
    traverse(node.right)
    result.push(node.value)
  }
  traverse(root)
  return result
}

function postOrderTraversalIterative(root: TreeNode | null): number[] {
  /**
   * 后序遍历的顺序是：左子树 -> 右子树 -> 根节点
   * 利用栈的双重作用来模拟递归，需要额外的标志来标记节点是否已经被访问过
   */
  const result: number[] = []
  if (!root) return result

  const stack: TreeNode[] = [root]
  const visited: Set<TreeNode> = new Set()

  while (stack.length > 0) {
    const node = stack[stack.length - 1]

    // 如果节点没有被访问过
    if (!visited.has(node)) {
      // 先将右子树和左子树入栈，保证左子树先处理
      if (node.right && !visited.has(node.right)) {
        stack.push(node.right)
      }
      if (node.left && !visited.has(node.left)) {
        stack.push(node.left)
      }
      // 标记当前节点为已访问
      visited.add(node)
    } else {
      result.push(node.value)
      // 出栈
      stack.pop()
    }
  }

  return result
}

function levelOrderTraversal(root: TreeNode | null): number[] {
  if (!root) return []
  const result: number[] = []
  const queue: TreeNode[] = [root]

  while (queue.length > 0) {
    const node = queue.shift()!
    result.push(node.value)
    if (node?.left) queue.push(node.left)
    if (node?.right) queue.push(node.right)
  }

  return result
}

