# Go 密码哈希与安全凭证

密码哈希是用户认证系统的最后一道防线。Go 的标准库 `crypto/subtle` 提供了常数时间比较，而密码哈希通常使用 `golang.org/x/crypto` 下的 `bcrypt`、`scrypt` 或 `argon2`。Go 的静态类型和内存安全特性使得实现安全的凭证处理相对容易，但仍需遵循严格的密码学最佳实践。

## 核心概念

密码哈希的核心目标不是加密（可逆），而是单向变换，使得即使数据库泄露，攻击者也无法快速还原原始密码。现代密码哈希算法都是故意慢速的（CPU/内存密集型），以抵抗暴力破解和彩虹表攻击。

Argon2 是 2015 年密码哈希竞赛的冠军，推荐用于新系统。bcrypt 历史悠久、生态成熟，是兼容性要求高的系统的稳妥选择。scrypt 允许更细粒度地控制内存消耗，适合对抗专用硬件（ASIC）攻击。在 Go 中，bcrypt 通过 `golang.org/x/crypto/bcrypt` 提供，argon2 通过 `golang.org/x/crypto/argon2` 提供。

## 代码实现

```go
// password.go
package security

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/bcrypt"
)

// Hasher 接口抽象密码哈希操作
type Hasher interface {
	Hash(password string) (string, error)
	Verify(password, encodedHash string) (bool, error)
}

// BcryptHasher 使用 bcrypt 算法
type BcryptHasher struct {
	Cost int
}

func NewBcryptHasher(cost int) *BcryptHasher {
	if cost < bcrypt.MinCost || cost > bcrypt.MaxCost {
		cost = bcrypt.DefaultCost
	}
	return &BcryptHasher{Cost: cost}
}

func (h *BcryptHasher) Hash(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), h.Cost)
	if err != nil {
		return "", fmt.Errorf("bcrypt hash: %w", err)
	}
	return string(hash), nil
}

func (h *BcryptHasher) Verify(password, encodedHash string) (bool, error) {
	err := bcrypt.CompareHashAndPassword([]byte(encodedHash), []byte(password))
	if err == bcrypt.ErrMismatchedHashAndPassword {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("bcrypt compare: %w", err)
	}
	return true, nil
}

// Argon2Params 配置 Argon2id 参数
type Argon2Params struct {
	Memory      uint32
	Iterations  uint32
	Parallelism uint8
	SaltLength  uint32
	KeyLength   uint32
}

// DefaultArgon2Params 返回 OWASP 推荐的参数
func DefaultArgon2Params() *Argon2Params {
	return &Argon2Params{
		Memory:      64 * 1024, // 64 MB
		Iterations:  3,
		Parallelism: 4,
		SaltLength:  16,
		KeyLength:   32,
	}
}

// Argon2Hasher 使用 Argon2id 算法（推荐）
type Argon2Hasher struct {
	params *Argon2Params
}

func NewArgon2Hasher(params *Argon2Params) *Argon2Hasher {
	if params == nil {
		params = DefaultArgon2Params()
	}
	return &Argon2Hasher{params: params}
}

func (h *Argon2Hasher) Hash(password string) (string, error) {
	salt := make([]byte, h.params.SaltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generate salt: %w", err)
	}

	hash := argon2.IDKey([]byte(password), salt, h.params.Iterations, h.params.Memory, h.params.Parallelism, h.params.KeyLength)

	// 编码为 modular crypt format: $argon2id$v=19$m=...,t=...,p=...$salt$hash
	b64Salt := base64.RawStdEncoding.EncodeToString(salt)
	b64Hash := base64.RawStdEncoding.EncodeToString(hash)

	encodedHash := fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, h.params.Memory, h.params.Iterations, h.params.Parallelism, b64Salt, b64Hash)

	return encodedHash, nil
}

func (h *Argon2Hasher) Verify(password, encodedHash string) (bool, error) {
	params, salt, hash, err := h.decodeHash(encodedHash)
	if err != nil {
		return false, fmt.Errorf("decode hash: %w", err)
	}

	otherHash := argon2.IDKey([]byte(password), salt, params.Iterations, params.Memory, params.Parallelism, uint32(len(hash)))

	if subtle.ConstantTimeCompare(hash, otherHash) == 1 {
		return true, nil
	}
	return false, nil
}

func (h *Argon2Hasher) decodeHash(encodedHash string) (*Argon2Params, []byte, []byte, error) {
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 6 {
		return nil, nil, nil, fmt.Errorf("invalid hash format")
	}

	var params Argon2Params
	_, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &params.Memory, &params.Iterations, &params.Parallelism)
	if err != nil {
		return nil, nil, nil, err
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return nil, nil, nil, err
	}

	hash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return nil, nil, nil, err
	}

	return &params, salt, hash, nil
}
```

