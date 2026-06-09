# 手写 Design Token 系统

## 目标

实现一个简化版 Design Token 系统，支持：
1. Token 定义（层级结构）
2. 多平台输出（CSS / SCSS / JS / JSON）
3. 主题变体（light / dark）
4. Token 引用解析

## 实现

```javascript
// design-token-system.js

class DesignTokenSystem {
  constructor() {
    this.tokens = new Map();
    this.themes = new Map();
  }

  // ========== Token 注册 ==========

  define(category, name, config) {
    const key = `${category}.${name}`;
    this.tokens.set(key, {
      category,
      name,
      value: config.value,
      type: config.type || 'string',
      description: config.description,
      deprecated: config.deprecated || false,
    });
    return this;
  }

  defineTheme(name, overrides) {
    this.themes.set(name, overrides);
    return this;
  }

  // ========== Token 查询 ==========

  get(path, theme = null) {
    let token = this.tokens.get(path);
    if (!token) return null;

    // 应用主题覆盖
    if (theme && this.themes.has(theme)) {
      const overrides = this.themes.get(theme);
      if (overrides[path] !== undefined) {
        token = { ...token, value: overrides[path] };
      }
    }

    // 解析引用 {token.path}
    token.value = this._resolveReferences(token.value, theme);
    return token;
  }

  _resolveReferences(value, theme) {
    if (typeof value !== 'string') return value;

    return value.replace(/\{([\w.]+)\}/g, (match, refPath) => {
      const ref = this.get(refPath, theme);
      return ref ? ref.value : match;
    });
  }

  // ========== 批量查询 ==========

  getByCategory(category, theme = null) {
    const result = {};
    for (const [key, token] of this.tokens) {
      if (token.category === category) {
        const resolved = this.get(key, theme);
        result[token.name] = resolved.value;
      }
    }
    return result;
  }

  getAll(theme = null) {
    const result = {};
    for (const [key] of this.tokens) {
      const parts = key.split('.');
      let current = result;
      for (let i = 0; i < parts.length - 1; i++) {
        current[parts[i]] = current[parts[i]] || {};
        current = current[parts[i]];
      }
      const token = this.get(key, theme);
      current[parts[parts.length - 1]] = token.value;
    }
    return result;
  }

  // ========== 输出生成器 ==========

  toCSS(theme = null) {
    const lines = [':root {'];

    for (const [key, token] of this.tokens) {
      if (token.deprecated) continue;
      const resolved = this.get(key, theme);
      const varName = `--${key.replace(/\./g, '-')}`;
      lines.push(`  ${varName}: ${resolved.value};`);
    }

    lines.push('}');

    // 主题变体
    for (const [themeName] of this.themes) {
      lines.push(`\n[data-theme="${themeName}"] {`);
      for (const [key, token] of this.tokens) {
        if (token.deprecated) continue;
        const resolved = this.get(key, themeName);
        if (resolved.value !== token.value) {
          const varName = `--${key.replace(/\./g, '-')}`;
          lines.push(`  ${varName}: ${resolved.value};`);
        }
      }
      lines.push('}');
    }

    return lines.join('\n');
  }

  toSCSS(theme = null) {
    const lines = [];

    for (const [key, token] of this.tokens) {
      if (token.deprecated) continue;
      const resolved = this.get(key, theme);
      const varName = `$${key.replace(/\./g, '-')}`;
      lines.push(`${varName}: ${resolved.value};`);
    }

    return lines.join('\n');
  }

  toJS(theme = null) {
    const exports = [];

    for (const [key, token] of this.tokens) {
      if (token.deprecated) continue;
      const resolved = this.get(key, theme);
      const constName = this._toCamelCase(key.replace(/\./g, '-'));
      exports.push(`export const ${constName} = '${resolved.value}';`);
    }

    return exports.join('\n');
  }

  toJSON(theme = null) {
    return JSON.stringify(this.getAll(theme), null, 2);
  }

  _toCamelCase(str) {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()).replace(/\./g, '');
  }
}

// ========== 使用示例 ==========

const tokens = new DesignTokenSystem();

// 定义基础 Token
tokens
  .define('color', 'blue-50', { value: '#eff6ff', type: 'color' })
  .define('color', 'blue-500', { value: '#3b82f6', type: 'color' })
  .define('color', 'blue-900', { value: '#1e3a8a', type: 'color' })
  .define('color', 'gray-50', { value: '#f9fafb', type: 'color' })
  .define('color', 'gray-900', { value: '#111827', type: 'color' })

  // 语义化 Token（引用基础 Token）
  .define('semantic', 'text-primary', { value: '{color.gray-900}', type: 'color' })
  .define('semantic', 'surface', { value: '#ffffff', type: 'color' })
  .define('semantic', 'brand', { value: '{color.blue-500}', type: 'color' })

  // 间距
  .define('space', '1', { value: '0.25rem', type: 'dimension' })
  .define('space', '4', { value: '1rem', type: 'dimension' })
  .define('space', '8', { value: '2rem', type: 'dimension' })

  // 字体
  .define('font', 'sans', { value: 'system-ui, -apple-system, sans-serif', type: 'fontFamily' })
  .define('font', 'base', { value: '1rem', type: 'fontSize' });

// 定义暗色主题
tokens.defineTheme('dark', {
  'semantic.text-primary': '#f9fafb',
  'semantic.surface': '#111827',
});

// 输出
console.log('=== CSS ===');
console.log(tokens.toCSS());

console.log('\n=== JS ===');
console.log(tokens.toJS());

console.log('\n=== JSON ===');
console.log(tokens.toJSON());

// 查询
console.log('\n=== 查询 ===');
console.log(tokens.get('semantic.text-primary'));           // light
console.log(tokens.get('semantic.text-primary', 'dark'));   // dark

module.exports = { DesignTokenSystem };
```
