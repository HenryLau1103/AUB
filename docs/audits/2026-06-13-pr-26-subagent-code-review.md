# PR #26 Updated Subagent Code Review

Date: 2026-06-13
PR: #26 `[codex] Harden workspace security follow-ups`
Range: `1eb94cd0cb7ed63510da0c48ebdd91ccdbd1bb58..c8b546c4b55867676a08db885419aa56a98e9819`

## 1. Security Agent

### Medium: Workspace registry auto-discovery can follow symlinked directories outside the workspace

`discoverWorkspaceExtensionRegistry()` uses lexical `resolve()` / `relative()` containment, then checks `existsSync(join(dir, 'aub.registry.json'))`. If `startDir` is a symlinked directory inside the workspace that resolves outside the workspace, discovery can still find an external registry.

Evidence:

- `scripts/registry.lib.mjs:62`
- `apps/mcp-server/src/tools/export-handoff.ts:56`
- `scripts/ci-verify.lib.mjs:116`

Suggested change:

```js
import { existsSync, realpathSync } from 'node:fs';

export function discoverWorkspaceExtensionRegistry(workspaceRoot, startDir = workspaceRoot) {
  const root = realpathSync(resolve(workspaceRoot));
  let dir = realpathSync(resolve(startDir));
  if (!isInsideRoot(root, dir)) {
    throw new Error(`Registry discovery start directory must stay inside workspace: ${startDir}`);
  }

  for (let i = 0; i < 64; i += 1) {
    const candidate = join(dir, EXTENSION_REGISTRY_FILENAME);
    if (existsSync(candidate)) {
      const realCandidate = realpathSync(candidate);
      if (!isInsideRoot(root, realCandidate)) {
        throw new Error(`Registry path must stay inside workspace: ${candidate}`);
      }
      return realCandidate;
    }
    if (dir === root) break;
    const parent = dirname(dir);
    if (parent === dir || !isInsideRoot(root, parent)) break;
    dir = parent;
  }
  return null;
}
```

### Low: Local RPC token is still printed in the terminal URL

The editor now scrubs the `mcp` query from the address bar, but the CLI still prints the full token-bearing editor URL.

Evidence:

- `packages/workspace-cli/bin/aub-workspace.mjs:914`
- `packages/workspace-cli/bin/aub-workspace.mjs:925`
- `apps/editor/src/App.tsx:275`

Suggested change:

```js
const displayedEditorUrl = new URL(editorUrl.href);
const displayedMcp = new URL(displayedEditorUrl.searchParams.get('mcp'));
displayedMcp.searchParams.set('token', '<redacted>');
displayedEditorUrl.searchParams.set('mcp', displayedMcp.href);
console.error(`Editor:    ${displayedEditorUrl.href}`);
```

### Resolved Since Previous Review

The previous security blockers are mostly resolved: action shell interpolation, RPC non-ASCII token handling, launcher token propagation, explicit registry filename suffix checks, browser-safe handoff PNG decode, same-process no-overwrite race, and resource caps all have code and regression coverage.

## 2. Quality Agent

### Medium: Project CLI workspace containment differs from schema/docs/MCP/CI

The schema and docs allow `screens[].path` parent segments when runtime containment keeps the resolved screen inside the active workspace. MCP and CI pass an explicit workspace root. The standalone CLI calls `loadProject(projectPath)` and therefore defaults containment to the project file directory.

Evidence:

- `scripts/project.lib.mjs:138`
- `scripts/project.mjs:56`
- `scripts/project.mjs:265`
- `docs/multi-screen.md:46`

Failure mode: `flows/app.aub.project.json` referencing `../screens/home.ui.json` can be valid in MCP/CI but fail in CLI validation/export.

Suggested change:

```js
export async function validateProjectFile(projectPathArg, options = {}) {
  const projectPath = resolve(projectPathArg);
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  const loaded = await loadProject(projectPath, { workspaceRoot });
  // ...
}
```

Add a CLI flow test for `project init flows/app.aub.project.json screens/home.ui.json`, then immediate `validate` and `export-md`.

