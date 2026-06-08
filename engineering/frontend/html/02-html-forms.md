# 表单工程化

## 1. 表单结构

```html
<form action="/submit" method="POST" novalidate>
  <fieldset>
    <legend>个人信息</legend>

    <div class="form-field">
      <label for="full-name">
        姓名 <span aria-label="required">*</span>
      </label>
      <input
        type="text"
        id="full-name"
        name="fullName"
        required
        minlength="2"
        maxlength="50"
        autocomplete="name"
        aria-describedby="full-name-hint"
        aria-invalid="false"
        aria-errormessage="full-name-error"
      >
      <span id="full-name-hint" class="hint">请输入真实姓名</span>
      <span id="full-name-error" class="error" role="alert" hidden></span>
    </div>

    <div class="form-field">
      <label for="email">邮箱</label>
      <input
        type="email"
        id="email"
        name="email"
        required
        autocomplete="email"
        inputmode="email"
        pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
      >
    </div>

    <div class="form-field">
      <label for="phone">电话</label>
      <input
        type="tel"
        id="phone"
        name="phone"
        autocomplete="tel"
        inputmode="tel"
        pattern="1[3-9]\d{9}"
        placeholder="13800138000"
      >
    </div>
  </fieldset>

  <fieldset>
    <legend>偏好设置</legend>

    <div class="form-field" role="group" aria-labelledby="notification-label">
      <p id="notification-label">通知方式</p>
      <label>
        <input type="checkbox" name="notifications" value="email" checked>
        邮件通知
      </label>
      <label>
        <input type="checkbox" name="notifications" value="sms">
        短信通知
      </label>
      <label>
        <input type="checkbox" name="notifications" value="push">
        推送通知
      </label>
    </div>

    <div class="form-field">
      <label for="theme">主题</label>
      <select id="theme" name="theme" required>
        <option value="" disabled selected>请选择</option>
        <option value="light">浅色</option>
        <option value="dark">深色</option>
        <option value="system">跟随系统</option>
      </select>
    </div>
  </fieldset>

  <div class="form-actions">
    <button type="submit" class="btn btn-primary">
      <span class="btn-text">提交</span>
      <span class="btn-loader" hidden>加载中...</span>
    </button>
    <button type="reset" class="btn btn-secondary">重置</button>
  </div>
</form>
```

## 2. 验证策略

```javascript
// 渐进增强验证
class FormValidator {
  constructor(form) {
    this.form = form;
    this.fields = new Map();
    this.init();
  }

  init() {
    this.form.setAttribute('novalidate', '');
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));

    for (const field of this.form.querySelectorAll('input, select, textarea')) {
      this.fields.set(field.name, {
        element: field,
        rules: this.parseRules(field),
        errorElement: this.getErrorElement(field),
      });

      field.addEventListener('blur', () => this.validateField(field));
      field.addEventListener('input', () => this.clearError(field));
    }
  }

  parseRules(field) {
    const rules = [];
    if (field.required) rules.push('required');
    if (field.minLength > 0) rules.push(`minLength:${field.minLength}`);
    if (field.maxLength > 0) rules.push(`maxLength:${field.maxLength}`);
    if (field.pattern) rules.push(`pattern:${field.pattern}`);
    if (field.type === 'email') rules.push('email');
    if (field.dataset.validate) {
      rules.push(...field.dataset.validate.split(','));
    }
    return rules;
  }

  validateField(field) {
    const config = this.fields.get(field.name);
    if (!config) return true;

    const value = field.value.trim();
    let error = null;

    for (const rule of config.rules) {
      error = this.checkRule(rule, value, field);
      if (error) break;
    }

    if (error) {
      this.showError(field, error);
      return false;
    } else {
      this.clearError(field);
      return true;
    }
  }

  checkRule(rule, value, field) {
    const [ruleName, param] = rule.split(':');

    switch (ruleName) {
      case 'required':
        return value === '' ? '此字段为必填项' : null;
      case 'minLength':
        return value.length < parseInt(param) ? `至少需要 ${param} 个字符` : null;
      case 'maxLength':
        return value.length > parseInt(param) ? `最多 ${param} 个字符` : null;
      case 'pattern':
        return !new RegExp(param).test(value) ? '格式不正确' : null;
      case 'email':
        return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? '请输入有效的邮箱地址' : null;
      case 'phone':
        return !/^1[3-9]\d{9}$/.test(value) ? '请输入有效的手机号码' : null;
      case 'match':
        const target = this.form.querySelector(`[name="${param}"]`);
        return value !== target?.value ? '两次输入不一致' : null;
      default:
        return null;
    }
  }

  showError(field, message) {
    const config = this.fields.get(field.name);
    field.setAttribute('aria-invalid', 'true');
    if (config.errorElement) {
      config.errorElement.textContent = message;
      config.errorElement.hidden = false;
    }
    field.closest('.form-field')?.classList.add('has-error');
  }

  clearError(field) {
    const config = this.fields.get(field.name);
    field.setAttribute('aria-invalid', 'false');
    if (config.errorElement) {
      config.errorElement.textContent = '';
      config.errorElement.hidden = true;
    }
    field.closest('.form-field')?.classList.remove('has-error');
  }

  handleSubmit(event) {
    event.preventDefault();
    let isValid = true;

    for (const [name, config] of this.fields) {
      if (!this.validateField(config.element)) {
        isValid = false;
      }
    }

    if (isValid) {
      this.submitForm();
    } else {
      // 聚焦第一个错误字段
      const firstError = this.form.querySelector('[aria-invalid="true"]');
      firstError?.focus();
    }
  }

  async submitForm() {
    const submitBtn = this.form.querySelector('[type="submit"]');
    submitBtn.disabled = true;

    try {
      const response = await fetch(this.form.action, {
        method: this.form.method,
        body: new FormData(this.form),
      });

      if (response.ok) {
        this.form.dispatchEvent(new CustomEvent('formsuccess', { 
          detail: await response.json() 
        }));
      } else {
        throw new Error('Submit failed');
      }
    } catch (error) {
      this.form.dispatchEvent(new CustomEvent('formerror', { detail: error }));
    } finally {
      submitBtn.disabled = false;
    }
  }
}

// 使用
new FormValidator(document.getElementById('my-form'));
```

