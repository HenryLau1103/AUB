# AUB Workspace Loop User Manual

This guide explains how to use AUB with an existing project:

- Let an agent scan existing routes and components.
- Generate editable AUB workspace templates.
- Adjust the UI in AUB Editor.
- Let the agent read the same AUB files and implement the real app changes.
- Preview the real app route inside AUB.

In one sentence:

> AUB is the shared UI workbench between you and your agent. You adjust the screen in AUB Editor, and the agent reads the same files through MCP before editing your real project.

Languages: **English** · [繁體中文](./workspace-loop-user-manual.zh-Hant.md) · [简体中文](./workspace-loop-user-manual.zh-Hans.md) · [日本語](./workspace-loop-user-manual.ja.md) · [한국어](./workspace-loop-user-manual.ko.md)

---

## 1. What You Need

Most users only need one existing product project:

```text
/your-path/your-app     # your existing product project
```

Your machine needs Node.js 24 or newer because `npx aub-workspace` starts AUB Editor and the MCP server locally.

You do not need to clone the AUB repo first. Clone AUB only when you want to develop AUB itself, debug it, or modify its source code.

---

## 2. Start AUB Workspace

Run this from your existing project root:

```bash
cd /your-path/your-app
npx aub-workspace
```

Success looks like this:

```text
AUB Workspace is running
Workspace: /your-path/your-app
Editor:    http://127.0.0.1:3110/?mcp=...
MCP:       http://127.0.0.1:3100/mcp
Stop:      Ctrl+C
```

The browser opens AUB Editor automatically, already connected to your workspace.

---

## 3. Files AUB May Create

`aub-workspace` lets AUB Editor and agents read and write AUB files inside your existing project, such as:

```text
.aub/session.json
.aub/component-candidates.json
.aub/templates/*.aub.template.json
aub.registry.json
screens/*.ui.json
```

AUB does not automatically edit your real app source code. The agent still makes the actual code changes.

---

## 4. Follow the Editor Onboarding Checklist

After the editor connects, use the **First workspace loop** checklist.

Complete these steps in order:

1. Scan project
2. Select a route and generate a template
3. Review custom component candidates
4. Adjust the UI Blueprint
5. Save back to workspace
6. Copy the agent instruction

---

## 5. Scan the Existing Project

In AUB Editor, click:

```text
Scan project
```

The editor calls the MCP tool:

```text
scan_project_ui
```

It will:

1. Scan React/Next, Vue/Nuxt, and Angular project structure.
2. Detect routes, pages, components, layouts, design tokens, and Storybook hints.
3. Detect project-specific custom components.
4. Write candidate data to:

```text
.aub/component-candidates.json
```

Important rule:

> Scanned custom components do not go directly into the formal registry. They first become candidates, then wait for user review.

---

## 6. Generate a Template from an Existing Screen

After scanning, the editor lists detected routes.

Select a route and click:

```text
Generate template
```

The editor calls the MCP tool:

```text
generate_template_from_source
```

If you want the agent to help, you can also say:

```text
Generate an AUB candidate template for app/settings/page.tsx. Put custom components into component candidates and do not auto-approve them.
```

Generated templates are saved at:

```text
.aub/templates/<slug>.aub.template.json
```

They start as candidates:

```json
{
  "status": "candidate"
}
```

That means they need user review.

---

## 7. Open Workspace Templates

Go back to AUB Editor.

In the template area, find:

```text
Workspace templates
```

You will see candidate templates generated from the workspace, for example:

```text
Settings
Dashboard
Customer Search
```

Selecting a template loads it as an editable screen.

You can adjust:

- Layout positions
- Component sizes
- Canvas resolution
- Desktop/tablet/mobile placements
- Text and content
- Component hierarchy
- Interactions and acceptance criteria

---

## 8. Review Custom Component Candidates

If scanning finds custom components such as:

```text
InsightCard
CustomerSearchPanel
RiskSummaryTable
```

They appear under:

```text
Component Candidates
```

Each candidate usually has three review choices.

### 8.1 Map to a Core Type

If the component is essentially a card, button, form, or data table, choose:

```text
Map core
```

For example:

```text
InsightCard -> card
CustomerTable -> data_table
```

This means AUB can understand it through an existing semantic type.

### 8.2 Create a Namespaced Extension Type

If the component is specific to your project, choose:

```text
Create extension
```

For example:

```text
webapp:insight_card
acme:risk_summary_table
```

Only after approval does AUB write to the formal registry:

```text
aub.registry.json
```

### 8.3 Ignore

If it is not a UI component or should not be represented in AUB yet, choose:

```text
Ignore
```

---

## 9. Save the Adjusted Screen

After adjusting the screen in AUB Editor, click:

```text
Save to workspace
```

For example, save it as:

```text
screens/settings.ui.json
```

The editor also updates:

```text
.aub/session.json
```

The session records:

- The active Blueprint
- The target route
- The preview dev server URL
- The last saved time

This matters because the agent can then read:

```text
get_aub_session
get_blueprint
resolve_component
```

and know exactly which screen you adjusted.

You can also click:

```text
Copy agent instruction
```

