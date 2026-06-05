# Raft Consensus Algorithm Walkthrough

## 目标

深入理解 Raft 共识算法：leader 选举、日志复制、成员变更、safety guarantees。

## 场景

- 为什么 Raft 比 Paxos 更容易理解？
- leader 选举失败怎么排查？
- 日志不一致怎么修复？
- 节点故障后如何保持 consistency？

## 核心概念

Raft 是一种共识算法，用于在分布式系统中实现一致性。它将问题分解为：
1. **Leader 选举**（Leader Election）
2. **日志复制**（Log Replication）
3. **成员变更**（Membership Changes）

## Leader 选举

### 节点状态

```
Three states:
- Follower: 被动接收 leader 心跳，不发请求
- Candidate: 选举中，尝试成为 leader
- Leader: 处理所有客户端请求，复制日志给 followers

Term: 逻辑时钟，单调递增，用于判断过期信息
```

### 选举过程

```
Follower 收不到 heartbeat（election timeout）
  -> 增加 term，转为 Candidate
  -> 给自己投票
  -> 向所有节点发 RequestVote RPC

Candidate 收到多数票
  -> 成为 Leader
  -> 发 AppendEntries 心跳（心跳interval << election timeout）

Candidate 收到更高的 term
  -> 降为 Follower

没人赢得多数（split vote）
  -> election timeout 重新选举
```

### 选举超时（Election Timeout）

```
心跳间隔：heartbeat_interval = 100~150ms
选举超时：election_timeout = 150~300ms（随机，避免 split vote）

如果 follower 在 election_timeout 内没收到 leader 心跳：
  -> 开始新的选举

随机化：
  - 节点 A: 150ms
  - 节点 B: 200ms
  - 节点 C: 250ms

A 先超时，发起选举；B 和 C 收到 A 的 RequestVote 时还没超时，所以会投赞成票
A 赢得多数，成为 leader
```

### 节点数与容错

| 节点数 | 容错 | 说明 |
|---|---|---|
| 3 | 1 | 2/3 存活才能选 leader |
| 5 | 2 | 3/5 存活才能选 leader |
| 7 | 3 | 4/7 存活才能选 leader |

**注意**：偶数节点没有奇数好（5 节点容错 1，和 6 节点一样，但 6 节点选 leader 需要 3/6=50%，不如 3/5=60% 可靠）

## 日志复制

### 日志结构

```
Term  | Command      | Index
------+--------------+------
  1   | SET x = 1    |   1
  1   | SET y = 2    |   2
  2   | SET x = 5    |   3    <- 日志项包含：term（创建时的term）、command
  2   | SET z = 7    |   4
  ... | ...          |  ...
```

- **Index**：日志条目的唯一索引
- **Term**：创建该日志时的 term 编号
- **Committed**：日志已复制到多数节点，可安全执行

### 复制流程

```
客户端 -> Leader: SET x = 5

Leader:
  1. 本地追加日志（uncommitted）
     Log: [1:SET x=1, 2:SET y=2, 3:SET x=5]
  2. 发 AppendEntries RPC 给所有 Followers
  3. 等待多数节点响应（假设 3 节点集群：self + 2 followers，收到 2 响应）
  4. Apply 到状态机
  5. 回复客户端

Leader:
  6. 发送 AppendEntries 告诉 followers：该日志已 committed
  7. Followers apply 到本地状态机
```

### 一致性保证

```
Leader 的 AppendEntries 包含：
  - prevLogIndex: 前一个日志的索引
  - prevLogTerm: 前一个日志的 term

Follower 收到 AppendEntries：
  - 如果 prevLogIndex/prevLogTerm 在本地不匹配
  - 拒绝追加，返回 false
  - Leader 回退，发送更早的日志
  - 重复直到 match

这保证了：Leader 的日志是"大多数一致的"，不会有冲突
```

### 日志不一致修复

