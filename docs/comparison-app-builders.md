# AUB vs App Builders: Product Positioning

AUB is not trying to be v0, Lovable, Bolt, Replit Agent, Builder.io, Plasmic, or Figma. Those tools are strongest when the user wants to create or visually design a new experience. AUB is strongest when a coding agent must change an existing production UI without drifting from the app's real components, routes, and review rules.

## The Hard Truth

AUB has a weak standalone market if it is positioned as "another UI builder." That market already has faster, prettier, and better-funded products. AUB only has a clear wedge if it owns one narrower job:

> Make AI coding-agent UI changes safer inside existing repositories.

If AUB cannot prove scanner trust, component reuse, and PR evidence in a real codebase, it becomes schema infrastructure with limited adoption.

## Competitive Comparison

| Product category | Best at | Weakness for existing-app agent work | AUB advantage |
|---|---|---|---|
| v0 / Lovable / Bolt style app builders | Fast generation from prompts | Often create new component structures instead of respecting an existing codebase | Treats the existing route and component registry as the contract |
| Replit Agent / general coding agents | End-to-end code changes | UI intent is still prose unless the project adds stronger contracts | Gives agents `.ui.json`, session state, mappings, and acceptance ids |
| Figma | High-fidelity design collaboration | Design intent is separated from source components and PR evidence | Turns implementation intent into a machine-checkable coding contract |
| Builder.io / Plasmic | Visual composition and CMS-like page building | Requires adopting their runtime/model; not always suitable for internal app routes | Local-first, source-controlled, and does not replace the app runtime |
| Storybook | Component documentation and isolated review | Does not describe route-level acceptance or agent handoff | Can use Storybook as supporting evidence for component candidates |

## Ideal Customer Profile

AUB should focus on teams with all of these traits:

- They already have a real React/Next or Angular app.
- They use Codex, Copilot, Claude Code, or another coding agent for PR work.
- Their UI has production components that must be reused, not recreated.
- Reviewers are spending time checking responsive behavior, component drift, or incomplete agent changes.
- They want GitHub PR evidence, not just screenshots or agent summaries.

AUB is a bad fit when:

- The user wants to generate a brand-new app from a prompt.
- There is no existing component system worth preserving.
- The team does not use coding agents in PR workflows.
- The expected output is a marketing landing page where speed matters more than source truth.

## Product Priorities

1. **One-command proof path**: `npx aub-workspace demo` must show scan, template, session, failing report, passing report, and PR Safety Score.
2. **Scanner trust**: `.aub/scan-report.json` must explain what was scanned, what was skipped, and how much confidence the user should have.
3. **Component reuse review**: Custom components must stay candidates until the user approves mappings.
4. **PR Safety Score**: Reviewers should see risk directly in the PR, not dig through logs.
5. **Editor clarity**: The workspace panel should separate template review from PR evidence review.

## Success Metric

The core metric is not "screens generated." It is:

> How many agent UI PRs became easier to trust because AUB made component reuse, acceptance evidence, and responsive safety visible?

If that metric does not improve, AUB should narrow further rather than expand into a generic design or app-building product.
