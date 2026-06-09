# JSBridge

跨端能力训练 —— JSBridge 协议设计、安全、版本、可观测性。

## 核心文档

| 文档 | 内容 |
|------|------|
| [implementation.md](implementation.md) | 简化版 JSBridge 实现：从 URL Scheme 到 MessageChannel |
| [sdk-integration.md](sdk-integration.md) | 支付、分享、地图、推送等 SDK 的桥接封装与降级 |
| [capability-detection.md](capability-detection.md) | 能力检测与降级：容器版本不匹配时的处理策略 |

## 核心设计

| 主题 | 关键点 |
|------|--------|
| Schema | `scheme://module/action?params` 或 message channel |
| Permission | API allowlist、user gesture、risk level |
| Callback | callback id、timeout、once、error |
| Versioning | capability detection、fallback |
| Security | origin 校验、参数校验、敏感 API 确认 |
| Observability | call id、latency、error code、container version |

## 追问

- URL Scheme 方案有什么致命缺陷？（长度限制、无回调、性能差）
- 如何防止 H5 页面伪造 Bridge 调用？（Origin 校验、签名机制）
- 回调函数在组件卸载后仍然执行，如何防止内存泄漏？
- 能力检测的三种方案各有什么优劣？（UA 解析 vs 特性检测 vs 能力声明）
