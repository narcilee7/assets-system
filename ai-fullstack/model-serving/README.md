# Model Serving

Model Serving 主线训练模型路由、fallback、成本、延迟和配额控制。

## 核心问题

- 不同任务如何选择模型？
- 模型失败如何 fallback？
- 如何控制 token 成本？
- 如何做 rate limit 和 quota？
- 如何记录 latency 和质量指标？

