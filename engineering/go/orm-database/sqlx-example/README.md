# sqlx + database/sql

sqlx 是对标准库 `database/sql` 的轻量扩展，增加了 StructScan 和命名参数支持。

## 核心实现

```go
// sqlx_example.go
package main

import (
	"log"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

type User struct {
	ID        int    `db:"id"`
	Name      string `db:"name"`
	Email     string `db:"email"`
	CreatedAt string `db:"created_at"`
}

func main() {
	db, err := sqlx.Connect("postgres", "host=localhost user=postgres dbname=myapp sslmode=disable")
	if err != nil {
		log.Fatal(err)
	}

	// StructScan 自动映射
	var users []User
	err = db.Select(&users, "SELECT id, name, email, created_at FROM users WHERE age > $1", 18)

	// 单行查询
	var user User
	err = db.Get(&user, "SELECT * FROM users WHERE id = $1", 1)

	// 命名参数
	query := `INSERT INTO users (name, email) VALUES (:name, :email)`
	_, err = db.NamedExec(query, map[string]interface{}{
		"name":  "Alice",
		"email": "alice@example.com",
	})

	// 事务
	tx := db.MustBegin()
	tx.MustExec("INSERT INTO users (name) VALUES ($1)", "Bob")
	tx.Commit()
}
```

## sqlx vs GORM

| 维度 | sqlx | GORM |
| --- | --- | --- |
| 抽象层级 | 低（SQL 为主） | 高（ORM 为主） |
| 学习成本 | 低 | 中 |
| 性能 | 更高 | 高 |
| 灵活性 | 极高 | 高 |
| 迁移 | 手动 | 自动 |
| 推荐场景 | 复杂 SQL、性能敏感 | 快速开发、CRUD 为主 |
