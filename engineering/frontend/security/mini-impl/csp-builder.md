# 手写 CSP 策略构建器

## 目标

实现一个简化版 CSP 策略构建器，支持：
1. 链式 API 配置策略
2. 自动生成 Nonce
3. 严格模式（Strict CSP）支持
4. 输出 HTTP 头格式

## 实现

```javascript
// csp-builder.js
class CSPBuilder {
  constructor() {
    this.directives = {};
    this.nonce = null;
  }

  // 静态工厂方法
  static create() {
    return new CSPBuilder();
  }

  // 默认安全策略
  static strict() {
    return new CSPBuilder()
      .defaultSrc("'self'")
      .scriptSrc("'self'")
      .styleSrc("'self'")
      .imgSrc("'self'", 'data:', 'https:')
      .fontSrc("'self'")
      .connectSrc("'self'")
      .frameSrc("'none'")
      .objectSrc("'none'")
      .baseUri("'none'")
      .formAction("'self'")
      .upgradeInsecureRequests();
  }

  // 通用指令设置
  setDirective(name, values) {
    this.directives[name] = Array.isArray(values) ? values : [values];
    return this;
  }

  // 便捷方法
  defaultSrc(...values) { return this.setDirective('default-src', values); }
  scriptSrc(...values) { return this.setDirective('script-src', values); }
  styleSrc(...values) { return this.setDirective('style-src', values); }
  imgSrc(...values) { return this.setDirective('img-src', values); }
  fontSrc(...values) { return this.setDirective('font-src', values); }
  connectSrc(...values) { return this.setDirective('connect-src', values); }
  frameSrc(...values) { return this.setDirective('frame-src', values); }
  objectSrc(...values) { return this.setDirective('object-src', values); }
  baseUri(...values) { return this.setDirective('base-uri', values); }
  formAction(...values) { return this.setDirective('form-action', values); }
  frameAncestors(...values) { return this.setDirective('frame-ancestors', values); }

  // 特殊指令
  upgradeInsecureRequests() {
    this.directives['upgrade-insecure-requests'] = true;
    return this;
  }

  blockAllMixedContent() {
    this.directives['block-all-mixed-content'] = true;
    return this;
  }

  // 生成 Nonce
  generateNonce() {
    const crypto = require('crypto');
    this.nonce = crypto.randomBytes(16).toString('base64');
    return this;
  }

  // 应用 Nonce 到 script/style
  applyNonce() {
    if (!this.nonce) this.generateNonce();

    ['script-src', 'style-src'].forEach((directive) => {
      if (this.directives[directive]) {
        const hasNonce = this.directives[directive].some((v) => v.startsWith("'nonce-"));
        if (!hasNonce) {
          this.directives[directive].push(`'nonce-${this.nonce}'`);
        }
      }
    });
    return this;
  }

  // 严格 CSP（Google 推荐）
  strictDynamic() {
    this.scriptSrc("'strict-dynamic'", 'https:');
    return this;
  }

  // 报告配置
  reportUri(uri) {
    this.directives['report-uri'] = [uri];
    return this;
  }

  reportTo(group) {
    this.directives['report-to'] = [group];
    return this;
  }

  // 构建为字符串
  build() {
    const parts = [];

    for (const [directive, values] of Object.entries(this.directives)) {
      if (values === true) {
        parts.push(directive);
      } else {
        parts.push(`${directive} ${values.join(' ')}`);
      }
    }

    return parts.join('; ');
  }

  // 构建为对象（用于框架配置）
  buildObject() {
    const result = {};
    for (const [directive, values] of Object.entries(this.directives)) {
      if (values === true) {
        result[directive] = true;
      } else {
        result[directive] = values.join(' ');
      }
    }
    return result;
  }

  // 生成 HTML meta 标签
  toMetaTag() {
    return `<meta http-equiv="Content-Security-Policy" content="${this.build()}">`;
  }

  // 生成 Express 中间件
  middleware(reportOnly = false) {
    const headerName = reportOnly
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';
    const policy = this.build();

    return (req, res, next) => {
      res.setHeader(headerName, policy);
      next();
    };
  }
}

// 使用示例
const csp = CSPBuilder.strict()
  .scriptSrc("'self'", 'https://cdn.example.com')
  .styleSrc("'self'", "'unsafe-inline'")  // 需要内联样式时
  .frameAncestors("'none'")
  .upgradeInsecureRequests()
  .reportUri('/csp-report')
  .build();

console.log(csp);
// default-src 'self'; script-src 'self' https://cdn.example.com; style-src 'self' 'unsafe-inline'; ...

// 严格模式 + Nonce
const strictCsp = CSPBuilder.strict()
  .generateNonce()
  .applyNonce()
  .strictDynamic()
  .build();

console.log(strictCsp);
// default-src 'self'; script-src 'self' 'nonce-xxx' 'strict-dynamic' https:; ...
```
