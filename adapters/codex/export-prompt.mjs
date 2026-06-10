#!/usr/bin/env node

import { runAgentAdapterCli } from '../../scripts/export-agent-prompt.mjs';

runAgentAdapterCli({ adapter: 'codex' }).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
