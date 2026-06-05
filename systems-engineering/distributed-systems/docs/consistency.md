# Consistency Model Comparison

## 目标

理解分布式系统中的各种一致性模型：从强到弱，以及 CAP/PACELC 的权衡。

## 场景

- 什么时候可以用弱一致性？
- 为什么 Paxos 慢但一致，AP 系统快但可能不一致？
- 读写一致性和写一致性有什么区别？

## 一致性模型层次

```
Strong Consistency (强一致性)
  | Sequential Consistency (顺序一致性)
  |   | Linearizability (线性一致性)
  |
Weak Consistency (弱一致性)
  | Causal Consistency (因果一致性)
  |   | Eventual Consistency (最终一致性)
```

## Linearizability（线性一致性）

### 定义

```
操作的效果在调用和响应之间的某个时间点生效
所有进程看到的所有操作都是同样顺序

等价于：
  - 操作的原子性（没有部分可见）
  - 所有操作按全局时钟排序
```

### 例子

```
非线性（两个并发写）：
  P1: W(x) = 1
  P2: W(x) = 2
  读操作可能返回 1 或 2（取决于哪个后生效）

线性：
  写操作完成后，所有后续读都返回新值
  不存在"部分可见"的状态
```

### 实现代价

- 需要共识算法（Paxos / Raft）
- 写入需要多数节点确认
- 延迟高（跨机房可能 100ms+）

## Sequential Consistency（顺序一致性）

### 定义

```
所有进程看到的操作顺序一致
但不需要和真实时间一致

例子：
  进程 A 按顺序执行：W(x)=1, R(x)=1, W(x)=2
  进程 B 可能看到：W(x)=1, W(x)=2, R(x)=2
  但 B 看到的顺序必须和 A 一致
```

### 和 Linearizability 的区别

```
Linearizability：操作有时间戳，全局有序
Sequential：操作有顺序但不一定是实时顺序

例子：
  T=1: W(x)=1 (P1)
  T=2: R(x)=1 (P2)
  T=3: W(x)=2 (P1)

Linearizability：B 的读一定看到 1 或 2（取决于时序）
Sequential：可能看到 1 或 2，但顺序必须和 P1 一致
```

## Causal Consistency（因果一致性）

### 定义

```
因果相关的操作必须按因果顺序执行
无因果关系的操作可以并发

例子：
  P1: W(x)=1 -> W(y)=2（y 依赖 x）
  P2: 必须先看到 x=1，才能看到 y=2
  P3: 可以先看到 y=2，再看到 x=1（无因果）
```

### 实现

```
向量时钟（Vector Clock）：
  VC = {P1: 2, P2: 1, P3: 0}
  
判断因果：
  VC_a < VC_b：a 在 b 之前
  VC_a || VC_b：并发

每个操作携带 VC，接收方判断是否需要等待
```

## Eventual Consistency（最终一致性）

### 定义

```
如果没有新的更新，最终所有副本会一致
但不保证何时一致

例子：
  DNS：TTL 过后所有节点一致
  购物车：多副本，最终合并
```

### 问题：更新丢失

```
场景：
  副本 A：初始 x=0
  副本 B：初始 x=0
  
  A 写入 x=1（到 A）
  B 写入 x=2（到 B）
  
  同步后：
    方案 1：last-write-wins → x=2（A 的丢失）
    方案 2：merge → conflict，需要人工解决
```

### 解决方案：CRDT

```
Conflict-free Replicated Data Types

G-Counter（只增计数器）：
  每个节点维护自己的 counter
  合并：取每个节点 counter 的最大值

LWW-Register（最后写入胜出）：
  每个操作带 timestamp
  合并：取 timestamp 最大的

OR-Set（观察删除集合）：
  添加带唯一 ID
  删除标记，不真正删除
  合并：合并添加集和删除集
```

## CAP 定理

### 表述

```
Consistency（一致性）：所有节点看到同样的数据
Availability（可用性）：每次请求都能得到响应
Partition Tolerance（分区容忍）：网络分区时系统仍能运行

CAP 定理：三者只能同时满足两个
```

### 常见误解

**误解 1：CAP = 三选二**
```
实际上：分区很少发生，CAP 只在分区时生效
平时不需要在 C 和 A 之间选择

PACELC：
  Partition 时：在 C 和 A 之间选择
  Else（正常情况）：在 L（latency）和 C 之间选择
```

**误解 2：CA 系统存在**
```
在有网络分区时，CA 不可兼得
真正的分布式系统必须有 P
所以"CA"只是没有分区的理论系统
```

### CAP 选择

