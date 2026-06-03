/**
 * 邻接矩阵
 */

class Graph1 {
  private adjMatrix: number[][]

  constructor(vertices: number) {
    this.adjMatrix = Array.from({ length: vertices }, () => Array(vertices).fill(0))
  }

  addEdge(u: number, v: number) {
    this.adjMatrix[u][v] = 1
    this.adjMatrix[v][u] = 1
  }

  printAdjMatrix() {
    console.log(this.adjMatrix)
  }
}

class Graph2 {
  private adjList: Map<number, number[]>

  constructor() {
    this.adjList = new Map()
  }

  addEdge(u: number, v: number) {
    if (!this.adjList.has(u)) {
      this.adjList.set(u, [])
    }
    if (!this.adjList.has(v)) {
      this.adjList.set(v, [])
    }
    this.adjList.get(u)!.push(v)
    this.adjList.get(v)!.push(u) // 如果是无向图
  }

  // 打印邻接表
  printAdjList() {
    this.adjList.forEach((value, key) => {
      console.log(`${key} -> ${value}`);
    });
  }
}

