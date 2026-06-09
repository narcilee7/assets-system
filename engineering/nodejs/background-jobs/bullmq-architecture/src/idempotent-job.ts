import { emailQueue } from './queue';

export async function enqueueIdempotent(jobId: string, data: any) {
  const existing = await emailQueue.getJob(jobId);
  if (existing && await existing.getState() !== 'completed') {
    return { jobId: existing.id, status: 'already-queued' };
  }
  const job = await emailQueue.add(jobId, data, { jobId });
  return { jobId: job.id, status: 'queued' };
}
