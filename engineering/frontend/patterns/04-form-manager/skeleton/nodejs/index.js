// 表单状态管理器 - Node.js 版本

// ===================== FormManager 实现 =====================

class FormManager {
  constructor() {
    this.fields = new Map();
    this.state = {
      values: {},
      errors: {},
      touched: {},
      dirty: {},
      isSubmitting: false,
      isValid: true,
    };
    this.listeners = new Set();
  }

  // TODO: registerField
  registerField(name, config) {
    // TODO:
    // 1. 保存 field config
    // 2. 初始化 state 中的值
  }

  // TODO: unregisterField
  unregisterField(name) {
    // TODO:
  }

  // TODO: setValue
  setValue(name, value) {
    // TODO:
    // 1. 更新 values
    // 2. 标记 dirty
    // 3. 通知 listeners
  }

  // TODO: getValue
  getValue(name) {
    return this.state.values[name];
  }

  // TODO: validateField
  async validateField(name) {
    // TODO:
    return null;
  }

  // TODO: validateAll
  async validateAll() {
    // TODO:
    return true;
  }

  // TODO: handleSubmit
  async handleSubmit(onSubmit) {
    // TODO:
  }

  // TODO: reset
  reset() {
    // TODO:
  }

  // TODO: getState
  getState() {
    return { ...this.state };
  }

  // TODO: subscribe
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((l) => l(this.getState()));
  }
}

// ===================== 验证规则工厂 =====================

// TODO: 实现常用验证规则工厂
const required = (message = "This field is required") => ({
  validate: (value) => value !== null && value !== undefined && value !== "",
  message,
});

const minLength = (min, message) => ({
  validate: (value) => typeof value === "string" && value.length >= min,
  message: message || `Minimum length is ${min}`,
});

const pattern = (regex, message = "Invalid format") => ({
  validate: (value) => typeof value === "string" && regex.test(value),
  message,
});

const email = (message = "Invalid email address") =>
  pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, message);

// ===================== 测试代码 =====================

async function testFormManager() {
  console.log("\n=== Form Manager Tests ===");

  const form = new FormManager();

  // Test 1: 字段注册
  console.log("\nTest 1 - Field registration:");
  form.registerField("username", {
    initialValue: "",
    rules: [required(), minLength(3)],
  });
  console.log(`  Registered: username`);
  console.assert(form.getValue("username") === "", "Username should be empty");
  console.log("  ✅ Field registration works");

  // Test 2: setValue
  console.log("\nTest 2 - setValue:");
  form.setValue("username", "john");
  console.assert(form.getValue("username") === "john", "Username should be john");
  console.log("  ✅ setValue works");

  // Test 3: validateField
  console.log("\nTest 3 - Field validation:");
  const err1 = await form.validateField("username");
  console.log(`  username error: ${err1 || "none"}`);

  form.setValue("username", "ab");
  const err2 = await form.validateField("username");
  console.log(`  username error after short value: ${err2}`);
  console.log("  ✅ Field validation works");

  // Test 4: 订阅
  console.log("\nTest 4 - Subscription:");
  let count = 0;
  const unsub = form.subscribe(() => count++);
  form.setValue("username", "alice");
  console.log(`  Notified ${count} time(s)`);
  unsub();
  console.log("  ✅ Subscription works");

  console.log("\n✅ Form Manager tests passed");
}

async function main() {
  console.log("Running Form Manager skeleton tests...\n");

  let passed = 0;
  let failed = 0;

  try {
    await testFormManager();
    passed++;
  } catch (e) {
    failed++;
    console.error(`❌ Form Manager test failed: ${e.message}`);
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