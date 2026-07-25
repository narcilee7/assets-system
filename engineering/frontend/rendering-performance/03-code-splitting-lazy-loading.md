# 代码分割与懒加载

## 代码分割

### Bundle

让浏览器在首屏只下载和执行必要的代码，其余代码在构建阶段就被物理隔离到独立 chunk 中。

从浏览器角度看：
下载一个 1MB 的 bundle → 解析 1MB 的 JS → 执行 1MB 的 JS → 主线程被占用很久
下载一个 200KB 的 initial bundle + 按需加载 800KB → 首屏解析执行时间大幅下降
代码分割优化的是 JS 解析（Parse）和执行（Execute）时间，不是下载时间。HTTP/2 下，下载 1 个 1MB 和下载 5 个 200KB 的总传输时间可能差不多，但解析 5 个 200KB 的 chunk 可以交错进行，且初始只解析 1 个。

#### 构建工具实现差异

##### Webpack: splitChunks的完整矩阵

```js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: "all",
      minSize: 20000,,
      minChunks: 1,
      maxAsyncRequests: 30,
      maxInitialRequests: 30,
      cacheGroups: {
        // 默认 vendor 组
        defaultVendors: {
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          reuseExistingChunk: true,
        },
        // 默认公共模块组
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true,
        },
      },
    }
  }
}
```

| 配置                         | 作用                 | 陷阱                                                   |
| -------------------------- | ------------------ | ---------------------------------------------------- |
| `chunks: 'async'`          | 只对动态 `import()` 分割 | 同步导入的第三方库仍被打入 initial bundle，首屏体积不减少                 |
| `chunks: 'initial'`        | 只对同步导入分割           | 动态导入不分割，懒加载失效                                        |
| `chunks: 'all'`            | 同步异步都分割            | 可能增加 initial chunk 数量，需配合 `maxInitialRequests`       |
| `maxSize`                  | 超过则尝试拆分            | 拆得太碎会导致**runtime 膨胀**（webpack 需要更多加载器代码来管理 chunk 关系） |
| `reuseExistingChunk: true` | 复用已存在的 chunk       | 避免重复打包同一模块，但可能让 chunk 依赖关系变复杂                        |

Webpack 5 的 Granular Chunking（默认优化）：
不再把 node_modules 打成一个 vendors.js，而是按包名拆分
好处：更新一个依赖只失效该依赖的 chunk，长期缓存更稳定
代价：chunk 数量增加，但 HTTP/2 下多路复用可以承受

##### Rollup/Vite：更静态的分割模型

```js
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        // 手动指定 chunk
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // 按包名分 chunk
            return id.toString().split('node_modules/')[1].split('/')[0];
          }
          // 按业务模块分
          if (id.includes('/src/modules/admin/')) {
            return 'admin';
          }
        },
      },
    },
  },
};
```

面试点：Rollup 与 Webpack 的分割哲学差异

|                | Webpack                                           | Rollup                           |
| -------------- | ------------------------------------------------- | -------------------------------- |
| **分割时机**       | 运行时动态（有 chunk 加载器 runtime）                        | 构建时静态（输出 ESM，依赖浏览器原生 `import()`） |
| **Runtime 体积** | 较大（需要 chunk 映射表、加载逻辑）                             | 极小（几乎无 runtime，靠浏览器 ESM）         |
| **循环依赖处理**     | 支持（CommonJS 兼容层）                                  | 严格，ESM 循环依赖行为与规范一致               |
| **分割粒度控制**     | 配置化（cacheGroups）                                  | 声明式（manualChunks）                |
| **动态导入**       | `import()` 被编译为 webpack 的 `__webpack_require__.e` | `import()` 保持为原生浏览器 `import()`   |

关键差异： Webpack 的代码分割是构建工具自己管理 chunk 关系和加载顺序，Rollup/Vite 是构建工具只负责拆文件，加载完全交给浏览器 ESM。这意味着 Vite 的 import() 没有 webpack 的"chunk 加载器"开销，但浏览器必须支持 ESM 动态导入。

