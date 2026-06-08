# Docker Multi-Stage Build

## 目标

训练 Docker 镜像优化：多阶段构建减小镜像体积、安全配置、健康检查、最佳实践。

## 为什么需要 Multi-Stage

| 对比 | 单阶段构建 | 多阶段构建 |
| --- | --- | --- |
| 镜像大小 | 包含构建工具、源码 | 只含运行时 |
| 攻击面 | 大（npm packages、build tools） | 小 |
| 构建时间 | 较长 | 可以复用缓存 |
| 层数 | 多 | 可控制 |

## Node.js Multi-Stage Build

```dockerfile
# ============================================================
# Stage 1: Dependencies
# ============================================================
FROM node:20-alpine AS deps
WORKDIR /app

# 只复制 package 文件，利用 Docker 缓存
COPY package.json package-lock.json* ./

# 安装生产依赖
RUN npm ci --only=production && npm cache clean --force

# ============================================================
# Stage 2: Builder
# ============================================================
FROM node:20-alpine AS builder
WORKDIR /app

# 复制 package 和 lock
COPY package.json package-lock.json* ./

# 安装所有依赖（包括 dev）
RUN npm ci

# 复制源码
COPY . .

# 构建产物（如果需要）
RUN npm run build

# ============================================================
# Stage 3: Runner (最终镜像)
# ============================================================
FROM node:20-alpine AS runner
WORKDIR /app

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeapp -u 1001

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

# 设置用户
USER nodeapp

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "dist/index.js"]
```

## Go Multi-Stage Build

```dockerfile
# ============================================================
# Stage 1: Builder
# ============================================================
FROM golang:1.22-alpine AS builder
WORKDIR /app

# 安装构建依赖
RUN apk add --no-cache git

# 复制 go mod
COPY go.mod go.sum* ./
RUN go mod download

# 复制源码
COPY . .

# CGO_ENABLED=0 生成静态二进制
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-w -s" \
    -o /app/server

# ============================================================
# Stage 2: Runner
# ============================================================
FROM alpine:3.19 AS runner

# 安装 CA 证书（如果需要 HTTPS）
RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

# 创建非 root 用户
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# 复制二进制
COPY --from=builder /app/server .

# 设置时区
ENV TZ=Asia/Shanghai

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

USER appuser

EXPOSE 8080

CMD ["./server"]
```

## 安全最佳实践

### 基础镜像选择

```dockerfile
# ✅ 使用特定版本，避免 latest
FROM node:20.11.1-alpine3.19

# ❌ 避免使用 latest
# FROM node:latest
```

### 非 root 用户

```dockerfile
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeapp -u 1001

USER nodeapp
```

### 只读文件系统

```yaml
# Kubernetes pod spec
securityContext:
  readOnlyRootFilesystem: true
```

### 敏感信息不写入镜像

```dockerfile
# ❌ 复制 secret 到镜像
COPY secrets.json /app/secrets.json

# ✅ 通过环境变量或挂载
ENV API_KEY=${API_KEY}
# 或
# docker run -v /path/to/secrets:/app/secrets:ro
```

## .dockerignore

```gitignore
# 版本控制
.git
.gitignore

# 文档和配置
README.md
*.md
.env*
docker-compose*.yml

# 测试和开发
**/*.test.ts
**/*.spec.ts
coverage/
.nyc_output/
*.log

# IDE
.vscode/
.idea/

# 本地构建产物
dist/
build/
node_modules/

# 其他
.DS_Store
Thumbs.db
```

## 构建缓存优化

```dockerfile
# ============================================================
# 利用 Docker 层缓存优化构建顺序
# ============================================================

# 1. 先复制依赖文件（变化少）
COPY package.json package-lock.json* ./
RUN npm ci

# 2. 再复制源码（变化多）
COPY src/ ./src/

# 3. 最后是配置（可能不变）
COPY config/ ./config/
```

## Docker Compose 开发环境

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      target: builder  # 开发时用 builder stage
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules  # 保持容器内 node_modules
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://db:5432/app
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d app"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

## 镜像大小对比

| 类型 | 大小 | 说明 |
| --- | --- | --- |
| node:20 | ~1.1GB | 完整 Node.js |
| node:20-alpine | ~130MB | 精简版 Alpine |
| 多阶段构建产物 | ~130MB | 只含运行时 |
| 多阶段 + distroless | ~30MB | 更小攻击面 |

## 面试追问

- 如何进一步减小镜像大小？
  （答：使用 distroless 或 alpine 基础镜像、压缩层、删除不必要的文件）
- 如何调试生产容器问题？
  （答：docker exec、docker logs、docker cp 导出文件）
- Docker 和 Kubernetes 的关系？
  （答：Docker 是容器运行时，K8s 是容器编排平台；K8s 可以管理多个 Docker 主机）

## 相关模式

- `ci-cd/github-actions/`：CI/CD 流水线构建镜像
- `kubernetes/`：K8s 部署优化后的镜像