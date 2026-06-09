# LeetCode Hot 100

高频面试题精选，按 Topic 分类，每题支持 Go / Python / TypeScript 三种实现。

## 环境

根目录已配置统一开发环境：

- **Go** — `go run solutions/go/*.go`
- **Python** — `python3 solutions/python/*.py`
- **TypeScript** — `npx tsx solutions/typescript/*.ts`

或使用 `just`（推荐）：

```bash
just run <topic> <problem> <lang> [args]
# 例: just run array 1_TwoSum go
```

## Topic 索引

| Topic | 题目数 |
|-------|--------|
| [Array](#array) | 3 |
| [Dynamic Programming](#dynamic-programming) | 12 |
| [Tree](#tree) | 17 |
| [Linked List](#linked-list) | 9 |
| [Graph](#graph) | 5 |
| [String](#string) | 2 |
| [Hash Table](#hash-table) | 2 |
| [Two Pointers](#two-pointers) | 2 |
| [Sliding Window](#sliding-window) | 3 |
| [Binary Search](#binary-search) | 3 |
| [Backtracking](#backtracking) | 5 |
| [Stack](#stack) | 3 |
| [Heap](#heap) | 2 |
| [Trie](#trie) | 3 |
| [Bit Manipulation](#bit-manipulation) | 3 |
| [Greedy](#greedy) | 5 |
| [Sorting](#sorting) | 1 |
| [Design](#design) | 3 |

---

## Array

| # | 题目 | 难度 | Go | Py | TS |
|---|------|------|----|----|----|
| 1 | Two Sum | 🟢 | | | |
| 238 | Product of Array Except Self | 🟡 | | | |
| 448 | Find All Numbers Disappeared in an Array | 🟢 | | | |

---

## Dynamic Programming

| # | 题目 | 难度 | Go | Py | TS |
|---|------|------|----|----|----|
| 10 | Regular Expression Matching | 🔴 | | | |
| 70 | Climbing Stairs | 🟢 | | | |
| 72 | Edit Distance | 🔴 | | | |
| 115 | Distinct Subsequences | 🟡 | | | |
| 139 | Word Break | 🟡 | | | |
| 152 | Maximum Product Subarray | 🟡 | | | |
| 198 | House Robber | 🟡 | | | |
| 221 | Maximal Square | 🟡 | | | |
| 279 | Perfect Squares | 🟡 | | | |
| 309 | Best Time to Buy and Sell Stock with Cooldown | 🟡 | | | |
| 322 | Coin Change | 🟡 | | | |
| 416 | Partition Equal Subset Sum | 🟡 | | | |
| 494 | Target Sum | 🟡 | | | |

---

## Tree

| # | 题目 | 难度 | Go | Py | TS |
|---|------|------|----|----|----|
| 100 | Same Tree | 🟢 | | | |
| 101 | Symmetric Tree | 🟢 | | | |
| 102 | Binary Tree Level Order Traversal | 🟡 | | | |
| 104 | Maximum Depth of Binary Tree | 🟢 | | | |
| 105 | Construct Binary Tree from Preorder and Inorder | 🟡 | | | |
| 112 | Path Sum | 🟢 | | | |
| 114 | Flatten Binary Tree to Linked List | 🟡 | | | |
| 116 | Populating Next Right Pointers | 🟡 | | | |
| 124 | Binary Tree Maximum Path Sum | 🔴 | | | |
| 226 | Invert Binary Tree | 🟢 | | | |
| 230 | Kth Smallest Element in a BST | 🟡 | | | |
| 236 | Lowest Common Ancestor | 🟡 | | | |
| 257 | Binary Tree Paths | 🟢 | | | |
| 404 | Sum of Left Leaves | 🟢 | | | |
| 437 | Path Sum III | 🟡 | | | |
| 543 | Diameter of Binary Tree | 🟢 | | | |
| 572 | Subtree of Another Tree | 🟢 | | | |

---

## Linked List

| # | 题目 | 难度 | Go | Py | TS |
|---|------|------|----|----|----|
| 2 | Add Two Numbers | 🟡 | | | |
| 21 | Merge Two Sorted Lists | 🟢 | | | |
| 141 | Linked List Cycle | 🟢 | | | |
| 142 | Linked List Cycle II | 🟡 | | | |
| 160 | Intersection of Two Linked Lists | 🟢 | | | |
| 206 | Reverse Linked List | 🟢 | | | |
| 234 | Palindrome Linked List | 🟢 | | | |
| 25 | Reverse Nodes in k-Group | 🔴 | | | |
| 287 | Find the Duplicate Number | 🟡 | | | |
| 328 | Odd Even Linked List | 🟡 | | | |

---

## Graph

| # | 题目 | 难度 | Go | Py | TS |
|---|------|------|----|----|----|
| 127 | Word Ladder | 🔴 | | | |
| 200 | Number of Islands | 🟡 | | | |
| 207 | Course Schedule | 🟡 | | | |
| 210 | Course Schedule II | 🟡 | | | |
| 301 | Remove Invalid Parentheses | 🔴 | | | |

---

## String

| # | 题目 | 难度 | Go | Py | TS |
|---|------|------|----|----|----|
| 44 | Wildcard Matching | 🔴 | | | |
| 647 | Palindromic Substrings | 🟡 | | | |

---

## Hash Table

| # | 题目 | 难度 | Go | Py | TS |
|---|------|------|----|----|----|
| 49 | Group Anagrams | 🟡 | | | |
| 128 | Longest Consecutive Sequence | 🟡 | | | |

---

## Two Pointers

| # | 题目 | 难度 | Go | Py | TS |
|---|------|------|----|----|----|
| 11 | Container With Most Water | 🟡 | | | |
| 42 | Trapping Rain Water | 🔴 | | | |

---

## Sliding Window

| # | 题目 | 难度 | Go | Py | TS |
|---|------|------|----|----|----|
| 3 | Longest Substring Without Repeating Characters | 🟡 | | | |
| 76 | Minimum Window Substring | 🔴 | | | |
| 438 | Find All Anagrams in a String | 🟡 | | | |

---

## Binary Search

| # | 题目 | 难度 | Go | Py | TS |
|---|------|------|----|----|----|
| 33 | Search in Rotated Sorted Array | 🟡 | | | |
| 153 | Find Minimum in Rotated Sorted Array | 🟡 | | | |
| 240 | Search a 2D Matrix II | 🟡 | | | |

---

## Backtracking

| # | 题目 | 难度 | Go | Py | TS |
|---|------|------|----|----|----|
| 17 | Letter Combinations of a Phone Number | 🟡 | | | |
| 22 | Generate Parentheses | 🟡 | | | |
| 46 | Permutations | 🟡 | | | |
| 78 | Subsets | 🟡 | | | |
| 131 | Palindrome Partitioning | 🟡 | | | |

---

## Stack

| # | 题目 | 难度 | Go | Py | TS |
|---|------|------|----|----|----|
| 155 | Min Stack | 🟢 | | | |
| 394 | Decode String | 🟡 | | | |
| 739 | Daily Temperatures | 🟡 | | | |

---

## Heap

| # | 题目 | 难度 | Go | Py | TS |
|---|------|------|----|----|----|
| 23 | Merge k Sorted Lists | 🔴 | | | |
| 215 | Kth Largest Element in an Array | 🟡 | | | |

---

## Trie

| # | 题目 | 难度 | Go | Py | TS |
|---|------|------|----|----|----|
| 208 | Implement Trie | 🟡 | | | |
| 212 | Word Search II | 🔴 | | | |
| 472 | Concatenated Words | 🔴 | | | |

---

## Bit Manipulation

| # | 题目 | 难度 | Go | Py | TS |
|---|------|------|----|----|----|
| 136 | Single Number | 🟢 | | | |
| 169 | Majority Element | 🟢 | | | |
| 461 | Hamming Distance | 🟢 | | | |

---

## Greedy

| # | 题目 | 难度 | Go | Py | TS |
|---|------|------|----|----|----|
| 121 | Best Time to Buy and Sell Stock | 🟢 | | | |
| 122 | Best Time to Buy and Sell Stock II | 🟢 | | | |
| 135 | Candy | 🔴 | | | |
| 406 | Queue Reconstruction by Height | 🟡 | | | |
| 621 | Task Scheduler | 🟡 | | | |

---

## Sorting

| # | 题目 | 难度 | Go | Py | TS |
|---|------|------|----|----|----|
| 56 | Merge Intervals | 🟡 | | | |

---

## Design

| # | 题目 | 难度 | Go | Py | TS |
|---|------|------|----|----|----|
| 146 | LRU Cache | 🟡 | | | |
| 297 | Serialize and Deserialize Binary Tree | 🔴 | | | |
| 460 | LFU Cache | 🔴 | | | |

---

## 目录结构

```
hot100/
├── README.md
├── go.mod                      # Go 模块
├── package.json                 # Node/TS 环境
├── justfile                    # 任务运行器
├── requirements.txt            # Python
└── topics/
    ├── array/
    │   ├── 1_TwoSum/
    │   │   ├── review.md
    │   │   └── solutions/
    │   │       ├── go/
    │   │       ├── python/
    │   │       └── typescript/
    │   └── ...
    └── ...
```

## 复盘格式

每题 `review.md` 包含：

- **模式** — 核心算法模式
- **识别信号** — 什么场景用这个模式
- **边界** — 特殊情况处理
- **实现要点** — 关键实现细节
- **复杂度** — 时间 + 空间
- **追问** — 面试追问方向

## 统计

- 总计: **87 题**
- 🟢 Easy: ~25
- 🟡 Medium: ~47
- 🔴 Hard: ~15
