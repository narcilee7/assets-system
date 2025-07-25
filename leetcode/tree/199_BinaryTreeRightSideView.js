// 题目链接：https://leetcode.cn/problems/binary-tree-right-side-view/

// 输入二叉树: [1,2,3,null,5,null,4]
const input = [1,2,3,null,5,null,4];
// 期望输出: [1,3,4]
const expected = [1,3,4];

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

// 右视图主函数
function rightSideView(root) {
    if (!root) return []
    const res = []
    const queue = [root]
    while (queue.length) {
        const len = queue.length
        for (let i = 0; i < len; i++) {
            const node = queue.shift()
            // 如果当前节点是当前层最后一个节点，则将节点值加入结果数组
            if (i === len - 1) res.push(node.val)
            if (node.left) queue.push(node.left)
            if (node.right) queue.push(node.right)
        }
    }
    return res
}

// 测试
const root = arrayToTree(input);
console.log('输出:', rightSideView(root));
console.log('期望:', expected); 