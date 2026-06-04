# Mini Runtime

这一层把零散机制组合成框架级理解：手写 FastAPI、ORM、pytest、Agent Runtime。

## 必会概念

- Web 框架的核心：路由注册 → 请求解析 → 依赖注入 → 响应序列化。
- ORM 的核心：模型定义 → SQL 生成 → 连接池 → 结果映射。
- 测试框架的核心：收集 → 执行 → 断言 → 报告。
- Agent Runtime 的核心：工具注册 → 调用协议 → 状态管理。

## 已有资产

| 资产 | 目录 | 状态 | 目标 |
|------|------|------|------|
| Mini Framework | `mini_framework/` | seed | mini FastAPI、mini ORM、mini pytest |

## 题单

| 题目 | 文件/目录 | 状态 | 关键点 |
|------|----------|------|--------|
| mini FastAPI | `mini_framework/mini_fastapi.py` | todo | 路由、依赖注入、中间件 |
| mini ORM | `mini_framework/mini_orm.py` | todo | 模型映射、CRUD、查询构造 |
| mini pytest | `mini_framework/mini_pytest.py` | todo | 测试收集、fixture、断言 |
| mini Agent Runtime | `mini_framework/mini_agent.py` | todo | 工具注册、调用、状态 |
