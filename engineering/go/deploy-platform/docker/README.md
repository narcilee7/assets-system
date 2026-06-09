# Go Docker Deployment

Go 编译为静态二进制，Docker 镜像可以做得极小。

## 多阶段构建

```dockerfile
# Dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
EXPOSE 8080
CMD ["./main"]
```

##  distroless 镜像

```dockerfile
# 更安全的极小镜像
FROM gcr.io/distroless/static-debian11
COPY --from=builder /app/main /main
EXPOSE 8080
ENTRYPOINT ["/main"]
```

## docker-compose

```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgres://db:5432/app
      - LOG_LEVEL=info
    depends_on:
      - db
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: app
```

## Go Docker 优势

- 单二进制文件，无需运行时依赖
- 静态链接后可用 scratch/distroless 镜像
- 镜像体积可从几百MB降至 < 20MB
