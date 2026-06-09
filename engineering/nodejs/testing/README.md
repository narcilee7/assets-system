# Node.js Testing

## 测试金字塔

```
        /\
       /  \     E2E (Playwright / Cypress)
      /----\
     /      \   Integration (Supertest + Test DB)
    /--------\
   /          \ Unit (Vitest / Jest)
  /------------\
```

## 资产

| 资产 | 目录 | 说明 |
| --- | --- | --- |
| Unit test with Vitest | `unit-test/` | Vitest 配置、Mock 策略、覆盖率阈值 |
| Integration test with Supertest | `integration-test/` | HTTP 集成测试、数据库隔离、Testcontainers |
| Contract test with Pact | `contract-test/` | 消费者驱动契约、Pact Broker |
