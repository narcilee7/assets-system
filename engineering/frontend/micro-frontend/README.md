# Micro Frontend

微前端不是默认选项。架构师要能判断收益是否超过复杂度。

## 决策条件

| 适合 | 不适合 |
| --- | --- |
| 多团队独立交付 | 单团队小应用 |
| 技术栈迁移期 | 只是想拆目录 |
| 子应用生命周期独立 | 强一致交互很多 |
| 存量系统整合 | 性能预算很紧 |

## 核心问题

- 路由如何托管？
- 样式如何隔离？
- JS 沙箱是否需要？
- 状态和登录态如何共享？
- 子应用如何独立发布和回滚？
- 公共依赖如何治理？

## 技术路线

- qiankun / single-spa
- Module Federation
- iframe isolation
- Web Components
- build-time composition

