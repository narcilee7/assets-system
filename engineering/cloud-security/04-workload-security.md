# 工作负载安全

## 1. 容器安全

```
容器安全生命周期

构建阶段          分发阶段          运行阶段
  │                │                │
  ▼                ▼                ▼
┌──────┐        ┌──────┐        ┌──────┐
│最小镜像│        │签名镜像│        │运行时 │
│无漏洞 │   ──▶  │SBOM  │   ──▶  │隔离   │
│无密钥 │        │扫描   │        │监控   │
└──────┘        └──────┘        └──────┘

构建安全
├── 使用 distroless / scratch / alpine
├── 多阶段构建分离构建依赖
├── 非 root 用户运行（USER 指令）
├── 移除包管理器（apk、apt）
├── 只读根文件系统
├── 资源限制（CPU/内存）
└── 健康检查

分发安全
├── 镜像签名（Cosign / Notary）
├── SBOM 附加
├── 漏洞扫描（Trivy / Clair）
└── 准入控制（拒绝未签名/有漏洞镜像）

运行安全
├── seccomp：系统调用过滤
├── AppArmor / SELinux：MAC 强制访问控制
├── Capabilities：精简 Linux 能力
├── cgroup：资源隔离
└── 只读文件系统 + tmpfs
```

```yaml
# Kubernetes Pod 安全规范
apiVersion: v1
kind: Pod
metadata:
  name: secure-app
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: app
      image: myapp:v1.0.0
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL
        seccompProfile:
          type: RuntimeDefault
      resources:
        limits:
          memory: "256Mi"
          cpu: "500m"
        requests:
          memory: "128Mi"
          cpu: "250m"
      volumeMounts:
        - name: tmp
          mountPath: /tmp
  volumes:
    - name: tmp
      emptyDir: {}
```

## 2. Kubernetes 安全加固

```
K8s 安全控制矩阵

控制平面安全
├── API Server
│   ├── 禁用匿名认证（--anonymous-auth=false）
│   ├── 启用审计日志
│   ├── 限制 API 访问（网络策略 / 防火墙）
│   └── 定期轮换证书
├── etcd
│   ├── 启用 TLS peer 通信
│   ├── 加密静态数据
│   └── 限制访问（仅 API Server）
└── Controller Manager / Scheduler
    └── 使用最小权限 ServiceAccount

工作负载安全
├── Pod Security Standards
│   ├── privileged：无限制
│   ├── baseline：最小限制
│   └── restricted：最严格
├── NetworkPolicy：默认拒绝
├── RBAC：最小权限
├── Secret 加密：KMS 集成
└── Runtime Security：Falco
```

```yaml
# Kyverno：强制 Pod 安全标准
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: pod-security-restricted
spec:
  validationFailureAction: enforce
  background: true
  rules:
    - name: require-run-as-non-root
      match:
        resources:
          kinds:
            - Pod
      validate:
        message: "Running as root is not allowed"
        pattern:
          spec:
            securityContext:
              runAsNonRoot: true
            containers:
              - securityContext:
                  allowPrivilegeEscalation: false
                  readOnlyRootFilesystem: true
                  capabilities:
                    drop:
                      - ALL
```

## 3. Serverless 安全

```
Serverless（FaaS）安全

函数安全
├── 最小权限 IAM 角色
├── 环境变量加密（KMS）
├── 超时和内存限制
├── VPC 内运行（需要时）
└── 依赖扫描

API Gateway 安全
├── 认证：Cognito / Lambda Authorizer
├── 限流：请求配额
├── WAF 集成
├── 请求验证（JSON Schema）
└── 日志和监控

事件源安全
├── S3 / SNS / EventBridge
├── 事件验证（防止伪造）
├── 幂等性设计
└── 死信队列（DLQ）
```

## 4. VM 与主机安全

```
主机安全基线
├── 操作系统加固
│   ├── CIS Benchmarks
│   ├── 最小化安装
│   ├── 自动更新
│   └── 安全启动（Secure Boot）
├── 运行时防护
│   ├── EDR（Endpoint Detection and Response）
│   ├── 防病毒
│   └── 文件完整性监控（FIM）
├── 日志
│   ├── 系统日志集中化
│   ├── 登录审计
│   └── 进程监控
└── 网络
    ├── 主机防火墙
    ├── 端口最小化
    └── SSH 加固（密钥、禁用 root、非默认端口）
```
