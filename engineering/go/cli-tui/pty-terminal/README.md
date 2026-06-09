# PTY 伪终端

PTY（Pseudo-Terminal）允许 Go 程序控制交互式命令行程序，如 vim、ssh、top。

## 核心实现

```go
// pty_example.go
package main

import (
	"fmt"
	"io"
	"os"
	"os/exec"

	"github.com/creack/pty"
)

func main() {
	// 启动一个 PTY
	cmd := exec.Command("bash")
	ptmx, err := pty.Start(cmd)
	if err != nil {
		fmt.Println("Failed to start PTY:", err)
		return
	}
	defer ptmx.Close()

	// 从 PTY 读取输出
	go func() {
		io.Copy(os.Stdout, ptmx)
	}()

	// 向 PTY 写入输入
	io.Copy(ptmx, os.Stdin)
}
```

## AI Agent CLI 中的应用

```go
// agent_terminal.go
func runInPTY(command string, onOutput func(string)) error {
	cmd := exec.Command("bash", "-c", command)
	ptmx, err := pty.Start(cmd)
	if err != nil {
		return err
	}
	defer ptmx.Close()

	// 设置终端大小
	pty.Setsize(ptmx, &pty.Winsize{Rows: 24, Cols: 80})

	// 流式输出
	scanner := bufio.NewScanner(ptmx)
	for scanner.Scan() {
		onOutput(scanner.Text())
	}

	return cmd.Wait()
}

// 使用
runInPTY("python train.py", func(line string) {
	fmt.Println("[AGENT OUTPUT]", line)
})
```