Then paste the generated instruction into Codex, Claude Code, Copilot, or another MCP-capable agent.

---

## 10. Let the Agent Implement the Real App

You can tell the agent:

```text
I finished adjusting the screen in AUB Editor. Read the AUB session and current Blueprint, update the real app according to the screen contract, and produce an implementation report.
```

The agent should:

1. Read `.aub/session.json`
2. Locate the active Blueprint
3. Read the `.ui.json`
4. Read `aub.registry.json`
5. Resolve component mappings
6. Modify the real app code
7. Run relevant tests or builds
8. Produce an implementation report

The agent should not guess from screenshots or prose. The `.ui.json` is the source of truth.

---

## 11. Preview the Real App Route

Suppose your app dev server starts with:

```bash
cd /your-path/your-app
pnpm dev
```

and runs at:

```text
http://localhost:3000
```

In AUB Editor's **Implementation Preview**, enter:

```text
Dev server URL: http://localhost:3000
Route: /settings
```

Click:

```text
Apply preview
```

AUB Editor shows:

```text
http://localhost:3000/settings
```

If your app blocks iframe embedding with `X-Frame-Options` or CSP, use:

```text
Open preview
```

That opens the route in a new tab.

---

## 12. Daily Short Flow

Most days, use this flow:

### Terminal 1: Start AUB Workspace

```bash
cd /your-path/your-app
npx aub-workspace
```

### Terminal 2: Start Your Real App

```bash
cd /your-path/your-app
pnpm dev
```

### Browser: Use AUB Editor

```text
The browser opens automatically from npx aub-workspace.
```

### AUB Editor: Complete the First Workspace Loop

```text
Scan project -> Generate template -> Review candidates -> Save to workspace -> Copy agent instruction
```

### Agent: Paste the Instruction

```text
I finished adjusting the screen in AUB Editor...
```

If you are developing AUB itself, use the developer command instead:

```bash
cd /your-path/AUB
pnpm workspace:start -- --workspace /your-path/your-app
```

---

## 13. FAQ

### Q1. Do I Need to Pull the AUB Repo?

No, not for normal use.

Run this inside your existing project:

```bash
npx aub-workspace
```

Clone AUB only when you want to develop AUB itself, modify source code, debug, or run repo checks.

### Q2. Can I Use the GitHub Pages Version?

Yes, for demo, import, and export.

The full workspace loop needs local AUB and a local MCP server because it reads and writes files in your project:

- Connect directly to a local workspace
- Scan the existing project
- Write `.aub/session.json`
- Write `.aub/templates`
- Write `.ui.json`
- Write `aub.registry.json`

`npx aub-workspace` starts the local editor and MCP server for you.

### Q3. Does AUB Automatically Modify My Real App Code?

No.

AUB creates a clear UI contract. The agent modifies the real source code.

AUB's value is that the agent does not need to guess:

- Which screen to change
- Which component to use
- How custom components map
- How desktop/tablet/mobile should render
- What acceptance criteria must pass

### Q4. Will Scanned Custom Components Pollute the Registry?

No.

Scan results first go to:

```text
.aub/component-candidates.json
```

Only after you approve **Create extension** in the editor will AUB write to:

```text
aub.registry.json
```

### Q5. How Does the Agent Know Which File I Edited?

The editor updates:

```text
.aub/session.json
```

The agent calls:

```text
get_aub_session
```

and reads the active Blueprint, target route, and preview settings.

### Q6. Do Components Scale When I Change Resolution?

Yes.

Changing the active viewport resolution updates that viewport's dimensions and scales its placements proportionally.

For example, when desktop changes from:

```text
1440 x 900
```

to:

```text
1920 x 1080
```

components in that viewport scale proportionally.

Other viewports, such as tablet and mobile, are not changed silently.

---

## 14. Useful Agent Instructions

### Scan an Existing Project

```text
Use AUB MCP to scan the current workspace UI. Find routes, pages, components, layouts, and design tokens. Generate component candidates and candidate workspace templates for the main routes. Do not write directly to aub.registry.json.
```

### Generate a Template for a Specific Page

```text
Generate an AUB workspace template for app/settings/page.tsx. Put custom components into component candidates and do not auto-approve them.
```

### After the User Finishes Editing

```text
I finished adjusting the screen in AUB Editor. Read get_aub_session, find the active Blueprint, update the real app according to the .ui.json and aub.registry.json, then produce an implementation report.
```

### Tell the Agent Not to Guess

```text
Use .ui.json as the source of truth. Do not override the Blueprint with prose. If component mapping or route context is unclear, report a blocker first.
```

---

## 15. Complete Flow Summary

```text
Existing project
  ↓
AUB MCP scan
  ↓
.aub/component-candidates.json
.aub/templates/*.aub.template.json
  ↓
AUB Editor reviews templates and custom components
  ↓
User adjusts UI
  ↓
Save to screens/*.ui.json
Update .aub/session.json
  ↓
Agent reads session + blueprint + registry
  ↓
Agent modifies the real app
  ↓
AUB Editor previews the real route
```

The core goal:

> The user decides the screen, AUB stores the verifiable contract, and the agent implements it in real code.
