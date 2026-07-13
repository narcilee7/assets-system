/**
 * 手写 BFS / DFS
 *
 * 考点：
 * - BFS 用队列，适合最短路径。
 * - DFS 用栈/递归，适合连通分量、拓扑。
 */

export type Graph<T> = Map<T, T[]>;

export function* bfs<T>(graph: Graph<T>, start: T): Generator<T> {
  const visited = new Set<T>();
  const queue: T[] = [start];
  visited.add(start);

  while (queue.length > 0) {
    const node = queue.shift()!;
    yield node;
    for (const neighbor of graph.get(node) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
}

export function* dfs<T>(graph: Graph<T>, start: T): Generator<T> {
  const visited = new Set<T>();
  const stack: T[] = [start];

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (visited.has(node)) continue;
    visited.add(node);
    yield node;
    const neighbors = graph.get(node) ?? [];
    for (let i = neighbors.length - 1; i >= 0; i--) {
      stack.push(neighbors[i]);
    }
  }
}

export function shortestPath<T>(graph: Graph<T>, start: T, end: T): T[] | null {
  if (start === end) return [start];
  const visited = new Set<T>([start]);
  const queue: [T, T[]][] = [[start, [start]]];

  while (queue.length > 0) {
    const [node, path] = queue.shift()!;
    for (const neighbor of graph.get(node) ?? []) {
      if (visited.has(neighbor)) continue;
      const newPath = [...path, neighbor];
      if (neighbor === end) return newPath;
      visited.add(neighbor);
      queue.push([neighbor, newPath]);
    }
  }
  return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const graph = new Map([
    ["A", ["B", "C"]],
    ["B", ["D"]],
    ["C", ["D"]],
    ["D", []],
  ] as [string, string[]][]);
  console.log([...bfs(graph, "A")]);
  console.log([...dfs(graph, "A")]);
  console.log(shortestPath(graph, "A", "D"));
}