##### esbuild:

esbuild 的代码分割：
支持 splitting: true（仅对 ESM 格式）
自动按入口点分割共享代码
不支持 manualChunks，粒度控制很弱

```js
// esbuild
esbuild.build({
  entryPoints: ['src/app.js', 'src/admin.js'],
  bundle: true,
  splitting: true,
  format: 'esm',
  outdir: 'dist',
});
```

esbuild 为什么快？因为它不做完整的依赖图分析，分割策略简单。但也因此不适合复杂业务场景，通常用于库构建或简单应用。

#### Turbopack：Webpack 的继任者？
Turbopack（Next.js 13+ 默认）基于 Rust，声称是"Webpack 的 700 倍快"：
代码分割策略与 Webpack 类似（兼容 splitChunks 配置）
但增量编译架构，开发时只重新编译变更的模块
生产构建的代码分割输出与 Webpack 5 兼容
面试点： Turbopack 目前仍在演进中，其代码分割的长期缓存稳定性（chunk hash 一致性）是核心挑战——增量编译必须保证相同输入产生相同的 chunk 边界，否则缓存失效。

### 模块联邦

```js
// 宿主应用（Host）
const RemoteButton = lazy(() => import('remoteApp/Button'));

// remoteApp 是另一个独立部署的应用
// Button 组件的代码不在 Host 的构建产物中，运行时从 remoteApp 加载
```

| 概念         | 作用                   |
| ---------- | -------------------- |
| **Host**   | 消费远程模块的应用            |
| **Remote** | 暴露模块供其他应用消费的应用       |
| **Shared** | 共享依赖（如 React），避免重复加载 |

1. Module Federation 是"运行时代码分割"
传统代码分割：构建时决定 chunk 边界，运行时按路径加载
Module Federation：构建时不知道远程模块的内容，运行时通过 Container Entry 动态发现和加载
2. Shared Dependencies的陷阱：
```js
// webpack.config.js
new ModuleFederationPlugin({
  shared: {
    react: { singleton: true, requiredVersion: '^18.0.0' },
  },
});
```
singleton: true：所有应用共享同一个 React 实例
如果 Remote 用了 React 18.2，Host 用了 React 18.3，浏览器加载哪个？
答案：版本协商机制。webpack 运行时比较 requiredVersion 和实际版本，加载满足所有约束的最高版本。如果无法满足，fallback 到各自加载。
3. 与微前端的关系
Module Federation 是模块级别的共享，不是应用级别的隔离
它解决的是"代码复用"问题，不是"运行时隔离"问题（CSS 冲突、JS 全局污染仍需自行处理)

代码分割是构建时对依赖图的物理切割，它的质量取决于粒度控制（不过度、不不足）、缓存策略（content hash + runtime 独立）、工具选择（Webpack 的灵活 vs Rollup 的简洁 vs RSC 的终极形态）。面试时要把"为什么拆"、"怎么拆"、"拆完后怎么加载"三个层次都说清楚。

## 懒加载

**懒加载的本质：不是"晚加载"，是"按需加载 + 预加载调度"**

三层时序控制：

| 层级       | 触发时机                   | 用户体验            |
| -------- | ---------------------- | --------------- |
| **即时加载** | 代码执行到 `import()` 时     | 用户看到 Loading，等待 |
| **预加载**  | 预测需要时（hover、滚动接近、路由预取） | 用户无感知，资源已就绪     |
| **空闲加载** | 浏览器主线程空闲时              | 用户完全无感知，但可能浪费带宽 |


### 按照资源类型的懒加载实现

#### JS模块：`import()`的精确语义

```js
const module = await import('./heavy-module.js');
```

底层发生了什么：
1. 发起 HTTP 请求（如果该 chunk 未被缓存）
2. 下载完成后，解析模块（Parse Module）
3. 执行模块顶层代码（Execute Module）
4. 返回 Module Namespace Object

