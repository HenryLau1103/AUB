#!/usr/bin/env node

import { runAgentAdapterCli } from '../../scripts/export-agent-prompt.mjs';

runAgentAdapterCli({ adapter: 'claude-code' }).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
