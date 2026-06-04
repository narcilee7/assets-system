# TypeScript 模块系统深度解析

这一层理解 TypeScript 的模块解析策略、与 JavaScript 模块系统的交互、以及声明文件的工程实践。

---

## 目录

| 文件 | 主题 |
|------|------|
| [`esm-vs-cjs.md`](esm-vs-cjs.md) | ESM / CJS / UMD / AMD 的历史与差异 |
| [`module-resolution.md`](module-resolution.md) | classic / node / nodenext / bundler 策略对比 |
| [`declaration-files.md`](declaration-files.md) | `.d.ts` 编写、三斜线指令、模块增强 |
| [`package-json-types.md`](package-json-types.md) | `types`、`exports`、`imports` 字段详解 |

---

## 核心问题

1. `moduleResolution: node` 和 `nodenext` 有什么本质区别？
2. 如何为没有类型的第三方库编写声明文件？
3. `package.json` 的 `exports` 字段如何影响类型解析？
4. 什么是「模块增强」（module augmentation）？什么时候用？

---

## 关联训练场

- `../core-abstractions/module-resolution-lab/` — 模块解析实验