面试深挖点：
- import() 返回的是 Promise，但模块内的顶层代码是同步执行的。如果 heavy-module.js 里有 for (let i = 0; i < 1e9; i++) {}，await import() 会阻塞直到循环结束。
- 浏览器会缓存动态导入的模块。同一个 URL 的 import() 第二次调用直接返回缓存的 Promise。
- 错误处理：网络失败或解析错误会 reject，必须用 try/catch 或 Error Boundary（React）捕获。

#### 图片懒加载：原生 `loading="lazy"`

```html
<img src="image.jpg" loading="lazy" alt="Lazy Image">
```

浏览器行为：
图片在视口外时不加载
接近视口时（通常提前 3000px 或根据网络条件调整）开始加载
必须提供 width/height，否则浏览器无法计算图片是否接近视口

LCP 图片绝对不能懒加载。如果首屏最大的内容是一张图，给它加 loading="lazy"，浏览器会等到它接近视口才加载，LCP 直接爆炸。
loading="lazy" 在服务端渲染时，服务端不会执行懒加载逻辑，所有图片在 SSR 输出中都是完整 URL。客户端 hydrate 后，浏览器根据视口位置决定是否加载。这意味着 SSR 输出的 HTML 中，懒加载图片的 URL 对爬虫可见（SEO 友好）。

#### Intersection Observer 懒加载

```js
const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            observer.unobserve(img);
        }
    });
}, {
  rootMargin: '200px', // 提前 200px 开始加载
  threshold: 0.01,
});

document.querySelectorAll('img[data-src]').forEach((img) => {
    observer.observe(img);
});
```

面试点：
- rootMargin 是性能杠杆。设太小，用户滚动到图片时还没加载完，看到白块；设太大，浪费带宽加载不可见内容。通常 200-400px 是平衡值。
- threshold 是可见比例阈值，图片懒加载通常用 0 或 0.01（刚进入视口就加载）。
- Intersection Observer 是异步回调，不阻塞主线程，比 scroll 事件监听性能高得多。

#### 路由懒加载：SPA标配

```js
// React
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Vue
const Dashboard = defineAsyncComponent(() => import('./pages/Dashboard.vue'));

// 配合路由
{
  path: '/dashboard',
  component: Dashboard,
}
```

路由切换时，如果目标路由的 chunk 还没下载，用户会看到白屏或 Loading。怎么优化？
预加载：hover 链接时 import('./pages/Dashboard')
骨架屏：Suspense fallback 必须和真实页面结构一致，否则触发 CLS
错误边界：chunk 加载失败（网络抖动、部署后旧 chunk 被清理）时，需要降级处理

#### 数据懒加载：组件挂载后才请求

```js
// ❌ 瀑布流：组件加载完才发请求
function Comments() {
  const { data } = useQuery('/api/comments'); // 组件 mount 后才执行
  return <div>{data}</div>;
}

// ✅ 并行：路由 loader 提前发请求
// React Router 6.4+
{
  path: '/post/:id',
  element: <Post />,
  loader: ({ params }) => fetch(`/api/post/${params.id}`),
}
```

### 性能陷阱：懒加载的背面

#### 1. Loading Waterfall

##### 嵌套懒加载

```js
const Page = lazy(() => import('./Page'));

function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <LazyChart />  {/* Page 内部又懒加载 */}
    </Suspense>
  );
}
```

时序：

```plain
下载 Page.js ──→ 渲染 Page ──→ 发现 LazyChart ──→ 下载 Chart.js ──→ 渲染 Chart
```

串行延迟累加，用户看两次 Loading。
解决：
1. 避免深层嵌套懒加载，把相关组件打包到同一 chunk
2. 或者在 Page 加载时并行预加载子组件：
```js
const Page = lazy(() => import('./Page'));
const preloadChart = () => import('./Chart'); // 不 await，只是触发下载

// 路由匹配时同时触发
function onRouteMatch() {
  preloadChart();
}
```

