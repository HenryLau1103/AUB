# PR #26 Latest Subagent Code Review

Date: 2026-06-13
PR: #26 `[codex] Harden workspace security follow-ups`
Range: `1eb94cd0cb7ed63510da0c48ebdd91ccdbd1bb58..b417840d7cb9cc08d2895967397e6fa9f0f13b20`

## Review Scope

This review re-checks the latest PR head after the follow-up commit `Resolve PR 26 workspace safety review`.

Five independent subagents reviewed the diff from these dimensions:

1. Security
2. Code quality
3. Bug hunting
4. Concurrency and performance
5. Architecture

## 1. Security Agent

### Medium: `aub.registry.json` can still cause MCP/CI resource exhaustion

Registry path containment and symlink escape are fixed, but the registry file itself still has no byte, component-count, implementation-count, props-count, or aggregate string-length caps.

Evidence:

- `scripts/registry.lib.mjs:98` auto-resolves workspace registries through `resolveKnownTypesForBlueprint()`.
- `scripts/registry.lib.mjs:252` reads the full registry with `readFile(path, 'utf8')`.
- `scripts/registry.lib.mjs:255` parses the full document with `JSON.parse(raw)`.
- `scripts/registry.lib.mjs:121` and `scripts/registry.lib.mjs:152` normalize all components/implementations without hard caps.

Risk:

A committed workspace `aub.registry.json` can make MCP tools or CI parse a very large registry during `validate_blueprint`, `validate_project`, `resolve_component`, `export_handoff`, or CI verification, causing memory/CPU denial of service.

Suggested change:

```js
const MAX_EXTENSION_REGISTRY_BYTES = 512 * 1024;
const MAX_EXTENSION_COMPONENTS = 500;
const MAX_EXTENSION_IMPLEMENTATIONS = 20;
const MAX_EXTENSION_PROPS = 200;

const info = await stat(path);
if (info.size > MAX_EXTENSION_REGISTRY_BYTES) {
  throw new Error(`${path}: registry exceeds ${MAX_EXTENSION_REGISTRY_BYTES} bytes`);
}

const raw = await readFile(path, 'utf8');
const doc = JSON.parse(raw);
if (!Array.isArray(doc.components) || doc.components.length > MAX_EXTENSION_COMPONENTS) {
  throw new Error(`${path}: too many extension components`);
}
```

### Security Items Now Resolved

The following previous security findings are resolved in the latest head:

- Action input shell interpolation.
- RPC non-ASCII token 500.
- Launcher token propagation.
- Terminal token exposure in the printed editor URL.
- Project member screen containment.
- Registry filename suffix bypass.
- Registry symlink auto-discovery escape.
- Browser-side handoff `Buffer` regression.
- Handoff screenshot PNG/viewport/size validation.
- Same-process and cross-process no-overwrite file creation.

## 2. Quality Agent

### Medium: `pnpm validate <project>` does not expose the new workspace root API

`scripts/project.mjs validate` supports `--workspace`, but `scripts/validate.mjs` still calls `validateProjectFile(filePath)` without parsing or forwarding a workspace root.

Evidence:

- `scripts/validate.mjs:67` detects project documents.
- `scripts/validate.mjs:69` calls `validateProjectFile(filePath)` without options.
- `scripts/project.mjs:70` defaults `workspaceRoot` to `process.cwd()`.

Risk:

`pnpm validate <*.aub.project.json>` can behave differently from `node scripts/project.mjs validate --workspace <root>` when called from a directory that is not the intended workspace root.

Suggested change:

```js
const { file: arg, registry: registryArg, workspace } = parseArgs(process.argv.slice(2));
// ...
const result = await validateProjectFile(filePath, {
  workspaceRoot: workspace ? resolve(workspace) : process.cwd(),
});
```

Add a regression test for `validate.mjs` detecting a project with parent-segment screen paths.

### Low: TS and MJS workspace path helpers still differ on root path policy

MCP's TS helper allows a path resolving to the workspace root; workspace-loop's MJS helper rejects `rel === ''`.

Evidence:

