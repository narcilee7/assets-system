# 代码审查

## 1. Review 清单

```markdown
## 功能性
- [ ] 功能是否符合需求
- [ ] 边界条件是否处理
- [ ] 错误路径是否覆盖

## 代码质量
- [ ] 命名是否清晰（变量/函数/文件）
- [ ] 函数是否单一职责
- [ ] 是否有重复代码（DRY）
- [ ] 复杂度是否可控

## 性能
- [ ] 是否有不必要的重渲染
- [ ] 是否有大数据量操作
- [ ] 图片/资源是否优化

## 安全
- [ ] 用户输入是否校验
- [ ] 敏感数据是否脱敏
- [ ] XSS/CSRF 是否考虑

## 可维护性
- [ ] 是否有测试覆盖
- [ ] 类型是否完整
- [ ] 注释是否必要且准确
- [ ] 是否引入不必要的依赖
```

## 2. 自动化审查

```yaml
# .github/workflows/pr-review.yml
name: PR Review
on: pull_request
jobs:
  auto-review:
    steps:
      - name: Size check
        uses: codacy/git-version@v2
        # 限制 PR 大小（< 400 行变更）

      - name: Danger JS
        run: npx danger ci
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

```javascript
// dangerfile.js
import { danger, fail, warn, message } from 'danger';

// PR 过大
if (danger.github.pr.additions + danger.github.pr.deletions > 500) {
  warn('PR 过大，建议拆分');
}

// 缺少测试
const hasTestChanges = danger.git.modified_files.some((f) => f.includes('.test.'));
const hasSrcChanges = danger.git.modified_files.some((f) => f.startsWith('src/'));
if (hasSrcChanges && !hasTestChanges) {
  fail('源码变更缺少测试');
}

// 禁止 console.log
const jsFiles = danger.git.modified_files.filter((f) => f.endsWith('.js'));
for (const file of jsFiles) {
  const content = await danger.github.utils.fileContents(file);
  if (content.includes('console.log')) {
    fail(`${file} 包含 console.log`);
  }
}
```
