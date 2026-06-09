# 发布平台

## 1. NPM 发布

```bash
# .npmrc
registry=https://registry.npmjs.org/
//registry.npmjs.org/:_authToken=${NPM_TOKEN}

# 发布前检查
npm whoami                    # 确认登录
npm pack --dry-run            # 预览发布内容
npm publish --dry-run         # 预览发布过程

# 正式发布
npm publish --access public   # Scoped 包必须指定 public

# 发布后验证
npm view @my-ui/components    # 查看包信息
npm install @my-ui/components@latest  # 测试安装
```

```json
// package.json 发布配置
{
  "name": "@my-ui/components",
  "version": "1.2.3",
  "description": "My UI Component Library",
  "main": "dist/index.cjs.js",
  "module": "dist/index.es.js",
  "types": "dist/index.d.ts",
  "files": ["dist", "README.md", "LICENSE"],
  "sideEffects": ["*.css"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.es.js",
      "require": "./dist/index.cjs.js"
    },
    "./style.css": "./dist/style/index.css"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/my-org/my-ui.git"
  },
  "keywords": ["react", "components", "ui"],
  "license": "MIT",
  "peerDependencies": {
    "react": ">=16.8.0",
    "react-dom": ">=16.8.0"
  }
}
```

## 2. 私有 Registry

```bash
# Verdaccio（自建私有 Registry）
npm install -g verdaccio
verdaccio  # 启动

# .npmrc
registry=http://localhost:4873
//localhost:4873/:_authToken=xxx

# 发布到私有 Registry
npm publish --registry http://localhost:4873
```

## 3. CDN 分发

```bash
# 构建后上传到 CDN
# 使用 unpkg / jsdelivr（NPM 包自动同步）

# 用户可通过 CDN 引入
# <script src="https://unpkg.com/@my-ui/components@1.2.3/dist/index.umd.js"></script>
# <link rel="stylesheet" href="https://unpkg.com/@my-ui/components@1.2.3/dist/style.css">

# 或自建 CDN（S3 + CloudFront）
aws s3 sync dist/ s3://my-ui-cdn/components/1.2.3/ --acl public-read
```

## 4. 产物验证

```bash
# 发布前自动化验证
# validate-build.js
const fs = require('fs');
const path = require('path');

function validateBuild() {
  const dist = path.resolve('dist');
  const errors = [];

  // 检查必要文件
  const requiredFiles = [
    'index.es.js',
    'index.cjs.js',
    'index.d.ts',
    'style/index.css',
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(dist, file))) {
      errors.push(`Missing: ${file}`);
    }
  }

  // 检查 package.json 一致性
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!pkg.main || !pkg.module || !pkg.types) {
    errors.push('Missing exports in package.json');
  }

  // 检查 peerDependencies
  if (!pkg.peerDependencies?.react) {
    errors.push('Missing react in peerDependencies');
  }

  if (errors.length > 0) {
    console.error('Build validation failed:');
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('Build validation passed!');
}

validateBuild();
```
