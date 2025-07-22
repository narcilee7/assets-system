class Graph {
  private adjList: Map<number, number[]>

  constructor() {
    this.adjList = new Map()
  }

  addEdge(u: number, v: number) {
    if (!this.adjList.has(u)) this.adjList.set(u, []);
    if (!this.adjList.has(v)) this.adjList.set(v, []);
    this.adjList.get(u)!.push(v);
    this.adjList.get(v)!.push(u);
  }

  // dfs 迭代法
  dfsIterative(start: number): number[] {
    const result: number[] = []
    const visited = new Set<number>()
    const stack: number[] = [start]

    while (stack.length > 0) {
      const node = stack.pop()!
      if (!visited.has(node)) {
        visited.add(node)
        result.push(node)
      }
      // 将所有未访问的邻接节点入栈
      const neighbors = this.adjList.get(node) || []
      for (let i = neighbors.length - 1; i >= 0; i--) {
        const neighbor = neighbors[i]
        if (!visited.has(neighbor)) {
          stack.push(neighbor)
        }
      }
    }
    return result
  }

  // 递归
  dfsRecursive(start: number): number[] {
    const result: number[] = []
    const visited = new Set<number>()

    const traverse = (node: number) => {
      if (visited.has(node)) return
      visited.add(node)
      result.push(node)
      const neighbors = this.adjList.get(node) || []
      for (const neighbor of neighbors) {
        traverse(neighbor)
      }
    }

    traverse(start)

    return result
  }

  bfs(start: number): number[] {
    const result: number[] = []
    const visited = new Set<number>()
    const queue: number[] = [start]

    while (queue.length > 0) {
      const node = queue.shift()!
      if (!visited.has(node)) {
        visited.add(node)
        result.push(node)
      }
      // 将所有未访问的邻接节点加入队列
      const neighbors = this.adjList.get(node) || []
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor)
        }
      }
    }

    return result
  }
}