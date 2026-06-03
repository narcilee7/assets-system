# Two Pointers

## 识别信号

- 数组或字符串。
- 有序或可以排序。
- 需要成对比较、原地覆盖、删除、反转。
- 需要从两端向中间收缩，或快慢指针维护位置关系。

## 常见变体

| 变体 | 例子 |
| --- | --- |
| 左右指针 | Two Sum II、Container With Most Water |
| 快慢指针 | Linked List Cycle、Remove Nth From End |
| 原地覆盖 | Move Zeroes、Remove Element |
| 三指针 / 多指针 | 3Sum、颜色分类 |

## 易错点

- 指针移动条件不互斥导致漏解。
- 去重位置不对。
- 原地覆盖时读写指针含义混淆。

