# GitHub Actions CI/CD

自动化构建、测试、安全和部署是 Node.js 工程化的基石。

## 完整工作流

```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm typecheck

      - name: Test
        run: pnpm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm audit --audit-level moderate
      - uses: github/codeql-action/init@v3
      - uses: github/codeql-action/analyze@v3

  build-and-push:
    needs: [lint-and-test, security]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:latest,ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to K8s
        run: |
          echo "${{ secrets.KUBECONFIG }}" | base64 -d > kubeconfig
          kubectl --kubeconfig=kubeconfig set image deployment/api api=ghcr.io/${{ github.repository }}:${{ github.sha }}
          kubectl --kubeconfig=kubeconfig rollout status deployment/api
```

## 关键设计

- `install --frozen-lockfile` 确保 CI 与本地 lockfile 一致。
- 并行执行 lint / test / security，减少总耗时。
- Docker 使用 BuildKit + GHA cache，构建速度提升 50%+。
- 安全扫描（audit + CodeQL）放在构建前，阻止漏洞上线。
- 部署使用 `rollout status` 等待健康检查通过，失败自动回滚。
