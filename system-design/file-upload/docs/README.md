# FILE UPLOAD DOCS

状态：**draft**（深度完成）

这个目录承载大文件上传系统设计的完整文档，包括问题定义、API、数据模型、读写路径、失败模式、扩展、可观测和面试追问。

## 文档清单

| 文档 | 状态 | 说明 |
|------|------|------|
| problem.md | ✅ draft | 分片上传/秒传/断点续传/合并、4 个关键决策（分片大小/Hash算法/状态存储/并发控制）、3 个真实踩坑 |
| api.md | ✅ draft | 秒传检查、初始化上传、分片上传、状态查询、文件合并、取消 API、Event Contract |
| data-model.md | ✅ draft | 10 类数据模型（上传任务/分片/文件/Hash索引/进度/合并任务）、状态机、存储路径设计 |
| read-write.md | ✅ draft | 完整上传流程（Hash计算→秒传→分片→断点续传→合并）、Web Worker 实现、并发控制、进度持久化 |
| failure.md | ✅ draft | 7 种失败模式：分片失败、Hash不一致、合并重复调用、上传超时、秒传误判、分片冲突、存储故障 |
| scale.md | ✅ draft | 性能目标、4 个瓶颈（Hash计算/网络开销/合并耗时/存储写入）及优化、容量规划 |
| observability.md | ✅ draft | 三大支柱、日志/指标/Trace、告警规则、SLO 监控 |
| interview.md | ✅ draft | 7 个核心追问（MD5优化/合并一致性/去重/断点恢复/分片大小/合并顺序/生产踩坑） |

