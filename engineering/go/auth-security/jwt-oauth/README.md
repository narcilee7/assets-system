# Go JWT 与 OAuth2 实现

在 Go 生态中，认证与授权通常由标准库配合第三方库完成。JWT（JSON Web Token）是无状态认证的事实标准，而 OAuth2 则是第三方授权的核心协议。Go 的强类型和显式错误处理使得安全代码更易于审计和维护。

## 核心概念

JWT 由 Header、Payload、Signature 三部分组成，通过点号连接。Go 中最常用的库是 `golang-jwt/jwt`，它是社区维护的 `dgrijalva/jwt-go` 的继任者，修复了关键的签名验证漏洞。OAuth2 在 Go 中通常使用 `golang.org/x/oauth2` 实现，它提供了完整的 OAuth2 客户端和服务端支持。

在生产环境中，JWT 应该使用 RS256（RSA 签名）或 ES256（ECDSA 签名），而不是 HS256（HMAC 对称签名），因为对称密钥在微服务架构中难以安全分发。Access Token 应设置较短的有效期（15 分钟），并通过 Refresh Token 机制实现无感刷新。

## 代码实现

```go
// jwt.go
package auth

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims 定义自定义声明
type Claims struct {
	UserID   string   `json:"user_id"`
	Username string   `json:"username"`
	Roles    []string `json:"roles"`
	jwt.RegisteredClaims
}

// TokenPair 包含 access token 和 refresh token
type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type JWTManager struct {
	privateKey *ecdsa.PrivateKey
	publicKey  *ecdsa.PublicKey
	issuer     string
}

// NewJWTManager 生成新的 ECDSA 密钥对
func NewJWTManager(issuer string) (*JWTManager, error) {
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generate key: %w", err)
	}
	return &JWTManager{
		privateKey: privateKey,
		publicKey:  &privateKey.PublicKey,
		issuer:     issuer,
	}, nil
}

// GenerateTokenPair 生成 token 对
func (m *JWTManager) GenerateTokenPair(userID, username string, roles []string) (*TokenPair, error) {
	now := time.Now()
	accessExpiry := now.Add(15 * time.Minute)
	refreshExpiry := now.Add(7 * 24 * time.Hour)

	accessClaims := Claims{
		UserID:   userID,
		Username: username,
		Roles:    roles,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(accessExpiry),
			IssuedAt:  jwt.NewNumericDate(now),
			Issuer:    m.issuer,
			Subject:   userID,
		},
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodES256, accessClaims)
	accessString, err := accessToken.SignedString(m.privateKey)
	if err != nil {
		return nil, fmt.Errorf("sign access token: %w", err)
	}

	// Refresh token 只包含最小信息
	refreshClaims := jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(refreshExpiry),
		IssuedAt:  jwt.NewNumericDate(now),
		Issuer:    m.issuer,
		Subject:   userID,
		ID:        generateTokenID(), // jti，用于撤销
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodES256, refreshClaims)
	refreshString, err := refreshToken.SignedString(m.privateKey)
	if err != nil {
		return nil, fmt.Errorf("sign refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessString,
		RefreshToken: refreshString,
		ExpiresAt:    accessExpiry,
	}, nil
}

// ValidateToken 验证并解析 access token
func (m *JWTManager) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodECDSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return m.publicKey, nil
	}, jwt.WithIssuer(m.issuer))
	if err != nil {
		return nil, fmt.Errorf("parse token: %w", err)
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}
	return nil, fmt.Errorf("invalid token claims")
}

func generateTokenID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%x", b)
}
```

```go
// middleware.go
package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"myapp/auth"
)

func JWTAuth(jwtManager *auth.JWTManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": "MISSING_TOKEN"})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": "INVALID_TOKEN_FORMAT"})
			return
		}

		claims, err := jwtManager.ValidateToken(parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": "INVALID_TOKEN", "message": err.Error()})
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("roles", claims.Roles)
		c.Next()
	}
}

// RequireRole 基于角色的访问控制
func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRoles, exists := c.Get("roles")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN"})
			return
		}

		roleList := userRoles.([]string)
		roleSet := make(map[string]struct{}, len(roleList))
		for _, r := range roleList {
			roleSet[r] = struct{}{}
		}

		for _, required := range roles {
			if _, ok := roleSet[required]; ok {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"code": "INSUFFICIENT_PERMISSIONS"})
	}
}
```

