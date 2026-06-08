# 容器安全与供应链

## 1. 镜像安全

```
镜像扫描
├── 构建时扫描：Trivy、Snyk Container、Clair
├── 注册表扫描： Harbor、AWS ECR、Google Artifact Registry
└── 运行时扫描：Falco、Sysdig Secure

镜像构建最佳实践
├── 使用最小基础镜像（distroless、alpine、scratch）
├── 以非 root 用户运行
├── 只读根文件系统
├── 多阶段构建减少攻击面
├── 固定基础镜像版本（digest）
└── 移除包管理器和 shell
```

```dockerfile
# 安全 Dockerfile 示例
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY src ./src
USER nonroot:nonroot
EXPOSE 3000
CMD ["src/index.js"]
```

```bash
# 镜像扫描
trivy image myapp:latest
docker scout cves myapp:latest
```

## 2. 镜像签名与验证

```
供应链安全
├── 签名：Cosign（Sigstore）、Notation（Notary v2）
├── SBOM：生成并附加到镜像
├── SLSA：Source -> Build -> Provenance -> Package
└── 验证： admission controller 拒绝未签名镜像
```

```bash
# Cosign 签名
COSIGN_EXPERIMENTAL=1 cosign sign --yes myregistry/myapp:latest

# Cosign 验证
cosign verify --certificate-identity=user@example.com \
  --certificate-oidc-issuer=https://accounts.google.com \
  myregistry/myapp:latest

# 生成 SBOM 并签名
syft packages dir:. -o spdx-json > sbom.spdx.json
cosign attest --predicate sbom.spdx.json --type spdx \
  myregistry/myapp:latest
```

## 3. Kubernetes 安全

```
K8s 安全加固
├── Pod 安全：
│   ├── SecurityContext（runAsNonRoot、readOnlyRootFilesystem、allowPrivilegeEscalation）
│   ├── NetworkPolicy（微分段）
│   ├── ResourceQuota / LimitRange
│   └── Pod Security Standards（restricted）
├── 访问控制：
│   ├── RBAC（最小权限 ServiceAccount）
│   ├── Admission Controller（OPA/Kyverno）
│   └── API Server 审计日志
├── 网络：
│   ├── NetworkPolicy（默认拒绝）
│   ├── Service Mesh mTLS
│   └── Ingress TLS
└── 运行时：
    ├── Falco（异常行为检测）
    └── RuntimeClass（gVisor、Kata Containers）
```

```yaml
# Pod Security Policy（Kyverno 示例）
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-ro-rootfs
spec:
  validationFailureAction: enforce
  rules:
    - name: check-read-only-root-fs
      match:
        resources:
          kinds:
            - Pod
      validate:
        message: "Root filesystem must be read-only"
        pattern:
          spec:
            containers:
              - securityContext:
                  readOnlyRootFilesystem: true
```

## 4. 依赖治理

```
依赖安全策略
├── 锁定版本：package-lock.json、poetry.lock、go.sum
├── 自动更新：Dependabot、Renovate、Snyk PR
├── 私有仓库：Nexus、Artifactory、Verdaccio
├── 恶意包检测：typosquatting、依赖混淆
└── 最小依赖：定期清理未使用的依赖
```
