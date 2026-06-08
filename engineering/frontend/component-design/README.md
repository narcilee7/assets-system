# Component Design

组件设计训练 —— 达到"能设计清晰 API、能处理复杂交互、能保障可访问性、能写出可测试组件"的水平。

## 训练哲学

1. **组件即 API**：好的组件设计像好的 API 设计——简单、可预测、可组合。
2. **关注点分离**：逻辑、样式、状态、可访问性各归其位。
3. **组合优于配置**：通过组合小部件构建复杂组件，而非增加配置项。
4. **可访问性不是可选项**：a11y 应该在设计阶段就考虑，不是事后补丁。

## 体系索引

### 设计基础
| 文档 | 内容 |
|------|------|
| [01-component-principles.md](01-component-principles.md) | 组件设计原则：单一职责、开闭原则、可组合性、API 设计规范 |

### 组件模式
| 文档 | 内容 |
|------|------|
| [02-atomic-components.md](02-atomic-components.md) | 原子组件：Button、Input、Label、Icon 的设计规范与变体 |
| [03-composite-patterns.md](03-composite-patterns.md) | 复合组件：Compound Components、Slots、Render Props、Context 模式 |
| [04-controlled-uncontrolled.md](04-controlled-uncontrolled.md) | 受控与非受控：状态管理、混合模式、Ref 转发 |

### 高级组件
| 文档 | 内容 |
|------|------|
| [05-accessibility.md](05-accessibility.md) | 可访问性：ARIA 属性、键盘导航、焦点管理、屏幕阅读器 |
| [06-state-machines.md](06-state-machines.md) | 组件状态机：有限状态机、状态转换、XState、复杂交互 |
| [07-headless-ui.md](07-headless-ui.md) | Headless UI：逻辑与样式分离、Radix UI、React Aria、Hooks 封装 |

### 特定组件类型
| 文档 | 内容 |
|------|------|
| [08-form-components.md](08-form-components.md) | 表单组件：Form 上下文、校验、Field 封装、错误处理 |
| [09-overlay-components.md](09-overlay-components.md) | 弹层组件：Portal、焦点陷阱、ESC 关闭、堆叠管理、动画 |
| [10-list-components.md](10-list-components.md) | 列表组件：虚拟列表、分页、筛选、排序、选择态 |

### 测试与质量
| 文档 | 内容 |
|------|------|
| [11-component-testing.md](11-component-testing.md) | 组件测试：单元测试、交互测试、可访问性测试、视觉回归 |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/compound-components.md](mini-impl/compound-components.md) | 手写 Compound Components：Context + 子组件验证 |
| [mini-impl/headless-base.md](mini-impl/headless-base.md) | 手写 Headless UI 基类：useDismiss、useFocusTrap、useId |
| [mini-impl/form-context.md](mini-impl/form-context.md) | 手写 Form Context：注册、校验、错误收集、提交 |

## 组件设计决策树

```
设计新组件？
  ├─ 是原子组件（Button/Input）？ → 定义变体 + 大小 + 状态
  ├─ 是复合组件（Select/Modal）？ → Compound Components / Slots
  ├─ 需要管理复杂状态？ → 状态机 / Headless UI
  ├─ 是表单相关？ → Form Context + 校验集成
  ├─ 是弹层/浮层？ → Portal + 焦点陷阱 + 堆叠
  └─ 是数据列表？ → 虚拟化 + 分页/无限滚动
```
