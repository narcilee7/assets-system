# 回滚策略

## 1. 快速回滚

```bash
# npm 回滚
npm dist-tag add package@1.2.2 latest   # 把上一个版本设为 latest

# Docker 回滚（前端静态资源）
docker pull registry/app:v1.2.2
docker tag registry/app:v1.2.2 registry/app:latest
docker push registry/app:latest

# CDN 回滚（如果有版本路径）
# /v1.2.3/ → /v1.2.2/（修改路由或配置）
```

## 2. 数据库兼容性

```markdown
回滚前提：新版本不能修改数据库结构（或兼容旧代码）

策略：
1. 先部署兼容代码（读写都兼容新旧格式）
2. 再执行数据库迁移
3. 验证稳定后，删除兼容代码

如果必须回滚：
- 回滚代码
- 数据库可能需要数据修复脚本
```

## 3. Feature Flag 兜底

```javascript
// 紧急情况下关闭功能，无需回滚代码
if (featureFlags.isEnabled('new-payment-gateway')) {
  return <NewPaymentGateway />;
}
return <OldPaymentGateway />;  // 兜底

// 在配置平台一键关闭
```
