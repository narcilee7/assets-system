# Container Security Notes

## 目标

理解容器环境的安全边界、隔离机制、镜像安全和运行时防护，建立容器化工作负载的安全基线。

## 场景

- Docker 和 VM 的安全边界差多少？
- 容器逃逸有哪些途径，怎么防？
- 镜像里的 CVE 怎么管理？
- Privileged 容器有多危险？
- K8s 的 SecurityContext 怎么配？

## 容器隔离机制

### 容器 ≠ VM

```
虚拟机：
  App ──► Guest OS ──► Hypervisor ──► Host OS ──► Hardware
  强隔离：独立内核、独立内核内存、硬件虚拟化

容器：
  App ──► Container Runtime ──► Host OS Kernel ──► Hardware
  轻量隔离：共享内核，namespace + cgroup + capabilities

隔离对比：

| 维度 | VM | Container |
|---|---|---|
| 内核 | 独立 | 共享 Host 内核 |
| 启动时间 | 分钟 | 秒 |
| 资源开销 | GB 级 | MB 级 |
| 安全边界 | 硬件级（强） | 软件级（较弱） |
| 逃逸难度 | 极难 | 相对容易（需防护） |
```

### Namespace 隔离

```
Linux Namespace 提供的隔离：

  PID namespace：    进程 ID 隔离（容器内 PID 1 是独立空间）
  Network namespace：网络设备、IP、端口隔离
  Mount namespace：  文件系统挂载点隔离
  UTS namespace：    主机名/域名隔离
  IPC namespace：    进程间通信隔离
  User namespace：   用户/组 ID 隔离（UID 0 映射到宿主机的非特权用户）
  Cgroup namespace： cgroup 根目录隔离

限制：
  - 共享内核 → 内核漏洞可影响所有容器
  - /proc、/sys 不完全隔离 → 信息泄露
  - 内核 keyring、time、syslog 未隔离
```

### Capabilities

```
Linux Capabilities = 细粒度的 root 权限拆分

传统 root = 所有 capabilities
容器安全 = 只给必要的 capabilities

危险的 capabilities：
  CAP_SYS_ADMIN   → mount、setns、umount（容器逃逸常用）
  CAP_SYS_PTRACE  → 调试其他进程（可注入恶意代码）
  CAP_SYS_MODULE  → 加载内核模块（直接攻破内核）
  CAP_DAC_READ_SEARCH → 绕过文件读权限检查
  CAP_NET_ADMIN   → 修改网络配置

安全的默认：
  Docker 默认 drop 所有 capabilities，只保留 14 个基本能力
  K8s 默认保留更少
```

## 镜像安全

### 镜像分层与攻击面

```
镜像构成：
  FROM ubuntu:22.04    ← 基础镜像（尽可能小）
  RUN apt-get install ...
  COPY app /app
  ENTRYPOINT ["/app"]

攻击面：
  - 基础镜像漏洞（glibc、OpenSSL 等）
  - 不必要的包（sshd、curl、编译工具）
  - 硬编码密钥
  - 恶意依赖（supply chain 攻击）

最小化原则：
  - 使用 distroless / scratch / alpine
  - 多阶段构建，只复制编译产物
  - 移除包管理器、shell、无用工具
```

### 镜像扫描

```
扫描时机：
  1. CI 构建时：阻断 HIGH/CRITICAL CVE
  2. 推送仓库时：再次扫描
  3. 运行时定期：新漏洞发布后重新扫描存量镜像

工具：
  - Trivy（Aqua Security）：快、易用、支持 SBOM
  - Clair（Red Hat）：与 Harbor 集成
  - Snyk：商业，漏洞库全
  - Grype：Anchore，支持 CycloneDX

SBOM（Software Bill of Materials）：
  - 镜像成分清单
  - 用于追溯和合规
  - 格式：SPDX、CycloneDX
```

### 镜像签名

```
防止镜像被篡改：

  构建 ──► 签名 ──► 推送仓库 ──► 运行时验证签名 ──► 运行

工具：
  - Docker Content Trust（Notary）
  - Cosign（Sigstore）：简单、支持 keyless（Fulcio + Rekor）
  - admission controller（K8s）：拒绝未签名镜像

Keyless 签名（Cosign）：
  - 不用管理私钥
  - 用 OIDC 身份（如 GitHub Actions）签发短期证书
  - 证书存入透明日志 Rekor，可审计
```

## 运行时安全

### 不要 Privileged

```yaml
# 绝对避免
securityContext:
  privileged: true

# 效果：
# - 拥有主机的所有 capabilities
# - 可以访问所有设备（/dev/*）
# - 可以绕过 cgroup 限制
# - 几乎等于 root 登录宿主机

替代方案：
  - 需要 mount：用 allowedHostPaths + readOnly
  - 需要设备：用 device plugin
  - 需要网络：用 NET_ADMIN（但仍危险）
```

### SecurityContext 最佳实践

```yaml
apiVersion: v1
kind: Pod
spec:
  securityContext:
    runAsNonRoot: true          # 禁止 root 运行
    runAsUser: 1000             # 指定 UID
    runAsGroup: 1000            # 指定 GID
    fsGroup: 1000               # 卷挂载的组所有权
    seccompProfile:
      type: RuntimeDefault      # 使用默认 seccomp
  containers:
    - name: app
      securityContext:
        allowPrivilegeEscalation: false  # 禁止提权（sudo/setuid）
        readOnlyRootFilesystem: true     # 根文件系统只读
        capabilities:
          drop:
            - ALL                 # 丢弃所有 capabilities
          add:
            - NET_BIND_SERVICE    # 只添加必要的（如绑定 80 端口）
        resources:
          limits:
            memory: "256Mi"
            cpu: "500m"
```

