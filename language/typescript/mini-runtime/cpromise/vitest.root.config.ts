import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, '../..'),
  test: {
    globals: true,
    environment: 'node',
    include: [
      'mini-runtime/cpromise/src/**/*.test.ts',
      'runtime-model/guard-and-assert/test.ts',
      'runtime-model/schema-bridge/test.ts',
      'engineering-patterns/result/test.ts',
      'engineering-patterns/typed-event-emitter/test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'type-system-gymnastics/**',
    ],
  },
});
