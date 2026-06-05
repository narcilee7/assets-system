# Supply Chain Security Checklist

## 目标

建立软件供应链安全的系统性检查能力，覆盖依赖管理、构建过程、镜像分发和运行时验证，防范从代码到部署全链路的投毒和篡改风险。

## 场景

- node_modules 里的恶意包怎么检测？
- SolarWinds 事件怎么在构建环节发现？
- 怎么确保运行的二进制就是源码编译出来的？
- SLSA 框架是什么，怎么落地？
- SBOM 在法律合规中有什么用？

## 供应链攻击面

```
软件供应链：

  开发者 ──► 源码仓库 ──► CI/CD ──► 镜像仓库 ──► K8s 集群 ──► 运行时
     │           │          │           │           │
     ▼           ▼          ▼           ▼           ▼
  社工/钓鱼   泄露密钥   恶意构建    镜像篡改     漏洞利用
  恶意IDE插件  供应链投毒  依赖混淆    中间人攻击   配置漂移

典型案例：
  - SolarWinds：构建服务器被入侵，植入后门
  - Codecov：Bash Uploader 脚本被篡改，窃取环境变量
  - event-stream：npm 包被植入比特币窃取代码
  - ua-parser-js：npm 包被植入恶意脚本
```

## 依赖安全

### 依赖管理检查

| # | 检查项 | 通过标准 | 工具 |
|---|---|---|---|
| 1.1 | 锁定依赖版本 | 使用 lockfile（package-lock、go.sum、Cargo.lock）| CI 检查 |
| 1.2 | 私有包命名空间 | 内部包使用私有 registry/scope，防止依赖混淆 | registry 配置 |
| 1.3 | 漏洞扫描 | CI 中集成 SCA，HIGH/CRITICAL 阻断构建 | Snyk、Trivy、OSV |
| 1.4 | 许可证合规 | 无 GPL/AGPL 等传染性许可证混入 | FOSSA、Black Duck |
| 1.5 | 依赖最小化 | 只安装生产依赖，移除 dev/test 依赖 | 多阶段构建 |
| 1.6 | 私有 registry | 内部使用私有 npm/pypi/maven，缓存外部包 | Nexus、Artifactory |

### 依赖混淆攻击防护

```
攻击原理：
  公司内部包名：internal-utils
  攻击者在公共 npm 发布同名包 internal-utils
  
  开发者配置错误时：
    npm install internal-utils
    → 优先下载公共 registry 的恶意包

防护：
  1. 使用 scope：@company/internal-utils
  2. 配置 .npmrc 优先查私有 registry
  3. lockfile 锁定版本和 registry 来源
  4. 私有包使用命名空间隔离
```

## 源码安全

### 仓库保护

| # | 检查项 | 通过标准 |
|---|---|---|
| 2.1 | 分支保护 | main/master 禁止 force push，需 PR + Code Review |
| 2.2 | 签名提交 | 关键仓库要求 GPG/Signed commit | 
| 2.3 | Secret 扫描 | 预提交钩子 + CI 扫描，禁止密钥入仓 |
| 2.4 | 权限最小化 | 仓库访问按需授权，离职即时回收 |
| 2.5 | 审计日志 | 所有 clone/push/admin 操作记录 |

### Secret 管理

```
预提交扫描（gitleaks / truffleHog）：
  git commit 前自动扫描 staged 文件
  发现疑似密钥 → 阻断提交

CI 扫描：
  全量历史扫描，发现已泄露的密钥
  自动通知轮换

应急：
  发现密钥入仓 → 立即撤销密钥（不要只删代码）
  从 Git 历史彻底清除（git-filter-repo）
```

## 构建安全

### SLSA 框架

```
SLSA = Supply Chain Levels for Software Artifacts

等级：

L1（可审计）：
  - 构建过程自动化
  - 输出 provenance（来源证明）

L2（可溯源）：
  - 使用版本控制（Git）
  - 构建服务化（非开发者本地构建）
  - 输出签名 provenance

L3（强隔离）：
  - 构建环境不可变（容器/VM）
  - 构建和发布隔离
  - 依赖预定义、不可变

L4（最高）：
  - 双人审查所有变更
  - 可重现构建（Reproducible Builds）
  - 构建环境 hermetic（完全封闭）
```

