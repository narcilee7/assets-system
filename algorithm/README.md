# Algorithms

算法层的目标不是刷题数量，而是形成稳定的模式识别能力：看到题能判断结构、选择模板、处理边界、解释复杂度。

## 主干

| 主线 | 目录 | 目标 |
| --- | --- | --- |
| Patterns | `patterns/` | 按解题模式沉淀模板和识别信号 |
| LeetCode | `leetcode/` | 题目实现和题单索引 |
| Data Structures | `data-structures/` | 可复用的数据结构实现 |

## 模式地图

| 模式 | 目录 | 识别信号 |
| --- | --- | --- |
| 双指针 | `patterns/two-pointers/` | 有序数组、左右边界、原地覆盖、成对关系 |
| 滑动窗口 | `patterns/sliding-window/` | 连续子数组 / 子串、最长 / 最短、窗口约束 |
| 二分查找 | `patterns/binary-search/` | 有序、答案单调、最左 / 最右边界 |
| 递归回溯 | `patterns/recursion-backtracking/` | 全排列、组合、路径、选择 / 撤销 |
| 动态规划 | `patterns/dynamic-programming/` | 最优子结构、重叠子问题、状态转移 |
| 贪心 | `patterns/greedy/` | 局部最优可推出全局、区间、排序后决策 |
| 图搜索 | `patterns/graph-search/` | 节点边关系、连通性、最短步数、遍历 |
| 拓扑排序 | `patterns/topological-sort/` | 依赖关系、有向无环图、课程 / 任务顺序 |
| 堆 / 优先队列 | `patterns/heap-priority-queue/` | Top K、动态最值、多路归并 |
| 并查集 | `patterns/union-find/` | 连通分量、集合合并、关系传递 |
| 单调栈 | `patterns/monotonic-stack/` | 下一个更大 / 更小、贡献法、柱状图 |
| 前缀和 | `patterns/prefix-sum/` | 区间和、子数组和、频次统计 |

## 资产完成标准

每个模式至少包含：

```text
README.md     # 识别信号、模板、复杂度、易错点
template.*    # 通用模板
problems.md   # 典型题映射
review.md     # 复盘和面试追问
```

每道高频题至少补齐：

- 题意重述。
- 模式识别理由。
- 边界条件。
- 复杂度。
- 一句话复盘。

## 优先级

| 优先级 | 模式 | 原因 |
| --- | --- | --- |
| P0 | 双指针、滑动窗口、二分、动态规划 | 高频、迁移性强 |
| P0 | 树 / 图搜索 | 面试覆盖广，也连接系统设计图模型 |
| P1 | 堆、单调栈、前缀和、贪心 | 高频专题强化 |
| P1 | 并查集、拓扑排序 | 中高级面试常见 |

