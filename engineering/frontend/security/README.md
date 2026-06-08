# 前端安全工程化

前端安全工程化训练 —— 达到"能设计安全架构、能实施防御层、能管理供应链安全"的水平。

## 训练哲学

1. **安全是分层防御**：没有银弹，每层防线都要建立。
2. **不信任任何输入**：用户输入、URL 参数、第三方脚本、甚至自己的数据库。
3. **供应链是最大攻击面**：一个被污染的 npm 包可以摧毁整个应用。
4. **安全左移**：在 CI/CD 中集成安全扫描，而不是上线后补洞。

## 体系索引

| 文档 | 内容 |
|------|------|
| [01-csp.md](01-csp.md) | Content Security Policy：策略配置、Nonce、Report-Only 模式、升级策略 |
| [02-https-tls.md](02-https-tls.md) | HTTPS/TLS：HSTS、证书管理、混合内容、TLS 版本控制 |
| [03-xss-defense.md](03-xss-defense.md) | XSS 防御工程化：输入验证、输出编码、DOM 净化、模板引擎安全 |
| [04-csrf-protection.md](04-csrf-protection.md) | CSRF 保护：Token 机制、SameSite Cookie、Origin/Referer 验证、双重 Cookie |
| [05-dependency-security.md](05-dependency-security.md) | 依赖安全：npm audit、SRI、Lockfile 安全、依赖混淆、SBOM |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/csp-builder.md](mini-impl/csp-builder.md) | 手写 CSP 策略构建器 |
| [mini-impl/dom-sanitizer.md](mini-impl/dom-sanitizer.md) | 手写 DOM Sanitizer（XSS 防御） |

## 安全防御分层

```
网络层          TLS 1.3 + HSTS + 证书固定
  ↓
HTTP 层         CSP + CORS + 安全响应头
  ↓
应用层          输入验证 + 输出编码 + CSRF Token
  ↓
DOM 层          DOMPurify + 可信类型 (Trusted Types)
  ↓
依赖层          npm audit + SRI + Lockfile 校验
  ↓
运行时          错误边界 + 监控告警 + 应急响应
```
