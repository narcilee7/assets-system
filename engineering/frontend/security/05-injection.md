# 注入攻击

## 1. HTML/DOM 注入

```javascript
// ❌ innerHTML 注入
const userInput = '<img src=x onerror=alert(1)>';
element.innerHTML = userInput;

// ❌ document.write
const hash = location.hash.slice(1);
document.write(decodeURIComponent(hash));

// ✅ 安全的 DOM 操作
element.textContent = userInput;  // 自动转义

// ✅ createElement
document.createElement('div');
// 属性用 setAttribute，不要用 innerHTML
```

## 2. 原型链污染

```javascript
// 攻击者通过 JSON 输入污染 Object.prototype
const maliciousPayload = '{"__proto__": {"isAdmin": true}}';
const obj = JSON.parse(maliciousPayload);

// 现在所有对象都有 isAdmin: true
const user = {};
console.log(user.isAdmin);  // true

// 防护：使用 Object.create(null) 创建无原型对象
const safeObj = Object.create(null);

// 或使用结构化克隆替代 JSON.parse
structuredClone(data);

// 递归合并时检查键名
function safeMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;  // 跳过危险键
    }
    target[key] = source[key];
  }
}
```

## 3. JSONP 风险

```javascript
// ❌ JSONP 的本质是执行任意代码
<script src="https://api.example.com/data?callback=handleData"></script>

// 如果 api.example.com 被控制，返回：
handleData({ data: '正常数据' });
// 或：
alert(document.cookie);  // 执行任意代码

// ✅ 替代方案：CORS + fetch
fetch('https://api.example.com/data', {
  credentials: 'include',
});
```

## 4. eval / new Function / setTimeout 字符串

```javascript
// ❌ 极度危险
const userInput = "alert('XSS')";
eval(userInput);
new Function(userInput)();
setTimeout(userInput, 1000);
setInterval(userInput, 1000);

// ❌ 间接 eval
const fn = eval;
fn(userInput);

// ✅ 安全的替代方案
// 需要动态执行？用 JSON.parse 或结构化方案
const config = JSON.parse(userInput);  // 只解析 JSON，不执行代码

// 模板引擎沙箱
const template = new vm.Script('return `Hello ${name}`', { timeout: 1000 });
```

## 5. URL 注入

```javascript
// ❌ 直接使用用户输入拼接 URL
const redirectUrl = req.query.redirect;
window.location.href = redirectUrl;  // 可能跳转到钓鱼网站

// ✅ 白名单校验
const ALLOWED_REDIRECTS = ['/home', '/profile', '/dashboard'];
if (ALLOWED_REDIRECTS.includes(redirectUrl)) {
  window.location.href = redirectUrl;
}

// ✅ 或使用 URL 解析
const url = new URL(redirectUrl, window.location.origin);
if (url.origin === window.location.origin) {
  window.location.href = url.pathname;
}

// javascript: 伪协议
const link = document.createElement('a');
link.href = userInput;  // 如果 userInput = "javascript:alert(1)"
// 必须校验 scheme
if (!/^https?:$/i.test(link.protocol)) {
  throw new Error('Invalid protocol');
}
```

## 6. WebSocket 注入

```javascript
// ❌ 直接解析 WebSocket 消息
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  eval(data.script);  // 如果消息被篡改
};

// ✅ 消息格式校验（schema validation）
const messageSchema = z.object({
  type: z.enum(['chat', 'notification']),
  payload: z.string().max(1000),
});

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  const result = messageSchema.safeParse(data);
  if (!result.success) return;  // 丢弃非法消息
  handleMessage(result.data);
};
```