##### 请求竞争（Request Contention）

首屏已经有很多关键请求（HTML、CSS、JS、字体、LCP 图片），如果此时懒加载 chunk 也加入竞争，会挤占带宽和 TCP 连接。
解决：
懒加载 chunk 使用 低优先级（浏览器默认对 import() 的请求优先级是 Low 或 High 取决于时机，但通常低于关键资源）
不要在一帧内触发大量并发 import()，用 requestIdleCallback 或 scheduler.yield() 分散


##### 骨架屏与CLS

```jsx
<Suspense fallback={<Skeleton />}>
  <LazyComponent />
</Suspense>
```

如果 Skeleton 的高度和 LazyComponent 不一致，切换时会触发 CLS。骨架屏不是随便画的，它必须：
和最终内容的布局盒尺寸一致（min-height 必须准确）
或者使用 transform / opacity 做淡入淡出，避免推挤文档流

##### 懒加载失败的处理

```js
const Heavy = lazy(() => import('./Heavy'));

// ❌ 没处理加载失败，chunk 404 时整个应用崩溃
function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Heavy />
    </Suspense>
  );
}

// ✅ React 18+ 用 Error Boundary
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return <div>加载失败，请刷新</div>;
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Skeleton />}>
        <Heavy />
      </Suspense>
    </ErrorBoundary>
  );
}```

### 预加载

#### 基于用户行为的预加载

```js
// React Router 6.4+ 的 useLinkPrefetch
import { Link, prefetch } from 'react-router-dom';

function Nav() {
  return (
    <Link
      to="/dashboard"
      onMouseEnter={() => prefetch('/dashboard')} // hover 时预加载
    >
      Dashboard
    </Link>
  );
}
```

时序优势：
用户 hover 链接到实际点击，通常有 100-300ms 的间隔
这段时间足够下载一个 50KB 的 chunk
点击时 chunk 已就绪，路由切换无感知


#### 基于视口的预加载

```js
// 快滚动到评论区时，预加载评论组件
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      import('./Comments'); // 预加载，不 await
    }
  });
}, { rootMargin: '500px' }); // 提前 500px
```

#### 基于空闲时间的预加载

```js
// 空闲时预加载
requestIdleCallback(() => {
  import('./');
});
```

#### `<link rel="preload">` vs `<link rel="prefetch">`

| 属性              | 优先级              | 触发时机      | 适用场景               |
| --------------- | ---------------- | --------- | ------------------ |
| `prefetch`      | **最低**（浏览器完全空闲时） | 当前页面加载完成后 | 预测用户下一步访问的页面 chunk |
| `preload`       | **高**            | 立即        | 当前页面**关键路径**上的资源   |
| `modulepreload` | **高**            | 立即        | ESM 模块的依赖图预加载      |

prefetch 不会阻塞当前页面的任何资源下载，但如果用户快速连续点击多个链接，prefetch 可能还没完成，懒加载会回退到正常请求。此时用户体验仍是"Loading"，但不会比不预加载更差。

### 框架层面的懒加载细节

#### React：`lazy` + `Suspense`的边界

```js
const Heavy = lazy(() => import('./Heavy'));

// Suspense 的 fallback 在首次加载时显示
// 但如果是**路由切换**时的懒加载，React 18 的 Concurrent Features 允许
// "保持旧 UI 可见，直到新 UI 准备好"（useTransition）
function App() {
  const [isPending, startTransition] = useTransition();
  
  function navigate() {
    startTransition(() => {
      setRoute('/heavy');
    });
  }
  
  return (
    <>
      {isPending && <GlobalSpinner />} {/* 路由切换中 */}
      <Suspense fallback={<Skeleton />}>
        <Heavy />
      </Suspense>
    </>
  );
}
```

