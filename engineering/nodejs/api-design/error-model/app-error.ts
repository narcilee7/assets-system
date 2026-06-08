export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
    public readonly retryable: boolean = false
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
    };
  }
}

export const Errors = {
  validation: (details?: Record<string, unknown>) =>
    new AppError('VALIDATION_ERROR', 'Request validation failed', 400, details),
  unauthorized: () =>
    new AppError('UNAUTHORIZED', 'Authentication required', 401),
  notFound: (resource: string) =>
    new AppError('NOT_FOUND', `${resource} not found`, 404),
  conflict: (message: string) =>
    new AppError('CONFLICT', message, 409),
  rateLimited: () =>
    new AppError('RATE_LIMITED', 'Too many requests', 429, undefined, true),
  internal: () =>
    new AppError('INTERNAL_ERROR', 'Internal server error', 500),
  serviceUnavailable: () =>
    new AppError('SERVICE_UNAVAILABLE', 'Service temporarily unavailable', 503, undefined, true),
} as const;
