# 云 IAM 与访问控制

## 1. 云 IAM 核心概念

```
IAM 组件模型（AWS / Azure / GCP / 阿里云）

├── Identity（身份）
│   ├── 用户（User）：人员账户
│   ├── 用户组（Group）：用户的集合
│   ├── 角色（Role）：临时身份的载体
│   └── 服务账户（Service Account）：应用/服务的身份
│
├── Resource（资源）
│   ├── 计算：VM、容器、函数
│   ├── 存储：对象存储、数据库、磁盘
│   ├── 网络：VPC、负载均衡、DNS
│   └── 其他：密钥、证书、日志
│
├── Policy（策略）
│   ├── 身份策略（Identity-based）：附加到用户/角色
│   ├── 资源策略（Resource-based）：附加到资源
│   ├── 权限边界（Permissions Boundary）：角色的最大权限
│   └── 组织策略（Organization SCP）：账号级限制
│
└── 访问判定逻辑
    ├── Deny 显式拒绝优先
    ├── Allow 显式允许
    └── 默认拒绝（Implicit Deny）
```

| 概念 | AWS | Azure | GCP | 阿里云 |
|------|-----|-------|-----|--------|
| 用户 | IAM User | Azure AD User | Google Account | RAM User |
| 角色 | IAM Role | Service Principal | Service Account | RAM Role |
| 策略 | IAM Policy | Azure RBAC Role | IAM Policy | RAM Policy |
| 组织 | AWS Organizations | Azure AD Tenant | Google Workspace | 资源目录 |
| MFA | IAM MFA | Azure MFA | 2-Step Verification | MFA |

## 2. 最小权限原则实践

```json
// ❌ 过于宽泛的策略
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "*",
    "Resource": "*"
  }]
}

// ✅ 最小权限策略
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3ReadOnly",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-app-bucket",
        "arn:aws:s3:::my-app-bucket/*"
      ],
      "Condition": {
        "Bool": {
          "aws:MultiFactorAuthPresent": "true"
        },
        "IpAddress": {
          "aws:SourceIp": ["10.0.0.0/8"]
        }
      }
    }
  ]
}
```

```
最小权限实施策略
├── 1. 从拒绝所有开始
├── 2. 按业务需求逐步添加允许
├── 3. 定期审计权限（Access Analyzer / IAM Access Advisor）
├── 4. 使用角色而非长期凭证
├── 5. 权限边界限制最大权限范围
├── 6. 条件键限制访问上下文（IP、时间、加密状态）
└── 7. 自动清理未使用的权限
```

## 3. 临时凭证与角色委派

```
临时凭证架构

用户/服务                STS / IAM                   目标资源
   │                       │                          │
   │── AssumeRole ────────▶│                          │
   │   + 身份验证             │                          │
   │                       │── 验证 + 生成临时凭证 ─────▶│
   │◀── 临时凭证 ───────────│                          │
   │   (AccessKey + Token)  │                          │
   │                       │                          │
   │── 使用临时凭证访问 ─────────────────────────────────▶│

使用场景：
├── 跨账户访问（Account A → Account B）
├── 联邦身份（SSO → SAML/OIDC → 临时角色）
├── 服务间调用（Pod → IRSA / EC2 → Instance Profile）
└── 终端用户访问（Cognito → 临时凭证 → S3）
```

```bash
# AWS STS AssumeRole
aws sts assume-role \
  --role-arn arn:aws:iam::123456789012:role/CrossAccountRole \
  --role-session-name MySession \
  --duration-seconds 3600 \
  --external-id ExternalSecret123

# Kubernetes IRSA（IAM Roles for Service Accounts）
# Pod 通过 OIDC 获取临时 AWS 凭证，无需长期密钥
```

## 4. 零信任架构

```
零信任原则
├── 永不信任，始终验证（Never Trust, Always Verify）
├── 假设网络已被攻破
├── 最小权限访问
├── 基于身份的访问控制
└── 持续验证和监控

零信任实现层次
├── 身份层：强认证 + MFA + 条件访问
├── 设备层：设备合规检查（MDM/Intune）
├── 网络层：微分段 + mTLS + 无 VPN
├── 应用层：应用感知代理 + 上下文感知
└── 数据层：加密 + DLP + 分类标签

BeyondCorp / 云原生零信任
├── Identity-Aware Proxy（IAP）
├── 无 VPN 远程访问
├── 基于用户+设备+上下文的访问决策
└── 每个请求都验证
```
