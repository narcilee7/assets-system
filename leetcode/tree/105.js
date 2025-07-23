/**
 * 从前序与中序遍历序列构造二叉树
 */

class TreeNode {
  constructor(val, left, right) {
    this.val = val
    this.left = left
    this.right = right
  }
}

function buildTree(preorder, inorder) {
  if (preorder.length === 0 || inorder.length === 0) return null

  const inMap = new Map()
  // 构建值到索引的映射，加速查找
  inorder.forEach((value, index) => inMap.set(value, index))

  let preIndex = 0

  function helper(left, right) {
    if (left > right) return null

    const rootValue = preorder[preIndex++]
    const root = new TreeNode(rootValue)
    const inIndex = inMap.get(rootValue)
    root.left = helper(left, inIndex - 1)
    root.right = helper(inIndex + 1, right)
    return root
  }

  return helper(0, inorder.length - 1)
}