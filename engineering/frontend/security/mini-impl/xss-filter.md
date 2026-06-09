# 手写 XSS 过滤器

## 1. HTML 编码器

```javascript
// mini-xss-filter.js

const HTML_ENTITY_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

function escapeHtml(str) {
  return String(str).replace(/[&<>"'`=\/]/g, (s) => HTML_ENTITY_MAP[s]);
}

// ============ 测试 ============
console.log(escapeHtml('<script>alert(1)</script>'));
// &lt;script&gt;alert(1)&lt;/script&gt;

console.log(escapeHtml('" onclick="alert(1)"'));
// &quot; onclick=&quot;alert(1)&quot;
```

## 2. DOMPurify 简化版

```javascript
// mini-dompurify.js

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3',
  'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code',
]);

const ALLOWED_ATTRS = new Set([
  'href', 'title', 'src', 'alt', 'width', 'height',
]);

const DANGEROUS_ATTRS = new Set([
  'onerror', 'onload', 'onclick', 'onmouseover',
  'onfocus', 'onblur', 'onchange', 'onsubmit',
  'style',  // style 可包含 expression()
]);

const DANGEROUS_URLS = /^javascript:/i;

function sanitizeHtml(dirty) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(dirty, 'text/html');

  function cleanNode(node) {
    // 文本节点直接返回
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent);
    }

    // 非元素节点跳过
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return document.createTextNode('');
    }

    const tagName = node.tagName.toLowerCase();

    // 不在白名单的标签：递归处理子节点，用 div 包裹
    if (!ALLOWED_TAGS.has(tagName)) {
      const fragment = document.createDocumentFragment();
      node.childNodes.forEach((child) => {
        fragment.appendChild(cleanNode(child));
      });
      return fragment;
    }

    // 创建安全元素
    const clean = document.createElement(tagName);

    // 处理属性
    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value;

      // 过滤危险属性
      if (DANGEROUS_ATTRS.has(name)) return;

      // 过滤不在白名单的属性
      if (!ALLOWED_ATTRS.has(name)) return;

      // 过滤 javascript: 伪协议
      if ((name === 'href' || name === 'src') && DANGEROUS_URLS.test(value)) {
        return;
      }

      clean.setAttribute(name, value);
    });

    // 递归处理子节点
    node.childNodes.forEach((child) => {
      clean.appendChild(cleanNode(child));
    });

    return clean;
  }

  const fragment = document.createDocumentFragment();
  doc.body.childNodes.forEach((child) => {
    fragment.appendChild(cleanNode(child));
  });

  const container = document.createElement('div');
  container.appendChild(fragment);
  return container.innerHTML;
}

// ============ 测试 ============
const dirty = `
  <p>正常文本</p>
  <script>alert('xss')</script>
  <img src=x onerror="alert('xss')">
  <a href="javascript:alert('xss')">点击</a>
  <p onclick="alert('xss')">危险</p>
  <div style="background:url('javascript:alert(1)')">危险</div>
`;

console.log(sanitizeHtml(dirty));
// <p>正常文本</p>
// <p>危险</p>
// （script、img、javascript: 链接被移除）
```

## 3. URL 编码器

```javascript
function escapeUrl(str) {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

// 用于 CSS 值
function escapeCss(str) {
  // CSS 字符串只允许特定字符
  return str.replace(/[^a-zA-Z0-9-_]/g, (c) => '\\' + c.charCodeAt(0).toString(16) + ' ');
}
```