### Medium: Extension registry auto-discovery semantics still differ across entrypoints

CI discovers from the Blueprint directory toward workspace root. Project CLI discovers from member screen directory but uses the project directory as the root in default calls. MCP `validate_blueprint` starts at `ctx.root`, while `export_handoff` starts at the resolved Blueprint directory.

Evidence:

- `apps/mcp-server/src/tools/validate-blueprint.ts:60`
- `apps/mcp-server/src/tools/validate-project.ts:45`
- `scripts/ci-verify.lib.mjs:116`
- `scripts/project.mjs:108`

Suggested change: centralize registry resolution in a shared helper such as `resolveKnownTypesForBlueprint(workspaceRoot, blueprintAbsPath, explicitRegistry)`, and use it from CLI, MCP, and CI.

### Low: `SOURCE_READ_CONCURRENCY` is declared but unused

`readSourceTexts()` is now sequential, but `SOURCE_READ_CONCURRENCY = 32` remains declared. Either implement bounded concurrency or remove the constant and document that deterministic source budget accounting is intentionally sequential.

## 3. Bug Hunter Agent

### High: CLI can reject a project shape that schema and `project init` allow

The current schema allows parent segments, and `project init` can produce parent-relative paths via `relative(outDir, screenAbs)`. But CLI validate/export paths use `loadProject(projectPath)` without an explicit workspace root, making the project directory the containment root.

Evidence:

- `schema/ui-project.schema.json:93`
- `scripts/project.lib.mjs:136`
- `scripts/project.mjs:50`
- `scripts/project.mjs:259`

Suggested change: make CLI pass an active workspace root, preferably `process.cwd()` by default plus a `--workspace` option for explicit use.

### Medium: Disconnect/reconnect can lose the workspace RPC token

The launcher passes the token inside the nested MCP endpoint URL. `normalizeWorkspaceEndpoint()` extracts the token and returns a normalized endpoint without it; `handleConnectWorkspace()` stores that stripped endpoint back into the input. After disconnect, reconnecting from the visible input can 401 because the in-memory connection was cleared and the token is no longer in the endpoint.

Evidence:

- `packages/workspace-cli/bin/aub-workspace.mjs:914`
- `apps/editor/src/lib/workspace-client.ts:205`
- `apps/editor/src/App.tsx:275`
- `apps/editor/src/App.tsx:432`
- `apps/editor/src/App.tsx:1148`

Suggested change:

```ts
const [workspaceRpcToken, setWorkspaceRpcToken] = useState<string | undefined>();

async function handleConnectWorkspace() {
  const endpoint = workspaceRpcToken
    ? addTokenIfMissing(workspaceEndpoint, workspaceRpcToken)
    : workspaceEndpoint;
  const { connection } = await connectWorkspace(endpoint);
  setWorkspaceRpcToken(connection.rpcToken ?? workspaceRpcToken);
  setWorkspaceEndpoint(connection.endpoint);
}
```

Add a browser/client test for `launch URL auto-connect -> disconnect -> reconnect`.

### No Longer Reproduced

The previous browser `Buffer` handoff export issue is fixed with an `atob`-first decoder and test coverage.

## 4. Concurrency & Performance Agent

### High: `overwrite:false` still races across separate processes

The same-process race is fixed by a per-process `Map` lock, but two MCP server or CLI processes can both pass `exists(outputPath)` and then use `rename(tempPath, outputPath)`. On POSIX, `rename` can replace the target, violating the no-overwrite contract across processes.

Evidence:

- `apps/mcp-server/src/workspace.ts:174`
- `apps/mcp-server/src/workspace.ts:179`

Suggested change:

```ts
await writeFile(tempPath, content, { flag: 'wx' });
if (!options.overwrite) {
  try {
    await link(tempPath, outputPath); // fails atomically with EEXIST
  } finally {
    await rm(tempPath, { force: true });
  }
  return;
}
await rename(tempPath, outputPath);
```

