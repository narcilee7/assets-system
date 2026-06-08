// 表单状态管理器

// ===================== 类型定义 =====================

type FieldValue = string | number | boolean | null | undefined;

interface ValidationRule {
  validate: (value: FieldValue, values: Record<string, any>) => boolean | Promise<boolean>;
  message: string;
}

interface FieldConfig {
  initialValue?: FieldValue;
  rules?: ValidationRule[];
  asyncRules?: Array<(value: FieldValue) => Promise<{ valid: boolean; message: string }>>;
}

interface FormState {
  values: Record<string, FieldValue>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  dirty: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
}

// ===================== FormManager 实现 =====================

class FormManager<T extends Record<string, FieldValue>> {
  private fields: Map<string, FieldConfig> = new Map();
  private state: FormState = {
    values: {} as T,
    errors: {},
    touched: {},
    dirty: {},
    isSubmitting: false,
    isValid: true,
  };
  private listeners: Set<(state: FormState) => void> = new Set();

  // TODO: registerField - 注册字段及其配置
  registerField(name: string, config: FieldConfig): void {
    // TODO:
    // 1. 保存 field config
    // 2. 初始化 state 中的值、error、touched、dirty
    // this.fields.set(name, config);
    // this.state.values[name] = config.initialValue;
  }

  // TODO: unregisterField - 注销字段
  unregisterField(name: string): void {
    // TODO: 从 fields 和 state 中移除
  }

  // TODO: setValue - 更新字段值
  setValue(name: string, value: FieldValue): void {
    // TODO:
    // 1. 更新 values
    // 2. 标记 dirty（如果与初始值不同）
    // 3. 触发验证（可选）
    // 4. 通知 listeners
  }

  // TODO: getValue - 获取字段值
  getValue(name: string): FieldValue {
    return this.state.values[name];
  }

  // TODO: validateField - 验证单个字段
  async validateField(name: string): Promise<string | null> {
    // TODO:
    // 1. 获取字段配置和当前值
    // 2. 同步验证：遍历 rules，返回第一个失败的消息
    // 3. 异步验证：遍历 asyncRules，收集结果
    // 4. 更新 errors[name]
    // 5. 返回错误消息或 null
    return null;
  }

  // TODO: validateAll - 验证全部字段
  async validateAll(): Promise<boolean> {
    // TODO:
    // 1. 遍历所有已注册字段
    // 2. 收集所有错误
    // 3. 更新 isValid 状态
    // 4. 返回是否全部通过
    return true;
  }

  // TODO: handleSubmit - 处理表单提交
  async handleSubmit(
    onSubmit: (values: T) => void | Promise<void>
  ): Promise<void> {
    // TODO:
    // 1. preventDefault（如果在浏览器环境）
    // 2. 标记所有字段为 touched
    // 3. 调用 validateAll()
    // 4. 如果验证失败，返回
    // 5. 设置 isSubmitting = true
    // 6. 调用 onSubmit(values)
    // 7. 成功后重置或保留状态
    // 8. 无论成功失败都要 finally 设置 isSubmitting = false
  }

  // TODO: reset - 重置表单
  reset(): void {
    // TODO:
    // 1. 清空 values（回到初始值）
    // 2. 清空 errors、touched、dirty
    // 3. 通知 listeners
  }

  // TODO: getState - 获取完整状态
  getState(): FormState {
    return { ...this.state };
  }

  // TODO: subscribe - 订阅状态变化
  subscribe(listener: (state: FormState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.getState()));
  }
}

// ===================== 验证规则工厂 =====================

// TODO: 实现常用验证规则工厂
const required = (message = "This field is required"): ValidationRule => ({
  validate: (value) => value !== null && value !== undefined && value !== "",
  message,
});

const minLength = (min: number, message?: string): ValidationRule => ({
  validate: (value) =>
    typeof value === "string" && value.length >= min,
  message: message || `Minimum length is ${min}`,
});

const maxLength = (max: number, message?: string): ValidationRule => ({
  validate: (value) =>
    typeof value === "string" && value.length <= max,
  message: message || `Maximum length is ${max}`,
});

const pattern = (regex: RegExp, message = "Invalid format"): ValidationRule => ({
  validate: (value) => typeof value === "string" && regex.test(value),
  message,
});

const email = (message = "Invalid email address"): ValidationRule =>
  pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, message);

