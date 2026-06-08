# 手写构建脚本

## 核心目标

实现一个简化版构建脚本，支持：
1. TypeScript → ESM + CJS 双格式输出
2. 提取每个组件的 CSS 到独立文件
3. 生成 .d.ts 声明文件
4. 生成 package.json exports

## 实现

```javascript
// build.js
const fs = require('fs');
const path = require('path');
const { transformSync } = require('@swc/core');
const postcss = require('postcss');

const SRC = path.resolve('src');
const DIST = path.resolve('dist');

async function clean() {
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true });
  }
  fs.mkdirSync(DIST, { recursive: true });
}

async function compileJS(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');

  // ESM
  const esm = transformSync(code, {
    jsc: { parser: { syntax: 'typescript', tsx: true }, target: 'es2020' },
    module: { type: 'es6' },
  });

  // CJS
  const cjs = transformSync(code, {
    jsc: { parser: { syntax: 'typescript', tsx: true }, target: 'es2020' },
    module: { type: 'commonjs' },
  });

  return { esm: esm.code, cjs: cjs.code };
}

async function compileCSS(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const result = await postcss([require('autoprefixer')]).process(code, { from: filePath });
  return result.css;
}

async function build() {
  await clean();

  const components = fs.readdirSync(SRC).filter((f) => {
    return fs.statSync(path.join(SRC, f)).isDirectory() && f !== 'index.ts';
  });

  // 编译每个组件
  for (const component of components) {
    const componentDir = path.join(SRC, component);
    const files = fs.readdirSync(componentDir);

    const tsFile = files.find((f) => f.endsWith('.tsx') || f.endsWith('.ts'));
    const cssFile = files.find((f) => f.endsWith('.css'));

    if (!tsFile) continue;

    const outDir = path.join(DIST, component);
    fs.mkdirSync(outDir, { recursive: true });

    // JS
    const { esm, cjs } = await compileJS(path.join(componentDir, tsFile));
    fs.writeFileSync(path.join(outDir, 'index.js'), esm);
    fs.writeFileSync(path.join(outDir, 'index.cjs'), cjs);

    // CSS
    if (cssFile) {
      const css = await compileCSS(path.join(componentDir, cssFile));
      fs.writeFileSync(path.join(outDir, 'style.css'), css);
    }
  }

  // 编译入口
  const { esm, cjs } = await compileJS(path.join(SRC, 'index.ts'));
  fs.writeFileSync(path.join(DIST, 'index.js'), esm);
  fs.writeFileSync(path.join(DIST, 'index.cjs'), cjs);

  // 生成 package.json exports
  const exports = {
    '.': {
      import: './index.js',
      require: './index.cjs',
    },
  };
  for (const component of components) {
    exports[`./${component}`] = {
      import: `./${component}/index.js`,
      require: `./${component}/index.cjs`,
    };
    exports[`./${component}/style.css`] = `./${component}/style.css`;
  }

  console.log('Build complete!');
  console.log('Exports:', JSON.stringify(exports, null, 2));
}

build().catch(console.error);
```

## 产物结构

```
dist/
├── index.js          # ESM 入口
├── index.cjs         # CJS 入口
├── button/
│   ├── index.js      # ESM
│   ├── index.cjs     # CJS
│   └── style.css     # 样式
├── input/
│   ├── index.js
│   ├── index.cjs
│   └── style.css
└── ...
```
