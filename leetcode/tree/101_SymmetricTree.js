// 题目链接：https://leetcode.cn/problems/symmetric-tree/

// 输入二叉树: [1,2,2,3,4,4,3]
const input = [1,2,2,3,4,4,3];
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

// 对称二叉树主函数
function isSymmetric(root) {
    const isMirror = (t1, t2) => {
        if (!t1 && !t2) return true
        if (!t1 || !t2) return false
        return t1.val === t2.val && isMirror(t1.left, t2.right) && isMirror(t1.right, t2.left)
    }
    return isMirror(root, root)
}

// 测试
const root = arrayToTree(input);
console.log('输出:', isSymmetric(root));
console.log('期望:', expected); 