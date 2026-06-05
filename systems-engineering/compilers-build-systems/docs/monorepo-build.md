# Monorepo Build Architecture

## 目标

理解 Monorepo 的构建挑战：大规模代码库的组织、依赖管理、构建系统选型（Bazel/Turborepo/Nx）、远程缓存和 CI 集成，以及代码共享与版本发布的平衡。

## 场景

- Monorepo 和 Polyrepo 怎么选？
- Google 为什么用一个仓库放所有代码？
- Bazel 适合前端项目吗？
- 大规模仓库的 Git 性能怎么解决？
- Monorepo 中的版本发布怎么做？

## Monorepo vs Polyrepo

```
Monorepo（单仓库）：
  repo/
    ├── web/          # 前端应用
    ├── mobile/       # App
    ├── api/          # 后端服务
    ├── shared/       # 共享库
    ├── infra/        # 基础设施
    └── .github/workflows/

Polyrepo（多仓库）：
  web-repo/     mobile-repo/     api-repo/
  shared-lib/   infra-repo/
```

| 维度 | Monorepo | Polyrepo |
|---|---|---|
| 代码共享 | 直接引用，原子重构 | 发布/消费 npm/maven 包 |
| 原子提交 | 跨项目修改一次提交 | 多仓库协调，困难 |
| 依赖管理 | 统一版本，无 diamond dependency | 各管各，版本冲突 |
| 构建复杂度 | 高（需要智能构建系统） | 低（各项目独立） |
| CI/CD | 需支持 affected tests | 简单，按仓库触发 |
| 权限控制 | 细粒度 ACL 挑战 | 仓库级 ACL 简单 |
| 规模限制 | Git 性能、构建系统 | 无（理论上） |

## 大规模 Monorepo 的挑战

### Git 性能

```
问题：
  - Linux 内核 10 年历史 → .git 目录庞大
  - git status、git log 变慢
  - clone 时间长

解决方案：

1. Partial Clone（Git 2.25+）：
   git clone --filter=blob:none <url>
   → 不下载文件内容，按需获取

2. Sparse Checkout：
   git sparse-checkout init --cone
   git sparse-checkout set web shared
   → 只 checkout 指定目录

3. Virtual Filesystem（VFS for Git / Scalar）：
   - 微软为 Windows 开发
   - 按需下载文件内容
   - 本地看起来像完整仓库

4. Git LFS：
   - 大文件（图片、二进制）存外部存储
   - Git 只存指针

5. 分区仓库（Submodule / Subtree）：
   - 把历史或独立模块拆出去
   - 但破坏了 Monorepo 的原子性
```

### 构建性能

```
问题：
  - 10,000 个包，改了 1 个文件
  - 应该只构建受影响的包及其下游

Affected 检测：
  - 对比当前分支和 base 分支（如 main）
  - 找出变更的文件
  - 根据依赖图计算受影响的目标

工具：
  - Bazel query：强大的依赖查询
  - Nx affected：基于项目图
  - Turborepo：基于包依赖
  - Rush：微软的 Monorepo 工具
```

## 构建系统选型

### Bazel

```
适用：大规模、多语言、需要 hermetic build

优势：
  - 精确的增量构建（沙箱 + 内容哈希）
  - 远程缓存和远程执行
  - 多语言支持（C++、Java、Go、Python、JS）

劣势：
  - 学习曲线陡峭（Starlark、BUILD 文件）
  - 前端生态支持较弱
  - 需要维护工具链

代表用户：
  Google、Uber、Twitter/X、Dropbox
```

### Nx

```
适用：TypeScript/JavaScript 为主的 Monorepo

优势：
  - 原生支持 npm/yarn/pnpm workspace
  - 强大的 affected 检测和并行执行
  - 插件生态丰富（React、Angular、Node）
  - 远程缓存（Nx Cloud）

劣势：
  - 主要针对 JS/TS
  - 不如 Bazel 的 hermetic 保证强

代表用户：
  中型前端项目、全栈 TypeScript 项目
```

### Turborepo

```
适用：JavaScript/TypeScript，追求简单和速度

优势：
  - 零配置（利用 package.json scripts）
  - 管道（pipeline）定义任务依赖
  - 本地和远程缓存
  - 与 pnpm/yarn/npm workspace 无缝集成

劣势：
  - 功能比 Nx 简单
  - 无代码生成、无插件生态
  - JS/TS only

配置示例：
  {
    "pipeline": {
      "build": {
        "dependsOn": ["^build"],
        "outputs": ["dist/**"]
      },
      "test": {
        "dependsOn": ["build"]
      }
    }
  }
```

### Pants

