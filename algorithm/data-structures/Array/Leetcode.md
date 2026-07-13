很好。数组的题目不要无脑刷 100 道，而是**按知识点刷**。很多题其实是在考同一种思想。

我建议按照下面这套体系。

---

# 第一组：数组基本操作（必做）

这些题目让你熟悉数组的遍历、删除、覆盖等基本操作。

### 1. Remove Element（LeetCode 27）⭐⭐⭐⭐⭐

考点：

* 双指针
* 原地修改（In-place）
* 覆盖思想

面试可能追问：

> 为什么不能一边遍历一边删除？

---

### 2. Remove Duplicates from Sorted Array（26）⭐⭐⭐⭐⭐

考点：

* 快慢指针
* 有序数组

这是双指针最经典的入门题。

---

### 3. Merge Sorted Array（88）⭐⭐⭐⭐⭐

考点：

* 倒序双指针
* 原地 Merge

很多公司喜欢问。

---

### 4. Move Zeroes（283）⭐⭐⭐⭐⭐

考点：

* 双指针
* 稳定移动

Google、字节都很喜欢。

---

# 第二组：Two Pointer（双指针）

这是数组最重要的技巧。

---

### 5. Two Sum（1）⭐⭐⭐⭐⭐

先写 HashMap。

然后面试官可能问：

> 如果数组有序怎么办？

引出：

Two Pointer。

---

### 6. Two Sum II（167）⭐⭐⭐⭐⭐

考点：

左右指针

这是双指针模板。

---

### 7. Squares of a Sorted Array（977）⭐⭐⭐⭐

负数平方以后顺序变了。

经典双指针。

---

### 8. Container With Most Water（11）⭐⭐⭐⭐⭐

最经典。

几乎所有算法课都会讲。

---

### 9. 3Sum（15）⭐⭐⭐⭐⭐

这是：

排序

↓

固定一个数

↓

Two Pointer

非常经典。

---

# 第三组：Sliding Window（滑动窗口）

这是数组中最重要的一章。

---

### 10. Minimum Size Subarray Sum（209）⭐⭐⭐⭐⭐

固定模板。

---

### 11. Longest Substring Without Repeating Characters（3）

虽然字符串。

其实就是数组。

---

### 12. Maximum Average Subarray（643）

固定窗口。

---

### 13. Maximum Consecutive Ones III（1004）

可变窗口。

---

### 14. Fruit Into Baskets（904）

经典窗口。

---

# 第四组：Prefix Sum（前缀和）

这是面试最喜欢考的优化。

---

### 15. Range Sum Query（303）

最简单。

---

### 16. Subarray Sum Equals K（560）⭐⭐⭐⭐⭐

非常经典。

HashMap

*

Prefix Sum

---

### 17. Continuous Subarray Sum（523）

Prefix Sum + Mod。

---

# 第五组：Binary Search（二分）

数组天然支持二分。

---

### 18. Binary Search（704）

模板题。

必须会默写。

---

### 19. Search Insert Position（35）

模板。

---

### 20. First Bad Version（278）

二分思想。

---

### 21. Find Peak Element（162）

经典。

---

### 22. Search in Rotated Sorted Array（33）⭐⭐⭐⭐⭐

中高级。

---

# 第六组：矩阵（二维数组）

二维数组本质还是数组。

---

### 23. Spiral Matrix（54）

模拟。

---

### 24. Rotate Image（48）

矩阵。

---

### 25. Set Matrix Zeroes（73）

空间优化。

---

### 26. Search a 2D Matrix（74）

二维二分。

---

# 第七组：数组综合

---

### 27. Product of Array Except Self（238）

经典。

不能除法。

---

### 28. Trapping Rain Water（42）⭐⭐⭐⭐⭐

神题。

三种解法：

* 暴力
* 前后缀
* 双指针

---

### 29. Best Time to Buy and Sell Stock（121）

贪心。

---

### 30. Majority Element（169）

Boyer-Moore。

---

# 如果时间只有一周

我建议只刷这 15 道，覆盖 90% 的数组考点：

| 题目                                | 核心知识点         |
| --------------------------------- | ------------- |
| 27 Remove Element                 | 快慢指针、原地修改     |
| 26 Remove Duplicates              | 双指针           |
| 88 Merge Sorted Array             | 倒序双指针         |
| 283 Move Zeroes                   | 双指针           |
| 1 Two Sum                         | HashMap       |
| 167 Two Sum II                    | 左右指针          |
| 11 Container With Most Water      | 双指针思想         |
| 15 3Sum                           | 排序 + 双指针      |
| 209 Minimum Size Subarray Sum     | 滑动窗口          |
| 560 Subarray Sum Equals K         | 前缀和 + HashMap |
| 704 Binary Search                 | 二分模板          |
| 33 Search in Rotated Sorted Array | 二分变种          |
| 238 Product of Array Except Self  | 前后缀数组         |
| 42 Trapping Rain Water            | 综合双指针         |
| 48 Rotate Image                   | 二维数组          |

对于你的目标（Go/Python 后端、AI Infra），**重点不是刷数量，而是总结模板**。数组题最终可以归纳为几种固定模式：

* 双指针（快慢、左右、对撞）
* 滑动窗口（固定窗口、可变窗口）
* 前缀和（Prefix Sum）
* 二分查找（普通二分、边界二分、变种二分）
* 原地操作（In-place）
* 矩阵模拟
* 排序 + 双指针

当你能看到题目就判断出属于哪一种模式，而不是从零开始思考时，说明数组这一章节已经掌握了。