// ===================== 测试代码 =====================

async function testFormManager() {
  console.log("\n=== Form Manager Tests ===");

  const form = new FormManager<any>();

  // Test 1: 字段注册
  console.log("\nTest 1 - Field registration:");
  form.registerField("username", {
    initialValue: "",
    rules: [required(), minLength(3)],
  });
  form.registerField("email", {
    initialValue: "",
    rules: [required(), email()],
  });
  form.registerField("age", {
    initialValue: 0,
    rules: [],
  });
  console.log(`  Registered fields: username, email, age`);
  console.assert(form.getValue("username") === "", "Username should be empty string");
  console.log("  ✅ Field registration works");

  // Test 2: setValue 和 dirty 状态
  console.log("\nTest 2 - setValue and dirty:");
  form.setValue("username", "john");
  console.log(`  username = "${form.getValue("username")}"`);
  console.assert(form.getValue("username") === "john", "Username should be john");
  console.log("  ✅ setValue works");

  // Test 3: validateField
  console.log("\nTest 3 - Field validation:");
  const usernameError = await form.validateField("username");
  console.log(`  username error: ${usernameError || "none"}`);
  console.assert(usernameError === null, "username should be valid");

  form.setValue("username", "ab"); // 太短
  const shortError = await form.validateField("username");
  console.log(`  username error after short value: ${shortError}`);
  console.assert(shortError !== null, "username should be invalid");
  console.log("  ✅ Field validation works");

  // Test 4: validateAll
  console.log("\nTest 4 - Form validation:");
  form.setValue("email", "not-an-email");
  const isValid = await form.validateAll();
  console.log(`  form isValid: ${isValid}`);
  console.assert(isValid === false, "Form should be invalid");
  console.log("  ✅ Form validation works");

  // Test 5: reset
  console.log("\nTest 5 - Reset:");
  form.reset();
  console.log(`  username after reset: "${form.getValue("username")}"`);
  console.assert(form.getValue("username") === "", "Username should be reset to initial");
  console.log("  ✅ Reset works");

  // Test 6: 订阅状态变化
  console.log("\nTest 6 - State subscription:");
  let notifyCount = 0;
  const unsub = form.subscribe((state) => {
    notifyCount++;
  });
  form.setValue("username", "alice");
  console.log(`  Notified ${notifyCount} time(s) after setValue`);
  console.assert(notifyCount > 0, "Should notify listeners");
  unsub();
  console.log("  ✅ Subscription works");

  console.log("\n✅ Form Manager tests passed");
}

async function testValidationRules() {
  console.log("\n=== Validation Rules Tests ===");

  // Test required
  console.log("Test required rule:");
  console.assert(required().validate("hello") === true, "should pass non-empty");
  console.assert(required().validate("") === false, "should fail empty string");
  console.assert(required().validate(null) === false, "should fail null");
  console.assert(required().validate(undefined) === false, "should fail undefined");
  console.log("  ✅ required works");

  // Test minLength
  console.log("\nTest minLength rule:");
  console.assert(minLength(3).validate("ab") === false, "should fail too short");
  console.assert(minLength(3).validate("abc") === true, "should pass exact length");
  console.assert(minLength(3).validate("abcd") === true, "should pass longer");
  console.log("  ✅ minLength works");

  // Test email
  console.log("\nTest email rule:");
  console.assert(email().validate("test@example.com") === true, "should pass valid email");
  console.assert(email().validate("invalid") === false, "should fail invalid email");
  console.log("  ✅ email works");

  console.log("\n✅ Validation Rules tests passed");
}

async function main() {
  console.log("Running Form Manager skeleton tests...\n");

  let passed = 0;
  let failed = 0;

  try {
    await testFormManager();
    passed++;
  } catch (e: any) {
    failed++;
    console.error(`❌ Form Manager test failed: ${e.message}`);
  }

  try {
    await testValidationRules();
    passed++;
  } catch (e: any) {
    failed++;
    console.error(`❌ Validation Rules test failed: ${e.message}`);
  }

  console.log(`\n${"=".repeat(50)}`);
  if (failed === 0) {
    console.log(`✅ ALL TESTS PASSED (${passed}/${passed})`);
  } else {
    console.log(`❌ ${failed} test(s) failed, ${passed} passed`);
    process.exit(1);
  }
}

main();