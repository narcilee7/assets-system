class CAggregateError extends Error {
  errors: any[];

  constructor(errors: any[]) {
    super('All promises were rejected');
    this.errors = errors;
    this.name = 'AggregateError';
  }
}

export default CAggregateError;