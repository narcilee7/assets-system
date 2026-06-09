# 10 Fan-in / Fan-out（扇入扇出）

## 问题描述

在上一个 Pipeline 的基础上，增加并行度：
- **Fan-out**：将输入数据分发给多个并行的 `Square` worker 处理。
- **Fan-in**：将多个 `Square` worker 的输出合并到一个 channel / 队列中，供 `Sum` 消费。

目标：利用多核并行加速中间阶段的计算。

## 核心概念

- **Fan-out**：一个输入源分发到多个处理单元，提升吞吐。
- **Fan-in**：多个处理单元的输出汇聚到一个消费者，简化下游逻辑。
- **WaitGroup / Barrier**：Fan-in 需要等待所有上游 worker 完成后再关闭汇聚 channel。

## 约束

- Square worker 数量固定（如 4 个）。
- 最终结果必须与单线程版本一致。

## 手写提示

1. Fan-out 是轮询分发还是随机分发？或者让每个 worker 竞争从输入 channel 读取？
2. Fan-in 合并时，输出顺序是否重要？如果不重要，如何高效合并？
3. 如何知道所有 Square worker 都已结束，可以安全关闭合并后的 channel？

## 验证方式

```bash
make run
```

验证逻辑：1 到 100 的平方和仍为 338350，但中间阶段利用了并行 worker。