### High: Read-modify-write flows can still lose concurrent updates

`writeJsonAtomic()` locks only the final write. Callers such as `updateAubSession()` and `approveComponentCandidate()` read JSON, compute a patch, and then write. Concurrent calls can compute from the same stale state and lose one update.

Evidence:

- `scripts/workspace-loop.lib.mjs:169`
- `scripts/workspace-loop.lib.mjs:873`
- `scripts/workspace-loop.lib.mjs:1625`

Suggested change:

```js
async function updateWorkspaceJson(root, filePath, fallback, mutate) {
  const path = await prepareWorkspaceWritePath(root, filePath);
  return withPathLock(path, async () => {
    const current = await readJsonIfExists(path, fallback);
    const next = await mutate(current);
    await writeJsonAtomicLocked(path, next);
    return next;
  });
}
```

### Medium: `getWorkspaceStatus()` reads source but reports zero source accounting

`getWorkspaceStatus()` creates a source reader and calls route/storybook detection, but returns `walkState.audit` without copying source-reader counters.

Evidence:

- `scripts/workspace-loop.lib.mjs:1059`
- `scripts/workspace-loop.lib.mjs:1075`

Suggested change:

```js
walkState.audit.sourceBytesRead = sourceReader.audit.totalSourceBytes;
walkState.audit.sourceFilesSkippedBySize = sourceReader.audit.skippedLargeFiles;
walkState.audit.sourceFilesSkippedByBudget = sourceReader.audit.skippedBudgetFiles;
walkState.audit.sourceByteLimitReached = sourceReader.audit.skippedBudgetFiles > 0;
```

### Low: Screenshot size checks occur after full base64 decode

Handoff screenshot byte caps are present, but large data URLs are decoded before rejection. Add a pre-decode size estimate to reject oversized inputs earlier.

## 5. Architecture Agent

### Medium: Project path contract remains split between CLI and MCP/CI

This is the core remaining architecture issue. The schema/docs describe active-workspace containment; MCP/CI mostly implement it; standalone CLI treats the project directory as the default workspace. The product should expose one project contract.

Suggested change: add a CLI `--workspace` option and default to a clear, documented root. Update `validateProjectFile`, `project export-md`, docs, and tests together.

### Low: Workspace containment and atomic-write logic are duplicated

MCP has `apps/mcp-server/src/workspace.ts`; workspace-loop has another containment/write implementation. This has already produced small semantic differences and increases future drift risk.

Suggested change: extract a shared `scripts/workspace-boundary.lib.mjs` and have both MCP and workspace-loop use the same behavior, with TypeScript wrappers where needed.

## Main Agent Assessment

The updated PR is substantially stronger than the previous head. The prior merge blockers around action quoting, browser `Buffer`, registry suffix checks, same-process `overwrite:false`, scanner source accounting, Angular caps, screenshot caps, and launcher process cleanup are now addressed with tests.

I would still request changes before merge for three reasons:

1. The project CLI can still reject project layouts that schema/docs/MCP/CI describe as valid.
2. Registry discovery needs realpath containment to avoid symlink-mediated trust-boundary bypass.
3. Workspace write semantics still do not fully protect cross-process no-overwrite or read-modify-write updates.

The remaining issues are narrower than the previous review, but they sit on shared boundaries. Fixing them now would prevent another follow-up cycle.

## Verification Run By Main Agent

The following checks passed locally against `c8b546c4b55867676a08db885419aa56a98e9819`:

- `git diff --check 1eb94cd0cb7ed63510da0c48ebdd91ccdbd1bb58..c8b546c4b55867676a08db885419aa56a98e9819`
- `pnpm test` (167 tests)
- `pnpm typecheck`
- `pnpm --dir apps/editor typecheck`
- `pnpm --dir apps/editor build`
- `pnpm --dir apps/mcp-server typecheck`
- `pnpm --dir apps/mcp-server build`
- `pnpm --dir apps/mcp-server test` (57 tests)
- `pnpm site:locales:check`
- `pnpm workspace:package`
