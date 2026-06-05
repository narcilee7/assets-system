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

## 知识资产深度标准

本目录下的文档按三层深度模型建设，详见 [`DEPTH.md`](DEPTH.md)。

**当前总体深度**：L1 骨架 ✅ 已完成，Chain-1（延迟诊断链）L2+L3 ✅ 已深化，其余链 L2/L3 深化中 ⬜

| 能力域 | 目录 | L1 文档 | L2 深度 | L3 实验 | 训练目标 |
| --- | --- | --- | --- | --- | --- |
| Operating Systems | `operating-systems/` | 5 | 2 | 2 | 进程、线程、调度、内存、I/O、文件系统 |
| Linux Systems | `linux-systems/` | 6 | 1 | 2 | shell、syscall、procfs、网络诊断、容器基础 |
| Computer Networking | `computer-networking/` | 4 | 2 | 2 | TCP/IP、HTTP、TLS、DNS、负载均衡 |
| Database Systems | `database-systems/` | 5 | 4 | 4 | 索引、事务、MVCC、WAL、查询优化、复制 |
| Distributed Systems | `distributed-systems/` | 5 | 1 | 1 | CAP、Raft、复制、分片、时钟、消息语义 |
| Storage Systems | `storage-systems/` | 4 | 0 | 0 | 文件系统、对象存储、LSM、B+Tree、缓存 |
| Cloud Native | `cloud-native/` | 5 | 2 | 2 | Docker、Kubernetes、Ingress、Service Mesh、Operator |
| SRE / Reliability | `sre-reliability/` | 5 | 2 | 2 | SLO、错误预算、Incident、容量、降级 |
| Performance Engineering | `performance-engineering/` | 5 | 1 | 1 | profiling、benchmark、火焰图、容量评估 |
| Security Engineering | `security-engineering/` | 5 | 0 | 0 | IAM、密钥、网络安全、供应链、隔离 |
| Compilers / Build Systems | `compilers-build-systems/` | 4 | 0 | 0 | 编译链路、依赖图、增量构建、缓存 |
| Infrastructure Automation | `infrastructure-automation/` | 5 | 0 | 0 | Terraform、GitOps、配置、发布、回滚 |
| Protocols | `protocols/` | 5 | 0 | 0 | HTTP、gRPC、WebSocket、SSE、MQTT、QUIC |
| Case Studies | `case-studies/` | 1 | 0 | 0 | 用生产问题串联系统能力 |

## 核心资产清单（按优先级 + 深度目标）

| 优先级 | 资产 | 目录 | 当前深度 | 目标深度 |
| --- | --- | --- | --- | --- |
| P0 | Linux troubleshooting playbook | `linux-systems/` | L1 | L2+L3 |
| P0 | TCP / HTTP deep dive | `computer-networking/` | L1 | L2 |
| P0 | database internals foundation | `database-systems/` | L1 | L2 |
| P0 | distributed consistency playbook | `distributed-systems/` | L1 | L2 |
| P0 | Kubernetes foundation | `cloud-native/` | L1 | L2 |
| P0 | SLO / incident playbook | `sre-reliability/` | L1 | L2 |
| P0 | performance profiling toolkit | `performance-engineering/` | L1 | L2+L3 |
| P1 | storage engine notes | `storage-systems/` | L1 | L2 |
| P1 | security baseline | `security-engineering/` | L1 | L2 |
| P1 | build system architecture | `compilers-build-systems/` | L1 | L2 |
| P1 | infrastructure as code blueprint | `infrastructure-automation/` | L1 | L2 |

## 深化路线：能力链（Capability Chain）

**Chain-1：请求延迟诊断链** 🔨 当前攻坚
```
慢请求
  ├──► performance-engineering/profiling.md（火焰图、tracing）L1→L2
  ├──► linux-systems/troubleshooting.md（us/sy/wa 定位）L1→L2+L3
  │      ├──► operating-systems/io-model.md（epoll、syscall）L1→L2+L3
  │      │      └──► operating-systems/virtual-memory.md（page fault）L1→L2+L3
  │      └──► computer-networking/tcp.md（重传、拥塞）L1→L2+L3
  └──► database-systems/slow-query.md（索引、锁、MVCC）L1→L2
```

**Chain-2：数据一致性链** ⏳ 待启动
```
分布式事务 → 数据库事务 → 缓存一致性 → 消息语义
```

**Chain-3：发布稳定性链** ⏳ 待启动
```
GitOps → 金丝雀 → 数据库迁移 → 回滚 → 故障演练
```

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
