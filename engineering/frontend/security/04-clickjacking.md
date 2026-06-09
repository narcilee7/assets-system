# 点击劫持

## 1. 攻击原理

```
攻击者页面 evil.com：
┌─────────────────────────────────────────┐
│  "点击领取免费 iPhone"                   │  <- 诱惑性文案
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  bank.com（透明 iframe）        │    │  <- 用户看不到
│  │                                 │    │
│  │      [ 确认转账 ]               │    │  <- 按钮正好在"领取"下方
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│         [    立即领取    ]              │  <- 用户以为点这个
└─────────────────────────────────────────┘

用户点击"领取"，实际上是点击了 bank.com 的"确认转账"按钮
```

## 2. 防护策略

### X-Frame-Options（传统）

```
X-Frame-Options: DENY           # 完全禁止嵌入
X-Frame-Options: SAMEORIGIN     # 只允许同域嵌入

// Express
res.setHeader('X-Frame-Options', 'DENY');
```

**缺点**：只能一刀切，无法精细控制。

### CSP frame-ancestors（推荐）

```
Content-Security-Policy: frame-ancestors 'none';           # 完全禁止
Content-Security-Policy: frame-ancestors 'self';           # 只允许同域
Content-Security-Policy: frame-ancestors https://partner.com;  # 白名单
```

```javascript
// Express helmet
const helmet = require('helmet');
app.use(helmet.contentSecurityPolicy({
  directives: {
    frameAncestors: ["'self'", 'https://trusted-partner.com'],
  },
}));
```

### 双重防护

```javascript
// 同时设置两者（兼容性 + 现代性）
function preventClickjacking(req, res, next) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  next();
}
```

## 3. 其他 UI Redressing 攻击

### Cursor Jacking（光标劫持）

```javascript
// 攻击者用 CSS 隐藏真实光标，显示假光标
body {
  cursor: none;  /* 隐藏真实光标 */
}
.fake-cursor {
  position: fixed;
  /* 假光标位置偏移，用户点击的是错误位置 */
  transform: translate(20px, 20px);
}
```

### File Jacking

```html
<!-- 诱使用户选择文件，实际上是上传敏感文件 -->
<input type="file" style="opacity:0;position:absolute;top:0;left:0;width:100%;height:100%">
```

## 4. 检测脚本

```javascript
// 前端检测是否被嵌入 iframe
if (window.self !== window.top) {
  // 被嵌套了
  // 选择 1：跳出 iframe
  window.top.location = window.self.location;

  // 选择 2：显示警告
  document.body.innerHTML = '<h1>请在独立窗口中使用</h1>';
}
```
