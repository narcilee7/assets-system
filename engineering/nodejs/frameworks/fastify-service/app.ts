import Fastify from 'fastify';
import { userRoutes } from './routes/user.routes';

const app = Fastify({
  logger: { level: 'info' },
  genReqId: () => crypto.randomUUID(),
});

app.register(userRoutes, { prefix: '/users' });

app.setErrorHandler((err, _req, reply) => {
  app.log.error(err);
  reply.status(err.statusCode || 500).send({
    code: err.code || 'INTERNAL_ERROR',
    message: err.message,
  });
});

export { app };
