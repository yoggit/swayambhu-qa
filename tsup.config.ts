import { defineConfig } from 'tsup';

export default defineConfig([
  // MCP server + CLI entry points
  {
    entry: {
      mcp: 'src/mcp/index.ts',
      cli: 'src/cli/index.ts',
    },
    format: ['cjs'],
    target: 'node18',
    clean: true,
    sourcemap: false,
    dts: false,
  },
  // Pipeline scripts — each bundled as a self-contained executable
  // tms/* and sources/* are bundled into each script that imports them
  {
    entry: {
      'scripts/fetch-issue':      'scripts/fetch-issue.ts',
      'scripts/scrape-app':       'scripts/scrape-app.ts',
      'scripts/push-to-tms':      'scripts/push-to-tms.ts',
      'scripts/run-tests':        'scripts/run-tests.ts',
      'scripts/update-tms-status':'scripts/update-tms-status.ts',
      'scripts/create-bug':       'scripts/create-bug.ts',
      'scripts/comment-issue':    'scripts/comment-issue.ts',
      'scripts/read-from-tms':    'scripts/read-from-tms.ts',
    },
    format: ['cjs'],
    target: 'node18',
    clean: false,
    sourcemap: false,
    dts: false,
    banner: { js: '#!/usr/bin/env node' },
    // @playwright/test is already installed in user's project — don't bundle it
    external: ['@playwright/test'],
  },
]);
