# 云数据保护

## 1. 加密策略

```
加密层次

┌─────────────────────────────────────────────────┐
│  应用层加密                                       │
│  ├── 客户端加密：数据离开客户端前加密              │
│  └── 端到端加密：只有通信双方能解密               │
├─────────────────────────────────────────────────┤
│  传输中加密（TLS 1.3）                            │
│  ├── 服务间通信：mTLS                             │
│  ├── API 网关：TLS 终止                           │
│  └── 数据库连接：SSL/TLS                          │
├─────────────────────────────────────────────────┤
│  存储加密                                         │
│  ├── 服务端加密（SSE）：云厂商管理密钥             │
│  ├── 客户管理密钥（CMEK）：客户控制密钥            │
│  └── 客户端加密（CSEK）：客户自己加密              │
├─────────────────────────────────────────────────┤
│  备份加密                                         │
│  ├── 快照加密                                     │
│  └── 跨区域复制加密                               │
└─────────────────────────────────────────────────┘
```

| 场景 | AWS | Azure | GCP |
|------|-----|-------|-----|
| 对象存储加密 | SSE-S3 / SSE-KMS / SSE-C | Storage Service Encryption | Customer-supplied/CMEK |
| 数据库加密 | RDS TDE / KMS | Transparent Data Encryption | CMEK |
| 磁盘加密 | EBS encryption | Azure Disk Encryption | CMEK |
| 密钥管理 | KMS | Key Vault | Cloud KMS |
| HSM | CloudHSM | Dedicated HSM | Cloud HSM |

## 2. KMS 密钥管理

```
KMS 密钥层级

┌─────────────┐
│  根密钥      │  ← HSM 中，永不离开
│  (HSM Backed)│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  密钥加密密钥 │  ← KEK，加密 DEK
│   (KEK)      │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  数据加密密钥 │  ← DEK，加密实际数据
│   (DEK)      │     可存储在数据旁
└─────────────┘

密钥轮换策略
├── 自动轮换：KMS 每年自动轮换 KEK
├── 手动轮换：数据泄露时立即轮换
├── 版本控制：保留旧版本用于解密历史数据
└── 多区域复制：全局服务需要跨区域密钥
```

```bash
# AWS KMS 示例
# 创建 KMS 密钥
aws kms create-key --description "Payment data encryption key"

# 生成数据密钥（信封加密）
aws kms generate-data-key \
  --key-id alias/payment-key \
  --key-spec AES_256

# 加密数据
aws kms encrypt \
  --key-id alias/payment-key \
  --plaintext fileb://data.txt

# 解密
aws kms decrypt \
  --ciphertext-blob fileb://encrypted.txt
```

## 3. 数据分类与 DLP

```
数据分类框架

├── 公开（Public）：任何人可访问
├── 内部（Internal）：公司员工可访问
├── 机密（Confidential）：授权人员可访问
├── 高度机密（Restricted）：最小范围访问
└── 受监管（Regulated）：符合法律要求（PII、PHI、PCI）

DLP（数据防泄漏）策略
├── 发现：自动扫描识别敏感数据
├── 监控：实时检测数据外泄
├── 防护：阻止未经授权的数据传输
└── 报告：合规审计和事件报告

云 DLP 服务
├── AWS Macie：S3 中的 PII 检测
├── Azure Information Protection：标签分类
├── Google Cloud DLP：敏感数据发现
└── 第三方：Nightfall、BigID
```

## 4. 备份与灾难恢复

```
备份安全策略
├── 3-2-1 备份原则
│   ├── 3 份数据副本
│   ├── 2 种不同存储介质
│   └── 1 份异地备份
├── 不可变备份（Immutable Backup）
│   └── 防止勒索软件加密备份
├── 加密备份
│   └── 备份数据也要加密
├── 定期恢复演练
│   └── 验证备份可恢复性
└── 跨区域复制
    └── 应对区域级灾难
```