```
场景：Leader 崩溃，部分 Follower 日志不完整或冲突

Term 2   1   1   2   2   2
Index    1   2   3   4   5   6
Leader:  [a] [b] [c] [d] [e] [f]
Follower: [a] [b]     [x] [y]      <- 缺失 3, 多余 x, y

Leader 发现：
  - nextIndex[Follower] = 3（期望从 index 3 开始）
  - 发 AppendEntries(prevLogIndex=2, prevLogTerm=1, entries=[c,d,e,f])
  - Follower index 3 没有日志，拒绝

Leader 回退：
  - nextIndex[Follower] = 2
  - 发 AppendEntries(prevLogIndex=1, prevLogTerm=1, entries=[b,c,d,e,f])
  - Follower 有 b，可以追加

最终：Follower 日志被强制同步为 Leader 的副本
```

## Safety Guarantees

### Election Safety

```
Raft 保证：每个 term 最多只有一个 leader

理由：
  - 一个节点在同一个 term 只能投一票（先到先得）
  - Candidate 拿到多数票才能成为 leader
  - 两个 Candidate 不可能同时拿到多数票

即使：
  - 两个 Candidate 同时发起选举（split vote）
  - 没人拿到多数，term+1，重新选举
  - 直到有人拿到多数
```

### Log Matching

```
如果两个日志的某个条目有相同的 index 和 term：
  - 该条目之前的所有条目都相同

证明：
  - Leader 在 index X 复制到多数，说明 index X 之前的日志在多数节点都一致
  - Follower 接受 AppendEntries，说明 prevLogIndex/prevLogTerm 匹配
  - 递归归纳：所有前置条目都一致
```

### Leader Completeness

```
如果某日志条目已在某 term 标记为 committed：
  - 所有未来的 leader 都包含该条目

证明：
  - 日志条目已 committed -> 复制到多数节点
  - 未来的 leader 必须获得多数票
  - 多数中至少有一个节点有该条目
  - 如果 candidate 没有该条目， majority 节点也不会投票给它
  - 因此新 leader 一定有该条目
```

### 状态机 Safety

```
如果状态机已 applied 某条目：
  - 不会有其他服务器在同样位置 apply 不同条目

因为：
  - 已 applied 的条目 -> 已 committed -> 存在于 majority
  - 未来的 leader 必须包含 majority -> 必然包含该条目
  - leader 只会在已 committed 的条目后追加
  - 所以不会有冲突
```

## 成员变更（Membership Changes）

### 两种方案

**方案 1：joint consensus（联合共识）**
```
- 旧配置 C_old 和新配置 C_new 共同生效
- 需要新旧配置各自多数都同意
- 过渡期间任一配置都可能有 leader
- 完成后切换到 C_new

问题：实现复杂，容易出错
```

**方案 2：single-server changes（一次性变更一个节点）**
```
Raft 推荐的简单方案：
  - 每次只添加或移除一个节点
  - 避免联合配置

添加节点：
  - 新节点没有日志，作为 follower 开始同步
  - leader 复制日志给它直到跟上

移除节点：
  - 需要确保移除的节点不是 leader
  - 如果是 leader，先选出一个新 leader 再移除

验证：
  - 3 节点 -> 4 节点：需要 3/4 = 75% 多数
  - 3 节点 -> 2 节点：2/3 = 66.7% 多数

关键：
  - 移除节点时，如果它不知道已被移除，可能继续发请求
  - 需要确保移除节点的 term 比当前 leader 小，不会干扰
```

## 脑裂问题（Split Brain）

```
问题：网络分区，原 leader 在小分区，无法获得多数

场景：3节点，节点A在分区1（只有A），B+C在分区2

分区1（A）：
  - election timeout 到来
  - term++, 成为 Candidate
  - 投自己，term+1

分区2（B+C）：
  - 收到更高的 term（A的），降为 Follower
  - B 或 C 成为 leader

恢复后：
  - A 收到 B 的 heartbeat（term 更高）
  - A 降为 Follower，接受 B 的领导
  - A 的日志（未 committed）被丢弃

结果：最终一致，不会脑裂
```

## L2：源码锚定与边界陷阱

### etcd Raft 关键源码

