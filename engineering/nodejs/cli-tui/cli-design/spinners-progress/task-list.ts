import { Listr } from 'listr2';

async function connectDB() {
  await new Promise((r) => setTimeout(r, 500));
}

async function runMigrations() {
  await new Promise((r) => setTimeout(r, 800));
  return ['001_init', '002_add_users'];
}

async function seedData() {
  await new Promise((r) => setTimeout(r, 600));
}

async function healthCheck() {
  await new Promise((r) => setTimeout(r, 400));
}

const tasks = new Listr([
  {
    title: 'Connect to database',
    task: async (ctx, task) => {
      await connectDB();
      task.output = 'Connected to postgres://localhost:5432/app';
    },
  },
  {
    title: 'Run migrations',
    task: async (ctx, task) => {
      const migrations = await runMigrations();
      task.output = `Applied ${migrations.length} migrations`;
    },
  },
  {
    title: 'Seed data',
    task: async () => {
      await seedData();
    },
    skip: (ctx: any) => ctx.skipSeed && 'Skipped via --skip-seed',
  },
  {
    title: 'Verify deployment',
    task: async (ctx, task) => {
      await healthCheck();
      task.title = '✅ Deployment verified';
    },
  },
]);

async function main() {
  await tasks.run({ skipSeed: false });
}

main().catch(console.error);