## 3. 文件上传

```html
<div class="upload-zone">
  <label for="file-input" class="upload-label">
    <input
      type="file"
      id="file-input"
      name="files"
      multiple
      accept=".jpg,.png,.pdf"
      aria-describedby="file-hint"
    >
    <span>拖放文件到此处，或点击选择</span>
    <span id="file-hint" class="hint">支持 JPG、PNG、PDF，单个文件不超过 10MB</span>
  </label>

  <ul class="file-list" role="list" aria-label="已选择的文件">
    <!-- 动态生成 -->
  </ul>

  <div class="upload-progress" role="progressbar" aria-valuenow="0" aria-valuemax="100" hidden>
    <div class="progress-bar" style="width: 0%"></div>
    <span class="progress-text">0%</span>
  </div>
</div>
```

```javascript
// 文件上传处理
class FileUploader {
  constructor(input, options = {}) {
    this.input = input;
    this.maxSize = options.maxSize || 10 * 1024 * 1024;
    this.maxFiles = options.maxFiles || 5;
    this.acceptedTypes = options.acceptedTypes || [];
    this.files = [];
    this.init();
  }

  init() {
    this.input.addEventListener('change', (e) => this.handleFiles(e.target.files));

    // 拖放
    const zone = this.input.closest('.upload-zone');
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('is-dragover');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-dragover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('is-dragover');
      this.handleFiles(e.dataTransfer.files);
    });
  }

  validate(file) {
    if (file.size > this.maxSize) {
      return `文件 ${file.name} 超过 ${this.formatSize(this.maxSize)} 限制`;
    }
    if (this.acceptedTypes.length && !this.acceptedTypes.includes(file.type)) {
      return `文件 ${file.name} 格式不支持`;
    }
    return null;
  }

  async handleFiles(fileList) {
    const newFiles = Array.from(fileList);

    if (this.files.length + newFiles.length > this.maxFiles) {
      this.showError(`最多上传 ${this.maxFiles} 个文件`);
      return;
    }

    for (const file of newFiles) {
      const error = this.validate(file);
      if (error) {
        this.showError(error);
        continue;
      }
      this.files.push(file);
      this.renderFile(file);
    }
  }

  async upload() {
    const formData = new FormData();
    this.files.forEach((f, i) => formData.append(`file${i}`, f));

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        this.updateProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        this.onSuccess(JSON.parse(xhr.response));
      } else {
        this.onError(new Error('Upload failed'));
      }
    });

    xhr.open('POST', '/upload');
    xhr.send(formData);
  }

  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit++;
    }
    return `${size.toFixed(1)} ${units[unit]}`;
  }
}
```
