# LeetCode 461 — Hamming Distance

## 模式
位运算

## 识别信号
- 两数二进制不同位计数
- 汉明距离
- Brian Kernighan 算法

## 边界
- 相等 → 0
- 一个是 0 → popcount
- 负数（考虑补码）

## 实现要点
- x ^ y 得到不同位
- Brian Kernighan: count += 1; x &= x-1 直到 x==0
- 或 builtin: x.__builtin_popcount()

## 复杂度
- 时间: O(1) 或 O(k) k 为 popcount
- 空间: O(1)

## 追问
- Brian Kernighan 为什么有效？→ x-1 把最低位 1 变 0，之后的 0 变 1
- 如果求海明权重？→ 同算法但自身
- 如果是字符串距离？→ 编辑距离
