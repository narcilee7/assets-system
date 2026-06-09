# Webpack

## 1. 核心概念

```
Entry -> Loaders -> Plugins -> Output
  │       │          │          │
  │       │          │          └─ 产物文件
  │       │          └─ 扩展构建流程
  │       └─ 转换非 JS 文件
  └─ 入口文件
```

```javascript
// webpack.config.js
module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash:8].js',
    clean: true,
  },
  module: {
    rules: [
      { test: /\.js$/, use: 'babel-loader' },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      { test: /\.(png|svg)$/, type: 'asset/resource' },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({ template: './index.html' }),
    new MiniCssExtractPlugin(),
  ],
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },
};
```

## 2. Loader 原理

```javascript
// Loader 就是一个函数：接收源文件，返回转换后的内容
module.exports = function (source) {
  // this 包含 loader 上下文（options、resourcePath 等）
  const options = this.getOptions();

  // 同步返回
  return source.replace(/console\.log\(.*\);/g, '');

  // 或异步
  const callback = this.async();
  someAsyncOperation(source, (err, result) => {
    callback(err, result);
  });
};
```

## 3. Plugin 原理

```javascript
// Plugin 是一个带有 apply 方法的类
class MyPlugin {
  apply(compiler) {
    // 在编译完成时执行
    compiler.hooks.done.tap('MyPlugin', (stats) => {
      console.log('Build complete!');
    });

    // 在生成 asset 时执行
    compiler.hooks.emit.tapAsync('MyPlugin', (compilation, callback) => {
      const filelist = Object.keys(compilation.assets).join('\n');
      compilation.assets['filelist.md'] = {
        source: () => filelist,
        size: () => filelist.length,
      };
      callback();
    });
  }
}
```

## 4. Tree Shaking

```javascript
// Webpack 通过 ES Module 的静态分析实现 Tree Shaking
// 条件：使用 ES Module（import/export）+ sideEffects 配置

// package.json
{
  "sideEffects": [
    "*.css",
    "*.scss",
    "./src/polyfill.js"
  ]
}

// 或 false 表示无副作用（全部可摇）
{ "sideEffects": false }
```

## 5. Code Splitting

```javascript
// 动态导入（自动拆包）
const module = await import('./heavy-module.js');

// 预加载
const OtherComponent = lazy(() => import(
  /* webpackChunkName: "other" */
  /* webpackPrefetch: true */
  './OtherComponent'
));

// SplitChunks 配置
optimization: {
  splitChunks: {
    chunks: 'all',
    minSize: 20000,      // 20KB 以下不拆
    maxSize: 244000,     // 超过 244KB 尝试二次拆分
    minChunks: 1,
    maxAsyncRequests: 30,
    maxInitialRequests: 30,
    cacheGroups: {
      defaultVendors: {
        test: /[\\/]node_modules[\\/]/,
        priority: -10,
        reuseExistingChunk: true,
      },
      default: {
        minChunks: 2,
        priority: -20,
        reuseExistingChunk: true,
      },
    },
  },
}
```
