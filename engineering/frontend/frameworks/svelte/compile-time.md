# Svelte 编译时框架

## 1. 核心思想：无 Virtual DOM

React / Vue：Runtime 驱动，每次状态变化 → 生成新 VDOM → Diff → 更新 DOM。

Svelte：**编译时**将模板转换为直接操作 DOM 的命令式代码。

```
React/Vue 运行时                    Svelte 编译时
   │                                  │
   │ Template                         │ Template
   │    │                             │    │
   │    ▼ 编译                        │    ▼ 编译
   │ Render Function                  │ 直接 DOM 操作代码
   │    │                             │
   │    ▼ 运行时执行                   │ 运行时无 diff，直接执行
   │ VDOM Tree                        │
   │    │                             │
   │    ▼ Diff                        │
   │ DOM Updates                      │
```

## 2. 编译产物对比

### 源码

```svelte
<script>
  let count = 0;
  function increment() {
    count += 1;
  }
</script>

<button on:click={increment}>
  Clicked {count} times
</button>
```

### React 编译产物（运行时）

```javascript
// React 需要运行时库 (~40KB gzip)
function Counter() {
  const [count, setCount] = useState(0);
  return React.createElement('button', {
    onClick: () => setCount(c => c + 1)
  }, `Clicked ${count} times`);
}
// + ReactDOM.render + Diff 算法
```

### Svelte 编译产物（直接 DOM 操作）

```javascript
// Svelte 编译结果（无运行时库，~0KB 额外体积）
function create_fragment(ctx) {
  let button;
  let t0;
  let t1;
  let t2;

  return {
    c() {  // create
      button = element("button");
      t0 = text("Clicked ");
      t1 = text(ctx[0]);  // count
      t2 = text(" times");
    },
    m(target, anchor) {  // mount
      insert(target, button, anchor);
      append(button, t0);
      append(button, t1);
      append(button, t2);
      button.addEventListener("click", ctx[1]);  // increment
    },
    p(ctx, dirty) {  // update（只更新变化的部分）
      if (dirty & 1) set_data(t1, ctx[0]);  // 只更新 count 文本
    },
    d(detaching) {  // destroy
      if (detaching) detach(button);
      button.removeEventListener("click", ctx[1]);
    }
  };
}
```

## 3. 响应式编译

Svelte 在编译时分析依赖关系，生成细粒度的更新代码：

```svelte
<script>
  let firstName = 'John';
  let lastName = 'Doe';
  $: fullName = firstName + ' ' + lastName;
</script>

<h1>Hello {fullName}!</h1>
<input bind:value={firstName} />
<input bind:value={lastName} />
```

编译结果中的更新逻辑：

```javascript
// 编译器识别出 fullName 依赖 firstName 和 lastName
function instance($$self, $$props, $$invalidate) {
  let firstName = 'John';
  let lastName = 'Doe';
  let fullName;

  // 编译器生成的响应式声明
  $$self.$$.update = () => {
    if ($$self.$$.dirty & 3) {  // firstName(1) | lastName(2) = 3
      $$invalidate(2, fullName = firstName + ' ' + lastName);
    }
  };

  return [firstName, lastName, fullName];
}
```

## 4. 手写训练：理解编译产物

```javascript
// 简化版 Svelte 编译器思路

// 1. 解析模板为 AST
function parse(template) {
  // 提取 <script> 和 <template>
  const scriptMatch = template.match(/<script>(.*?)<\/script>/s);
  const script = scriptMatch ? scriptMatch[1] : '';

  const templateMatch = template.match(/<template>(.*?)<\/template>/s);
  const html = templateMatch ? templateMatch[1] : template;

  return { script, html };
}

// 2. 分析模板中的动态部分
function analyze(html) {
  const dynamics = [];
  // 匹配 {expression}
  const regex = /\{([^}]+)\}/g;
  let match;
  while ((match = regex.exec(html))) {
    dynamics.push({
      expression: match[1].trim(),
      index: match.index,
    });
  }
  return dynamics;
}

// 3. 生成代码
function generate(script, html, dynamics) {
  const dynamicVars = dynamics.map(d => d.expression);

  let createCode = '';
  let updateCode = '';

  dynamics.forEach((dyn, i) => {
    createCode += `  const text${i} = document.createTextNode(${dyn.expression});\n`;
    updateCode += `  text${i}.data = ${dyn.expression};\n`;
  });

  return `
function createComponent() {
  ${script}

  const container = document.createElement('div');
  container.innerHTML = \`${html.replace(/\{[^}]+\}/g, 'PLACEHOLDER')}\`;

  // 更精细的编译会生成直接创建 DOM 的代码
  ${createCode}

  return {
    mount(target) {
      target.appendChild(container);
    },
    update() {
      ${updateCode}
    }
  };
}
`;
}
```
