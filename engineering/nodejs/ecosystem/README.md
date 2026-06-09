# Node.js Ecosystem

## 生态主题

| 主题 | 关键点 |
| --- | --- |
| Package Manager | npm、pnpm、yarn、workspace |
| Module Format | CJS、ESM、dual package、exports |
| Native Addon | node-gyp、N-API |
| Supply Chain | lockfile、audit、provenance |
| Runtime Alternatives | Bun、Deno、Edge runtime |
| Tooling | ts-node、tsx、nodemon、PM2 |
| Monorepo | pnpm workspaces、Turborepo、changesets |

## 资产

| 资产 | 目录 | 说明 |
| --- | --- | --- |
| CJS / ESM compatibility | `cjs-esm/` | 互操作规则、迁移 checklist、TypeScript 配置 |
| Package exports design | `package-exports/` | exports 字段最佳实践、条件导出、验证工具 |
| Supply chain checklist | `supply-chain/` | 依赖安全、Secret 防护、发布安全 |
| Monorepo with pnpm + Turborepo | `monorepo/` | workspaces、turbo.json、changesets、共享包 |
