# Zero Trust Service Access

## 目标

理解零信任安全模型的核心原则：永不信任、始终验证，以及如何在微服务和云原生环境中落地实现服务间的安全访问。

## 场景

- 内网服务默认互信了，一台机器被攻破怎么办？
- 微服务之间怎么防止 lateral movement？
- BeyondCorp 和 SDP 有什么区别？
- 零信任是不是意味着不需要 VPN 了？
- Service Mesh 的 mTLS 就是零信任吗？

## 零信任核心原则

```
传统安全模型（边界模型）：
  ┌─────────────────────────────┐
  │         互联网               │
  └───────────┬─────────────────┘
              │ 防火墙
  ┌───────────▼─────────────────┐
  │         内网（信任）          │
  │   服务A ◄──► 服务B ◄──► DB   │
  └─────────────────────────────┘
  
  问题：一旦突破边界，内网畅通无阻

零信任模型：
  ┌─────────────────────────────────────────┐
  │              互联网 / 内网                │
  │   服务A ──► 策略引擎 ◄─── 服务B          │
  │      \         │         /              │
  │       \   每次请求都验证  /               │
  │        \    身份 + 上下文 /               │
  │         ▼              ▼                │
  │         通过 / 拒绝 / 限制               │
  └─────────────────────────────────────────┘
  
  核心：不区分内外网，每次访问都验证
```

### 三大支柱

```
1. 明确验证（Verify Explicitly）
   - 身份认证：你是谁（人/服务/设备）
   - 设备健康：是否合规、有无漏洞
   - 上下文：时间、地点、行为基线

2. 最小权限（Use Least Privilege Access）
   - 按需授权（Just-in-Time）
   - 限时访问（Just-Enough-Time）
   - 动态调整

3. 假设 breach（Assume Breach）
   - 分段隔离（micro-segmentation）
   - 全程加密
   - 持续监控和异常检测
```

## 人访问服务：BeyondCorp

### Google BeyondCorp 模型

```
用户（任何网络位置）
   │
   ▼
Identity-Aware Proxy (IAP) / Access Proxy
   │
   ├──► 身份验证（SSO + MFA）
   ├──► 设备验证（证书 + 健康状态）
   ├──► 上下文评估（IP、时间、地理位置）
   └──► 策略决策
            │
      允许 ──► 反向代理到后端服务
      拒绝 ──► 返回 403

关键：
  - 无 VPN
  - 每个请求都经过代理和验证
  - 后端服务不直接暴露
```

### 设备信任

```
设备注册：
  - 公司设备安装管理证书
  - 定期上报健康状态（补丁、杀毒、磁盘加密）

设备状态：
  - 合规：允许访问所有应用
  - 不合规：只允许访问修复工具/文档
  - 未注册：只能访问公共应用
```

## 服务访问服务：mTLS + SPIFFE/SPIRE

### 服务身份

```
传统：IP + Port = 信任依据
  问题：IP 可变、可伪造、复用

零信任：Cryptographic Identity（加密身份）
  - 每个服务实例有唯一证书（X.509 SVID）
  - 证书由统一 CA 签发（SPIRE、Istio Citadel、Vault）
  - 身份 = SPIFFE ID（如 spiffe://cluster.local/ns/default/sa/frontend）
```

### SPIFFE / SPIRE

```
SPIFFE = Secure Production Identity Framework For Everyone
SPIRE = SPIFFE Runtime Environment

架构：
  ┌─────────────┐
  │   SPIRE     │
  │   Server    │
  │  (CA/注册)   │
  └──────┬──────┘
         │ 签发 SVID
         ▼
  ┌─────────────┐
  │   SPIRE     │
  │    Agent    │
  │  (每节点)    │
  └──────┬──────┘
         │ 分发 SVID
    ┌────┴────┬────────┐
    ▼         ▼        ▼
  ServiceA  ServiceB  ServiceC
  (SVID)    (SVID)    (SVID)

SVID（SPIFFE Verifiable Identity Document）：
  - X.509 证书或 JWT Token
  - 包含 SPIFFE ID
  - 短期有效（1 小时），自动轮换
```

### Service Mesh 中的零信任