```
CP（一致性优先）：
  - Zookeeper
  - etcd
  - HBase
  - 金融系统、订单系统

AP（可用性优先）：
  - Cassandra
  - DynamoDB
  - Cassandra
  - 社交 Feed、日志系统

CA（理论）：
  - 单机数据库
  - 虚拟机
```

## PACELC

```
if (P) {
  // 分区时：在一致性和可用性之间选择
  if (consistency) { latency++; }
  else { staleness++; }
} else {
  // 正常时：在延迟和一致性之间选择
  if (low_latency) { staleness++; }
  else { latency++; }
}
```

| 数据库 | CAP | PACELC |
|---|---|---|
| Zookeeper | CP | 强一致，中等延迟 |
| etcd | CP | 强一致，中等延迟 |
| Cassandra | AP | 低延迟，可能不一致 |
| DynamoDB | AP | 低延迟，本地读强一致 |
| MongoDB | CP | 强一致，高延迟（副本集） |
| MySQL | CA | 低延迟，弱一致（异步复制） |

## 一致性模型选择

| 场景 | 推荐模型 | 理由 |
|---|---|---|
| 金融交易 | Linearizability | 账户余额必须强一致 |
| 社交 Feed | Eventual + CRDT | 允许最终一致，追求低延迟 |
| 购物车 | Last-Write-Wins | 允许覆盖，用户体验优先 |
| 配置下发 | Sequential | 需要有序但不要求实时 |
| DNS | Eventual | TTL 缓存，可接受最终一致 |

## L2：实现细节与边界

### 线性一致性的工程实现

- **etcd / Raft**：所有写操作通过 Raft log 复制到多数节点，`ReadIndex` 机制保证读也线性一致（Leader 确认自己仍是 Leader 后才返回）。
- **Zookeeper (ZAB)**：保证顺序一致性 + 单客户端 FIFO。写操作全局有序，但不同客户端可能看到略微不同的时序。
- **Cassandra (QUORUM)**：`QUORUM` 读写交叉时（R + W > N）可提供强一致，但默认 `ONE` 读取是最终一致。

### 向量时钟的代价

```
VC 大小 = 节点数 N
- 节点数增加时，每次请求携带的元数据线性增长
- 删除节点后，VC 中残留条目需要垃圾回收（Dynamo 用 clock prune）
- 如果 N > 1000，VC 成为带宽和存储瓶颈
```

替代方案：**Hybrid Logical Clock (HLC)** = 物理时钟 + Lamport counter，既能因果排序又能和物理时间对齐，大小固定。

### CRDT 的 state-based vs operation-based

| 类型 | 传输内容 | 要求 | 示例 |
|---|---|---|---|
| State-based | 完整状态 | 可交换、幂等、单调 | G-Counter 合并取 max |
| Op-based | 操作日志 | 可靠广播 + 因果交付 | OR-Set 的 add/remove 操作 |

Op-based 通常更省带宽，但需要底层消息系统保证因果顺序 delivery。

### 边界陷阱

1. **最终一致性的 "最终" 没有上限**：在网络分区持续期间，副本可能永远不一致。
2. **Last-Write-Wins 的时钟依赖**：如果节点时钟漂移，可能导致"未来"写入被"过去"写入覆盖。
3. **强一致的读延迟尾跳**：etcd 的 `ReadIndex` 在 Leader 选举或网络抖动时，延迟可能从 ms 级跳到数百 ms。

## L3：可运行实验

见 `impl/consistency_lab/`：

```bash
cd systems-engineering/distributed-systems/impl/consistency_lab
python3 crdt.py
```

演示 G-Counter 的合并（取各节点 max）和 LWW-Register 的合并（取最大 timestamp）。

## 核心追问

1. **Linearizability 和 Sequential Consistency 的区别？** Linearizability 要求操作的时间顺序和全局时钟一致；Sequential 只要求所有进程看到的顺序一致，不要求和真实时间一致
2. **为什么最终一致性不够？** 写冲突时无法自动解决，需要业务处理或 CRDT
3. **CAP 的 P 什么时候发生？** 网络抖动、机器宕机、跨机房链路断开
4. **PACELC 的 L 是什么？** Latency，正常情况下追求低延迟和追求一致性的权衡
5. **CRDT 的适用场景？** 需要多副本合并、无中心协调、允许最终一致的场景（如聊天、购物车、协同编辑）

## 状态

| 资产 | 深度 | 状态 |
|---|---|---|
| Raft walkthrough | L1 | done |
| distributed lock critique | L1 | done |
| message delivery semantics | L1 | done |
| sharding and rebalance playbook | L1 | done |
| consistency model comparison | **L2+L3** | **done** |