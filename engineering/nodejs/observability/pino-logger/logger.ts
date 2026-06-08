import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  redact: {
    paths: ['password', '*.password', 'token', 'authorization', 'cookie'],
    remove: true,
  },
  base: {
    service: process.env.SERVICE_NAME || 'nodejs-api',
    version: process.env.SERVICE_VERSION || 'unknown',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function getRequestLogger(reqId: string, traceId?: string) {
  return logger.child({ reqId, traceId });
}
