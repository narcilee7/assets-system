// 题目链接：https://leetcode.cn/problems/minimum-depth-of-binary-tree/

// 输入二叉树: [3,9,20,null,null,15,7]
const input = [3, 9, 20, null, null, 15, 7];
// 期望输出: 2
const expected = 2;

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

// 最小深度主函数
function minDepth(root) {
    if (!root) return 0
    if (!root.left && !root.right) return 1
    let min = Infinity
    if (root.left) min = Math.min(minDepth(root.left), min)
    if (root.right) min = Math.min(minDepth(root.right), min)
    return min + 1
}

// 测试
const root = arrayToTree(input);
console.log('输出:', minDepth(root));
console.log('期望:', expected); 