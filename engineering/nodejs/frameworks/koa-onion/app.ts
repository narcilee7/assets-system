import Koa from 'koa';
import Router from '@koa/router';

const app = new Koa();
const router = new Router();

app.use(async (ctx, next) => {
  const start = Date.now();
  console.log(`--> ${ctx.method} ${ctx.url}`);
  await next();
  console.log(`<-- ${ctx.method} ${ctx.url} ${ctx.status} ${Date.now() - start}ms`);
});

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err: any) {
    ctx.status = err.status || 500;
    ctx.body = { code: err.code || 'INTERNAL_ERROR', message: err.message };
    ctx.app.emit('error', err, ctx);
  }
});

router.get('/users/:id', async (ctx) => {
  ctx.body = { id: ctx.params.id, name: 'Alice' };
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(3000, () => console.log('Koa on :3000'));
