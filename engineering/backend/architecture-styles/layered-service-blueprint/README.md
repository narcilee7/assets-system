# Layered Service Blueprint

## 目标

训练分层架构的代码组织：Controller → Service → Repository。理解每层的职责边界、依赖方向，以及什么时候该打破分层。

## 场景

你正在实现一个订单服务，需要：
- 接收 HTTP 请求（Controller 层）
- 处理业务逻辑和校验（Service 层）
- 访问数据库（Repository 层）

## 核心考点

- **Controller**：请求解析、参数校验、响应格式化、错误映射
- **Service**：业务逻辑、事务边界、领域规则、组合编排
- **Repository**：数据访问抽象、查询构造、持久化
- **依赖倒置**：Service 依赖 Repository 接口，不依赖具体实现
- **单一职责**：每层只做本层的事，不越界

## 边界条件

- **贫血 vs 充血**：Service 处理业务逻辑，Domain Entity 可以承载行为
- **跨层调用**：直接跳过 Controller 调用 Service（内部调用）
- **事务边界**：事务应该在 Service 层开启，不在 Repository 层
- **校验位置**：参数校验在 Controller，业务规则校验在 Service

## 分层原则

| 层 | 职责 | 不该做什么 |
| --- | --- | --- |
| Controller | 接收请求、返回响应、路由 | 业务逻辑、SQL |
| Service | 业务规则、事务、编排 | HTTP 解析、SQL |
| Repository | 数据访问、CRUD | 业务逻辑、事务 |

## 实现思路

### 目录结构
```
layered-service/
├── controller/       # 接收 HTTP 请求
├── service/          # 业务逻辑和事务
├── repository/       # 数据访问抽象
├── domain/           # 领域模型（Entity、Value Object）
├── dto/              # 数据传输对象
└── errors/           # 领域错误定义
```

### 关键设计

1. **接口定义**：Service 定义 Repository 接口（依赖倒置）
2. **DTO 转换**：Controller 负责 Request/Response DTO 转换
3. **错误处理**：领域错误在 Service 层抛出，Controller 映射为 HTTP 状态码
4. **事务管理**：Service 方法标注事务边界，框架自动开启提交/回滚

## 复杂度

- **空间复杂度**：O(n)，n 为领域实体数量
- **时间复杂度**：O(1)，每层调用都是 O(1) 查找
- **主要代价**：分层带来的代码量和调用深度

## 面试追问

- 什么时候应该打破分层，直接在 Controller 里调用 Repository？
  （答：简单的 CRUD 操作，直接在 Controller 调用 Repository 可以减少样板代码。）
- 如果两个 Service 之间有依赖怎么办？
  （答：单向依赖，避免循环依赖。可以抽取公共 Service 或用事件解耦。）
- Service 层能不能有状态？
  （答：通常无状态，但可以持有配置、缓存等工具类。）
- Repository 能不能返回 Domain Entity？
  （答：可以，但要注意 Entity 被外部修改破坏封装。建议返回 Entity 的副本或 DTO。）

## 工程迁移

- **Spring MVC**：Controller / Service / Repository 模式
- **NestJS**：Controller / Service / Repository 模块化
- **Express**：手动分层或用中间件模拟
- **Clean Architecture**：Layered 是 Clean Architecture 的简化版本

## 相关模式

- `patterns/middleware-pipeline/`：Controller 层的请求处理
- `data-consistency/transaction-boundary/`：Service 层事务边界
- `domain-modeling/`：Domain 层实体和值对象设计