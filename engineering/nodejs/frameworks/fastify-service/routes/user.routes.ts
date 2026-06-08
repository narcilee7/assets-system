import { FastifyInstance } from 'fastify';

const users: Map<string, any> = new Map();
let idCounter = 0;

async function createUser(data: any) {
  const id = String(++idCounter);
  const user = { id, ...data };
  users.set(id, user);
  return user;
}

async function findUserById(id: string) {
  return users.get(id);
}

const createUserSchema = {
  body: {
    type: 'object',
    required: ['email', 'name'],
    properties: {
      email: { type: 'string', format: 'email' },
      name: { type: 'string', minLength: 1 },
      age: { type: 'integer', minimum: 0 },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        name: { type: 'string' },
      },
    },
  },
};

export async function userRoutes(app: FastifyInstance) {
  app.post('/', { schema: createUserSchema }, async (req, reply) => {
    const user = await createUser(req.body as any);
    reply.status(201).send(user);
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await findUserById(id);
    if (!user) {
      reply.status(404).send({ code: 'NOT_FOUND', message: `User ${id} not found` });
      return;
    }
    reply.send(user);
  });
}