### Seccomp

```
Seccomp = Secure Computing Mode

作用：
  - 限制容器可以使用的系统调用
  - 默认 Docker/K8s 有一个允许列表

自定义 profile：
  - 审计模式：先记录用了哪些 syscall
  - 限制模式：只放行必需的 syscall
  - 阻断危险调用：mount、ptrace、open_by_handle_at 等
```

### AppArmor / SELinux

```
Mandatory Access Control（MAC）：

AppArmor（Ubuntu/Debian）：
  - 基于路径的访问控制
  - 配置文件：/etc/apparmor.d/docker-default
  - 限制容器能读写的文件、能访问的网络

SELinux（RHEL/CentOS）：
  - 基于标签的访问控制
  - 容器进程有 svirt_lxc_net_t 标签
  - 文件有 svirt_sandbox_file_t 标签
  - 只有匹配标签才能访问

K8s 集成：
  securityContext:
    seLinuxOptions:
      level: "s0:c123,c456"
```

## 容器逃逸途径与防护

### 常见逃逸方式

| 方式 | 原理 | 防护 |
|---|---|---|
| Privileged 容器 | 拥有所有 capabilities 和设备访问 | 禁止 privileged |
| 危险 Capabilities | CAP_SYS_ADMIN 可执行 mount | drop ALL，按需添加 |
| Docker Socket 挂载 | 访问 /var/run/docker.sock 可创建特权容器 | 禁止挂载 docker.sock |
| 内核漏洞 | Dirty COW、CVE-2022-0847 等 | 及时打补丁、用 seccomp |
| 挂载宿主机目录 | 挂载 / 或 /etc 可修改宿主机 | 限制 allowedHostPaths，readOnly |
| cgroup release_agent | 利用 cgroup v1 的 notify_on_release | 升级到 cgroup v2 |
| runc 漏洞 | CVE-2019-5736 覆盖 runc 二进制 | 升级 runc/containerd |

### 纵深防御

```
多层防护：

  1. 镜像层：最小镜像、无漏洞、已签名
  2. 编排层：SecurityContext、NetworkPolicy、ResourceQuota
  3. 内核层：seccomp、AppArmor/SELinux、User Namespace
  4. 主机层：节点加固、文件完整性监控、限制 ssh
  5. 网络层：微分段、Egress 控制、入侵检测
  6. 检测层：Falco 运行时威胁检测、异常行为告警
```

## K8s 安全基线

### Pod Security Standards

```
K8s 内置三个级别：

Privileged（最宽松）：
  - 无限制
  - 仅用于系统级工作负载

Baseline（中等）：
  - 禁止 privileged
  - 禁止 hostNetwork/hostPID/hostIPC
  - 禁止 bind 到 <1024 的端口（除非有 CAP_NET_BIND_SERVICE）
  - 禁止 volume 类型：hostPath、nfs 等

Restricted（最严格）：
  - 必须 runAsNonRoot
  - 禁止 privilegeEscalation
  - 必须 drop ALL capabilities
  - 限制 seccomp、SELinux
  - 推荐用于所有业务应用
```

### Admission Control

```
准入控制器（Admission Controller）在 Pod 创建时拦截：

  PodSpec ──► API Server ──► Mutating Admission ──► Validating Admission ──► etcd
                                    │                       │
                                    ▼                       ▼
                              自动注入安全策略            拒绝不合规的 Pod
                              （如 sidecar、label）      （如未签名的镜像）

常用控制器：
  - PodSecurity：执行 Pod Security Standards
  - OPA/Gatekeeper：自定义策略（Rego 语言）
  - Kyverno：策略引擎，更简单的 YAML 语法
  - ImagePolicyWebhook：镜像签名验证
```

## 运行时威胁检测

### Falco

```
Falco = 容器运行时安全监控

检测能力：
  - 系统调用异常（如容器内执行 shell）
  - 文件修改（如 /etc/passwd）
  - 网络连接（如容器连向外部 CNC 服务器）
  - K8s 审计事件（如特权提升）

规则示例：
  - rule: Terminal shell in container
    desc: 容器内有人打开了 shell
    condition: spawned_process and shell_procs and container
    output: "Shell in container (user=%user.name)"
    priority: WARNING
```

## 核心追问

1. **User namespace 为什么能大幅提升容器安全？** 容器内的 root（UID 0）映射到宿主机的非特权用户（如 UID 100000）；即使容器逃逸，攻击者在宿主机上也是普通用户，无法访问 root 资源
2. **readOnlyRootFilesystem 有什么用？** 防止攻击者修改容器内文件（如植入木马、修改配置）；临时写入需求用 emptyDir 或挂载外部卷
3. **为什么 distroless 镜像比 alpine 更安全？** distroless 没有 shell、包管理器、非必需库，攻击者即使进入容器也几乎没有工具可用；alpine 虽小但仍有 shell 和 apk
4. **K8s 的 Service Account Token 有什么风险？** 默认 Token  mounted 到每个 Pod，且长期有效；如果被窃取可访问 API Server；应使用 Bound Service Account Token（短期、与 Pod 绑定）
5. **容器逃逸后第一件事做什么？** 从攻击者视角：收集宿主机信息、横向移动、访问其他容器；从防御视角：Falco 告警 → 隔离节点 → 取证分析 → 补丁修复

## 状态

| 资产 | 状态 |
|---|---|
| security baseline checklist | done |
| secret rotation playbook | done |
| zero trust service access | done |
| container security notes | done |
| supply chain security checklist | todo |
