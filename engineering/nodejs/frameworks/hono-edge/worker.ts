import { Hono } from "hono"
import { logger } from 'hono/logger'
import { bearerAuth } from 'hono/bearer-auth'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

const app = new Hono<{ Bindings: { JWT_SECRET: string } }>()

app.use(logger())

app.use("/api/*", async (ctx, next) => {
  const auth = bearerAuth({ token: ctx.env.JWT_SECRET })
  return auth(ctx, next)
})

const schema = z.object({
  name: z.string().min(),
  email: z.string().email(),
})

app.post('/api/users', zValidator('json', schema), async (c) => {
  const data = c.req.valid('json');
  // 使用 Cloudflare D1 / KV / Durable Objects
  await c.env.DB.prepare('INSERT INTO users (name, email) VALUES (?, ?)')
    .bind(data.name, data.email)
    .run();
  return c.json({ id: crypto.randomUUID(), ...data }, 201);
});

app.get('/api/users/:id', async (c) => {
  const id = c.req.param('id');
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first();
  if (!user) return c.json({ code: 'NOT_FOUND' }, 404);
  return c.json(user);
});

export default app;