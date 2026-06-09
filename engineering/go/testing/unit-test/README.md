# Go 单元测试体系

Go 的标准库 `testing` 提供了轻量但功能完备的测试框架。与 Python 的 pytest 或 JavaScript 的 Jest 不同，Go 测试不依赖复杂的断言库或插件生态，而是通过组合 `testing.T`、表格驱动测试（Table-Driven Tests）和子测试（Subtests）实现强大的测试覆盖。Go 1.18 引入的泛型进一步简化了测试辅助函数的编写。

## 核心概念

Go 的测试文件以 `_test.go` 结尾，测试函数签名固定为 `func TestXxx(t *testing.T)`。`testing.T` 提供错误报告（`Error`/`Fatal`）、日志（`Logf`）和并发控制（`Parallel`）。Go 团队极力推荐**表格驱动测试**：将输入/期望输出组织为结构体切片，循环执行同一测试逻辑，这种方式代码复用率高，新增测试用例只需添加数据行。

Go 1.7 引入的 Subtests 允许通过 `t.Run(name, func(t *testing.T))` 创建层级化的测试结构，配合 `t.Parallel()` 可实现真正的并行测试执行。Go 1.18 的 Fuzzing 测试进一步扩展了测试能力，可以自动生成随机输入发现边界问题。

## 代码实现

```go
// user_test.go
package service

import (
	"errors"
	"testing"
)

// UserService 待测试的服务
type UserService struct {
	repo UserRepository
}

type UserRepository interface {
	GetByID(id string) (*User, error)
	Create(u *User) error
}

type User struct {
	ID    string
	Email string
	Name  string
}

func (s *UserService) GetUser(id string) (*User, error) {
	if id == "" {
		return nil, errors.New("id is required")
	}
	return s.repo.GetByID(id)
}

func (s *UserService) CreateUser(email, name string) (*User, error) {
	if email == "" || name == "" {
		return nil, errors.New("email and name are required")
	}
	u := &User{Email: email, Name: name}
	if err := s.repo.Create(u); err != nil {
		return nil, err
	}
	return u, nil
}

// TestUserService_GetUser 表格驱动测试示例
func TestUserService_GetUser(t *testing.T) {
	// 构造 mock
	mockRepo := &mockUserRepository{
		users: map[string]*User{
			"1": {ID: "1", Email: "alice@example.com", Name: "Alice"},
		},
	}
	svc := &UserService{repo: mockRepo}

	// 表格驱动
	tests := []struct {
		name      string
		input     string
		wantUser  *User
		wantErr   bool
		errMsg    string
	}{
		{
			name:     "existing user",
			input:    "1",
			wantUser: &User{ID: "1", Email: "alice@example.com", Name: "Alice"},
			wantErr:  false,
		},
		{
			name:     "non-existing user",
			input:    "999",
			wantUser: nil,
			wantErr:  true,
			errMsg:   "not found",
		},
		{
			name:     "empty id",
			input:    "",
			wantUser: nil,
			wantErr:  true,
			errMsg:   "id is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// t.Parallel() // 可开启并行
			got, err := svc.GetUser(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetUser() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && err != nil && tt.errMsg != "" {
				if err.Error() != tt.errMsg {
					t.Errorf("GetUser() error msg = %v, want %v", err.Error(), tt.errMsg)
				}
			}
			if got != nil && tt.wantUser != nil {
				if got.ID != tt.wantUser.ID || got.Email != tt.wantUser.Email {
					t.Errorf("GetUser() = %+v, want %+v", got, tt.wantUser)
				}
			}
		})
	}
}

// mockUserRepository 手动 mock 实现
type mockUserRepository struct {
	users map[string]*User
	err   error
}

func (m *mockUserRepository) GetByID(id string) (*User, error) {
	if m.err != nil {
		return nil, m.err
	}
	u, ok := m.users[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return u, nil
}

func (m *mockUserRepository) Create(u *User) error {
	if m.err != nil {
		return m.err
	}
	m.users[u.ID] = u
	return nil
}
```

