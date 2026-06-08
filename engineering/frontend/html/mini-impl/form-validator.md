# 手写表单验证引擎

## 目标

实现一个简化版表单验证引擎，支持：
1. 声明式规则定义
2. 自定义验证规则
3. 实时/延迟验证
4. 错误提示与无障碍支持

## 实现

```javascript
// form-validator.js

class FormValidator {
  constructor(form, options = {}) {
    this.form = typeof form === 'string' ? document.querySelector(form) : form;
    this.options = {
      validateOnBlur: true,
      validateOnInput: false,
      validateOnSubmit: true,
      focusFirstError: true,
      ...options,
    };
    this.fields = new Map();
    this.rules = new Map([
      ['required', (value) => value !== '' && value != null],
      ['email', (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)],
      ['url', (value) => /^https?:\/\/.+/.test(value)],
      ['number', (value) => !isNaN(Number(value))],
      ['integer', (value) => Number.isInteger(Number(value))],
      ['phone', (value) => /^1[3-9]\d{9}$/.test(value)],
      ['minLength', (value, len) => String(value).length >= Number(len)],
      ['maxLength', (value, len) => String(value).length <= Number(len)],
      ['min', (value, min) => Number(value) >= Number(min)],
      ['max', (value, max) => Number(value) <= Number(max)],
      ['pattern', (value, regex) => new RegExp(regex).test(value)],
      ['match', (value, targetSelector, form) => {
        const target = form.querySelector(targetSelector);
        return target ? value === target.value : false;
      }],
    ]);
    this.messages = new Map([
      ['required', '此字段为必填项'],
      ['email', '请输入有效的邮箱地址'],
      ['url', '请输入有效的网址'],
      ['number', '请输入数字'],
      ['integer', '请输入整数'],
      ['phone', '请输入有效的手机号码'],
      ['minLength', '至少需要 {param} 个字符'],
      ['maxLength', '最多 {param} 个字符'],
      ['min', '最小值为 {param}'],
      ['max', '最大值为 {param}'],
      ['pattern', '格式不正确'],
      ['match', '两次输入不一致'],
    ]);

    this.init();
  }

  init() {
    if (this.options.validateOnSubmit) {
      this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    this.scanFields();
  }

  scanFields() {
    const inputs = this.form.querySelectorAll(
      'input[data-validate], select[data-validate], textarea[data-validate], ' +
      'input[required], input[pattern], input[type="email"]'
    );

    inputs.forEach(input => {
      const fieldConfig = this.parseField(input);
      this.fields.set(input.name, fieldConfig);

      if (this.options.validateOnBlur) {
        input.addEventListener('blur', () => this.validateField(input.name));
      }

      if (this.options.validateOnInput) {
        input.addEventListener('input', () => this.validateField(input.name));
      } else {
        // 输入时清除错误
        input.addEventListener('input', () => this.clearError(input.name));
      }
    });
  }

  parseField(input) {
    const rules = [];
    const dataset = input.dataset;

    // 从 data-validate 解析规则
    if (dataset.validate) {
      dataset.validate.split('|').forEach(rule => {
        const [name, param] = rule.split(':');
        rules.push({ name: name.trim(), param: param?.trim() });
      });
    }

    // 从原生属性推断规则
    if (input.required) {
      rules.unshift({ name: 'required' });
    }
    if (input.minLength > 0) {
      rules.push({ name: 'minLength', param: input.minLength });
    }
    if (input.maxLength > 0) {
      rules.push({ name: 'maxLength', param: input.maxLength });
    }
    if (input.min) {
      rules.push({ name: 'min', param: input.min });
    }
    if (input.max) {
      rules.push({ name: 'max', param: input.max });
    }
    if (input.pattern) {
      rules.push({ name: 'pattern', param: input.pattern });
    }
    if (input.type === 'email') {
      rules.push({ name: 'email' });
    }
    if (input.type === 'url') {
      rules.push({ name: 'url' });
    }
    if (dataset.match) {
      rules.push({ name: 'match', param: dataset.match });
    }

    return {
      element: input,
      rules: this.deduplicateRules(rules),
      errorElement: this.findOrCreateErrorElement(input),
    };
  }

  deduplicateRules(rules) {
    const seen = new Set();
    return rules.filter(rule => {
      const key = rule.param ? `${rule.name}:${rule.param}` : rule.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  findOrCreateErrorElement(input) {
    const id = input.getAttribute('aria-errormessage');
    if (id) return document.getElementById(id);

    const describedBy = input.getAttribute('aria-describedby');
    if (describedBy) {
      const existing = document.getElementById(describedBy);
      if (existing?.classList.contains('error')) return existing;
    }

    // 创建错误元素
    const errorEl = document.createElement('span');
    errorEl.className = 'form-error';
    errorEl.setAttribute('role', 'alert');
    errorEl.hidden = true;
    input.parentNode.appendChild(errorEl);

    // 关联
    input.setAttribute('aria-errormessage', errorEl.id || this.generateId());
    if (!errorEl.id) errorEl.id = input.getAttribute('aria-errormessage');

    return errorEl;
  }

  generateId() {
    return `error-${Math.random().toString(36).substr(2, 9)}`;
  }

  validateField(fieldName) {
    const field = this.fields.get(fieldName);
    if (!field) return { valid: true };

    const value = field.element.value;

    for (const rule of field.rules) {
      const validator = this.rules.get(rule.name);
      if (!validator) continue;

      const isValid = validator(value, rule.param, this.form);
      if (!isValid) {
        const message = this.getErrorMessage(rule, field.element);
        this.showError(fieldName, message);
        return { valid: false, rule: rule.name, message };
      }
    }

    this.clearError(fieldName);
    return { valid: true };
  }

  validateAll() {
    const results = [];
    let allValid = true;

    for (const [name] of this.fields) {
      const result = this.validateField(name);
      results.push({ field: name, ...result });
      if (!result.valid) allValid = false;
    }

    return { valid: allValid, results };
  }

  getErrorMessage(rule, input) {
    // 自定义消息
    const customKey = `msg${rule.name.charAt(0).toUpperCase()}${rule.name.slice(1)}`;
    if (input.dataset[customKey]) return input.dataset[customKey];

    const template = this.messages.get(rule.name) || '验证失败';
    return template.replace('{param}', rule.param || '');
  }

  showError(fieldName, message) {
    const field = this.fields.get(fieldName);
    if (!field) return;

    field.element.setAttribute('aria-invalid', 'true');
    field.element.classList.add('is-invalid');

    if (field.errorElement) {
      field.errorElement.textContent = message;
      field.errorElement.hidden = false;
    }
  }

  clearError(fieldName) {
    const field = this.fields.get(fieldName);
    if (!field) return;

    field.element.setAttribute('aria-invalid', 'false');
    field.element.classList.remove('is-invalid');

    if (field.errorElement) {
      field.errorElement.textContent = '';
      field.errorElement.hidden = true;
    }
  }

  clearAllErrors() {
    for (const [name] of this.fields) {
      this.clearError(name);
    }
  }

  handleSubmit(event) {
    event.preventDefault();
    this.clearAllErrors();

    const result = this.validateAll();

    if (result.valid) {
      this.form.dispatchEvent(new CustomEvent('formvalid', {
        detail: new FormData(this.form),
      }));
    } else {
      if (this.options.focusFirstError) {
        const firstInvalid = this.form.querySelector('.is-invalid');
        firstInvalid?.focus();
      }
      this.form.dispatchEvent(new CustomEvent('forminvalid', { detail: result }));
    }

    return result;
  }

  // ========== 扩展 API ==========

  addRule(name, validator, message) {
    this.rules.set(name, validator);
    if (message) this.messages.set(name, message);
    return this;
  }

  setMessage(rule, message) {
    this.messages.set(rule, message);
    return this;
  }

  destroy() {
    this.clearAllErrors();
    this.fields.clear();
    // 移除事件监听器...（简化版省略）
  }
}

// ========== 使用示例 ==========

const validator = new FormValidator('#signup-form', {
  validateOnBlur: true,
  validateOnInput: true,
});

// 添加自定义规则
validator.addRule(
  'strongPassword',
  (value) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value),
  '密码需包含大小写字母和数字，至少8位'
);

// 监听验证结果
document.getElementById('signup-form').addEventListener('formvalid', (e) => {
  console.log('Form valid:', Object.fromEntries(e.detail));
  // 提交表单
});

document.getElementById('signup-form').addEventListener('forminvalid', (e) => {
  console.log('Validation failed:', e.detail.results);
});
```

```html
<!-- HTML -->
<form id="signup-form">
  <div class="field">
    <label for="username">用户名</label>
    <input
      type="text"
      id="username"
      name="username"
      required
      minlength="3"
      maxlength="20"
      data-validate="required|minLength:3|maxLength:20"
      data-msg-required="用户名不能为空"
    >
  </div>

  <div class="field">
    <label for="email">邮箱</label>
    <input type="email" id="email" name="email" required>
  </div>

  <div class="field">
    <label for="password">密码</label>
    <input
      type="password"
      id="password"
      name="password"
      data-validate="required|strongPassword"
    >
  </div>

  <div class="field">
    <label for="confirm">确认密码</label>
    <input
      type="password"
      id="confirm"
      name="confirm"
      data-validate="required"
      data-match="#password"
    >
  </div>

  <button type="submit">注册</button>
</form>
```

module.exports = { FormValidator };
```
