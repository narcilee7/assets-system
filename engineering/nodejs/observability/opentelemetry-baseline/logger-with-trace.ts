import { logger } from '../pino-logger/logger';
import { trace } from '@opentelemetry/api';

export function getTraceAwareLogger() {
  const span = trace.getActiveSpan();
  const context = span?.spanContext();
  return logger.child({
    traceId: context?.traceId,
    spanId: context?.spanId,
  });
}
