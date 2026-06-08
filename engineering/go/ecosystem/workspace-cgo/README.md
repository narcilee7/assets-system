# Go Workspace & CGO

Go 1.18 引入 Workspace 支持多模块协作，CGO 允许调用 C 代码。

## Workspace

```go
// go.work
go 1.21

use (
	./api
	./worker
	./shared
)

replace github.com/myorg/shared => ./shared
```

```bash
# 初始化 workspace
go work init ./api ./worker ./shared

# 添加模块
go work use ./new-module

# 在 workspace 中运行
cd api && go run .
```

## CGO

```go
// cgo_example.go
package main

/*
#include <stdio.h>
void hello() {
    printf("Hello from C!\n");
}
*/
import "C"

func main() {
	C.hello()
}
```

```bash
# 禁用 CGO（静态链接，容器常用）
CGO_ENABLED=0 go build

# 指定编译器和选项
CGO_CFLAGS="-I/path/to/include" CGO_LDFLAGS="-L/path/to/lib" go build
```

## 交叉编译

```bash
# Linux AMD64
GOOS=linux GOARCH=amd64 go build

# Linux ARM64
GOOS=linux GOARCH=arm64 go build

# macOS
GOOS=darwin GOARCH=amd64 go build

# Windows
GOOS=windows GOARCH=amd64 go build
```
