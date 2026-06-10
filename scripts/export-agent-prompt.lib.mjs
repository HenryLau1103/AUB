import { exportMarkdown } from './export-md.lib.mjs';
import { createImplementationReportTemplate } from './implementation-report.lib.mjs';

const ADAPTERS = {
  generic: {
    label: 'Generic coding agent',
    repositoryInstructions: [
      'Inspect the repository instructions and existing implementation patterns before changing files.',
      'Use the repository-native package manager, components, tokens, and test commands.',
    ],
  },
  codex: {
    label: 'Codex',
    repositoryInstructions: [
      'Read every applicable AGENTS.md before editing files.',
      'Inspect the existing codebase first and preserve local architecture and design-system conventions.',
      'Run the repository checks that cover every changed surface and report their exact result.',
    ],
  },
  'claude-code': {
    label: 'Claude Code',
    repositoryInstructions: [
      'Read CLAUDE.md and other repository instructions before editing files.',
      'Inspect related components and tests before choosing an implementation approach.',
      'Run the repository checks that cover every changed surface and report their exact result.',
    ],
  },
  copilot: {
    label: 'GitHub Copilot',
    repositoryInstructions: [
      'Read .github/copilot-instructions.md and any applicable AGENTS.md before editing files.',
      'Inspect the existing codebase first and reuse the repository-native components, tokens, and patterns.',
      'Run the repository checks that cover every changed surface and report their exact result.',
    ],
  },
};

const TASKS = {
  author: {
    title: 'Author a UI Blueprint',
    outcome: 'Produce a schema-valid UI Blueprint JSON document from the supplied product and screen requirements.',
    steps: [
      'Inspect the component registry, schema, canonical example, and supplied source material.',
      'Model one semantic node tree with explicit layout, bindings, interactions, responsive rules, and acceptance criteria.',
      'Validate the generated JSON and report every unresolved product decision instead of guessing.',
    ],
  },
  implement: {
    title: 'Implement this UI Blueprint',
    outcome: 'Modify the target repository so the implementation satisfies the Blueprint and every acceptance criterion.',
    steps: [
      'Map every Blueprint node to an existing or new implementation component.',
      'Implement the declared hierarchy, layout mode, viewport geometry, interactions, and responsive behavior.',
      'Verify every acceptance item and attach concrete evidence.',
    ],
  },
  plan: {
    title: 'Plan this UI Blueprint implementation',
    outcome: 'Produce an implementation plan grounded in the target repository without changing files.',
    steps: [
      'Map Blueprint nodes to likely files, routes, and components in the repository.',
      'Identify reusable components, missing capabilities, dependencies, and risks.',
      'Return ordered implementation steps tied to node ids and acceptance ids.',
    ],
  },
  review: {
    title: 'Review an implementation against this UI Blueprint',
    outcome: 'Inspect the current implementation and report contract mismatches without silently relaxing the Blueprint.',
    steps: [
      'Compare the implementation against node hierarchy, layout, geometry, interactions, and responsive rules.',
      'Evaluate every acceptance item as pass, fail, or needs-review.',
      'Report mismatches with file references and evidence, ordered by severity.',
    ],
  },
};

export function exportAgentPrompt(blueprint, options = {}) {
  const adapterId = options.adapter ?? 'generic';
  const taskId = options.task ?? 'implement';
  const adapter = ADAPTERS[adapterId];
  const task = TASKS[taskId];
  const reportTemplate = createImplementationReportTemplate(blueprint);
  if (!adapter) throw new Error(`Unknown agent adapter: ${adapterId}`);
  if (!task) throw new Error(`Unknown agent task: ${taskId}`);

  const lines = [
    `# ${task.title}`,
    '',
    `Adapter: **${adapter.label}**`,
    `Screen: **${blueprint.screen.name}** (\`${blueprint.screen.id}\`)`,
    '',
    '## Required outcome',
    '',
    task.outcome,
    '',
    '## Repository execution rules',
    '',
    ...adapter.repositoryInstructions.map((instruction) => `- ${instruction}`),
    taskId === 'author'
      ? '- Treat the supplied requirements as evidence. Use only registered component types and do not invent missing behavior.'
      : '- Treat the embedded UI Blueprint as the source of truth. Do not redesign, infer missing behavior, or weaken acceptance criteria.',
    '- If the Blueprint conflicts with repository constraints, stop and report the conflict with a concrete proposed resolution.',
    '',
    '## Required workflow',
    '',
    '- Start by replying in the user\'s language. Explain what AUB is, list the supplied Blueprint evidence, name the task you will perform, and identify any unresolved product decisions.',
    ...task.steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    '## Final response contract',
    '',
    ...(taskId === 'author'
      ? [
          '- Return one complete Blueprint JSON object and no prose or Markdown fence.',
          '- Use children only on registered container types; every leaf must use `children: []`.',
          '- Use only `px`, `%`, `rem`, or `vw` in size objects; use `grid_columns` for fractional tracks.',
          '- Validate unique ids, bidirectional parent/children references, interactions, responsive rules, and acceptance coverage.',
          '- Put unresolved product decisions in `screen.notes` instead of guessing.',
          '',
        ]
      : [
          '- Summarize changed or inspected files.',
          '- List validation commands and results.',
          '- Report each acceptance id as `pass`, `fail`, or `needs-review` with evidence.',
          '- Call out every unresolved blocker explicitly.',
          '',
          '## Machine-readable implementation report',
          '',
          'Fill this template and return it with the implementation. Every node must map to a file and every acceptance result must include evidence.',
          '',
          '```json',
          JSON.stringify(reportTemplate, null, 2),
          '```',
          '',
        ]),
    ...(taskId === 'author'
      ? [
          '## Authoring reference',
          '',
          'Use the embedded Blueprint as a canonical shape reference. Replace its product-specific content with the requested screen.',
          '',
        ]
      : []),
    '<aub_blueprint_context>',
    '',
    exportMarkdown(blueprint),
    '',
    '</aub_blueprint_context>',
    '',
  ];

  return lines.join('\n');
}

export function supportedAgentAdapters() {
  return Object.keys(ADAPTERS);
}

export function supportedAgentTasks() {
  return Object.keys(TASKS);
}
