# Systems Engineering

系统工程师能力目标：理解计算机系统从单机到集群的运行机制，能设计、诊断和治理基础设施级系统，而不是只在 Web 应用层做工程。

这条主线覆盖操作系统、Linux、网络、数据库系统、分布式系统、存储、云原生、SRE、性能工程、安全、编译构建和基础设施自动化。

## 系统工程师能力模型

| 层级 | 能力 | 判断标准 |
| --- | --- | --- |
| L1 Machine Model | CPU、内存、进程、线程、I/O、文件系统 | 能解释程序在机器上如何运行 |
| L2 OS / Linux | syscall、调度、虚拟内存、网络栈、容器基础 | 能定位系统资源和内核边界问题 |
| L3 Network / Storage / DB | TCP/IP、HTTP、索引、事务、LSM、复制 | 能解释数据如何传输和持久化 |
| L4 Distributed Systems | 一致性、复制、分片、共识、消息语义 | 能处理多节点协作的不确定性 |
| L5 Cloud Native / SRE | Kubernetes、Service Mesh、CI/CD、SLO、Incident | 能运营生产级系统 |
| L6 Performance / Security | profiling、benchmark、容量、安全边界 | 能做性能和安全治理 |
| L7 Infrastructure Architecture | 平台工程、自动化、成本、弹性、演进 | 能设计可持续基础设施 |

## 主干

| 能力域 | 目录 | 训练目标 |
| --- | --- | --- |
| Operating Systems | `operating-systems/` | 进程、线程、调度、内存、I/O、文件系统 |
| Linux Systems | `linux-systems/` | shell、syscall、procfs、网络诊断、容器基础 |
| Computer Networking | `computer-networking/` | TCP/IP、HTTP、TLS、DNS、负载均衡 |
| Database Systems | `database-systems/` | 索引、事务、MVCC、WAL、查询优化、复制 |
| Distributed Systems | `distributed-systems/` | CAP、Raft、复制、分片、时钟、消息语义 |
| Storage Systems | `storage-systems/` | 文件系统、对象存储、LSM、B+Tree、缓存 |
| Cloud Native | `cloud-native/` | Docker、Kubernetes、Ingress、Service Mesh、Operator |
| SRE / Reliability | `sre-reliability/` | SLO、错误预算、Incident、容量、降级 |
| Performance Engineering | `performance-engineering/` | profiling、benchmark、火焰图、容量评估 |
| Security Engineering | `security-engineering/` | IAM、密钥、网络安全、供应链、隔离 |
| Compilers / Build Systems | `compilers-build-systems/` | 编译链路、依赖图、增量构建、缓存 |
| Infrastructure Automation | `infrastructure-automation/` | Terraform、GitOps、配置、发布、回滚 |
| Protocols | `protocols/` | HTTP、gRPC、WebSocket、SSE、MQTT、QUIC |
| Case Studies | `case-studies/` | 用生产问题串联系统能力 |

## 核心资产清单

| 优先级 | 资产 | 目录 | 状态 |
| --- | --- | --- | --- |
| P0 | Linux troubleshooting playbook | `linux-systems/` | todo |
| P0 | TCP / HTTP deep dive | `computer-networking/` | todo |
| P0 | database internals foundation | `database-systems/` | todo |
| P0 | distributed consistency playbook | `distributed-systems/` | todo |
| P0 | Kubernetes foundation | `cloud-native/` | todo |
| P0 | SLO / incident playbook | `sre-reliability/` | todo |
| P0 | performance profiling toolkit | `performance-engineering/` | todo |
| P1 | storage engine notes | `storage-systems/` | todo |
| P1 | security baseline | `security-engineering/` | todo |
| P1 | build system architecture | `compilers-build-systems/` | todo |
| P1 | infrastructure as code blueprint | `infrastructure-automation/` | todo |

## 架构师级追问

- 服务变慢时，如何从应用层一路定位到 CPU、内存、磁盘、网络？
- TCP 重传、队头阻塞、连接池耗尽分别怎么观测？
- 数据库慢查询是索引、锁、事务还是 I/O 问题？
- 分布式系统为什么没有 exactly-once 的免费午餐？
- Kubernetes 里一次请求从 Ingress 到 Pod 的路径是什么？
- SLO 如何定义，错误预算如何影响发布节奏？
- 如何估算容量和成本？
- 安全边界在哪里，密钥和权限如何治理？

## 和其他主线的关系

- `engineering/backend/`：应用后端架构建立在系统能力之上。
- `engineering/nodejs/`：Node.js 性能、部署、可观测需要系统工程支撑。
- `language/go/`：Go 是系统工程和云原生的主要实现语言。
- `system-design/`：系统设计案例要用这里的底层能力做论证。
- `ai-fullstack/`：AI 平台的 Serving、Eval、Streaming、Tool Runtime 都需要系统级可靠性。

