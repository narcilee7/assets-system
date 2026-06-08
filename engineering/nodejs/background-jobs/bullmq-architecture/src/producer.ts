import { emailQueue } from './queue';

export async function scheduleWelcomeEmail(userId: string, email: string) {
  await emailQueue.add(
    'welcome',
    { to: email, subject: 'Welcome!', body: 'Thanks for joining.' },
    {
      delay: 60_000,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 10,
      removeOnFail: 5,
    }
  );
}
