class AVLTreeNode {
  value: number;
  left: AVLTreeNode | null;
  right: AVLTreeNode | null;
  height: number;

  constructor(value: number) {
    this.value = value
    this.left = null
    this.right = null
    this.height = 1 // 新节点的高度是1
  }
}

// function insert(root: AVLTreeNode | null, value: number): AVLTreeNode {
//   if (!root) return new AVLTreeNode(value)


// }