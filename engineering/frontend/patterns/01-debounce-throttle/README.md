# 01 Debounce and Throttle（防抖与节流）

## 问题描述

实现 `debounce` 和 `throttle` 两个函数工具。

- **debounce**：在事件触发后等待 N 毫秒，如果期间没有再次触发，才执行目标函数。
- **throttle**：在事件触发后立即执行，然后在接下来的 N 毫秒内忽略所有触发。

## 核心概念

- **防抖（Debounce）**：将多次触发合并为一次，常用于搜索框输入（用户停止输入后才搜索）。
- **节流（Throttle）**：限制执行频率，平滑触发，常用于滚动事件、窗口调整。
- **立即执行（leading edge）**：是否在首次触发时立即执行。
- **取消（cancel）**：已排期的函数调用可被取消。

## 约束

- 不得使用 lodash 或其他第三方工具库。
- 必须支持 `cancel()` 方法。
- 必须支持 `flush()` 方法（立即执行并清空）。
- `debounce` 可选支持 `maxWait`（最大等待时间）。

## 手写提示

1. 定时器是唯一的时间控制手段，核心是 `setTimeout` + `clearTimeout`。
2. `debounce` 返回的函数需要通过闭包保存 timer 状态。
3. `flush` 需要先清除待执行函数，再调用一次。
4. 如何处理 `this` 上下文和参数传递？

## 验证方式

```bash
make run   # 运行骨架，预期输出 FAIL
# 补全 TODO 后
make run   # 预期输出 PASS
make test  # 运行测试用例
```