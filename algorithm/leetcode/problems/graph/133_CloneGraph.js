// 题目链接：https://leetcode.cn/problems/clone-graph/

// 输入邻接表: [[2,4],[1,3],[2,4],[1,3]]
const input = [[2,4],[1,3],[2,4],[1,3]];
// 期望输出: [[2,4],[1,3],[2,4],[1,3]]
const expected = [[2,4],[1,3],[2,4],[1,3]];

// 图节点定义
function Node(val, neighbors) {
  this.val = val;
  this.neighbors = neighbors || [];
}

// 邻接表转图
function arrayToGraph(adjList) {
  if (!adjList.length) return null;
  let nodes = adjList.map((_, i) => new Node(i + 1));
  for (let i = 0; i < adjList.length; i++) {
    nodes[i].neighbors = adjList[i].map(j => nodes[j - 1]);
  }
  return nodes[0];
}

// 图转邻接表
function graphToArray(node) {
  if (!node) return [];
  let res = [];
  let visited = new Map();
  let queue = [node];
  visited.set(node, 0);
  while (queue.length) {
    let curr = queue.shift();
    let idx = visited.get(curr);
    res[idx] = curr.neighbors.map(n => n.val);
    for (let n of curr.neighbors) {
      if (!visited.has(n)) {
        visited.set(n, visited.size);
        queue.push(n);
      }
    }
  }
  return res;

}

// 克隆图主函数
function cloneGraph(node) {
  if (!node) return null;
  let map = new Map();
  function dfs(n) {
    if (!n) return null;
    if (map.has(n)) return map.get(n);
    let copy = new Node(n.val);
    map.set(n, copy);
    copy.neighbors = n.neighbors.map(dfs);
    return copy;
  }
  return dfs(node);
}

// 测试
const root = arrayToGraph(input);
const cloned = cloneGraph(root);
console.log('输出:', graphToArray(cloned));
console.log('期望:', expected); 