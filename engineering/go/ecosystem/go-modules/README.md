# Go Modules

Go Modules 是 Go 1.11+ 引入的官方依赖管理方案，替代了早期的 GOPATH 和 vendor 模式。

## 核心命令

```bash
# 初始化模块
go mod init github.com/myorg/myapp

# 下载依赖
go mod tidy

# 升级依赖
go get -u github.com/gin-gonic/gin

# 升级所有依赖
go get -u ./...

# 查看依赖树
go mod graph

# 为什么需要某个依赖
go mod why github.com/some/dep

# 供应商模式（离线构建）
go mod vendor
```

## go.mod 结构

```go
// go.mod
module github.com/myorg/myapp

go 1.21

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/golang-jwt/jwt/v5 v5.2.0
	gorm.io/driver/postgres v1.5.4
	gorm.io/gorm v1.25.5
)

require (
	github.com/bytedance/sonic v1.9.1 // indirect
	github.com/chenzhuoyu/base64x v0.0.0-20221115062448-fe3a3abad311 // indirect
)

replace github.com/myorg/shared => ../shared
```

## 版本管理策略

```bash
# 语义化版本
# v1.2.3 -> major.minor.patch
# major: 不兼容变更
# minor: 兼容新增功能
# patch: bug fix

# major 版本升级（v1 -> v2）
# 需要修改 import 路径
import "github.com/myorg/lib/v2"
```

## 私有模块

```bash
# ~/.gitconfig
[url "ssh://git@github.com/"]
	insteadOf = https://github.com/

# 或者直接设置环境变量
export GOPRIVATE="github.com/myorg/*"
```

## Go Modules vs Node.js npm

| 维度 | Go Modules | npm |
| --- | --- | --- |
| 锁定文件 | go.sum | package-lock.json |
| 最小版本选择 | ✅ | ❌ |
| 供应商模式 | go mod vendor | npm ci + node_modules |
| 工作区 | go.work | workspaces |
| 模块路径 | URL 风格 | 包名 |
