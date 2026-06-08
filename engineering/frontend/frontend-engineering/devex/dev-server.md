# 开发服务器

## 1. Vite Dev Server

```javascript
// vite.config.ts
export default defineConfig({
  server: {
    port: 3000,
    host: true,           // 允许外部访问
    open: true,           // 自动打开浏览器
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
    https: {
      key: fs.readFileSync('./cert/key.pem'),
      cert: fs.readFileSync('./cert/cert.pem'),
    },
  },
});
```

## 2. HTTPS 本地开发

```bash
# mkcert（推荐）
mkcert -install
mkcert localhost 127.0.0.1 ::1

# 生成 localhost.pem 和 localhost-key.pem
```

## 3. Mock 代理

```javascript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      bypass(req, res, options) {
        // 特定路径走 mock
        if (req.url?.startsWith('/api/mock/')) {
          req.url = req.url.replace('/api/mock/', '/mock/');
          return req.url;
        }
      },
    },
  },
}
```