```
Istio/Linkerd 零信任实现：

  ServiceA ──► Envoy Sidecar ──► mTLS ──► Envoy Sidecar ──► ServiceB
                  │                              │
                  └── 自动管理证书（Citadel）      └── 验证对方身份

功能：
  1. 自动 mTLS：Sidecar 间自动协商加密连接
  2. 身份验证：基于 SVID 确认对方是谁
  3. 授权策略：L4/L7 访问控制（如只允许 frontend 访问 backend:8080）
  4. 审计日志：谁访问了谁、什么结果

不是零信任的全部：
  - Service Mesh 解决的是服务间通信安全
  - 零信任还包括人访问服务、设备信任、数据访问控制
```

## 网络微分段

### 传统分段 vs 微分段

```
传统分段（VLAN）：
  - 粗粒度：DMZ / App / DB 三个区
  - 同一区域内的服务自由通信
  - 硬件防火墙规则复杂

微分段（Micro-segmentation）：
  - 细粒度：每个工作负载独立策略
  - 默认拒绝，显式允许
  - 基于身份而非 IP

实现方式：
  1. 主机防火墙（iptables/Windows FW）
  2. 容器网络策略（K8s NetworkPolicy）
  3. 服务网格策略（Istio AuthorizationPolicy）
  4. 云安全组（Cloud Security Groups）
```

### K8s NetworkPolicy 示例

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-policy
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - protocol: TCP
          port: 8080

含义：
  - 只有 label app=frontend 的 Pod 能访问 backend 的 8080
  - 其他所有来源默认拒绝
  - 即使是同一 Namespace 的其他 Pod 也不行
```

## SDP（Software Defined Perimeter）

```
SDP = 软件定义边界

架构：
  ┌─────────────┐
  │  SDP Controller │
  │  (策略决策)      │
  └──────┬──────┘
         │
    ┌────┴────┐
    ▼         ▼
  Client   Gateway
  (Initiating    (Accepting
   Host)          Host)

流程：
  1. Client 向 Controller 认证
  2. Controller 验证身份、设备、上下文
  3. 通过 → Controller 通知 Gateway 开放单包授权（SPA）端口
  4. Client 发送 SPA 包，Gateway 临时允许该 IP
  5. Client 与 Gateway 建立连接，访问后端服务

特点：
  - Gateway 默认拒绝所有连接（黑云）
  - 只有认证通过的客户端才能"看到"服务
  - 比 VPN 更细粒度，按需开放
```

## 零信任成熟度模型

| 级别 | 特征 | 技术 |
|---|---|---|
| L0 传统 | 边界防火墙 + VPN | VLAN、IPSec VPN |
| L1 混合 | VPN + 部分应用代理 | VPN、反向代理、SSO |
| L2 应用级 | 无 VPN，应用级代理 + 身份验证 | IAP、BeyondCorp |
| L3 服务级 | 服务间 mTLS + 授权 | Service Mesh、SPIFFE |
| L4 数据级 | 数据分类 + 加密 + DLP | KMS、DLP、数据分类 |
| L5 持续优化 | AI 驱动的动态信任评分 | UEBA、实时策略引擎 |

## 核心追问

1. **零信任和 VPN 是完全替代关系吗？** 不是。零信任是安全理念，VPN 是网络接入技术。很多零信任方案用 VPN 作为接入层之一，但认证和授权不依赖"在内网"这个前提
2. **Service Mesh 的 mTLS 能防内部人员攻击吗？** 不能。mTLS 防的是服务间流量窃听和伪造，内部人员如果有 API 访问权限或能登录容器，mTLS 挡不住；需要配合审计、DLP、最小权限
3. **SPIFFE ID 和 Kubernetes Service Account 的关系？** K8s Service Account 是命名空间内的身份；SPIFFE ID 是跨平台的统一身份标准，可以映射自 Service Account，也可以来自 VM、裸机等
4. **零信任的性能开销有多大？** 主要开销：TLS 握手（1-RTT，可复用会话）、策略检查（本地缓存可降低到 μs 级）、Sidecar 代理（延迟增加 0.1-1ms）。通常可接受
5. **小公司没有 Google 的工程师，怎么落地零信任？** 从最高 ROI 开始：1）撤销内网默认互信，启用云安全组/NetworkPolicy；2）人访问服务用云厂商 IAP（如 AWS ALB + Cognito）；3）服务间用托管 Service Mesh（如 AWS App Mesh、Google Anthos）

## 状态

| 资产 | 状态 |
|---|---|
| security baseline checklist | done |
| secret rotation playbook | done |
| zero trust service access | done |
| container security notes | todo |
| supply chain security checklist | todo |
