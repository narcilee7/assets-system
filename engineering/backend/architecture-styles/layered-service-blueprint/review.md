# Layered Service Blueprint Review

## 设计评估

### 优点

1. **清晰的职责分离**：Controller 处理 HTTP、Service 处理业务、Repository 处理数据访问
2. **依赖倒置**：Service 依赖 Repository 接口，不依赖具体实现，方便测试和替换
3. **错误映射**：领域错误在 Service 层抛出，Controller 统一映射为 HTTP 状态码
4. **DTO 转换**：Request/Response DTO 与领域实体分离，避免内部模型泄漏
5. **状态机验证**：Order 状态转换有明确的合法性校验
6. **可测试性**：所有层都可以独立测试，InMemory Repository 便于单元测试

### 可改进点

1. **事务管理**：当前实现没有显式事务管理。生产环境需要在 Service 方法上添加事务注解
2. **校验框架**：使用手动校验，可以考虑使用 zod/joi 等校验库
3. **日志和监控**：缺少请求日志、性能指标等可观测性支持
4. **分页支持**：getUserOrders 应该支持分页参数
5. **乐观锁**：update 时应检查 version 字段，防止并发更新覆盖

### 关键设计决策

| 决策 | 选择 | 理由 |
| --- | --- | --- |
| Repository 接口 | Service 定义 | 依赖倒置，便于 mock |
| 错误处理 | 领域错误 + HTTP 映射 | 分离业务异常和传输层异常 |
| DTO 转换 | Controller 层 | HTTP 层的职责，不污染 Service |
| 状态机 | 枚举 + 转换表 | 显式、可测试 |

### 测试覆盖

- ✅ 创建订单（成功、各种校验失败）
- ✅ 获取订单（存在、不存在）
- ✅ 获取用户订单（单用户、多用户、空结果）
- ✅ 状态转换（合法转换、非法转换、终态）
- ✅ 取消订单
- ✅ 删除订单
- ✅ Controller 错误处理（404、400、409、500）
- ✅ DTO 日期转换
- ✅ 集成测试

### 生产环境注意事项

1. **事务管理**：使用 `@Transactional` 或类似机制，确保 Service 方法在事务内执行
2. **Repository 实现**：InMemory → PostgreSQL/MySQL，需要实现真正的 SQL 查询
3. **乐观锁**：在 Order 表添加 version 字段，更新时检查
4. **审计字段**：createdBy、updatedBy、deletedAt 等
5. **软删除**：物理删除改为软删除（添加 deletedAt 字段）
6. **分页**：findByUserId 需要支持 LIMIT/OFFSET