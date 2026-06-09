# Permission Domain Model Kata

## 目标

训练权限系统的领域建模：实体、值对象、聚合、领域事件、领域服务的识别和设计。

## 场景

实现一个 RBAC（基于角色的访问控制）系统：
- 用户（User）归属于角色（Role）
- 角色拥有权限（Permission）
- 权限定义了对资源（Resource）的动作（Action）

## 核心概念

| 概念 | 解释 |
| --- | --- |
| Entity | User、Role（需要身份，有生命周期） |
| Value Object | Permission、ResourceId、Action（无身份，靠值相等） |
| Aggregate | UserRoleAssignment（一致性边界） |
| Domain Service | PermissionChecker（跨聚合的领域行为） |
| Domain Event | RoleAssigned、RoleRevoked、PermissionGranted |

## 领域模型

### Entities

- **User**：用户根实体
- **Role**：角色实体

### Value Objects

- **Permission**：权限（resource + action）
- **ResourceId**：资源标识
- **Action**：操作类型（read/write/delete/admin）

### Aggregates

- **UserRoleAssignment**：用户角色关联（一致性边界）
  - 包含：userId, roleId, grantedAt, grantedBy
  - 根：UserRoleAssignmentId

### Domain Events

- **RoleAssigned**：角色分配事件
- **RoleRevoked**：角色撤销事件
- **PermissionGranted**：权限授予事件
- **PermissionDenied**：权限拒绝事件

### Domain Services

- **PermissionService**：权限检查服务
  - `checkPermission(userId, resource, action): boolean`
  - `getUserPermissions(userId): Permission[]`

## 面试追问

- 为什么 Permission 是值对象而不是实体？
  （答：Permission 由 resource + action 构成，两个相同的 Permission 应该等价，没有独立身份）
- UserRoleAssignment 为什么是独立的聚合？
  （答：它是 User 和 Role 的关联，有自己的身份和生命周期，需要单独管理和事务边界）
- 权限检查失败应该抛异常还是返回 false？
  （答：通常返回 boolean，权限检查是常规操作。异常保留给程序错误）

## 相关模式

- `security/`：RBAC/ABAC 权限模型
- `architecture-styles/layered-service-blueprint/`：分层架构