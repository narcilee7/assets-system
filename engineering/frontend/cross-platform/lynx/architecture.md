# Lynx 架构原理

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        开发者层                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   React DSL  │  │   Vue DSL    │  │   CSS Style  │      │
│  │   (.jsx)     │  │   (.vue)     │  │   (.css)     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │               │
│         └─────────────────┼──────────────────┘               │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Lynx Compiler (Rust)                     │   │
│  │  JSX/Vue → AST → Optimization → Lepus + Tasm        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Lynx Engine                             │
│  ┌───────────────────────┐  ┌─────────────────────────────┐│
│  │     JS Thread         │  │      Native Thread           ││
│  │  ┌─────────────────┐  │  │  ┌─────────────────────┐    ││
│  │  │   PrimJS Engine  │  │  │  │    Tasm Renderer     │   ││
│  │  │  ┌───────────┐  │  │  │  │  ┌───────────────┐  │   ││
│  │  │  │ Lepus VM  │  │  │  │  │  │  Element Tree  │  │   ││
│  │  │  │ (逻辑层)   │  │  │  │  │  │  (Virtual DOM) │  │   ││
│  │  │  └─────┬─────┘  │  │  │  │  └───────┬───────┘  │   ││
│  │  │        │        │  │  │  │          │           │   ││
│  │  │  ┌─────▼─────┐  │  │  │  │  ┌───────▼───────┐  │   ││
│  │  │  │  Business │  │  │  │  │  │  Native Views  │  │   ││
│  │  │  │   Logic   │  │  │  │  │  │ (iOS/Android)  │  │   ││
│  │  │  └───────────┘  │  │  │  │  └───────────────┘  │   ││
│  │  └─────────────────┘  │  │  └─────────────────────┘   ││
│  │         │              │  │            ▲                ││
│  │         │ JSBinding    │  │            │ Pipeline        ││
│  │         └──────────────┼──┘            │                ││
│  │                        │               │                ││
│  │  ┌─────────────────────┼───────────────┘                ││
│  │  │   PAPI (Platform API)                               ││
│  │  │   Element PAPI / Module PAPI                        ││
│  │  └────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## 1. 编译层：Compiler

Lynx 不直接运行 React/Vue，而是通过编译器将 DSL 转为 Lynx 专用的运行时产物。

### 编译产物

| 产物 | 格式 | 职责 |
|------|------|------|
| **Tasm** | JSON-like 模板 | 描述 UI 结构、样式绑定、事件绑定 |
| **Lepus** | Bytecode | 运行业务逻辑：生命周期、状态管理、事件处理 |
| **CSS** | 结构化样式表 | 样式规则、动画、响应式布局 |

```
App.jsx                 Tasm (template)              Lepus (script)
   │                         │                            │
   │  <view class="card">    │  {                        │  let state = {count: 0}
   │    <text>{count}</text> │    "type": "view",        │  
   │    <button bindtap=     │    "class": "card",       │  function onTap() {
   │      "onTap">+</button> │    "children": [          │    state.count++
   │  </view>                 │      {"type": "text",     │  }
   │                         │       "content": "$count"},│
   │                         │      {"type": "button",    │
   │                         │       "bindtap": "onTap",  │
   │                         │       "children": ["+"]}   │
   │                         │    ]                       │
   │                         │  }                         │
```

### Tasm 模板的优势

Tasm 是**声明式模板**，Native 端可以直接解析渲染，无需等待 JS 执行：

```json
{
  "type": "view",
  "class": "feed-card",
  "children": [
    {
      "type": "image",
      "src": "$coverUrl",
      "style": { "width": "100%", "height": 200 }
    },
    {
      "type": "text",
      "content": "$title",
      "class": "title"
    }
  ],
  "bindtap": "onCardTap"
}
```

- `$coverUrl` 和 `$title` 是数据绑定占位符
- Native 渲染器解析 Tasm 时，直接从数据池取值，不经过 JS 计算
- 这就是 **TTF（Template First Rendering）** 的核心基础

