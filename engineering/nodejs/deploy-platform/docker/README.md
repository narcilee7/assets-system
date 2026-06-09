# Docker Deployment

Node.js 的 Docker 镜像需要多层优化：体积小、构建快、安全、分层缓存友好。

## 多阶段构建

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache dumb-init
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
USER node
EXPOSE 3000
CMD ["dumb-init", "node", "dist/main.js"]
```

## 优化要点

| 优化 | 说明 |
| --- | --- |
| Alpine | 镜像从 1GB+ 降至 ~150MB |
| 多阶段 | 不携带 devDependencies 和源码 |
| dumb-init | 正确转发信号（PID 1 问题） |
| USER node | 不以 root 运行 |
| .dockerignore | 排除 node_modules、.git、test |
| npm ci | 严格按 lockfile 安装，比 npm install 快且确定 |

## docker-compose 示例

```yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://db:5432/app
    depends_on:
      - db
      - redis
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: app
  redis:
    image: redis:7-alpine
```

## 健康检查

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"
```
