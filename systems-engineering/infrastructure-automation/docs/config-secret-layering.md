# Config and Secret Layering

## 目标

理解基础设施配置的分层管理：环境变量、配置文件、密钥管理、动态配置和配置漂移治理，建立从开发到生产的配置安全传递体系。

## 场景

- 本地开发、测试、生产的配置怎么隔离？
- 配置和代码一起发布还是独立管理？
- 动态配置（feature flag）和静态配置的区别？
- 12-Factor App 的配置原则在实际中怎么落地？
- 配置改了但应用没重启，怎么生效？

## 配置分层模型

```
配置来源（按优先级从高到低）：

L1 运行时注入
  ├── 命令行参数（--port=8080）
  ├── 环境变量（PORT=8080）
  └── 动态配置中心（Consul / etcd / Nacos）

L2 部署时注入
  ├── K8s ConfigMap / Secret
  ├── 配置管理工具（Ansible / Chef / Puppet）
  └── 启动脚本注入

L3 构建时嵌入
  ├── 编译期常量（__DATE__、版本号）
  ├── 配置文件打包进镜像
  └── 默认值（代码中的 default）

原则：
  - 环境相关配置放在 L1/L2
  - 环境无关配置放在 L3
  - Secret 绝不放在 L3
```

## 12-Factor App 配置原则

```
1. 代码和配置严格分离
   - 同一份代码可以跑在任何环境
   - 不同环境用不同配置

2. 配置存储在环境中
   - 不放在代码仓库
   - 用环境变量或配置服务

3. 环境等价
   - dev/staging/prod 尽量相似
   - 减少"在我机器上能跑"的问题
```

## 配置文件管理

### 分层覆盖

```yaml
# config/
# ├── default.yaml       # 默认值
# ├── development.yaml   # 开发环境覆盖
# ├── testing.yaml       # 测试环境覆盖
# ├── staging.yaml       # 预发环境覆盖
# └── production.yaml    # 生产环境覆盖

# default.yaml
server:
  port: 8080
  timeout: 30s

database:
  pool_size: 10

# production.yaml
server:
  port: 80  # 覆盖默认值

database:
  pool_size: 50  # 生产环境更大连接池
```

```python
# 加载逻辑（Python 示例）
import yaml

config = yaml.safe_load(open("config/default.yaml"))
env = os.environ.get("APP_ENV", "development")
override = yaml.safe_load(open(f"config/{env}.yaml"))
config.deep_merge(override)  # 深度合并
```

### 格式选择

| 格式 | 优点 | 缺点 | 适用 |
|---|---|---|---|
| YAML | 可读性好，注释友好 | 缩进敏感，解析慢 | K8s、应用配置 |
| JSON | 通用，解析快 | 无注释，可读性差 | API、机器间传递 |
| TOML | 简洁，明确 | 生态不如 YAML | Rust、Python 项目 |
| HCL | 表达力强 | HashiCorp 专用 | Terraform、Vault |
| Properties | 简单 | 无层级 | Java、简单 KV |
| INI | 分区 | 标准不统一 | Windows 传统 |

## Secret 分层

### Secret 生命周期

```
生成 → 存储 → 分发 → 使用 → 轮换 → 销毁

生成：
  - 随机生成（crypto/rand）
  - 证书签发（CA / Let's Encrypt）

存储：
  - Vault / AWS Secrets Manager / Azure Key Vault
  - K8s Secret（base64，非加密）
  - Git（SOPS / Sealed Secrets）

分发：
  - 运行时从 Vault 拉取（动态）
  - 启动时从环境变量读取（静态）
  - 挂载文件（K8s Secret volume）

使用：
  - 内存中使用，不落盘
  - 日志脱敏
  - 传输加密

轮换：
  - 定期自动更换
  - 泄露后紧急轮换

销毁：
  - 从所有存储中删除
  - 内存清零（sensitive data）
```

### K8s Secret 的局限

