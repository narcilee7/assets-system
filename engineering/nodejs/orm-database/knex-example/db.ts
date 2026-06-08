import knex from 'knex';

const config = {
  client: 'postgresql',
  connection: process.env.DATABASE_URL,
  pool: { min: 2, max: 10 },
  migrations: { directory: './migrations' },
};

export const db = knex(config);
