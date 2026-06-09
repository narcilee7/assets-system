# GORM

GORM 是 Go 生态最流行的 ORM，功能全、文档好、社区活跃。

## 核心实现

```go
// models.go
package models

import (
	"gorm.io/gorm"
	"time"
)

type User struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Email     string         `gorm:"uniqueIndex;not null" json:"email"`
	Name      string         `gorm:"not null" json:"name"`
	Balance   float64        `gorm:"default:0" json:"balance"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	Orders    []Order        `json:"orders,omitempty"`
}

type Order struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null" json:"user_id"`
	Status    string    `gorm:"default:pending" json:"status"`
	Amount    float64   `gorm:"not null" json:"amount"`
	CreatedAt time.Time `json:"created_at"`
}
```

## 连接与迁移

```go
// db.go
package db

import (
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"log"
	"os"
	"time"
)

var DB *gorm.DB

func Init() {
	var err error
	DB, err = gorm.Open(postgres.Open(os.Getenv("DATABASE_URL")), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatal("Failed to connect database:", err)
	}

	// 自动迁移
	DB.AutoMigrate(&models.User{}, &models.Order{})
}
```

## CRUD 与事务

```go
// repository.go
package repository

import (
	"gorm.io/gorm"
	"myapp/models"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(user *models.User) error {
	return r.db.Create(user).Error
}

func (r *UserRepository) FindByID(id uint) (*models.User, error) {
	var user models.User
	if err := r.db.Preload("Orders").First(&user, id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) FindByEmail(email string) (*models.User, error) {
	var user models.User
	if err := r.db.Where("email = ?", email).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// 事务
func (r *UserRepository) Transfer(userID uint, amount float64) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var user models.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, userID).Error; err != nil {
			return err
		}

		if user.Balance < amount {
			return errors.New("insufficient balance")
		}

		user.Balance -= amount
		if err := tx.Save(&user).Error; err != nil {
			return err
		}

		order := models.Order{UserID: userID, Amount: amount, Status: "paid"}
		if err := tx.Create(&order).Error; err != nil {
			return err
		}

		return nil
	})
}
```

## 高级查询

```go
// advanced.go
func (r *UserRepository) Search(filters map[string]interface{}) ([]models.User, error) {
	var users []models.User
	query := r.db.Model(&models.User{})

	if email, ok := filters["email"]; ok {
		query = query.Where("email LIKE ?", "%"+email.(string)+"%")
	}
	if minBalance, ok := filters["min_balance"]; ok {
		query = query.Where("balance >= ?", minBalance)
	}

	err := query.Order("created_at DESC").Find(&users).Error
	return users, err
}
```

## GORM vs sqlx vs database/sql

| 维度 | GORM | sqlx | database/sql |
| --- | --- | --- | --- |
| 功能 | 全功能 ORM | 轻量扩展 | 标准库 |
| 学习曲线 | 中 | 低 | 低 |
| 性能 | 中 | 高 | 最高 |
| 灵活性 | 中 | 高 | 极高 |
| 适用 | 快速开发 | 平衡 | 极致控制 |
