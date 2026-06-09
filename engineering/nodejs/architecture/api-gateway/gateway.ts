import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';

const app = express();

app.use(express.json());

// Auth middleware
app.use((req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ code: 'UNAUTHORIZED' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ code: 'UNAUTHORIZED' });
  }
});

// Rate limit middleware
const rateLimiter = new Map<string, number[]>();
app.use((req, res, next) => {
  const key = (req as any).user?.sub || req.ip;
  const now = Date.now();
  const window = 60_000;
  const max = 100;
  const history = rateLimiter.get(key) || [];
  const recent = history.filter((t) => now - t < window);
  if (recent.length >= max) {
    return res.status(429).json({ code: 'RATE_LIMITED' });
  }
  recent.push(now);
  rateLimiter.set(key, recent);
  next();
});

// Proxy routes
app.use('/users', createProxyMiddleware({ target: process.env.USER_SERVICE_URL, changeOrigin: true }));
app.use('/orders', createProxyMiddleware({ target: process.env.ORDER_SERVICE_URL, changeOrigin: true }));

// Error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
});

app.listen(8080, () => console.log('Gateway on :8080'));