`useTransition`让路由切换不阻塞交互，旧页面保持可交互，新页面在后台加载，加载后平滑切换。

#### `defineAsyncComponent`

```js
const AsyncComp = defineAsyncComponent({
  loader: () => import('./Heavy.vue'),
  loadingComponent: Loading,
  errorComponent: Error,
  delay: 200,        // 延迟 200ms 才显示 loading，避免闪屏
  timeout: 3000,     // 超时时间
  suspensible: true, // 配合 Suspense
});
```

 Vue 的 delay 参数是 React lazy 没有的。如果组件在 200ms 内加载完成，用户完全看不到 loading，避免"闪一下"的糟糕体验。


#### 路由级别：React Router的 `loader` + `lazy`

```js
// React Router 6.4+：路由配置中同时声明懒加载和数据预取
{
  path: 'dashboard',
  lazy: () => import('./Dashboard'), // 懒加载组件
  loader: () => fetch('/api/dashboard'), // 预取数据
}
```

关键优势： loader 在路由匹配时就开始执行，和组件 import() 并行：

```plain
路由匹配 ──→ 同时触发：下载 Dashboard.js + 请求 /api/dashboard
  │
  └──→ 两者都完成后，渲染 Dashboard（数据已就绪）
```

### 懒加载与 Web Vitals 的精确关系

| 指标      | 懒加载的影响                                   | 禁忌                                           |
| ------- | ---------------------------------------- | -------------------------------------------- |
| **LCP** | ✅ 减少初始资源竞争，主线程更快空闲                       | **LCP 元素不能懒加载**（图片、视频 poster、首屏文本）           |
| **INP** | ✅ 减少初始 JS 执行时间，主线程更快响应交互                 | 交互触发时才懒加载组件 → Input Delay 爆炸（主线程在下载解析 chunk） |
| **CLS** | ⚠️ **风险**：`Suspense fallback` 和真实内容高度不一致 | 骨架屏必须精确占位                                    |
| **FCP** | ✅ 减少初始 CSS/JS 体积，更快首次绘制                  | 如果懒加载的是**关键 CSS**，FCP 反而恶化                   |

### 几个问题

#### `import()`的缓存机制

```js
const mod1 = await import('./module.js');
const mod2 = await import('./module.js');
```

问：mod1 === mod2 吗？
答案是 true（同一个 Module Namespace Object）
浏览器对同一 URL 的 import() 有模块缓存，第二次调用直接返回已解析的模块
但如果加了查询参数（import('./module.js?v=2')），浏览器视为不同 URL，会重新下载

### 懒加载chunk的404处理

部署新版本后，旧用户浏览器中的懒加载 chunk URL 可能失效（因为 content hash 变了）。怎么优雅降级？
1. CDN 保留旧版本：保留最近 3-5 个版本的 chunk
2. 前端捕获错误：
```js
const Heavy = lazy(() => import('./Heavy').catch(() => ({
  default: () => <div>加载失败，请刷新页面</div>
})));
```
3. Service Worker缓存：用SW预缓存关键chunk，离线也能加载

### SSR下的懒加载

React 18 之前：renderToString 不支持 React.lazy，服务端遇到 lazy 会 throw Promise，必须用 @loadable/component
React 18+：renderToPipeableStream 支持 Suspense，服务端可以输出 fallback，客户端 hydrate 后替换
Vue 3：defineAsyncComponent 在 SSR 中，如果组件是异步的，服务端会等待它 resolve 后再输出 HTML（或输出 fallback，取决于配置）

### 为什么`React.lazy`不能用于非默认导出?

```js
const { NamedExport } = await import('./module.js');

const Module = lazy(() => import('./module.js'));
```

因为 import() 返回的是 Module Namespace Object，React.lazy 内部只取 .default。如果需要命名导出，必须包装：

```js
const Module = lazy(() => import('./module.js').then(mod => ({ default: mod.NamedExport })));
```