- `apps/mcp-server/src/workspace.ts:36`
- `scripts/workspace-loop.lib.mjs:115`

Suggested change: extract a shared boundary helper or align root-path policy explicitly in both implementations.

### Low: Launcher/token coverage depends on built dist

The smoke test for token redaction/RPC auth is skipped when editor/MCP dist is missing.

Evidence:

- `tests/workspace-cli-init.test.mjs:139`
- `tests/workspace-cli-init.test.mjs:140`

Suggested change: add unit coverage for `normalizeWorkspaceEndpoint()` and `attachWorkspaceTokenIfMissing()` so token extraction/scrubbing/re-attachment is tested without build artifacts.

## 3. Bug Hunter Agent

### Medium: Scrubbed token breaks reload/manual launch recovery

The launcher still uses the real token URL for `openBrowser()`, but terminal output is redacted and the editor removes the `mcp` query from the address bar. If auto-open fails, the user runs `--no-open`, copies the printed URL, or refreshes after the query was removed, the in-memory token is gone and `/rpc` returns 401.

Evidence:

- `packages/workspace-cli/bin/aub-workspace.mjs:921`
- `packages/workspace-cli/bin/aub-workspace.mjs:929`
- `apps/editor/src/App.tsx:277`
- `apps/editor/src/App.tsx:282`
- `apps/editor/src/lib/workspace-client.ts:205`
- `apps/mcp-server/src/http.ts:73`

Suggested change:

```ts
const [workspaceRpcToken, setWorkspaceRpcToken] = useState(() =>
  sessionStorage.getItem('aub.rpcToken') ?? undefined
);

const nextToken = connection.rpcToken ?? workspaceRpcToken;
setWorkspaceRpcToken(nextToken);
if (nextToken) sessionStorage.setItem('aub.rpcToken', nextToken);

// Explicit disconnect:
sessionStorage.removeItem('aub.rpcToken');
setWorkspaceRpcToken(undefined);
```

Alternatively, for `--no-open`, provide a secure one-time launch handoff instead of only printing a redacted URL.

### Bug Items Now Resolved

No obvious issues remain in browser-vs-Node handoff runtime, schema/runtime project contract through `project.mjs`, Angular importer caps, GitHub Action quoting, or same-page disconnect/reconnect.

## 4. Concurrency & Performance Agent

### High: Workspace-loop read-modify-write locks are still process-local

`updateWorkspaceJson()` now locks read/mutate/write inside one process, but the lock is a process-local `Map`. Two MCP/CLI processes can still read the same JSON state and overwrite independent updates.

Evidence:

- `scripts/workspace-loop.lib.mjs:168`
- `scripts/workspace-loop.lib.mjs:215`
- `scripts/workspace-loop.lib.mjs:906`

Risk:

Concurrent processes updating `.aub/session.json` or `.aub/component-candidates.json` can lose independent fields. Atomic rename prevents partial files, but does not serialize state transitions across processes.

Suggested change:

Use a cross-process lock, for example an exclusive `mkdir(lockDir)` lock with retry and `finally rm`, and keep read/mutate/write in the same lock scope.

### Medium: `create_extension` updates registry and candidate state in separate transactions

`create_extension` reads the candidate before locking, writes `aub.registry.json`, then updates component candidates in a second transaction.

Evidence:

- `scripts/workspace-loop.lib.mjs:1730`
- `scripts/workspace-loop.lib.mjs:1740`
- `scripts/workspace-loop.lib.mjs:1768`

Risk:

Concurrent `ignore`, `map_core`, or `create_extension` actions, or a crash between writes, can leave the registry updated while the candidate remains unapproved, or approve based on stale candidate state.

Suggested change:

Introduce a single candidate-review transaction lock. Re-read the candidate inside that lock, confirm it is still reviewable, then update registry and candidate state with a recoverable pending/reconcile design if two files must be touched.

### Medium: `validate_project` uses unbounded per-screen concurrency

`validate_project` validates all screens with `Promise.all`, and each screen may resolve/read/parse registries. Project schema has `minItems` but no screen `maxItems`.

Evidence:

