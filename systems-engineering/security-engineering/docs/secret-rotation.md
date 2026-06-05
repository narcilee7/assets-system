# Secret Rotation Playbook

## 目标

建立密钥、证书、Token 等敏感凭证的全生命周期管理：生成、分发、使用、轮换、撤销和审计，降低凭证泄露后的影响面。

## 场景

- 员工离职后他的 API Key 怎么办？
- 数据库密码被写入代码仓库怎么应急？
- 证书过期导致服务中断怎么预防？
- 密钥轮换时怎么保证服务不中断？
- Vault 的动态秘钥是怎么工作的？

## 凭证分类

```
按生命周期：
  - 长期凭证（Long-term）：密码、API Key、静态 Token
  - 短期凭证（Short-term）：STS Token、Session Cookie、JWT
  - 动态凭证（Dynamic）：数据库临时账号、云厂商临时角色

按用途：
  - 人类凭证：账号密码、个人 API Key、SSH Key
  - 机器凭证：Service Account、TLS 证书、mTLS 证书
  - 数据凭证：数据加密密钥（DEK）、密钥加密密钥（KEK）
```

## 凭证管理原则

### 1. 永不硬编码

```
错误：
  const DB_PASSWORD = "SuperSecret123!"

正确：
  db_password = os.Getenv("DB_PASSWORD")
  // 或从 Vault/AWS Secrets Manager 读取
```

### 2. 最小传播范围

```
密钥只在需要时、需要的地方存在：
  - 不存入代码仓库
  - 不写入日志
  - 不通过邮件/IM 传输
  - 内存中使用时加密（或及时清零）
```

### 3. 可审计

```
所有密钥操作记录日志：
  - 谁创建了密钥
  - 谁最后一次使用
  - 什么时候轮换
  - 什么时候撤销
```

## 密钥存储方案

### 方案对比

| 方案 | 安全性 | 可用性 | 成本 | 适用场景 |
|---|---|---|---|---|
| 环境变量 | 低 | 高 | 无 | 开发环境、非敏感配置 |
| 配置文件（加密） | 中 | 高 | 低 | 小规模、无 Vault 基础设施 |
| Kubernetes Secret | 中 | 高 | 无 | K8s 环境，base64 非加密 |
| HashiCorp Vault | 高 | 中 | 中 | 企业级动态凭证 |
| 云厂商 Secrets Manager | 高 | 高 | 按量 | AWS/Azure/GCP 原生 |
| Hardware HSM | 极高 | 中 | 高 | 金融、主密钥保护 |

### Vault 动态密钥架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Application │────►│    Vault    │────►│   Database  │
│              │◄────│  (Dynamic)  │◄────│  (临时账号)  │
└─────────────┘     └─────────────┘     └─────────────┘

流程：
  1. App 用 Service Account 认证到 Vault
  2. Vault 动态创建数据库账号（如 vault-user-xxx）
  3. Vault 返回临时密码给 App
  4. App 用临时密码连接数据库
  5. TTL 到期后 Vault 自动删除数据库账号

优势：
  - 密码不会离开 Vault
  - 自动过期，无需轮换
  - 每个 App 实例可能有不同密码
```

## 轮换策略

### 自动轮换 vs 手动轮换

```
自动轮换（推荐）：
  - TLS 证书： cert-manager / Let's Encrypt 自动续期
  - 云数据库密码：Secrets Manager 自动轮换 + Lambda 更新
  - Service Account Key：定期生成新 Key，旧 Key 宽限期后删除

手动轮换（应急或特殊场景）：
  - 疑似泄露时立即轮换
  - 员工离职时手动撤销
  - 重大变更前预防性轮换
```

### 轮换频率建议

| 凭证类型 | 建议轮换周期 | 触发条件 |
|---|---|---|
| 人类账号密码 | 90 天 | 首次登录修改、定期强制 |
| SSH Key | 180 天 | 员工转岗、机器重建 |
| API Key（外部） | 90 天 | 定期轮换 |
| API Key（内部） | 180 天 | 定期轮换 |
| TLS 证书 | 自动（30 天到期前续期） | 到期告警 |
| 数据库密码 | 90 天 | 定期或动态 |
| JWT Signing Key | 180 天 | 定期轮换 |
| 容器 Registry Token | 30 天 | 短期有效 |

### 零停机轮换

```
数据库密码轮换：

  Phase 1: 准备
    - 创建新用户/密码
    - 验证新密码可用
    - 更新配置中心（但不推送）

  Phase 2: 滚动更新
    - 分批重启/ reload 应用实例
    - 实例读取新密码连接数据库
    - 新旧密码同时有效（双活期）

  Phase 3: 清理
    - 所有实例已切换
    - 等待旧连接断开（或强制断开）
    - 删除旧用户/密码