```
K8s Secret 默认：
  - 数据是 base64 编码（不是加密）
  - etcd 中明文存储（除非启用 etcd encryption）
  - 任何能读 Secret 的 Pod/用户都能看到值

加固：
  1. etcd encryption at rest：
     --encryption-provider-config

  2. 限制 Secret 访问：
     RBAC：只给需要的 ServiceAccount 权限

  3. 不用 K8s Secret 存高敏感数据：
     用 External Secrets Operator 从 Vault 同步

  4. Secret 卷内存挂载（tmpfs）：
     避免 Secret 数据写入节点磁盘
```

## 动态配置

### Feature Flag

```
场景：
  - 新功能灰度发布
  - A/B 测试
  - 紧急开关（熔断、降级）

架构：
  ┌─────────────┐
  │  LaunchDarkly │
  │   / Unleash   │
  │   / Flagsmith │
  └──────┬──────┘
         │ SDK 拉取/推送
    ┌────┴────┬────────┐
    ▼         ▼        ▼
  App A     App B    App C

实现方式：
  1. 外部服务（SaaS）：LaunchDarkly
  2. 自托管：Unleash、Flagsmith
  3. 配置中心：Consul + Watcher、etcd + Watcher
  4. 数据库：简单场景直接查 DB

注意：
  - Feature Flag 不是配置，是业务逻辑开关
  - 定期清理已稳定的功能开关（技术债）
```

### 热更新配置

```
方式 1：文件监听
  - 应用 watch 配置文件
  - 变化时 reload（如 Nginx -s reload）

方式 2：配置中心推送
  - Consul / Nacos / Apollo
  - 长连接或轮询获取最新配置
  - 变化时回调应用更新

方式 3：Sidecar 模式
  - Envoy / Consul Template
  - Sidecar 监听配置变化
  - 生成新配置文件，触发应用重载

注意事项：
  - 配置变化可能有中间状态
  - 需要验证新配置的合法性
  - 回滚机制（配置异常时自动恢复旧版本）
```

## 配置漂移治理

### 检测

```
问题：
  - 不同环境的配置差异越来越大
  - 生产配置和预期不一致

检测方法：
  1. 配置快照对比：
     - 定期导出各环境配置
     - 和基线（Git 中的配置）diff

  2. 声明式管理：
     - GitOps：Git 是配置的唯一来源
     - 任何漂移都会被检测并修复

  3. 审计日志：
     - 谁改了什么配置
     - 变更前后对比
```

### 治理策略

| 策略 | 说明 | 工具 |
|---|---|---|
| 代码化 | 所有配置用代码/YAML 管理 | Terraform、Ansible |
| 版本化 | 配置和代码一起版本控制 | Git |
| 审查化 | 配置变更需 Code Review | PR + CI |
| 自动化 | 禁止控制台直接修改 | SCP、IAM Policy |
| 可观测 | 配置变化可追踪、可告警 | Audit Log、EventBridge |

## 核心追问

1. **为什么 K8s Secret 默认不安全还要用它？** 方便、原生集成（volume 挂载、环境变量注入）；安全加固后（etcd encryption + RBAC + External Secrets）可以满足大多数场景；简单 Secret 可直接用，高敏感用 Vault
2. **Feature Flag 和配置的区别？** 配置是环境参数（如数据库地址），变化慢；Feature Flag 是业务开关（如是否启用新 UI），变化快，和发布解耦，可能需要按用户粒度控制
3. **配置中心挂了怎么办？** 客户端必须有本地缓存（fallback）；启动时先读本地缓存，再异步同步远程；核心配置（如数据库地址）用静态配置，非核心用动态配置
4. **环境变量太多（>100个）怎么管理？** 按功能分组（DB_、CACHE_、LOG_）；用配置管理服务（Consul、AWS Parameter Store）；K8s 用 ConfigMap + Secret 分类存储
5. **配置和 Secret 的分界线在哪？** 配置：不敏感、可公开、泄露无风险（如超时时间、功能开关）；Secret：敏感、需保护、泄露有严重后果（如密码、私钥、API Key）；模糊地带（如内网地址）按组织安全策略定

## 状态

| 资产 | 状态 |
|---|---|
| Terraform blueprint | done |
| GitOps workflow | done |
| config and secret layering | done |
| deployment rollback playbook | todo |
| policy as code notes | todo |
