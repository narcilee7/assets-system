# 质量门禁

## 1. 门禁层级

```
PR 创建
  │
  ├── Stage 1: Fast（< 30s）
  │     ├─ lint
  │     └─ format check
  │
  ├── Stage 2: Medium（< 2min）
  │     ├─ type check
  │     └─ unit test（affected）
  │
  ├── Stage 3: Slow（< 5min）
  │     ├─ build
  │     ├─ bundle size check
  │     └─ visual regression
  │
  └── Stage 4: Deploy
        └─ preview environment
```

## 2. Bundle Size 门禁

```javascript
// bundlesize.config.js
module.exports = {
  files: [
    {
      path: './dist/*.js',
      maxSize: '200kB',
      compression: 'gzip',
    },
    {
      path: './dist/vendor.*.js',
      maxSize: '500kB',
      compression: 'gzip',
    },
  ],
};

// CI 中
// npx bundlesize
```

## 3. 测试覆盖率门禁

```yaml
# vitest.config.ts
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html'],
    thresholds: {
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80,
    },
  },
}
```

## 4. 完整的 Quality Gate

```yaml
jobs:
  quality-gate:
    steps:
      - name: Lint
        run: pnpm lint

      - name: Format check
        run: pnpm format:check

      - name: Type check
        run: pnpm typecheck

      - name: Unit test
        run: pnpm test:unit --coverage

      - name: Bundle size
        run: pnpm bundlesize

      - name: Lighthouse CI
        run: pnpm lhci autorun

      - name: Build
        run: pnpm build
```