```
适用：Python、Java、Scala、Go 的 Monorepo

特点：
  - 自动推断依赖（减少 BUILD 文件维护）
  - 细粒度目标（文件级而非目录级）
  - 远程缓存

代表用户：
  Twitter（早期）、Shopify（部分）
```

## 依赖图管理

### 内部依赖

```
Monorepo 中的包依赖：

  shared-ui ──► shared-utils
       │
       ▼
     web-app

版本管理：
  - 统一版本（Single Version Policy）：所有包同一版本号
  - 独立版本（Independent Versioning）：各包自行发版

工具：
  - Changesets：独立版本管理 + 变更日志生成
  - Lerna：已过时，被 Nx 替代
  - Rush：微软的方案
```

### 外部依赖

```
问题：不同包依赖不同版本的 lodash

方案 1：Single Version Policy
  - 强制所有包用同一版本
  - 由根 package.json 控制
  - 简单，但可能阻塞升级

方案 2：自动 deduplication
  - npm/yarn/pnpm 自动 hoist 公共依赖
  - 冲突时允许多版本共存
  - 需要验证运行时行为

方案 3：Bazel 的外部仓库
  - 每个外部依赖明确声明版本
  - 不允许隐式依赖
  - 精确控制，无 diamond dependency 问题
```

## CI/CD 集成

### Affected CI

```
目标：只运行受变更影响的测试和构建

流程：
  1. 检测变更文件（git diff main...HEAD）
  2. 计算 affected 项目（依赖图分析）
  3. 并行构建 affected 项目
  4. 并行运行 affected 测试
  5. 部署 affected 服务

工具集成：
  - GitHub Actions：dorny/paths-filter、Nx affected
  - GitLab CI：rules:changes
  - CircleCI：path-filtering orb

示例（Nx）：
  nx affected:build --base=origin/main --head=HEAD
  nx affected:test --base=origin/main --head=HEAD
```

### 远程缓存

```
目标：CI 构建结果共享给团队成员

架构：
  Developer ──► Local Cache ──► Remote Cache (S3/Vercel/Nx Cloud)
                                    │
  CI Pipeline ──► Remote Cache ◄────┘

收益：
  - 开发者本地构建秒级（复用 CI 结果）
  - CI 并行构建，结果缓存
  - 新分支无需从零构建

安全：
  - 缓存 key 基于输入哈希，不可伪造
  - 敏感信息不应出现在缓存中（用环境变量注入）
```

## 版本发布

### 统一版本（Fixed/Locked）

```
所有包同一版本号：
  v1.2.3 → shared-ui@1.2.3, shared-utils@1.2.3, web-app@1.2.3

适用：
  - 紧密耦合的产品套件
  - 一起发布的应用和库

工具：
  - Lerna fixed mode（已不推荐）
  - Nx release

流程：
  1. 变更集积累（conventional commits）
  2. 自动计算新版本（semver）
  3. 生成 CHANGELOG
  4. git tag + npm publish
```

### 独立版本（Independent）

```
各包独立发版：
  shared-ui@2.1.0, shared-utils@1.5.3, web-app@3.0.0

适用：
  - 多个独立产品共享基础设施
  - 库需要 semver 兼容保证

工具：
  - Changesets
  - Rush publish

流程：
  1. PR 附带 changeset 文件（描述变更和影响）
  2. 合并后 CI 计算每个包的版本变化
  3. 自动发版和更新依赖
```

## 核心追问

1. **Google 为什么能坚持用一个仓库？** 强大的内部工具：自定义 Piper（基于 Bigtable 的版本控制）、TAP（全球分布式构建系统）、Gerrit 代码审查；普通公司没有这些基础设施
2. **Monorepo 的 Git 性能瓶颈最终怎么解决？** 分层方案：VFS/Scalar 按需加载、Partial Clone、Sparse Checkout；终极方案是代码托管平台原生支持（如 GitHub 的 large monorepo 优化）
3. **Bazel 为什么不流行于前端？** 前端生态变化快（每周新工具），Bazel 的显式声明和工具链配置跟不上；前端更喜欢零配置工具（Turborepo、Vite）
4. **远程缓存的命中率怎么提升？** 消除非确定性输入（时间戳、绝对路径）、统一开发环境（Docker devcontainer）、减少环境变量差异、预构建外部依赖
5. **Monorepo 中循环依赖怎么发现和处理？** 构建系统分析依赖图时检测环（Bazel 禁止、Nx 报错）；业务上拆分公共逻辑到独立包，或合并强耦合的包

## 状态

| 资产 | 状态 |
|---|---|
| compiler pipeline notes | done |
| build graph and cache | done |
| incremental build design | done |
| monorepo build architecture | done |