```go
// api_key.go
package security

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

// APIKeyManager 管理 API Key 的生成和验证
// 存储哈希而非明文，支持前缀识别
type APIKeyManager struct{}

func NewAPIKeyManager() *APIKeyManager {
	return &APIKeyManager{}
}

// Generate 生成新的 API Key
// 格式: prefix_randomString
// 返回原始 key（仅一次）和哈希
func (m *APIKeyManager) Generate(prefix string) (rawKey, hash string, err error) {
	randomBytes := make([]byte, 32)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", "", err
	}

	rawKey = fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(randomBytes))
	hash = m.hashKey(rawKey)
	return rawKey, hash, nil
}

func (m *APIKeyManager) hashKey(key string) string {
	h := sha256.Sum256([]byte(key))
	return hex.EncodeToString(h[:])
}

// Verify 验证 API Key
func (m *APIKeyManager) Verify(rawKey, storedHash string) bool {
	expectedHash := m.hashKey(rawKey)
	return subtle.ConstantTimeCompare([]byte(expectedHash), []byte(storedHash)) == 1
}

// ExtractPrefix 从 key 中提取前缀（用于数据库索引查找）
func (m *APIKeyManager) ExtractPrefix(rawKey string) string {
	parts := strings.SplitN(rawKey, "_", 2)
	if len(parts) > 0 {
		return parts[0]
	}
	return ""
}
```

```go
// pepper.go
package security

import (
	"crypto/hmac"
	"crypto/sha256"
	"fmt"
)

// Pepper 是全局密钥，不存储在数据库中
// 通常来自环境变量或 KMS，用于在哈希前增强密码
// 注意：如果 pepper 丢失，所有密码将无法验证
var globalPepper = []byte("CHANGE_ME_IN_PRODUCTION")

func SetPepper(pepper string) {
	globalPepper = []byte(pepper)
}

func applyPepper(password string) []byte {
	// HMAC(password, pepper) 增加一层保护
	mac := hmac.New(sha256.New, globalPepper)
	mac.Write([]byte(password))
	return mac.Sum(nil)
}

// PepperBcryptHasher 在 bcrypt 前应用 pepper
type PepperBcryptHasher struct {
	base *BcryptHasher
}

func NewPepperBcryptHasher(cost int) *PepperBcryptHasher {
	return &PepperBcryptHasher{base: NewBcryptHasher(cost)}
}

func (h *PepperBcryptHasher) Hash(password string) (string, error) {
	peppered := applyPepper(password)
	return h.base.Hash(fmt.Sprintf("%x", peppered))
}

func (h *PepperBcryptHasher) Verify(password, encodedHash string) (bool, error) {
	peppered := applyPepper(password)
	return h.base.Verify(fmt.Sprintf("%x", peppered), encodedHash)
}
```

## 选型对比

| 算法 | 优势 | 劣势 | 推荐场景 |
| --- | --- | --- | --- |
| bcrypt | 历史悠久，生态成熟，自适应成本 | 内存硬化弱，上限 72 字节 | 兼容性优先的系统 |
| scrypt | 内存硬化，可配置 | 参数调优复杂 | 对抗 ASIC/FPGA |
| argon2id | 密码哈希竞赛冠军，GPU/ASIC 抵抗 | Go 1.20+ 支持更好 | **新系统首选** |
| PBKDF2 | NIST 推荐，广泛支持 | 计算效率低，无内存硬化 | 合规要求 |

## 最佳实践

- **永远不用 MD5/SHA1**：这些哈希算法设计为快速，不适合密码存储
- **Cost 参数随硬件升级**：bcrypt cost 应定期提升，迁移时在下一次登录时重新哈希
- **Pepper + Salt**：Salt 每个用户独立（防彩虹表），Pepper 全局（数据库泄露多一层保护）
- **常数时间比较**：使用 `crypto/subtle.ConstantTimeCompare` 防止时序攻击
- **HTTPS 强制传输**：密码只在 TLS 连接上传输，禁止明文日志记录
- **速率限制**：登录接口必须做 IP/账号级别的速率限制，防止在线爆破