### 构建加固

| # | 检查项 | 通过标准 |
|---|---|---|
| 3.1 | 构建环境隔离 | 每次构建全新容器/VM，无残留 |
| 3.2 | 不可变基础镜像 | 构建镜像固定 digest，不用 latest |
| 3.3 | 构建脚本版本控制 | Dockerfile、Makefile、CI 配置在 Git 中 |
| 3.4 | 无网络构建（hermetic） | 所有依赖预先下载/缓存，构建时不联网 |
| 3.5 | 输出签名 | 镜像和二进制用 Cosign / Notary 签名 |
| 3.6 | Provenance 生成 | 记录构建时间、源码 commit、构建器身份 |

### 可重现构建（Reproducible Builds）

```
目标：相同源码 + 相同环境 → 完全相同的二进制

影响因素：
  - 构建时间戳 → 设置为固定值或 SOURCE_DATE_EPOCH
  - 随机数 → 固定随机种子
  - 文件顺序 → 排序后处理
  - 路径 → 使用相对路径或固定路径
  - 依赖版本 → 完全锁定

验证：
  - 两个不同机器构建同一版本
  - 比较 hash，应完全一致
  - Debian、Tor、Bitcoin 已实现
```

## 分发安全

### 镜像签名与验证

```
构建 ──► 签名 ──► 推送 ──► 验证 ──► 运行

签名：
  cosign sign --key cosign.key my-registry/app:v1.0

验证（K8s Admission）：
  - 拒绝未签名镜像
  - 验证签名者身份
  - 检查 provenance

透明日志（Rekor）：
  - 签名记录存入公共不可篡改日志
  - 可审计、可发现异常签名
```

### SBOM 管理

```
SBOM = Software Bill of Materials

生成：
  syft packages dir:.
  syft my-registry/app:v1.0 -o spdx-json > sbom.spdx.json

用途：
  - 漏洞响应：快速定位哪些产品用了有漏洞的组件
  - 合规：满足法规对软件成分披露的要求
  - 审计：证明没有使用违禁组件

分发：
  - 与镜像一起存储（OCI artifact）
  - 签名保证 SBOM 未被篡改
```

## 运行时验证

### 镜像准入控制

```yaml
# K8s ImagePolicyWebhook 或 OPA/Gatekeeper
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sAllowedRepos
metadata:
  name: allow-only-signed
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
  parameters:
    repos:
      - "my-registry.com/signed/"
    # 额外检查：镜像必须有 cosign 签名
```

### 运行时完整性

```
文件完整性监控（AIDE / Falco）：
  - 监控容器内关键二进制是否被修改
  - 检测到变更 → 告警 → 隔离

进程白名单：
  - 只允许预期的进程运行
  - 异常进程（如容器内启动的 shell/mining）立即告警
```

## 核心追问

1. **SLSA L3 和 L4 的最大区别是什么？** L3 要求构建环境隔离和不可变；L4 额外要求双人审查和可重现构建。L4 是理想状态，L3 是企业可落地的务实目标
2. **为什么可重现构建对供应链安全很重要？** 如果二进制可以独立复现，就能验证发布的二进制确实来自声称的源码，没有被偷偷插入后门；是构建过程透明的终极证明
3. **SBOM 能解决漏洞问题吗？** 不能解决，但能快速响应。没有 SBOM，发现 log4j 漏洞后需要数周定位影响范围；有 SBOM 可以分钟级查询
4. **私有 registry 能防止所有依赖混淆吗？** 不能。如果开发者机器或 CI 配置错误，仍然可能查询公共 registry；需要配合 lockfile、scope 和 registry 白名单
5. **SolarWinds 事件用现在的技术能防住吗？** 不能完全防住（APT 攻击面太广），但可以大幅降低影响和发现速度：SLSA provenance 能发现构建异常、签名验证能阻止篡改后的分发、SBOM 能加速响应

## 状态

| 资产 | 状态 |
|---|---|
| security baseline checklist | done |
| secret rotation playbook | done |
| zero trust service access | done |
| container security notes | done |
| supply chain security checklist | done |