- `apps/mcp-server/src/tools/validate-project.ts:41`
- `apps/mcp-server/src/tools/validate-project.ts:57`
- `schema/ui-project.schema.json:45`

Suggested change:

Use bounded concurrency and cache `resolveKnownTypesForBlueprint()` by registry path, or add a schema `maxItems` for `screens`.

### Low: Angular template caps still run after full parse

`parseFragment()` builds the AST before `walkHtml()` enforces node caps. The node cap is also per template traversal, not an import-wide aggregate budget.

Evidence:

- `scripts/angular-importer.lib.mjs:267`
- `scripts/angular-importer.lib.mjs:268`
- `scripts/angular-importer.lib.mjs:627`

Suggested change:

Add a pre-parse rough tag/token cap and an aggregate import-wide node budget, or move to a streaming parser for large templates.

## 5. Architecture Agent

### Medium: `write_blueprint` still uses a different registry resolution boundary

`validate_blueprint`, `validate_project`, and CI use `resolveKnownTypesForBlueprint(...)`, which discovers registries from the Blueprint path toward the workspace root. `write_blueprint` still discovers from `ctx.root`.

Evidence:

- `apps/mcp-server/src/tools/write-blueprint.ts:48`
- `apps/mcp-server/src/tools/validate-blueprint.ts:61`
- `apps/mcp-server/src/tools/validate-project.ts:57`
- `scripts/ci-verify.lib.mjs`

Risk:

In a nested app or monorepo with a subdirectory `aub.registry.json`, MCP `write_blueprint` can reject a Blueprint that `validate_blueprint`, `validate_project`, and CI would later accept.

Suggested change:

Resolve the output path first, then use it as the Blueprint location for registry discovery:

```ts
const outputPath = await prepareWorkspaceWritePath(ctx.root, args.path);
const knownTypes = await resolveKnownTypesForBlueprint({
  workspaceRoot: ctx.root,
  blueprintAbsPath: outputPath,
  explicitRegistry: args.registry,
});
```

### Low: Scan audit/source-budget contract is still not a single shared shape

Runtime now reports source read counters in scan report summary and trust breakdown, but editor `WorkspaceStatus.scanAudit` still declares only the older fields.

Evidence:

- `scripts/workspace-loop.lib.mjs:990`
- `scripts/workspace-loop.lib.mjs:1054`
- `apps/editor/src/lib/workspace-client.ts:91`

Suggested change:

Define a shared `ScanAudit` / `ScanReport` type or schema and use it in workspace-loop output and editor types.

## Main Agent Assessment

This latest PR head is much stronger than the previous iterations. It fixes the earlier high-risk follow-ups around:

- Action shell quoting.
- RPC token validation and redaction.
- Editor same-page reconnect token handling.
- Project CLI workspace root for `project.mjs`.
- Registry symlink containment.
- Browser handoff export.
- Handoff resource caps.
- Same-process and cross-process no-overwrite file creation.
- Workspace-loop same-process read-modify-write loss.
- Scanner source accounting in status.

However, I would still request changes before merge. The remaining findings are narrower, but they affect shared boundaries:

1. Registry parsing still lacks size/count caps.
2. `pnpm validate <project>` did not receive the new workspace-root option.
3. Token scrubbing breaks reload/manual launch recovery unless a safe token handoff exists.
4. Workspace-loop read-modify-write is still process-local, not cross-process.
5. `write_blueprint` uses a different registry discovery boundary from validate/CI.

## Verification Run By Main Agent

The following checks passed locally against `b417840d7cb9cc08d2895967397e6fa9f0f13b20`:

- `git diff --check 1eb94cd0cb7ed63510da0c48ebdd91ccdbd1bb58..b417840d7cb9cc08d2895967397e6fa9f0f13b20`
- `pnpm test` (170 tests)
- `pnpm typecheck`
- `pnpm --dir apps/editor typecheck`
- `pnpm --dir apps/editor build`
- `pnpm --dir apps/mcp-server typecheck`
- `pnpm --dir apps/mcp-server build`
- `pnpm --dir apps/mcp-server test` (61 tests)
- `pnpm site:locales:check`
- `pnpm workspace:package`
