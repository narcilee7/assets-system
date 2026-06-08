# 04 Form Manager（表单状态管理）

## 问题描述

实现一个健壮的表单管理器 `FormManager`，统一处理表单状态、验证、提交和重置。

### 核心能力

1. **状态管理**：管理所有字段的值、错误、dirty 状态、touched 状态。
2. **验证**：支持内置规则（required、minLength、pattern、custom）和异步验证。
3. **字段注册**：动态注册/注销字段。
4. **受控/非受控**：支持初始值，也支持 uncontrolled 模式。
5. **提交处理**：收集数据、验证全部字段、处理提交逻辑。

## 核心概念

- **受控组件（Controlled）**：表单值由 React/Vue 状态驱动。
- **非受控组件（Uncontrolled）**：表单值由 DOM 自身管理，只在提交时读取。
- **Field-level validation**：每个字段独立验证。
- **Form-level validation**：提交前验证全部字段。
- **Async validation**：远程验证（如用户名唯一性检查）。

## 约束

- 不得使用 formik、react-hook-form 等第三方库。
- 必须支持嵌套字段（如 `address.city`）。
- 验证规则可组合。
- 错误信息支持国际化（i18n key）。

## 手写提示

1. 状态结构：`{ values, errors, touched, dirty }`。
2. 字段注册时记录 field config（验证规则、初始值）。
3. 验证时收集所有字段错误，全部通过才算成功。
4. `handleSubmit` 需要 preventDefault + 验证 + 回调。

## 验证方式

```bash
make run   # 运行骨架
make test  # 验证表单逻辑
```

## 追问

- 嵌套字段的验证错误如何展示（如 `address.city.required`）？
- 如何处理动态添加/删除的字段？
- 表单级别的重置（reset）如何实现？
- 如何支持数组字段（联系人列表）？
- 与后端 API 的错误映射如何处理（如 422 状态码对应字段错误）？