```go
// oauth2_server.go
package auth

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"golang.org/x/oauth2"
)

// OAuth2Config 封装 OAuth2 服务端配置
type OAuth2Config struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
	Scopes       []string
	AuthURL      string
	TokenURL     string
}

// SimpleOAuth2Server 演示 OAuth2 Authorization Code 流程
// 生产环境应使用 github.com/go-oauth2/oauth2/v4 或 ORY Hydra
type SimpleOAuth2Server struct {
	config   OAuth2Config
	codes    map[string]codeInfo // auth code -> user mapping
	tokens   map[string]tokenInfo
}

type codeInfo struct {
	userID    string
	clientID  string
	expiresAt time.Time
}

type tokenInfo struct {
	userID    string
	expiresAt time.Time
}

func NewOAuth2Server(cfg OAuth2Config) *SimpleOAuth2Server {
	return &SimpleOAuth2Server{
		config: cfg,
		codes:  make(map[string]codeInfo),
		tokens: make(map[string]tokenInfo),
	}
}

// AuthorizeHandler 处理 /oauth/authorize
func (s *SimpleOAuth2Server) AuthorizeHandler(w http.ResponseWriter, r *http.Request) {
	clientID := r.URL.Query().Get("client_id")
	redirectURI := r.URL.Query().Get("redirect_uri")
	state := r.URL.Query().Get("state")
	scope := r.URL.Query().Get("scope")
	responseType := r.URL.Query().Get("response_type")

	if responseType != "code" {
		http.Error(w, "unsupported_response_type", http.StatusBadRequest)
		return
	}

	// 验证 client_id 和 redirect_uri
	if clientID != s.config.ClientID {
		http.Error(w, "invalid_client", http.StatusBadRequest)
		return
	}

	// 模拟用户登录并授权（实际应展示授权页面）
	code := generateTokenID()
	s.codes[code] = codeInfo{
		userID:    "user-123",
		clientID:  clientID,
		expiresAt: time.Now().Add(10 * time.Minute),
	}

	// 重定向回客户端
	redirectURL, _ := url.Parse(redirectURI)
	q := redirectURL.Query()
	q.Set("code", code)
	q.Set("state", state)
	redirectURL.RawQuery = q.Encode()

	http.Redirect(w, r, redirectURL.String(), http.StatusFound)
}

// TokenHandler 处理 /oauth/token
func (s *SimpleOAuth2Server) TokenHandler(w http.ResponseWriter, r *http.Request) {
	grantType := r.PostFormValue("grant_type")
	if grantType != "authorization_code" {
		// 支持 refresh_token
		if grantType == "refresh_token" {
			s.handleRefreshToken(w, r)
			return
		}
		http.Error(w, "unsupported_grant_type", http.StatusBadRequest)
		return
	}

	code := r.PostFormValue("code")
	info, ok := s.codes[code]
	if !ok || time.Now().After(info.expiresAt) {
		http.Error(w, "invalid_grant", http.StatusBadRequest)
		return
	}
	delete(s.codes, code) // 一次性使用

	accessToken := generateTokenID()
	refreshToken := generateTokenID()
	s.tokens[accessToken] = tokenInfo{userID: info.userID, expiresAt: time.Now().Add(time.Hour)}
	s.tokens[refreshToken] = tokenInfo{userID: info.userID, expiresAt: time.Now().Add(7 * 24 * time.Hour)}

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"access_token":"%s","token_type":"Bearer","expires_in":3600,"refresh_token":"%s"}`,
		accessToken, refreshToken)
}

func (s *SimpleOAuth2Server) handleRefreshToken(w http.ResponseWriter, r *http.Request) {
	refreshToken := r.PostFormValue("refresh_token")
	info, ok := s.tokens[refreshToken]
	if !ok || time.Now().After(info.expiresAt) {
		http.Error(w, "invalid_grant", http.StatusBadRequest)
		return
	}

	newAccess := generateTokenID()
	s.tokens[newAccess] = tokenInfo{userID: info.userID, expiresAt: time.Now().Add(time.Hour)}

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"access_token":"%s","token_type":"Bearer","expires_in":3600}`, newAccess)
}
```

## 选型对比

| 库 | 适用场景 | 特点 |
| --- | --- | --- |
| `golang-jwt/jwt` | JWT 签发与验证 | 社区主流，支持 Go 1.18+，安全性好 |
| `lestrrat-go/jwx` | JWS/JWE/JWK/JWT | 功能最全，支持 JWE 加密 |
| `golang.org/x/oauth2` | OAuth2 客户端 | Google 官方，标准兼容 |
| `go-oauth2/oauth2` | OAuth2 服务端 | 完整服务端实现，支持存储扩展 |
| `ORY Hydra` | 生产级 OAuth2/OIDC | 基于 OAuth2.0 和 OpenID Connect 标准 |

## 最佳实践

- **密钥管理**：生产环境使用 HashiCorp Vault 或 AWS KMS 管理私钥，禁止硬编码
- **Token 存储**：Access Token 存内存，Refresh Token 存 HttpOnly Cookie 或安全存储
- **撤销机制**：维护 JWT ID（jti）黑名单，在 Redis 中设置 TTL 与 Token 过期时间一致
- **算法固定**：服务端强制校验 `alg` 头，防止算法混淆攻击（none/HS256 欺骗）
- **Scope 校验**：OAuth2 的 scope 应最小化，按需申请权限
