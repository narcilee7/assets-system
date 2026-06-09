# Ent (ORM)

Ent 是 Facebook 开源的 Go 实体框架，基于代码生成，提供类型安全的 ORM 体验。

## 核心特性

- 代码生成：Schema 定义后自动生成类型安全代码
- Graph 查询：支持遍历关系图
- 迁移：自动数据库迁移
- 钩子：Pre/Post 操作钩子
- 隐私：行级权限控制

## Schema 定义

```go
// ent/schema/user.go
package schema

import (
	"ent"
	"ent/schema/field"
	"ent/schema/edge"
)

type User struct {
	ent.Schema
}

func (User) Fields() []ent.Field {
	return []ent.Field{
		field.Int("id"),
		field.String("name").NotEmpty(),
		field.String("email").Unique(),
		field.Int("age").Positive(),
		field.Time("created_at").Default(time.Now),
	}
}

func (User) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("orders", Order.Type),
	}
}
```

## 生成与使用

```bash
# 安装 ent CLI
go install entgo.io/ent/cmd/ent@latest

# 生成代码
go generate ./ent
```

```go
// 使用
import "myapp/ent"

client, err := ent.Open("postgres", "host=localhost user=postgres dbname=myapp")
if err != nil {
	log.Fatal(err)
}

// 创建
user, err := client.User.Create().
	SetName("Alice").
	SetEmail("alice@example.com").
	SetAge(30).
	Save(ctx)

// 查询
user, err := client.User.Get(ctx, 1)
users, err := client.User.Query().Where(user.AgeGT(18)).All(ctx)

// 关联查询
orders, err := client.User.QueryOrders(user).All(ctx)

// 事务
err := client.WithTx(ctx, func(tx *ent.Tx) error {
	user, err := tx.User.Create().SetName("Bob").Save(ctx)
	if err != nil {
		return err
	}
	_, err = tx.Order.Create().SetUserID(user.ID).Save(ctx)
	return err
})
```
