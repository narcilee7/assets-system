# Type System

## 目标

训练 TypeScript 类型层面的建模能力，掌握 conditional type、mapped type、infer、递归类型和模板字面量类型，让类型系统服务于真实模块约束。

## 场景

在大型前端或全栈项目中，需要为 API 响应、配置对象、状态机和事件系统建立精确的类型契约，避免 any 泛滥，同时在编译期捕获边界错误。

## 核心考点

- 条件类型与分配律：`T extends U ? X : Y` 的分配行为。
- infer 提取：从函数签名、Promise、数组等结构中提取类型参数。
- Mapped Type：遍历 key 并转换 value 类型。
- 递归类型：DeepReadonly、DeepPartial 等深层结构处理。
- 模板字面量类型：构造符合命名规范的字符串类型。

## 当前资产

| 资产 | 目录 | 状态 | 目标 |
| --- | --- | --- | --- |
| DeepReadonly | `deep-readonly/` | ready | 递归只读，测试嵌套对象和数组 |
| PickByValue | `pick-by-value/` | ready | 按值类型筛选 key |
| UnionToIntersection | `union-to-intersection/` | ready | 联合转交叉，理解逆变位置 |

## 边界条件

- 循环引用对象：递归类型可能触发类型深度限制。
- 函数和内置对象：DeepReadonly 对函数是否只读？
- 可选属性 / readonly 修饰符：mapped type 中如何处理修饰符。

## 工程迁移

- DeepReadonly 对应 Redux 状态树或配置对象的不可变约束。
- PickByValue 对应从 DTO 中按类型提取字段（如提取所有 string 类型的查询条件）。
- UnionToIntersection 对应将联合的接口合并为单个交叉类型，用于高阶组件 props 合并。
