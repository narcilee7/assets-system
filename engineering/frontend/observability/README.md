# Frontend Observability

前端可观测性要能回答：谁、在哪个版本、什么设备、哪条链路、发生了什么。

## 信号

| 信号 | 字段 |
| --- | --- |
| Error | message、stack、source map、release、user、route |
| Performance | LCP、INP、CLS、TTFB、long task |
| Resource | URL、status、duration、cache、size |
| API | endpoint、status、latency、trace id |
| Behavior | click、route、session、funnel |
| Bridge | API、container、latency、error |

## 资产

| 资产 | 状态 |
| --- | --- |
| frontend monitoring baseline | todo |
| source map upload pipeline | todo |
| WebView white screen diagnosis | todo |
| Agent UI event trace | todo |

