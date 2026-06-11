#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const target = valueAfter(args, '--target') ?? 'generic';
const workspace = resolve(valueAfter(args, '--workspace') ?? process.cwd());
const sessionPath = resolve(workspace, '.aub', 'session.json');
const session = existsSync(sessionPath) ? JSON.parse(await readFile(sessionPath, 'utf8')) : null;

const titleByTarget = {
  codex: 'Codex AUB UI implementation instruction',
  copilot: 'GitHub Copilot AUB UI implementation instruction',
  claude: 'Claude Code AUB UI implementation instruction',
  generic: 'AUB UI implementation instruction',
};

const activeBlueprint = session?.activeBlueprint ?? '<active .ui.json path>';
const targetRoute = session?.targetRoute ?? session?.preview?.route ?? '<target route>';
const previewUrl = session?.preview?.devServerUrl && session?.preview?.route
  ? `${String(session.preview.devServerUrl).replace(/\/$/, '')}${session.preview.route.startsWith('/') ? session.preview.route : `/${session.preview.route}`}`
  : '<preview URL>';

console.log([
  `# ${titleByTarget[target] ?? titleByTarget.generic}`,
  '',
  'Use AUB as the UI contract. Do not redesign from prose and do not weaken acceptance criteria.',
  '',
  `Workspace: ${workspace}`,
  `Active Blueprint: ${activeBlueprint}`,
  `Target route: ${targetRoute}`,
  `Preview URL: ${previewUrl}`,
  '',
  'Required workflow:',
  '',
  '1. Read `.aub/session.json` or call MCP `get_aub_session` before editing source.',
  '2. Read the active Blueprint with `get_blueprint`; `.ui.json` is the source of truth.',
  '3. Resolve each custom or registry-backed component with `resolve_component`.',
  '4. Reuse approved production components instead of creating lookalike components.',
  '5. Do not auto-approve `.aub/component-candidates.json`; users must review candidates.',
  '6. Modify the real app route only after the contract and component mappings are clear.',
  '7. Produce an implementation report with screenshot, DOM, overflow, component reuse, interaction, or code-diff evidence.',
  '8. Run `pnpm report:verify <blueprint.ui.json> <implementation-report.json> --require-evidence` or the project equivalent before PR handoff.',
  '',
  'Completion standard:',
  '',
  '- Every Blueprint node is mapped to a source file.',
  '- Every acceptance id is `pass` with evidence or explicitly marked `needs-review` with a blocker.',
  '- PR Safety Score is reviewed; low scores require more evidence before merge.',
].join('\n'));

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}
