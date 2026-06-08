# Go Validation

Go 的验证通常结合 struct tag 和验证库（go-playground/validator）实现声明式校验。

## 核心实现

```go
// validation.go
package validation

import (
	"github.com/go-playground/validator/v10"
	"github.com/gin-gonic/gin"
	"net/http"
)

var validate = validator.New()

type CreateUserRequest struct {
	Name     string `json:"name" validate:"required,min=1,max=100"`
	Email    string `json:"email" validate:"required,email"`
	Age      int    `json:"age" validate:"omitempty,gte=0,lte=150"`
	Password string `json:"password" validate:"required,min=8"`
	Role     string `json:"role" validate:"omitempty,oneof=user admin"`
}

func ValidateStruct(s interface{}) error {
	return validate.Struct(s)
}

// Gin 绑定 + 验证
func CreateUserHandler(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_ERROR",
			"message": err.Error(),
		})
		return
	}

	if err := ValidateStruct(&req); err != nil {
		// 格式化验证错误
		var errors []map[string]string
		for _, err := range err.(validator.ValidationErrors) {
			errors = append(errors, map[string]string{
				"field":   err.Field(),
				"rule":    err.Tag(),
				"message": err.Error(),
			})
		}
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_ERROR",
			"errors":  errors,
		})
		return
	}

	c.JSON(http.StatusCreated, req)
}
```

## 自定义验证规则

```go
// custom_validation.go
func init() {
	validate.RegisterValidation("strong_password", func(fl validator.FieldLevel) bool {
		password := fl.Field().String()
		hasUpper := false
		hasLower := false
		hasDigit := false
		for _, c := range password {
			switch {
			case c >= 'A' && c <= 'Z':
				hasUpper = true
			case c >= 'a' && c <= 'z':
				hasLower = true
			case c >= '0' && c <= '9':
				hasDigit = true
			}
		}
		return hasUpper && hasLower && hasDigit
	})
}
```
