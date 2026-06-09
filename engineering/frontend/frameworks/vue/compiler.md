# Vue 编译器

## 1. 编译流程

```
Template String
      │
      │ 1. Parse
      ▼
   AST (抽象语法树)
      │
      │ 2. Transform
      ▼
 Transformed AST
      │
      │ 3. Generate
      ▼
Render Function Code
```

### 1.1 Parse：模板 → AST

```html
<!-- 模板 -->
<div id="app" class="container">
  <h1>{{ title }}</h1>
  <button @click="increment">{{ count }}</button>
</div>
```

```javascript
// AST（简化）
{
  type: 'Element',
  tag: 'div',
  props: [
    { type: 'Attribute', name: 'id', value: 'app' },
    { type: 'Attribute', name: 'class', value: 'container' }
  ],
  children: [
    {
      type: 'Element',
      tag: 'h1',
      children: [
        { type: 'Interpolation', content: { type: 'Expression', content: 'title' } }
      ]
    },
    {
      type: 'Element',
      tag: 'button',
      props: [
        { type: 'Directive', name: 'on', arg: 'click', exp: 'increment' }
      ],
      children: [
        { type: 'Interpolation', content: { type: 'Expression', content: 'count' } }
      ]
    }
  ]
}
```

### 1.2 Transform：AST 优化

Vue 3 编译器的核心优化：**Block Tree + 静态提升**

```html
<!-- 模板 -->
<div>
  <h1>Static Title</h1>        <!-- 纯静态，永不更新 -->
  <p>{{ message }}</p>          <!-- 动态 -->
  <ul>
    <li v-for="item in list" :key="item.id">
      {{ item.name }}
    </li>
  </ul>
</div>
```

```javascript
// 编译结果（优化后）
const _hoisted_1 = createElementVNode("h1", null, "Static Title", -1);  // 静态提升

function render(_ctx, _cache) {
  return (openBlock(), createElementBlock("div", null, [
    _hoisted_1,                    // 直接使用静态 vnode，跳过 diff
    createElementVNode("p", null, toDisplayString(_ctx.message), 1),  // 动态标记
    createElementVNode("ul", null, [
      // v-for 生成 Block Fragment
      (openBlock(true), createElementBlock(Fragment, null,
        renderList(_ctx.list, (item) => {
          return (openBlock(), createElementBlock("li", { key: item.id },
            toDisplayString(item.name), 1));
        }), 128 /* KEYED_FRAGMENT */))
    ])
  ]));
}
```

## 2. Block Tree

Vue 3 的核心创新：**Block 节点收集动态子节点**，diff 时只比较动态部分。

```
传统 VDOM diff（Vue 2）        Block Tree diff（Vue 3）
   │                              │
   │ 遍历整棵树                    │ 遍历整棵树收集动态节点
   │ 比较所有节点                  │
   │                              │ 只比较动态节点数组
   ▼                              ▼
  时间: O(n)                    时间: O(m)，m = 动态节点数 << n
```

```javascript
// Block 收集动态子节点
function createBlock(type, props, children, patchFlag) {
  const vnode = createVNode(type, props, children, patchFlag);
  vnode.dynamicChildren = [];  // 收集所有动态子节点
  return vnode;
}

// 子节点如果是动态的，会被收集到父 Block
function createVNode(type, props, children, patchFlag) {
  const vnode = { type, props, children, patchFlag };

  // 如果当前在 Block 上下文中，且 patchFlag > 0
  if (currentBlock && patchFlag > 0) {
    currentBlock.push(vnode);
  }

  return vnode;
}
```

### PatchFlag 类型

| Flag | 值 | 说明 |
|------|----|----|
| TEXT_CHILDREN | 1 | 动态文本内容 |
| CLASS | 2 | 动态 class |
| STYLE | 4 | 动态 style |
| PROPS | 8 | 动态 props（不包括 class/style） |
| FULL_PROPS | 16 | 动态 key 或需要完整 diff props |
| HYDRATE_EVENTS | 32 | 需要 hydrate 事件 |
| STABLE_FRAGMENT | 64 | 子节点顺序不变 |
| KEYED_FRAGMENT | 128 | 子节点有 key |
| UNKEYED_FRAGMENT | 256 | 子节点无 key |

