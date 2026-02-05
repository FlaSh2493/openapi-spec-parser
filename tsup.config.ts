import { defineConfig } from 'tsup';

export default defineConfig([
  // Main library
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true,
    ignoreWatch: ['**/test/**', '**/test-output/**'],
  },
  // CLI
  {
    entry: { 'cli/index': 'src/cli/index.ts' },
    format: ['esm'],
    dts: false,
    sourcemap: true,
  },
]);
