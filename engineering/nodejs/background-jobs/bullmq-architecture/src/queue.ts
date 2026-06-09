import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis({ maxRetriesPerRequest: null });

export const emailQueue = new Queue('email', { connection });
export const reportQueue = new Queue('report', { connection });
