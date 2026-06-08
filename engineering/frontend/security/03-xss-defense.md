# XSS 防御工程化

## 1. 输入验证与输出编码

```javascript
// 1. 输入验证（白名单原则）
function validateUsername(input) {
  // 只允许字母、数字、下划线
  const pattern = /^[a-zA-Z0-9_]{3,20}$/;
  if (!pattern.test(input)) {
    throw new Error('Invalid username');
  }
  return input;
}

// 2. 输出编码（根据上下文选择编码方式）
function htmlEscape(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function jsEscape(str) {
  return JSON.stringify(str).slice(1, -1);
}

function cssEscape(str) {
  return str.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char.charCodeAt(0).toString(16)} `);
}

function urlEscape(str) {
  return encodeURIComponent(str);
}

// 3. 模板引擎自动编码（React/Vue 默认安全）
// React: JSX 自动转义
function Component({ userInput }) {
  return <div>{userInput}</div>;  // 自动 htmlEscape
}

// ❌ 危险：dangerouslySetInnerHTML
function BadComponent({ html }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

// ✅ 安全：先净化再插入
import DOMPurify from 'dompurify';
function SafeComponent({ html }) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href', 'title'],
  });
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

## 2. DOM 净化策略

```javascript
// DOMPurify 配置
const purifyConfig = {
  // 允许的 HTML 标签
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3',
    'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre',
  ],

  // 允许的 HTML 属性
  ALLOWED_ATTR: [
    'href', 'title', 'alt', 'src', 'class', 'id',
    'target', 'rel',
  ],

  // 强制所有链接添加 rel="noopener noreferrer"
  ADD_ATTR: ['target'],
  FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],

  // 强制 https
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|xxx):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,

  // 返回 DOM 而非字符串（性能更好）
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,

  // 自定义 hook
  hook(node, data) {
    // 移除所有事件监听器属性
    if (node.nodeType === 1) { // Element
      const attrs = node.attributes;
      for (let i = attrs.length - 1; i >= 0; i--) {
        if (attrs[i].name.startsWith('on')) {
          node.removeAttribute(attrs[i].name);
        }
      }
    }
  },
};
```

## 3. Trusted Types（Chrome 原生 XSS 防御）

```javascript
// Trusted Types API
if (window.trustedTypes && trustedTypes.createPolicy) {
  const policy = trustedTypes.createPolicy('myPolicy', {
    createHTML(input) {
      return DOMPurify.sanitize(input);
    },
    createScript(input) {
      throw new Error('Scripts are not allowed');
    },
    createScriptURL(input) {
      // 只允许信任的 CDN
      const allowedDomains = ['cdn.example.com', 'cdn.jsdelivr.net'];
      const url = new URL(input, location.href);
      if (!allowedDomains.includes(url.hostname)) {
        throw new Error('Untrusted script source');
      }
      return input;
    },
  });

  // 使用策略
  const safeHTML = policy.createHTML(userContent);
  element.innerHTML = safeHTML;  // 安全赋值
}

// CSP 强制 Trusted Types
// Content-Security-Policy: require-trusted-types-for 'script';
```

## 4. 模板注入防御

```javascript
// ❌ 危险：字符串拼接模板
const template = `<div class="${userClass}">${userContent}</div>`;

// ✅ 安全：使用模板引擎或 DOM API
const div = document.createElement('div');
div.className = userClass;  // 自动处理危险值
div.textContent = userContent;  // 自动转义

// React/Vue 中避免 v-html / dangerouslySetInnerHTML
// 如果必须使用，先通过 DOMPurify 净化
```
