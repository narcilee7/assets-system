class FormValidator {
  constructor(form, ops = {}) {
    this.form = typeof form === "string" ? document.querySelector(form) : form;
    this.ops = {
      validateOnBlur: true,
      validateOnInput: true,
      validateOnSubmit: true,
      focusFirstError: true,
      ...ops,
    };
    this.fields = new Map();
    this.rules = new Map([
      ["required", (value) => value !== "" && value != null],
      ["email", (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)],
      ["url", (value) => /^https?:\/\/.+/.test(value)],
      ["number", (value) => !isNaN(Number(value))],
      ["integer", (value) => Number.isInteger(Number(value))],
      ["phone", (value) => /^1[3-9]\d{9}$/.test(value)],
      ["minLength", (value, len) => String(value).length >= Number(len)],
      ["maxLength", (value, len) => String(value).length <= Number(len)],
      ["min", (value, min) => Number(value) >= Number(min)],
      ["max", (value, max) => Number(value) <= Number(max)],
      ["pattern", (value, regex) => new RegExp(regex).test(value)],
      [
        "match",
        (value, targetSelector, form) => {
          const target = form.querySelector(targetSelector);
          return target ? value === target.value : false;
        },
      ],
    ]);
    this.messages = new Map([
      ["required", "此字段为必填项"],
      ["email", "请输入有效的邮箱地址"],
      ["url", "请输入有效的网址"],
      ["number", "请输入数字"],
      ["integer", "请输入整数"],
      ["phone", "请输入有效的手机号码"],
      ["minLength", "至少需要 {param} 个字符"],
      ["maxLength", "最多 {param} 个字符"],
      ["min", "最小值为 {param}"],
      ["max", "最大值为 {param}"],
      ["pattern", "格式不正确"],
      ["match", "两次输入不一致"],
    ]);
  }

  init() {
    if (this.ops.validateOnSubmit) {
      this.form.addEventListener("submit", (e) => this.handleSubmit(e));
    }
  }

  scanFields() {
    const inputs = this.form.querySelectorAll(
      "input[data-validate], select[data-validate], textarea[data-validate], " +
        'input[required], input[pattern], input[type="email"], input[type="url"]',
    );

    inputs.forEach((input) => {
      const fieldConfig = this.parseField(input);
      this.fields.set(input.name, fieldConfig);

      if (this.ops.validateOnBlur) {
        input.addEventListener("blur", () => this.validateField(input));
      }
    });
  }
}
