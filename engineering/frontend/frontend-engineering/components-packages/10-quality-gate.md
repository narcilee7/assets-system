# 质量门禁

## 1. Bundle Size 监控

```javascript
// bundlesize.config.js
module.exports = {
  files: [
    {
      path: './dist/index.es.js',
      maxSize: '50 kB',
      compression: 'gzip',
    },
    {
      path: './dist/index.cjs.js',
      maxSize: '50 kB',
      compression: 'gzip',
    },
    {
      path: './dist/style/index.css',
      maxSize: '20 kB',
      compression: 'gzip',
    },
  ],
};
```

```yaml
# .github/workflows/bundle-size.yml
name: Bundle Size
on: [pull_request]
jobs:
  size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: preactjs/compressed-size-action@v2
        with:
          pattern: './dist/**/*.{js,css}'
          strip-hash: true
```

## 2. 完整 CI 门禁

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm format:check

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test:coverage
      - uses: codecov/codecov-action@v3

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm build
      - run: pnpm validate-build  # 自定义验证脚本

  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm build
      - run: pnpm bundlesize

  visual:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm build-storybook
      - run: pnpm chromatic --project-token=${{ secrets.CHROMATIC_TOKEN }}
```

## 3. Danger JS（PR 自动化审查）

```javascript
// dangerfile.ts
import { danger, fail, warn, message } from 'danger';

// 1. 检查 Bundle Size 变化
const packageSize = danger.git.fileMatch('dist/index.es.js');
if (packageSize.modified) {
  warn('Bundle size changed. Please verify this is expected.');
}

// 2. 检查是否更新了测试
const hasTestChanges = danger.git.modified_files.some((f) => f.includes('.test.'));
const hasSrcChanges = danger.git.modified_files.some((f) => f.startsWith('src/'));
if (hasSrcChanges && !hasTestChanges) {
  fail('Source code changes should include test updates.');
}

// 3. 检查是否更新了文档
const hasDocChanges = danger.git.modified_files.some(
  (f) => f.includes('.stories.') || f.includes('docs/')
);
const hasNewComponent = danger.git.created_files.some((f) => f.startsWith('src/components/'));
if (hasNewComponent && !hasDocChanges) {
  fail('New components must include Storybook documentation.');
}

// 4. 检查是否更新了 Changeset
const hasChangeset = danger.git.created_files.some((f) => f.startsWith('.changeset/'));
if (hasSrcChanges && !hasChangeset) {
  fail('Please add a changeset for your changes: `pnpm changeset`');
}

// 5. 检查大文件
const bigFiles = danger.git.created_files.filter((f) => {
  const content = danger.github.utils.fileContents(f);
  return content.length > 500;
});
if (bigFiles.length > 0) {
  warn(`Large files detected: ${bigFiles.join(', ')}`);
}
```
