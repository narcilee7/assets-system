# Runtime Bridges

## 目标

训练 TypeScript 类型与运行时之间的桥接能力，掌握类型守卫（type guard）、断言函数（assertion function）和轻量 schema 校验，确保外部输入在进入业务逻辑前被正确收窄类型。

## 场景

前端接收后端 API 响应、解析 URL 参数、读取 localStorage、处理用户上传的 JSON 文件——这些场景下运行时数据是 `unknown` 或 `any`，必须通过类型守卫或 schema 校验才能安全使用。

## 核心考点

- 用户定义类型守卫：`x is T` 的语义和使用场景。
- 断言函数：`asserts x is T` 在 TS 3.7+ 中的用法。
- 运行时校验与类型推导的结合：如何让校验函数同时提供运行时检查和编译期类型收窄。
- 错误处理：校验失败时应给出清晰的错误路径。

## 当前资产

| 资产 | 目录 | 状态 | 目标 |
| --- | --- | --- | --- |
| Guard & Assert | `guard-and-assert/` | ready | 类型守卫与断言函数 |
| Schema Bridge | `schema-bridge/` | ready | 轻量运行时 schema + 类型推导 |

## 边界条件

- `null` vs `undefined`：很多 typeof 检查会把两者混为一谈。
- 数组 vs 对象：`typeof [] === 'object'`。
- 可选字段缺失 vs 值为 `undefined`：schema 校验中语义不同。

## 工程迁移

- API 层统一封装 `fetchWithSchema`，在请求返回处立即校验。
- 表单提交前用 schema 校验用户输入，减少后端无效请求。
