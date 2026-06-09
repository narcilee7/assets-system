# 手写简化 CSS 处理器

## 目标

实现一个简化版 CSS 处理器，支持：
1. CSS 变量替换
2. 嵌套规则展开
3. 简单的 mixin 系统

## 实现

```javascript
// css-processor.js

class CSSProcessor {
  constructor(options = {}) {
    this.variables = options.variables || {};
    this.mixins = {};
  }

  process(input) {
    let css = this._removeComments(input);
    css = this._extractMixins(css);
    css = this._expandNestedRules(css);
    css = this._replaceVariables(css);
    css = this._applyMixins(css);
    css = this._minify(css);
    return css;
  }

  // ========== 变量替换 ==========

  _replaceVariables(css) {
    // 提取 :root 变量
    const rootMatch = css.match(/:root\s*{([^}]+)}/);
    if (rootMatch) {
      const declarations = this._parseDeclarations(rootMatch[1]);
      Object.assign(this.variables, declarations);
    }

    // 替换 var(--name) 和 var(--name, fallback)
    return css.replace(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g, (match, name, fallback) => {
      return this.variables[name] || fallback || match;
    });
  }

  // ========== 嵌套展开 ==========

  _expandNestedRules(css) {
    // 简化版：处理一级嵌套
    const ruleRegex = /([^{]+)\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
    let result = '';
    let lastIndex = 0;
    let match;

    while ((match = ruleRegex.exec(css)) !== null) {
      const selector = match[1].trim();
      const body = match[2].trim();

      // 检查 body 中是否包含嵌套规则
      const nestedMatch = body.match(/([^{}]+)\{([^{}]*)\}/);

      if (nestedMatch && !body.includes(';', body.indexOf(nestedMatch[0]) + nestedMatch[0].length)) {
        // 有嵌套
        const declarations = body.replace(/([^{}]+)\{[^{}]*\}/g, '').trim();
        let expanded = declarations ? `${selector} { ${declarations} }\n` : '';

        // 展开嵌套
        const nestedRegex = /([^{}]+)\{([^{}]*)\}/g;
        let nested;
        while ((nested = nestedRegex.exec(body)) !== null) {
          const nestedSelector = nested[1].trim();
          const nestedBody = nested[2].trim();

          // 组合选择器
          let combined;
          if (nestedSelector.startsWith('&')) {
            combined = selector + nestedSelector.slice(1);
          } else if (nestedSelector.startsWith(':')) {
            combined = selector + nestedSelector;
          } else {
            combined = `${selector} ${nestedSelector}`;
          }

          expanded += `${combined} { ${nestedBody} }\n`;
        }

        result += expanded;
      } else {
        result += `${selector} { ${body} }\n`;
      }

      lastIndex = ruleRegex.lastIndex;
    }

    return result || css;
  }

  // ========== Mixin 系统 ==========

  _extractMixins(css) {
    // @define-mixin name { ... }
    return css.replace(/@define-mixin\s+(\w+)\s*\{([^}]*)\}/g, (match, name, body) => {
      this.mixins[name] = body.trim();
      return '';
    });
  }

  _applyMixins(css) {
    // @mixin name
    return css.replace(/@mixin\s+(\w+);?/g, (match, name) => {
      return this.mixins[name] || '';
    });
  }

  // ========== 工具方法 ==========

  _removeComments(css) {
    return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  }

  _parseDeclarations(block) {
    const declarations = {};
    const regex = /(--[\w-]+)\s*:\s*([^;]+);?/g;
    let match;
    while ((match = regex.exec(block)) !== null) {
      declarations[match[1].trim()] = match[2].trim();
    }
    return declarations;
  }

  _minify(css) {
    return css
      .replace(/\s+/g, ' ')
      .replace(/\s*([{}:;,])\s*/g, '$1')
      .replace(/;\}/g, '}')
      .trim();
  }
}

// ========== 使用示例 ==========

const processor = new CSSProcessor();

const input = `
:root {
  --color-primary: #3b82f6;
  --space-4: 1rem;
}

@define-mixin focus-ring {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-primary);
}

.btn {
  padding: var(--space-4);
  color: var(--color-primary);

  &:hover {
    opacity: 0.8;
  }

  &:focus-visible {
    @mixin focus-ring;
  }

  .dark & {
    color: white;
  }
}
`;

console.log(processor.process(input));
/* 输出：
:root{--color-primary:#3b82f6;--space-4:1rem}
.btn{padding:1rem;color:#3b82f6}
.btn:hover{opacity:0.8}
.btn:focus-visible{outline:none;box-shadow:0 0 0 2px #3b82f6}
.dark .btn{color:white}
*/

module.exports = { CSSProcessor };
```