## 2. 运行时：Radon 架构

### 2.1 双线程模型

| 线程 | 运行内容 | 职责 |
|------|----------|------|
| **JS Thread** | PrimJS + Lepus VM | 业务逻辑、状态管理、事件响应、数据处理 |
| **Native Thread** | Tasm Renderer + Element Tree | UI 渲染、手势处理、动画、布局（Yoga） |

```
JS Thread                              Native Thread
   │                                        │
   │  1. 状态变化: count++                   │
   │                                        │
   │  2. 计算 Diff                          │
   │     { path: "children[0].content",     │
   │       value: 6 }                       │
   │───────────────────────────────────────>│
   │         JSBinding (二进制序列化)         │
   │                                        │
   │                                        │  3. 应用 Patch
   │                                        │     更新 Element Tree
   │                                        │
   │                                        │  4. Yoga 布局
   │                                        │
   │                                        │  5. Native View 更新
   │                                        │
   │  6. 事件回调 (bindtap)                  │
   │<───────────────────────────────────────│
```

### 2.2 JSBinding：Lynx 的通信层

与 RN 的 JSON Bridge 不同，Lynx 使用 **JSBinding**：

```cpp
// C++ JSBinding 简化示意
class JSBinding {
public:
  // JS → Native：同步调用
  Value CallNativeMethod(const std::string& module,
                         const std::string& method,
                         const std::vector<Value>& args) {
    // 直接内存访问，无需 JSON 序列化
    auto* nativeModule = moduleRegistry_->Get(module);
    return nativeModule->Invoke(method, args);
  }

  // Native → JS：事件投递
  void DispatchEvent(const std::string& eventName,
                     const std::string& elementId,
                     const Value& detail) {
    // 构造 JS 事件对象，注入到 Lepus VM
    lepusVM_->ExecuteCallback(eventName, elementId, detail);
  }
};
```

**关键差异**：

| 维度 | RN 经典 Bridge | Lynx JSBinding |
|------|---------------|----------------|
| 序列化 | JSON 字符串 | 二进制协议（MessagePack-like） |
| 调用方式 | 异步队列 | 同步/异步混合 |
| 数据拷贝 | 深拷贝 JSON | 共享内存（C++ Value 对象） |
| 首屏渲染 | 需等 JS Bundle 执行 | Tasm 直接解析，无需 JS |

## 3. PrimJS 引擎

PrimJS 是 Lynx 自研的 JavaScript 引擎，专为移动端优化：

### 设计取舍

| 特性 | PrimJS | Hermes | JSC |
|------|--------|--------|-----|
| 编译目标 | Bytecode | Bytecode | 源代码/字节码 |
| 启动方式 | 直接执行 Bytecode | 直接执行 Bytecode | 需编译或解释 |
| 内存占用 | 低（裁剪了部分 ES 特性） | 中 | 高 |
| ES 规范支持 | ES2020 子集 | ES2020 | 完整 ES2023 |
| Intl 支持 | 按需加载 | 内置 | 内置 |
| 调试支持 | SourceMap | SourceMap | 原生调试 |

### Bytecode 预编译

```bash
# 构建时编译 JS 为 Bytecode
lynx compile App.jsx --target=lepus --output=App.lbc

# App.lbc 是二进制字节码，运行时直接加载执行
# 无需在端上解析 JS 源代码，启动速度提升 30-50%
```

## 4. TTF：首屏直出

### 4.1 首屏渲染流程对比

