# Cobra CLI

Cobra 是 Go 生态最成熟的 CLI 框架，kubectl、Docker CLI、Hugo 都使用它。

## 核心实现

```go
// main.go
package main

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "deployctl",
	Short: "Deployment control CLI",
	Long:  `A CLI tool for managing deployments to Kubernetes clusters.`,
}

func init() {
	rootCmd.AddCommand(deployCmd)
	rootCmd.AddCommand(rollbackCmd)
	rootCmd.AddCommand(statusCmd)
}

var deployCmd = &cobra.Command{
	Use:   "deploy [environment]",
	Short: "Deploy application",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		env := args[0]
		tag, _ := cmd.Flags().GetString("tag")
		dryRun, _ := cmd.Flags().GetBool("dry-run")

		fmt.Printf("Deploying to %s with tag %s (dry-run: %v)\n", env, tag, dryRun)
	},
}

var rollbackCmd = &cobra.Command{
	Use:   "rollback [environment]",
	Short: "Rollback deployment",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("Rolling back %s\n", args[0])
	},
}

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show deployment status",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("All services running")
	},
}

func init() {
	deployCmd.Flags().StringP("tag", "t", "latest", "Docker image tag")
	deployCmd.Flags().Bool("dry-run", false, "Simulate without deploying")
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
```

## Cobra + Viper 配置

```go
// config.go
import "github.com/spf13/viper"

func init() {
	viper.SetConfigName("deployctl")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("$HOME/.deployctl")

	viper.SetDefault("server.port", "8080")
	viper.SetDefault("log.level", "info")

	viper.ReadInConfig()
}
```

## Cobra vs urfave/cli

| 维度 | Cobra | urfave/cli |
| --- | --- | --- |
| 生态 | 极大 | 中等 |
| 子命令 | 原生支持 | 支持 |
| 配置集成 | Viper | 手动 |
| 生成工具 | cobra-cli | 无 |
| 推荐 | 复杂 CLI | 简单 CLI |