关键：
  - 数据库层支持多账号同时有效
  - 应用支持配置热加载或滚动重启
  - 旧密码有宽限期（grace period）
```

## 泄露应急响应

### 发现凭证泄露

```
Step 1: 遏制（Containment）
  - 立即撤销/禁用泄露的凭证
  - 如果有宽限期，先缩短宽限期
  - 阻断使用该凭证的异常访问

Step 2: 评估（Assessment）
  - 该凭证的权限范围
  - 泄露时间窗口（多久前泄露的）
  - 访问日志审计：谁用了、做了什么

Step 3: 修复（Remediation）
  - 轮换该凭证
  - 检查关联凭证是否也受影响（如 root 密码泄露，所有派生密钥可能都有风险）
  - 修复泄露源头（如从 Git 历史中彻底删除）

Step 4: 复盘（Post-mortem）
  - 为什么会泄露
  - 检测用了多久
  - 如何防止再次发生
```

### 从 Git 历史删除密钥

```bash
# 1. 立即撤销密钥（不要只删代码）
aws iam update-access-key --access-key-id AKIA... --status Inactive

# 2. 从 Git 历史清除（BFG Repo-Cleaner 或 git-filter-repo）
git-filter-repo --replace-text secrets.txt

# 3. 强制推送（通知所有协作者 rebase）
git push origin --force --all

# 4. 通知 GitHub/GitLab 扫描缓存
# GitHub 会自动扫描并通知你确认删除

# 5. 轮换所有可能受影响的密钥
```

## 证书管理

### TLS 证书生命周期

```
申请 → 验证 → 签发 → 部署 → 监控 → 续期 → 撤销

自动化：
  - cert-manager（K8s）：自动申请 Let's Encrypt，自动续期
  - AWS ACM：自动管理，自动续期
  - Vault PKI：内部 CA，自动签发短期证书

监控：
  - Prometheus + blackbox_exporter 检查证书过期时间
  - 告警阈值：30 天、7 天、1 天
```

### 证书轮换实践

```
短期证书（7-30 天）：
  - 完全自动化续期
  - 无需人工干预
  - 泄露后影响窗口小

长期证书（1 年）：
  - 自动化续期 + 人工确认部署
  - 到期前多次提醒
  - 保留旧证书宽限期（双证书部署）

热重载：
  - Nginx：kill -HUP（零停机重载配置）
  - Envoy：xDS 推送新证书
  - Go：自定义文件监听 + tls.Config 动态更新
```

## 核心追问

1. **动态密钥比静态密钥好在哪？** 动态密钥有 TTL 自动过期，泄露后影响窗口短；且每个客户端可能拿到不同密钥，便于追踪和细粒度撤销
2. **轮换时新旧密钥同时有效，算安全风险吗？** 是权衡：完全即时切换会导致服务中断；宽限期（通常 24h）内双密钥有效，但需监控旧密钥的使用情况，确保没有异常流量
3. **HSM 和 KMS 的区别？** KMS 是软件服务，主密钥可用软件保护或 HSM 保护；HSM 是硬件设备，密钥在硬件内生成和使用，不可导出，抗侧信道攻击，用于最高安全级别
4. **Vault 挂了怎么办？** 必须有高可用部署（HA mode）；但即使 Vault 短时间不可用，已颁发的动态密钥在 TTL 内仍有效；应用需有降级策略（如使用本地缓存的短密钥）
5. **密钥轮换的终极状态是什么？** 全自动、无感知、短期凭证为主、长期凭证逐步淘汰；凭证泄露后系统能在分钟级完成遏制和恢复

## 状态

| 资产 | 状态 |
|---|---|
| security baseline checklist | done |
| secret rotation playbook | done |
| zero trust service access | todo |
| container security notes | todo |
| supply chain security checklist | todo |