```
React Native 首屏                    Lynx TTF 首屏
   │                                    │
   │ 1. 下载 JS Bundle                  │ 1. 下载 Tasm + Lepus
   │    (~500KB)                        │    (~200KB, Tasm 纯数据)
   │                                    │
   │ 2. 解析 + 执行 JS                  │ 2. Native 直接解析 Tasm
   │    (~200-500ms)                    │    (~20-50ms)
   │                                    │
   │ 3. 创建 Virtual DOM                │ 3. 创建 Element Tree
   │                                    │
   │ 4. Diff + Bridge 通信              │ 4. 绑定数据，渲染首屏
   │                                    │    (无需等待 JS 执行)
   │ 5. Native 创建 View                │
   │                                    │ 5. JS 线程异步加载 Lepus
   │                                    │    (交互逻辑后置)
   ▼                                    ▼
  首屏时间: 800-1500ms                 首屏时间: 200-400ms
```

### 4.2 TTF 的数据绑定

```json
// Tasm 中的数据绑定
{
  "type": "view",
  "children": [
    {
      "type": "text",
      "content": "$user.name",       // 数据路径绑定
      "class": "$isVip ? 'vip' : ''" // 表达式绑定（受限）
    },
    {
      "type": "image",
      "src": "$user.avatar",
      "placeholder": "@res/default_avatar"
    }
  ]
}
```

Tasm 模板中的表达式是**受限的**（不支持任意 JS 逻辑），这是为了保证 Native 端可以安全、快速地求值。

## 5. 渲染管线详解

```
DSL (JSX/Vue)
    │
    │ Compiler
    ▼
┌─────────────┐     ┌─────────────┐
│    Tasm     │     │    Lepus    │
│  (模板描述)  │     │  (逻辑脚本)  │
└──────┬──────┘     └──────┬──────┘
       │                    │
       │  Native Thread     │  JS Thread
       ▼                    ▼
┌─────────────┐     ┌─────────────┐
│ Tasm Parser │     │ PrimJS VM   │
│             │     │             │
│ Element     │◀────│ JSBinding   │
│ Tree        │     │ (状态同步)   │
└──────┬──────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│ Yoga Layout │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Native View │
│ 绘制 + 合成  │
└─────────────┘
```

## 6. 与 React Native 的对比

| 维度 | Lynx | React Native |
|------|------|--------------|
| DSL | 类 React/Vue（编译后运行） | 标准 React |
| 首屏 | TTF 直出（~200ms） | 需等 JS 执行（~800ms） |
| JS 引擎 | PrimJS（自研） | Hermes / JSC |
| 通信 | JSBinding（二进制） | Bridge（JSON）/ JSI |
| 包体积 | 较小（Tasm 压缩率高） | 较大（JS Bundle） |
| 生态 | 较新，社区库少 | 成熟，生态丰富 |
| 调试 | DevTool + SourceMap | Metro + Flipper |
| 动态下发 | 支持（Tasm + Lepus 分离） | 支持（CodePush / Expo） |

## 手写训练：理解 Tasm 结构

```javascript
// 原始 JSX
function FeedCard({ item, onTap }) {
  return (
    <view class="card" bindtap={onTap}>
      <image src={item.cover} style={{ width: '100%', height: 200 }} />
      <text class="title">{item.title}</text>
      <view class="footer">
        <image src={item.author.avatar} class="avatar" />
        <text class="name">{item.author.name}</text>
      </view>
    </view>
  );
}
```

```json
// 编译后的 Tasm（简化）
{
  "type": "view",
  "class": "card",
  "bindtap": "onTap",
  "children": [
    {
      "type": "image",
      "src": "$item.cover",
      "style": { "width": "100%", "height": 200 }
    },
    {
      "type": "text",
      "class": "title",
      "content": "$item.title"
    },
    {
      "type": "view",
      "class": "footer",
      "children": [
        {
          "type": "image",
          "src": "$item.author.avatar",
          "class": "avatar"
        },
        {
          "type": "text",
          "class": "name",
          "content": "$item.author.name"
        }
      ]
    }
  ]
}
```

**思考题**：
- Tasm 中的 `$item.title` 和 Lepus 中的 `state.item.title` 是什么关系？
- 如果 `item.author` 为 null，Tasm 渲染会崩溃吗？如何防御？
- TTF 模式下，首屏渲染时 Lepus 脚本还未执行，事件绑定如何处理？
