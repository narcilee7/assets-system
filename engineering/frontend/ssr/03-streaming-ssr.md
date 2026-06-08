# 流式 SSR

## 1. 传统 SSR vs 流式 SSR

```
传统 SSR：
请求 → 获取所有数据 → 渲染完整 HTML → 发送响应
         └────────────────────────────┘
                      用户等待白屏

流式 SSR：
请求 → 渲染 Shell → 发送 <html><head>...</head><body>...
         ↓
      获取数据 A → 发送 <div>A 内容</div>
         ↓
      获取数据 B → 发送 <div>B 内容</div>
         ↓
      发送 </body></html>

用户看到渐进式加载，FCP 极大提升
```

## 2. React 18 Streaming SSR

```jsx
// App.js
function App() {
  return (
    <html>
      <head><title>Streaming SSR</title></head>
      <body>
        <div id="root">
          <Header />
          <Suspense fallback={<Skeleton />}>
            <SlowContent />  {/* 这个组件的数据获取会触发 fallback */}
          </Suspense>
          <Footer />
        </div>
      </body>
    </html>
  );
}

// 服务端渲染
import { renderToPipeableStream } from 'react-dom/server';

app.get('/', (req, res) => {
  const { pipe } = renderToPipeableStream(<App />, {
    bootstrapScripts: ['/main.js'],
    onShellReady() {
      // Shell 就绪，开始流式传输
      res.statusCode = 200;
      res.setHeader('Content-type', 'text/html');
      pipe(res);
    },
    onError(error) {
      console.error(error);
      res.statusCode = 500;
    },
  });
});
```

## 3. Suspense 与数据获取

```jsx
// 使用 Promise 作为 Suspend 机制
function fetchData(url) {
  let promise = fetch(url).then(r => r.json());
  return {
    read() {
      const result = React.use(promise);  // React 18.3+ use API
      return result;
    }
  };
}

function SlowContent() {
  // 这个组件会 Suspend，触发 fallback
  const data = fetchData('/api/data').read();
  return <div>{data.content}</div>;
}

// 服务端处理 Suspend：
// 1. 渲染到 <Suspense> 边界
// 2. 发送 fallback HTML
// 3. 等待 Promise resolve
// 4. 发送实际内容（替换 fallback）
```

## 4. Out-of-Order Streaming

```html
<!-- 流式传输的 HTML 结构 -->
<!DOCTYPE html>
<html>
  <head>...</head>
  <body>
    <div id="root">
      <header>Loaded</header>
      <div id="S:1">Loading...</div>  <!-- fallback -->
      <footer>Loaded</footer>
    </div>

    <!-- 内联的替换脚本 -->
    <template id="U:1">
      <div>Actual Content Here</div>
    </template>
    <script>
      // 用模板内容替换 fallback
      const fallback = document.getElementById('S:1');
      const template = document.getElementById('U:1');
      fallback.replaceWith(template.content);
    </script>
  </body>
</html>
```

## 5. 流式最佳实践

```javascript
// 1. 优先渲染关键内容
function Page() {
  return (
    <>
      {/* 立即渲染（above the fold） */}
      <HeroSection />
      <PrimaryContent />

      {/* 延迟渲染（below the fold） */}
      <Suspense fallback={<Placeholder height={400} />}>
        <SecondaryContent />
      </Suspense>

      <Suspense fallback={<Placeholder height={300} />}>
        <Recommendations />
      </Suspense>
    </>
  );
}

// 2. 错误边界防止流式中断
function ErrorBoundary({ children }) {
  return (
    <Suspense fallback={<ErrorFallback />}>
      {children}
    </Suspense>
  );
}

// 3. 配合 Edge 缓存
// 静态 Shell 可以缓存很久，动态内容流式注入
export const config = {
  runtime: 'edge',
};
```
