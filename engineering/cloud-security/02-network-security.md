# 云网络安全

## 1. VPC 与网络隔离

```
VPC 网络架构

Internet
    │
    ▼
┌──────────────┐
│  Internet    │
│  Gateway     │
└──────────────┘
    │
    ▼
┌──────────────┐     ┌──────────────┐
│   Public     │     │   Public     │
│   Subnet     │     │   Subnet     │
│  (ALB/NatGW) │     │   (Bastion)  │
└──────────────┘     └──────────────┘
    │                      │
    ▼                      ▼
┌──────────────┐     ┌──────────────┐
│   Private    │     │   Private    │
│   Subnet     │     │   Subnet     │
│  (App Tier)  │     │   (DB Tier)  │
└──────────────┘     └──────────────┘
    │                      │
    ▼                      ▼
┌──────────────┐     ┌──────────────┐
│   Private    │     │   Private    │
│   Subnet     │     │   Subnet     │
│  (Cache)     │     │   (Storage)  │
└──────────────┘     └──────────────┘

网络隔离策略
├── 安全组（Security Group）：有状态、实例级、允许规则
├── 网络 ACL（NACL）：无状态、子网级、允许+拒绝规则
├── VPC 对等连接：跨 VPC 私有通信
├── PrivateLink / VPC Endpoint：无需公网访问云服务
└── 传输网关（Transit Gateway）：大规模 VPC 互联
```

| 特性 | 安全组 | 网络 ACL |
|------|--------|----------|
| 级别 | 实例/ENI | 子网 |
| 状态 | 有状态 | 无状态 |
| 规则 | 仅允许 | 允许 + 拒绝 |
| 评估 | 评估所有规则 | 按顺序评估 |
| 默认 | 拒绝所有入站，允许所有出站 | 允许所有 |

## 2. 微分段

```
微分段（Micro-segmentation）

传统：按网络边界分段（DMZ / 内网）
现代：按工作负载身份分段

┌──────────────────────────────────────────┐
│  应用 A Pod                               │
│  标签: app=payment, env=prod, tier=app   │
│  身份: spiffe://cluster.local/ns/payment │
└──────────────────────────────────────────┘
              │
              │ mTLS + 身份验证
              │
┌──────────────────────────────────────────┐
│  数据库 Pod                               │
│  标签: app=payment-db, env=prod          │
│  策略: 只允许 payment app 访问             │
└──────────────────────────────────────────┘

实现方式：
├── Service Mesh（Istio/Linkerd）：L7 微分段
├── CNI 网络策略（Calico/Cilium）：L3/L4 微分段
└── 云原生安全组：标签驱动的动态规则
```

```yaml
# Kubernetes NetworkPolicy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: payment-db-policy
  namespace: payment
spec:
  podSelector:
    matchLabels:
      app: payment-db
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: payment
              tier: app
      ports:
        - protocol: TCP
          port: 5432
```

## 3. DDoS 防护

```
DDoS 防护层次

Layer 7（应用层）
├── WAF：速率限制、Bot 管理、挑战响应
├── CDN：吸收流量、缓存静态内容
└── API Gateway：限流、认证

Layer 4（传输层）
├── 云厂商 DDoS 防护（AWS Shield、Azure DDoS Protection）
├── 负载均衡器：连接限制、SYN Cookie
└── Anycast：分散攻击流量

Layer 3（网络层）
├── BGP 黑洞路由：丢弃攻击流量
├── 流量清洗中心：清洗后回注
└── 云厂商基础防护：自动缓解

AWS Shield
├── Shield Standard：免费，自动防护 L3/L4
└── Shield Advanced：付费，L7 防护、DRT 支持、成本保护
```

## 4. 私有连接

```
无需公网的云访问

VPC Endpoint（AWS）/ Private Link（Azure/GCP）
┌─────────┐        ┌─────────────┐        ┌─────────┐
│  VPC    │◀──────▶│   Endpoint  │◀──────▶│  云服务  │
│ 内部    │ 私有    │  (Gateway/  │  私有   │ (S3/RDS) │
│         │        │   Interface)│        │         │
└─────────┘        └─────────────┘        └─────────┘

使用场景：
├── 从 VPC 访问 S3/DynamoDB（Gateway Endpoint，免费）
├── 从 VPC 访问其他 AWS 服务（Interface Endpoint，收费）
├── 跨租户/跨组织私有访问（PrivateLink）
└── 混合云：VPN / Direct Connect / ExpressRoute
```