```go
// benchmark_test.go
package service

import (
	"testing"
)

// BenchmarkCreateUser 基准测试
func BenchmarkCreateUser(b *testing.B) {
	mockRepo := &mockUserRepository{users: make(map[string]*User)}
	svc := &UserService{repo: mockRepo}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := svc.CreateUser("test@example.com", "Test User")
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkCreateUserParallel 并行基准测试
func BenchmarkCreateUserParallel(b *testing.B) {
	mockRepo := &mockUserRepository{users: make(map[string]*User)}
	svc := &UserService{repo: mockRepo}

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			svc.CreateUser("test@example.com", "Test User")
		}
	})
}

// 比较不同实现的性能
func BenchmarkStringConcat(b *testing.B) {
	b.Run("Plus", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			_ = "hello" + " " + "world"
		}
	})
	b.Run("Builder", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			var sb strings.Builder
			sb.WriteString("hello")
			sb.WriteString(" ")
			sb.WriteString("world")
			_ = sb.String()
		}
	})
}
```

```go
// fuzz_test.go
package service

import (
	"testing"
	"unicode"
)

// FuzzSanitizeInput fuzzing 测试
func FuzzSanitizeInput(f *testing.F) {
	// 种子语料
	f.Add("hello world")
	f.Add("test123")
	f.Add("")

	f.Fuzz(func(t *testing.T, input string) {
		result := SanitizeInput(input)
		// 验证结果只包含合法字符
		for _, r := range result {
			if !unicode.IsLetter(r) && !unicode.IsDigit(r) && r != ' ' {
				t.Errorf("invalid character in sanitized result: %q", r)
			}
		}
	})
}

func SanitizeInput(s string) string {
	var out []rune
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == ' ' {
			out = append(out, r)
		}
	}
	return string(out)
}
```

```go
// assert_helper.go
package testutil

import (
	"testing"
)

// AssertNoError 辅助断言函数
func AssertNoError(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func AssertError(t *testing.T, err error, wantMsg string) {
	t.Helper()
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if wantMsg != "" && err.Error() != wantMsg {
		t.Fatalf("error message = %q, want %q", err.Error(), wantMsg)
	}
}

func AssertEqual[T comparable](t *testing.T, got, want T) {
	t.Helper()
	if got != want {
		t.Fatalf("got %v, want %v", got, want)
	}
}
```

## 选型对比

| 工具 | 用途 | 特点 | 推荐 |
| --- | --- | --- | --- |
| testing (标准库) | 单元/基准测试 | 轻量，无需依赖 | **始终使用** |
| testify | 断言 + Mock | 丰富的 assert 方法，mock 框架 | 大型项目推荐 |
| gomock | 接口 Mock | 代码生成，类型安全 | 复杂依赖场景 |
| gofuzz | Fuzzing | 自动生成输入 | 安全关键模块 |
| gotestsum | 测试运行器 | 格式化输出，并行优化 | CI 环境 |
| cover.out + go tool cover | 覆盖率 | 内置支持 | 必须集成 CI |

## 最佳实践

- **表格驱动**：所有逻辑测试使用表格驱动，避免复制粘贴测试代码
- **t.Parallel()**：无共享状态的测试加 `t.Parallel()`，充分利用多核
- **测试覆盖率**：核心包要求 80%+ 覆盖率，使用 `go test -coverprofile`
- **Mock 边界**：优先手动 mock，复杂场景使用 `gomock` 或 `mockery`
- **子测试命名**：`t.Run` 名称使用蛇_case，描述测试场景而非函数名
- **基准测试**：性能优化前必须写 `Benchmark`，用 `benchcmp` 对比结果
- **Fuzzing**：输入处理函数（解析器、校验器）必须加 Fuzzing 测试
