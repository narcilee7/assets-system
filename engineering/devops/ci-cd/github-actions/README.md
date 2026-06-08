# GitHub Actions CI/CD

## 目标

训练 GitHub Actions 流水线设计：触发条件、Job 并行、Step 复用、Matrix 构建、缓存策略、Secrets 管理。

## 核心概念

| 概念 | 解释 |
| --- | --- |
| Workflow | 自动化流程的整体定义 |
| Job | 一次构建/部署任务 |
| Step | Job 中的具体步骤 |
| Action | 可复用的 Step 包装 |
| Runner | 执行 Job 的机器 |
| Matrix | 多版本/多平台并行 |

## 触发条件

| 触发器 | 使用场景 |
| --- | --- |
| push | 代码提交触发 |
| pull_request | PR 创建/更新触发 |
| workflow_dispatch | 手动触发 |
| schedule | 定时触发（Cron） |
| release | 发布标签触发 |
| issue_comment | Issue 评论触发 |

## CI 流水线设计

```yaml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test
      - run: npm run lint

  build:
    needs: test  # 依赖 test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker image
        run: docker build -t myapp:${{ github.sha }} .

  deploy:
    needs: build  # 依赖 build
    if: github.ref == 'refs/heads/main'  # 只在 main 分支部署
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: ./deploy.sh
```

## CD 流水线设计

```yaml
name: CD Pipeline

on:
  push:
    tags:
      - 'v*'  # 发布标签触发

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}

    steps:
      - uses: actions/checkout@v4
      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: type=semver,pattern={{version}}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: ${{ steps.meta.outputs.tags }}

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/myapp \
            myapp=${{ needs.build-and-push.outputs.image-tag }}
```

## 缓存策略

```yaml
- name: Cache node_modules
  uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-npm-

- name: Cache Docker layers
  uses: actions/cache@v4
  with:
    path: /tmp/.docker-build-cache
    key: ${{ runner.os }}-docker-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-docker-
```

## Matrix 构建

```yaml
jobs:
  test-matrix:
    strategy:
      matrix:
        node-version: [18, 20, 22]
        os: [ubuntu-latest, windows-latest]
      fail-fast: false  # 一个失败不影响其他

    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm test
```

## Secrets 管理

| Secret | 说明 |
| --- | --- |
| `GITHUB_TOKEN` | 自动提供的 GitHub API token |
| `secrets.*` | 用户定义的 secrets |
| `vars.*` | 用户定义的 non-sensitive 变量 |

- Secrets 不在日志中输出
- 环境变量需要显式映射
- 使用 `replace` 而非 `set-output` 避免 secrets 泄露

## 面试追问

- 如何加速 CI 流水线？
  （答：缓存依赖、并行 Job、减少镜像构建层、跳过不必要的 Step）
- 如何保证部署的安全性？
  （答：环境分支隔离、审批机制、Secrets 最小权限、镜像签名）
- GitHub Actions 和 Jenkins 的区别？
  （答：GitHub Actions 云原生、配置简单；Jenkins 灵活、自托管、需要自己维护）

## 相关模式

- `container-orchestration/`：Docker 镜像构建
- `kubernetes/`：K8s 部署
- `secret-management/`：Secrets 注入