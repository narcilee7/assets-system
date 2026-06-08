# Secret Management

## 目标

训练密钥安全管理：Vault、Sealed Secrets、KMS、环境变量注入。

## 密钥类型

| 类型 | 例子 |
| --- | --- |
| Database Credentials | 用户名、密码 |
| API Keys | AWS Key、Stripe Key |
| TLS Certificates | 证书、私钥 |
| SSH Keys | Deploy Keys |
| Tokens | JWT Secret |

## 密钥管理原则

1. **最小权限**：只授予必要的访问权限
2. **隔离**：不同环境使用不同的密钥
3. **轮换**：定期轮换，避免长期有效密钥
4. **审计**：记录所有密钥访问
5. **加密**：静态和传输加密

## HashiCorp Vault

### 架构

```
┌─────────────────────────────────────────┐
│                  Vault                   │
│  ┌─────────────────────────────────┐   │
│  │         Secret Engine           │   │
│  │  (kv, db, aws, pki, etc.)       │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │         Auth Methods            │   │
│  │  (kubernetes, aws, ldap, etc.) │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│              K8s Pod                    │
│  app (通过 ServiceAccount获取Secret)   │
└─────────────────────────────────────────┘
```

### K8s 集成

```yaml
# 1. 创建 ServiceAccount
apiVersion: v1
kind: ServiceAccount
metadata:
  name: myapp
  namespace: production

---
# 2. 创建 RBAC
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: myapp-secret-reader
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    resourceNames: ["myapp-secrets"]  # 只读特定 secret
    verbs: ["get", "list"]

---
# 3. 绑定
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: myapp-secret-binding
subjects:
  - kind: ServiceAccount
    name: myapp
    namespace: production
roleRef:
  kind: Role
  name: myapp-secret-reader
  apiGroup: rbac.authorization.k8s.io

---
# 4. Deployment 使用
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  serviceAccountName: myapp
  containers:
    - name: myapp
      image: myapp:v1
      envFrom:
        - secretRef:
            name: myapp-secrets
```

### Vault Agent 注入

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  containers:
    - name: myapp
      image: hashicorp/vault:1.15
      args:
        - agent
        - -config=/vault/config/agent.hcl
        - -template=/vault/secrets/app.env:/app/.env
      volumeMounts:
        - name: vault-config
          mountPath: /vault/config
        - name: vault-secret
          mountPath: /vault/secrets
```

```hcl
# agent.hcl
vault {
  address = "https://vault.example.com"
}

auto_auth {
  method "kubernetes" {
    config = {
      role = "myapp"
    }
  }
}

template {
  destination = "/vault/secrets/app.env"
  contents = <<EOF
DATABASE_URL={{ with secret "database/creds/myapp" }}{{ .Data.data.url }}{{ end }}
API_KEY={{ with secret "kv/api-keys" }}{{ .Data.data.stripe }}{{ end }}
EOF
}
```

## Sealed Secrets（GitOps 友好）

```yaml
# 1. 安装 Sealed Secrets Controller
# kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/latest/download/controller.yaml

# 2. 创建 Secret
apiVersion: v1
kind: Secret
metadata:
  name: myapp-secrets
type: Opaque
stringData:
  DB_PASSWORD: changeme
  API_KEY: sk-xxxxx

# 3. 加密（需要 kubeseal CLI）
kubeseal --format=yaml < myapp-secrets.yaml > sealed-secrets.yaml

# 4. SealedSecret（可提交到 Git）
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: myapp-secrets
spec:
  encryptedData:
    DB_PASSWORD: AgA2...
    API_KEY: AgB3...
```

## AWS Secrets Manager

```typescript
// Lambda 从 Secrets Manager 获取密钥
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "us-east-1" });

export async function getSecret(secretName: string): Promise<string> {
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);
  return response.SecretString!;
}

// 在 K8s 中使用 External Secrets Operator
apiVersion: external-secrets.io/v1alpha1
kind: ExternalSecret
metadata:
  name: myapp-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets
    kind: ClusterSecretStore
  target:
    name: myapp-secrets
  data:
    - secretKey: DB_PASSWORD
      remoteRef:
        key: prod/myapp/db
        property: password
    - secretKey: API_KEY
      remoteRef:
        key: prod/myapp/api
        property: key
```

## 密钥轮换

### 数据库密码轮换

```yaml
# Vault Database Secrets Engine
# 1. 启用 db secrets engine
# vault secrets enable database

# 2. 配置数据库连接
# vault write database/config/myapp \
#     plugin_name=postgresql-database-plugin \
#     allowed_roles=myapp-role \
#     connection_url=postgresql://{{username}}:{{password}}@db:5432/myapp

# 3. 创建角色（自动生成密钥）
# vault write database/roles/myapp-role \
#     db_name=myapp \
#     creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';" \
#     default_ttl=1h \
#     max_ttl=24h

# 4. 读取动态密钥
# vault read database/creds/myapp-role
```

## 安全最佳实践

| 实践 | 说明 |
| --- | --- |
| 不在代码中硬编码 | 使用环境变量或密钥管理服务 |
| 不在 Git 提交密钥 | .gitignore + pre-commit hook |
| 最小权限 | IAM Policy 最小权限原则 |
| 定期轮换 | 自动轮换比手动更安全 |
| 审计日志 | 记录所有密钥访问 |
| 静态加密 | 所有存储加密 |

## .gitignore 示例

```gitignore
# 密钥文件
*.pem
*.key
*.crt
*.p12
*.jks

# 本地配置
.env
.env.local
.env.*.local

# K8s Secret（明文）
secrets.yaml

# 敏感配置
config/secrets.yml
```

## 面试追问

- 如何安全地将密钥注入 Pod？
  （答：K8s Secret + RBAC、Vault Agent、Sealed Secrets）
- GitOps 如何处理密钥？
  （答：Sealed Secrets 加密后提交，或外部密钥管理服务）
- 密钥泄露了怎么办？
  （答：立即轮换、审计日志、检查是否被滥用、通知受影响方）

## 相关模式

- `kubernetes/`：K8s Secret
- `ci-cd/github-actions/`：CI 中的密钥
- `iac/terraform/`：密钥作为代码