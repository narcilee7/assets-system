/**
 * 手写拓扑排序
 *
 * 考点：
 * - Kahn 算法：反复移除入度为 0 的节点。
 * - 检测环。
 */

export function topologicalSort<T>(graph: Map<T, T[]>): T[] {
  const inDegree = new Map<T, number>();
  for (const [node, neighbors] of graph) {
    if (!inDegree.has(node)) inDegree.set(node, 0);
    for (const neighbor of neighbors) {
      inDegree.set(neighbor, (inDegree.get(neighbor) ?? 0) + 1);
    }
  }

  const queue: T[] = [];
  for (const [node, degree] of inDegree) {
    if (degree === 0) queue.push(node);
  }

  const result: T[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    for (const neighbor of graph.get(node) ?? []) {
      const degree = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, degree);
      if (degree === 0) queue.push(neighbor);
    }
  }

  if (result.length !== inDegree.size) {
    throw new Error("graph contains a cycle");
  }
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const tasks = new Map<string, string[]>([
    ["build", ["test"]],
    ["test", ["deploy"]],
    ["deploy", []],
    ["lint", ["test"]],
  ]);
  console.log(topologicalSort(tasks));
}