| 功能 | 文件/结构 | 说明 |
|---|---|---|
| Raft 状态机 | `raft/raft.go` | `raft.Raft` struct：Term、State、Log、Progress |
| Leader 选举 | `raft/raft.go:becomeCandidate` / `becomeLeader` | 转换状态，发起 RequestVote |
| 日志追加 | `raft/raft.go:appendEntry` | Leader 追加本地日志 |
| 复制跟踪 | `raft/progress.go` | `Progress` struct：nextIndex、matchIndex、inflight |
| 心跳 | `raft/raft.go:heartbeat` / `raft/raft.go:bcastHeartbeat` | Leader 广播心跳 |
| 快照 | `raft/snapshot.go` | 日志过大时发送 snapshot |

### Progress 与 inflight 的边界

```go
// etcd raft/tracker/progress.go
 type Progress struct {
     NextIndex  uint64  // 期望发送给该节点的下一个日志索引
     MatchIndex uint64  // 该节点已确认的日志索引
     Inflights  *Inflights // 已发出但尚未确认的消息窗口
 }
```

- **Inflights**：Leader 对每条消息都记录在 inflight 窗口中，收到 follower ACK 后才释放。
- **边界**：如果 follower 网络抖动，inflight 窗口满后 Leader 会停止发送，导致复制延迟。 inflight 大小默认 256，可通过 `MaxInflightMsgs` 调整。

### 单节点变更的陷阱

```
3 节点扩容到 5 节点：
  - 每次只添加 1 个节点
  - 添加后：4 节点，需要 3/4 多数
  - 如果此时再添加 1 个：5 节点，需要 3/5 多数

陷阱：
  - 新节点没有日志，leader 需要大量复制
  - 如果 leader 复制能力不足，复制延迟会导致集群不可用
  - 最佳实践：先添加为 Learner（只接收日志，不参与投票），追上后再转为正式节点
```

### 预投票（PreVote）

```
问题：网络分区恢复后，被隔离的节点 term 很高，重新加入集群后迫使 leader 降级。

PreVote 机制：
  - Candidate 先发送 PreVote RPC（不增加 term）
  - 如果多数节点同意，才真正增加 term 并发起选举
  - 避免 term 暴涨导致频繁 leader 切换
```

## L3：可运行实验

见 `impl/raft_lab/`：

```bash
cd systems-engineering/distributed-systems/impl/raft_lab
python3 raft_sim.py
```

脚本模拟：
- 3 节点集群的 Leader 选举（RequestVote + 多数确认）
- Leader 向 Followers 复制日志（AppendEntries）
- Commit Index 的更新与多数确认

## 核心追问

1. **Raft 为什么比 Paxos 更容易理解？** Paxos 把所有问题（leader 选举、日志复制、membership）混合在一个协议里；Raft 把问题分解成独立的子问题，每步都有明确的目标
2. **election timeout 为什么要随机？** 避免多个 Candidate 同时发起选举导致 split vote；随机化确保只有一个先发起并赢得多数
3. **日志复制到多数后就可以 commit 吗？** 可以。日志条目复制到 majority 时，即使 leader 崩溃，新 leader 也会包含该日志（因为 majority 包含它）
4. **成员变更时如何避免脑裂？** 每次只变更一个节点，保持奇数节点（或确保新配置仍有 majority），joint consensus 方案在过渡期需要新旧 majority 都同意
5. **如果 leader 在 commit 后崩溃但还没 apply 到状态机？** 新 leader 会继续复制该日志（因为它已 committed），最终会被 apply；状态机 apply 是幂等的，不会重复执行

## 工程迁移

- **etcd**：使用 Raft 实现分布式 KV 存储
- **Consul**：使用 Raft 实现服务发现和配置
- **TiKV**：使用 Raft 复制 Region 数据

## 状态

| 资产 | 深度 | 状态 |
|---|---|---|
| Raft walkthrough | **L2+L3** | **done** |
| distributed lock critique | L1 | todo |
| message delivery semantics | L1 | todo |
| sharding and rebalance playbook | L1 | todo |
| consistency model comparison | L2+L3 | done |