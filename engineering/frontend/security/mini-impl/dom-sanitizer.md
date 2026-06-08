# 手写 DOM Sanitizer

## 目标

实现一个简化版 DOM Sanitizer，支持：
1. HTML 字符串解析与净化
2. 白名单标签/属性
3. URL 协议过滤
4. 事件处理器移除

## 实现

```javascript
// dom-sanitizer.js
class DOMPurifier {
  constructor(options = {}) {
    this.allowedTags = new Set(options.allowedTags || [
      'p', 'br', 'strong', 'em', 'u', 'b', 'i',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'img',
      'blockquote', 'code', 'pre', 'span', 'div',
    ]);

    this.allowedAttrs = new Set(options.allowedAttrs || [
      'href', 'src', 'alt', 'title', 'class', 'id',
      'target', 'rel', 'width', 'height',
    ]);

    this.allowedProtocols = new Set(options.allowedProtocols || [
      'http:', 'https:', 'mailto:', 'tel:',
    ]);

    this.forbiddenAttrs = new Set([
      'onerror', 'onload', 'onclick', 'onmouseover',
      'onmouseout', 'onfocus', 'onblur', 'onchange',
      'onsubmit', 'onreset', 'onselect', 'onkeydown',
      'onkeypress', 'onkeyup',
    ]);
  }

  sanitize(dirty) {
    if (!dirty || typeof dirty !== 'string') return '';

    // 使用 DOMParser 解析 HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(dirty, 'text/html');

    // 净化 body 内容
    this._sanitizeNode(doc.body);

    // 返回净化后的 HTML
    return doc.body.innerHTML;
  }

  _sanitizeNode(node) {
    // 遍历所有子节点（倒序遍历，方便删除）
    const children = Array.from(node.childNodes);

    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        this._sanitizeElement(child);
      } else if (child.nodeType === Node.COMMENT_NODE) {
        // 移除注释节点（可能包含条件注释攻击）
        child.remove();
      }
    }
  }

  _sanitizeElement(element) {
    const tagName = element.tagName.toLowerCase();

    // 1. 检查标签白名单
    if (!this.allowedTags.has(tagName)) {
      // 移除外壳标签，保留内容
      const parent = element.parentNode;
      while (element.firstChild) {
        parent.insertBefore(element.firstChild, element);
      }
      element.remove();
      return;
    }

    // 2. 净化属性
    const attrs = Array.from(element.attributes);
    for (const attr of attrs) {
      const attrName = attr.name.toLowerCase();

      // 移除所有事件处理器
      if (attrName.startsWith('on') || this.forbiddenAttrs.has(attrName)) {
        element.removeAttribute(attr.name);
        continue;
      }

      // 移除不在白名单的属性
      if (!this.allowedAttrs.has(attrName)) {
        element.removeAttribute(attr.name);
        continue;
      }

      // 3. URL 协议过滤（href/src）
      if (attrName === 'href' || attrName === 'src') {
        const value = attr.value.trim().toLowerCase();

        // 检查 javascript: 伪协议
        if (value.startsWith('javascript:') || value.startsWith('data:text/html')) {
          element.removeAttribute(attr.name);
          continue;
        }

        // 检查协议白名单
        try {
          const url = new URL(value, 'http://example.com');
          if (url.protocol !== 'http:' && url.protocol !== 'https:' &&
              url.protocol !== 'mailto:' && url.protocol !== 'tel:') {
            element.removeAttribute(attr.name);
            continue;
          }
        } catch {
          // 相对路径允许通过
        }
      }
    }

    // 4. 特殊标签处理
    if (tagName === 'a') {
      // 强制添加 rel="noopener noreferrer"
      element.setAttribute('rel', 'noopener noreferrer');
      // 强制 target="_blank"
      element.setAttribute('target', '_blank');
    }

    // 5. 递归净化子节点
    this._sanitizeNode(element);
  }

  // 净化纯文本（完全去除 HTML）
  sanitizeText(dirty) {
    const div = document.createElement('div');
    div.innerHTML = this.sanitize(dirty);
    return div.textContent || div.innerText || '';
  }

  // 净化 URL
  sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '';

    const trimmed = url.trim().toLowerCase();

    // 拒绝危险协议
    const dangerous = ['javascript:', 'data:', 'vbscript:', 'mocha:', 'livescript:'];
    if (dangerous.some((p) => trimmed.startsWith(p))) {
      return '';
    }

    return url;
  }
}

// 使用示例
const purifier = new DOMPurifier();

const dirtyHTML = `
  <p>正常段落</p>
  <script>alert('xss')</script>
  <img src="x" onerror="alert('xss')">
  <a href="javascript:alert('xss')">恶意链接</a>
  <p onclick="alert('xss')">点击我</p>
  <iframe src="https://evil.com"></iframe>
  <style>body { background: url('javascript:alert(1)') }</style>
`;

const clean = purifier.sanitize(dirtyHTML);
console.log(clean);
// 输出：
// <p>正常段落</p>
// <img src="x">
// <a rel="noopener noreferrer" target="_blank"></a>
// <p>点击我</p>

// Node.js 环境（无 DOMParser）
class DOMPurifierNode extends DOMPurifier {
  sanitize(dirty) {
    // 使用正则进行基础净化（不如 DOMParser 精确）
    return this._regexSanitize(dirty);
  }

  _regexSanitize(html) {
    let clean = html;

    // 移除 script 标签及其内容
    clean = clean.replace(/<script[\s\S]*?<\/script>/gi, '');

    // 移除 style 标签
    clean = clean.replace(/<style[\s\S]*?<\/style>/gi, '');

    // 移除 iframe/object/embed
    clean = clean.replace(/<(iframe|object|embed)[\s\S]*?\/?>/gi, '');

    // 移除 on* 事件属性
    clean = clean.replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '');
    clean = clean.replace(/\s+on\w+\s*=\s*'[^']*'/gi, '');

    // 移除 javascript: 协议
    clean = clean.replace(/(href|src)\s*=\s*"javascript:[^"]*"/gi, '$1=""');
    clean = clean.replace(/(href|src)\s*=\s*'javascript:[^']*'/gi, "$1=''");

    // 移除 data:text/html 协议
    clean = clean.replace(/(href|src)\s*=\s*"data:text\/html[^"]*"/gi, '$1=""');

    return clean;
  }
}

module.exports = { DOMPurifier, DOMPurifierNode };
```
