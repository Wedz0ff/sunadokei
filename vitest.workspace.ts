import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*',
  'apps/*',
  {
    test: {
      name: 'e2e',
      include: ['tests/**/*.{test,spec}.ts'],
      environment: 'node'
    }
  }
]);
