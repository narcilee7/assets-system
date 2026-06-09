# 手写流式 SSR 渲染器

## 目标

实现一个简化版流式 SSR 渲染器，支持：
1. 同步渲染 Shell（外壳）
2. 异步组件 Suspend + fallback
3. 流式传输实际内容替换 fallback
4. 客户端恢复交互

## 实现

```javascript
// streaming-renderer.js
const { Writable } = require('stream');

class StreamingRenderer {
  constructor(options = {}) {
    this.bootstrapScript = options.bootstrapScript || '/main.js';
    this.suspenseId = 0;
    this.pendingPromises = new Map();
  }

  // 渲染入口
  async renderToStream(component) {
    const stream = new WritableStream();
    const suspenseBoundaries = new Map();

    // 第一步：渲染 Shell（同步部分）
    const shell = this._renderShell(component, suspenseBoundaries);

    // 写入 HTML 开头
    stream.write('<!DOCTYPE html><html><head>');
    stream.write(`<script src="${this.bootstrapScript}" defer></script>`);
    stream.write('</head><body>');

    // 写入 Shell 内容（包含 fallback）
    stream.write(shell.html);

    // 等待所有异步边界 resolve
    const pending = Array.from(suspenseBoundaries.values());
    if (pending.length > 0) {
      stream.write('<script>window.__SUSPENSE__ = {};</script>');

      // 逐个处理
      for (const boundary of pending) {
        try {
          const content = await boundary.promise;
          const replacement = this._generateReplacement(boundary.id, content);
          stream.write(replacement);
        } catch (error) {
          const errorHtml = this._generateErrorReplacement(boundary.id, error);
          stream.write(errorHtml);
        }
      }
    }

    // 结束 HTML
    stream.write('</body></html>');
    stream.end();

    return stream;
  }

  _renderShell(component, suspenseBoundaries) {
    let html = '';

    // 简化版：递归渲染组件树
    const render = (node) => {
      if (typeof node === 'string' || typeof node === 'number') {
        return this._escapeHtml(String(node));
      }

      if (!node || !node.type) return '';

      // Suspense 边界
      if (node.type === 'Suspense') {
        const id = ++this.suspenseId;
        const fallback = render(node.props.fallback);

        // 记录异步边界
        if (node.props.children?.promise) {
          suspenseBoundaries.set(id, {
            id,
            promise: node.props.children.promise,
            fallback,
          });
        }

        // 输出 fallback 占位
        return `<div id="S:${id}">${fallback}</div>`;
      }

      // 普通组件
      const tag = node.type;
      const props = node.props || {};
      const children = props.children;

      let attrs = '';
      for (const [key, value] of Object.entries(props)) {
        if (key === 'children') continue;
        if (value === true) {
          attrs += ` ${key}`;
        } else if (value !== false && value != null) {
          attrs += ` ${key}="${this._escapeAttr(String(value))}"`;
        }
      }

      const childrenHtml = Array.isArray(children)
        ? children.map(render).join('')
        : render(children);

      return `<${tag}${attrs}>${childrenHtml}</${tag}>`;
    };

    html = render(component);
    return { html, suspenseBoundaries };
  }

  _generateReplacement(id, content) {
    const escaped = this._escapeScript(content);
    return `
      <template id="U:${id}">${content}</template>
      <script>
        (function() {
          var fallback = document.getElementById('S:${id}');
          var template = document.getElementById('U:${id}');
          if (fallback && template) {
            var div = document.createElement('div');
            div.innerHTML = template.innerHTML;
            fallback.replaceWith(div.firstElementChild || div);
            template.remove();
          }
        })();
      </script>
    `;
  }

  _generateErrorReplacement(id, error) {
    return `
      <script>
        (function() {
          var el = document.getElementById('S:${id}');
          if (el) el.innerHTML = '<div style="color:red">Error: ${this._escapeHtml(error.message)}</div>';
        })();
      </script>
    `;
  }

  _escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  _escapeAttr(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;');
  }

  _escapeScript(str) {
    return str
      .replace(/<\/script>/gi, '<\\/script>');
  }
}

// 使用示例
const renderer = new StreamingRenderer({
  bootstrapScript: '/app.js',
});

// 模拟异步数据
function fetchData() {
  return new Promise((resolve) => {
    setTimeout(() => resolve('<div class="content">Loaded Data!</div>'), 1000);
  });
}

// 模拟组件树
const app = {
  type: 'div',
  props: {
    children: [
      { type: 'h1', props: { children: 'Hello' } },
      {
        type: 'Suspense',
        props: {
          fallback: { type: 'div', props: { children: 'Loading...' } },
          children: { promise: fetchData() },
        },
      },
    ],
  },
};

// Express 路由
app.get('/', async (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Transfer-Encoding', 'chunked');

  const stream = await renderer.renderToStream(app);
  stream.pipe(res);
});
```
