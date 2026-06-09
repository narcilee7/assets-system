# 08 Worker Pool（工作池）

## 问题描述

实现一个固定大小的 **Worker Pool**（工作池/线程池）：
- 提交任务到池中，由固定数量的 worker 异步处理。
- 支持 **graceful shutdown**：关闭后等待所有已提交任务完成，不再接受新任务。
- 可选：支持获取任务执行结果。

## 核心概念

- **任务队列**：缓冲待处理任务，解耦生产者和消费者。
- **并发限制**：固定 worker 数量防止资源耗尽。
- **优雅关闭**：`Close()` / `Shutdown()` 需要等待正在运行的任务结束。

## 约束

- 不得使用语言内置的线程池（如 Python 的 `concurrent.futures.ThreadPoolExecutor`）。
- 必须自己管理 worker 生命周期和任务队列。

## 手写提示

1. 任务队列用什么数据结构？有界还是无界？
2. 如何通知 worker 停止？（关闭 channel / 发送特殊任务 / context 取消）
3. `Shutdown` 返回时，如何确保所有任务都已处理完毕？
4. 如果 worker panic 了怎么办？

## 验证方式

```bash
make run
```

验证逻辑：提交一批计算任务，验证所有结果正确；验证 shutdown 后新任务被拒绝。
