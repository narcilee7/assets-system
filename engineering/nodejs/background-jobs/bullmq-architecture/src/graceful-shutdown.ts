import { emailWorker, reportWorker } from './worker';
import { emailQueue, reportQueue } from './queue';

async function shutdown() {
  console.log('Shutting down workers...');
  await emailWorker.close();
  await reportWorker.close();
  await emailQueue.close();
  await reportQueue.close();
  console.log('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
