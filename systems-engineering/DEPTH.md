# Systems Engineering Depth Standard

系统工程知识资产的三层深度模型与评估标准。

## 三层资产模型

### L1 Framework（框架层）

**作用**：地图、导航、知道"有什么"  
**内容**：概念定义、关系图、场景清单、面试追问  
**判断标准**：一个没学过的人读完能画得出知识地图  
**当前状态**：全部 33 篇主题文档 + 7 篇已有 P0 文档

### L2 Deep Dive（深度层）

**作用**：理解"为什么这样设计"、"边界在哪"  
**内容**：
- 源码级走读（指向具体函数、数据结构、版本）
- 数学/算法推导（如一致性证明、复杂度分析）
- 性能基准数字（有出处或可复现）
- 设计权衡的 history（如为什么 TCP 不是 UDP）
- 边界条件与反直觉案例

**判断标准**：能给别人讲清楚实现细节，能预判异常行为

### L3 Lab（实验层）

**作用**：亲手验证，形成肌肉记忆  
**内容**：
- `impl/`：可编译运行的最小程序（如 toy LSM、epoll server）
- `test/`：验证脚本 + 性能基准
- `trace/`：bpftrace/eBPF 脚本、strace 输出样本
- `case/`：可复现的故障注入脚本

**判断标准**：clone 下来能跑，跑完能复现书中描述的现象

## 四把评估尺子

每篇文档在每个维度上标注 `L1/L2/L3/none`：

| 维度 | L1 | L2 | L3 |
|---|---|---|---|
| **源码锚定** | 提到关键数据结构名 | 指向具体文件+函数+行号范围 | 有注释过的源码片段 |
| **数字锚定** | 有数量级概念 | 有可复现的 benchmark 数字 | 有趋势图/对比实验 |
| **可运行物** | 有代码片段 | 有完整可运行的程序 | 有自动化测试/CI |
| **关联网络** | 文末列相关文档 | 正文中有明确的衔接点标注 | 有交互式依赖图 |

## 能力链（Capability Chain）

单篇文档的深化价值有限，**必须按能力链纵向打通**。当前定义的核心链：

### Chain-1：请求延迟诊断链
```
慢请求
  ├──► performance-engineering/profiling.md（火焰图、tracing）
  ├──► linux-systems/troubleshooting.md（us/sy/wa 定位）
  │      ├──► operating-systems/io-model.md（epoll、syscall）
  │      │      └──► operating-systems/virtual-memory.md（page fault）
  │      └──► computer-networking/tcp.md（重传、拥塞）
  └──► database-systems/slow-query.md（索引、锁、MVCC）
```

### Chain-2：数据一致性链
```
分布式事务 / 数据库事务 / 缓存一致性 / 消息语义
  ├──► database-systems/mvcc.md
  ├──► database-systems/replication.md
  ├──► distributed-systems/consistency.md
  ├──► distributed-systems/raft.md
  └──► protocols/sse.md / websocket.md（消息送达语义）
```

### Chain-3：发布稳定性链
```
GitOps → 金丝雀 → 数据库迁移 → 回滚 → 故障演练
  ├──► infrastructure-automation/gitops-workflow.md
  ├──► infrastructure-automation/deployment-rollback.md
  ├──► sre-reliability/incident.md
  └──► sre-reliability/slo.md
```

## 深化原则

1. **不按模块平铺，按链纵向打通**：一条链深化完再打下一条
2. **L2 优先于 L3**：先把关键概念的源码和数字补全，再补实验代码
3. **可运行物必须和文档同版本维护**：代码不能过时
4. **每个 L3 实验必须有预期输出**：跑完和文档对照验证