```javascript
// 根据 patchFlag 精确更新
function patchElement(n1, n2) {
  const el = (n2.el = n1.el);
  const { patchFlag } = n2;

  if (patchFlag & PatchFlags.CLASS) {
    if (n1.props.class !== n2.props.class) {
      hostPatchProp(el, 'class', null, n2.props.class);
    }
  }

  if (patchFlag & PatchFlags.STYLE) {
    hostPatchProp(el, 'style', n1.props.style, n2.props.style);
  }

  if (patchFlag & PatchFlags.TEXT_CHILDREN) {
    if (n1.children !== n2.children) {
      hostSetElementText(el, n2.children);
    }
  }

  // 不需要遍历所有 props，只需处理标记的部分
}
```

## 3. 静态提升（Static Hoisting）

```html
<div>
  <header>
    <h1>App Title</h1>
    <nav><a href="/">Home</a></nav>
  </header>
  <main>{{ content }}</main>
</div>
```

```javascript
// 编译结果：整个 <header> 被提升到模块级，只创建一次
const _hoisted_1 = createStaticVNode(
  "<header><h1>App Title</h1><nav><a href=\"/\">Home</a></nav></header>"
);

function render(_ctx, _cache) {
  return (openBlock(), createElementBlock("div", null, [
    _hoisted_1,  // 直接复用，跳过 diff
    createElementVNode("main", null, toDisplayString(_ctx.content), 1)
  ]));
}
```

## 4. 手写训练：简化版编译器

```javascript
// 1. Parse：简单解析器
function parse(template) {
  const ast = {
    type: 'Root',
    children: []
  };

  // 简化版：假设模板只有一个根元素
  const tagMatch = template.match(/<(\w+)([^>]*)>(.*)<\/\1>/s);
  if (tagMatch) {
    const [, tag, attrsStr, childrenStr] = tagMatch;
    ast.children.push({
      type: 'Element',
      tag,
      props: parseAttrs(attrsStr),
      children: parseChildren(childrenStr)
    });
  }

  return ast;
}

function parseAttrs(str) {
  const attrs = [];
  const regex = /(\w+)(?:="([^"]*)")?/g;
  let match;
  while ((match = regex.exec(str))) {
    attrs.push({ name: match[1], value: match[2] || true });
  }
  return attrs;
}

function parseChildren(str) {
  const children = [];
  // 处理文本插值 {{ expr }}
  const parts = str.split(/\{\{\s*(.*?)\s*\}\}/);
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].trim()) {
      if (i % 2 === 0) {
        children.push({ type: 'Text', content: parts[i].trim() });
      } else {
        children.push({ type: 'Interpolation', content: parts[i].trim() });
      }
    }
  }
  return children;
}

// 2. Generate：生成 render 函数
function generate(ast) {
  const code = `function render(_ctx) {
    return ${genNode(ast.children[0])};
  }`;
  return code;
}

function genNode(node) {
  switch (node.type) {
    case 'Element':
      const props = node.props.map(p => `${p.name}: ${JSON.stringify(p.value)}`).join(', ');
      const children = node.children.map(genNode).join(', ');
      return `h('${node.tag}', { ${props} }, [${children}])`;
    case 'Text':
      return JSON.stringify(node.content);
    case 'Interpolation':
      return `_ctx.${node.content}`;
  }
}

// 测试
const template = `<div class="app"><h1>{{ title }}</h1></div>`;
const ast = parse(template);
const code = generate(ast);
console.log(code);
// 输出: function render(_ctx) { return h('div', { class: "app" }, [h('h1', {}, [_ctx.title])]); }
```
