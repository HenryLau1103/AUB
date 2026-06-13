# PR #25 Subagent Code Review

Date: 2026-06-13

Scope: Latest merged PR #25, `[codex] Harden AUB security boundaries`

Reviewed range:

- Base: `431c3ef858d96e7d3a99af65ce34e80012804d3a`
- Merge commit: `1eb94cd0cb7ed63510da0c48ebdd91ccdbd1bb58`
- PR: `https://github.com/HenryLau1103/AUB/pull/25`

This review used five independent subagent perspectives: Security, Quality, Bug Hunter, Concurrency & Performance, and Architecture. The review was read-only.

## Validation Run

The following checks passed during the review:

```bash
pnpm --dir apps/mcp-server test
pnpm test
pnpm typecheck
pnpm --dir apps/editor typecheck
pnpm --dir apps/editor build
pnpm --dir apps/mcp-server typecheck && pnpm --dir apps/mcp-server build
pnpm workspace:package
git diff --check 431c3ef858d96e7d3a99af65ce34e80012804d3a..1eb94cd0cb7ed63510da0c48ebdd91ccdbd1bb58
```

The worktree was clean after validation. Build/package outputs were ignored artifacts and did not create commit-ready changes.

## Executive Summary

PR #25 materially improves the security posture of AUB by adding token-required MCP HTTP/RPC defaults, realpath-based workspace containment, ZIP entry hardening, Angular depth guards, scanner limits, and regression tests.

However, the merged PR still has release-blocking follow-up items. The highest-priority issue is a functional regression in the one-command workspace launcher: `aub-workspace` generates an RPC token, but the editor does not pass that token into workspace RPC calls, so auto-connect can fail with `401`. There are also remaining security gaps in `action.yml` shell input handling and multi-screen project member path containment.

Recommended priority:

1. Fix launcher/editor RPC token propagation.
2. Finish `action.yml` shell input hardening.
3. Contain multi-screen project member screen paths.
4. Apply registry containment to `validate_blueprint`.
5. Fix token comparison, atomic write temp names, and resource limits.

## 1. Security Agent

### High: Composite Action still has shell expression injection

Risk: `inputs.config` and `inputs.min-safety-score` are still partially interpolated directly into `run:` shell blocks. If a consuming workflow passes untrusted data into these inputs, payloads such as command substitution can execute on the GitHub runner. The comment step is especially sensitive because it has `GH_TOKEN`.

Evidence:

- `action.yml:65-66`: `inputs.min-safety-score` is directly interpolated in the verify step.
- `action.yml:83`: comment step still uses `--config "${{ inputs.config }}"`.
- `action.yml:90-91`: comment step directly interpolates `inputs.min-safety-score`.
- `action.yml:53-58`: only the verify step's `inputs.config` was moved through env.

Suggested fix:

```yaml
env:
  AUB_CONFIG_INPUT: ${{ inputs.config }}
  AUB_MIN_SAFETY_SCORE: ${{ inputs.min-safety-score }}

run: |
  args=(--workspace "$GITHUB_WORKSPACE" --config "$AUB_CONFIG_INPUT")
  if [[ -n "$AUB_MIN_SAFETY_SCORE" ]]; then
    args+=(--min-safety-score "$AUB_MIN_SAFETY_SCORE")
  fi
```

Apply the same pattern to the `Comment PR Safety Score` step.

### High: Project member screen paths can still read outside the workspace

Risk: PR #25 contains the project file path itself, but `loadProject()` still trusts `screens[].path`. That member path can be absolute or contain `..`, and `get_project({ inlineScreens: true })` can return the parsed external JSON/YAML content.

Evidence:

- `apps/mcp-server/src/workspace.ts:215-220`: containment is applied to the project ref itself.
- `apps/mcp-server/src/tools/get-project.ts:30-42`: `inlineScreens` can return member blueprints.
- `scripts/project.lib.mjs:96-98`: `resolveScreenPath()` accepts absolute paths.
- `scripts/project.lib.mjs:127-130`: member paths are read directly.
- `schema/ui-project.schema.json:93-98`: `screens[].path` has only string length limits.

Suggested fix:

```js
async function resolveContainedScreenPath(projectPath, screenPath, workspaceRoot) {
  if (isAbsolute(screenPath)) throw new Error('Screen path must be relative.');
  const candidate = resolve(dirname(projectPath), screenPath);
  const realRoot = await realpath(workspaceRoot);
  const realTarget = await realpath(candidate);
  const rel = relative(realRoot, realTarget);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`Screen path must stay inside workspace: ${screenPath}`);
  }
  return candidate;
}
```

Also update `ui-project.schema.json` to reject absolute paths and parent traversal.

## 2. Quality Agent

### Medium: Absolute path compatibility broke for in-workspace refs

Impact: Before PR #25, `get_blueprint` and `get_project` accepted absolute paths. After the new resolver, even absolute paths inside the workspace are rejected. The comments still say refs can be absolute or relative, so the API contract is inconsistent.

Evidence:

- `apps/mcp-server/src/workspace.ts:35`: `resolveWorkspacePath()` rejects absolute paths.
- `apps/mcp-server/src/workspace.ts:164`: resolver comment still says absolute or relative.
- `apps/mcp-server/test/tools.test.mjs:70`: tests cover outside absolute rejection but not inside absolute compatibility.

Suggested fix:

```ts
const absPath = isAbsolute(filePath) ? resolve(filePath) : resolve(absRoot, filePath);
```

Then enforce `realpath(absPath)` stays inside `realpath(root)`. If the intended contract is relative-only, update comments, docs, and MCP tool descriptions.

### Medium: RPC token comparison can throw 500 for non-ASCII input

Impact: `timingSafeEqual` requires buffers with equal byte length. The current check compares JS string length first, so strings with equal character length but different UTF-8 byte length can throw and produce a 500 instead of a stable 401.

Evidence:

- `apps/mcp-server/src/http.ts:38`: compares `a.length !== b.length` before `Buffer.from(...)`.
- `apps/mcp-server/src/http.ts:78`: auth path calls `safeEquals`.
- `apps/mcp-server/test/http-auth.test.mjs:94`: auth tests use ASCII tokens.

Suggested fix:

```ts
function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
```

Add a non-ASCII bearer-token regression test that expects 401, not 500.

### Medium: `screen.id` and safe report filename rules are inconsistent

Impact: Schema-valid Blueprint ids such as `bad..id` can be rejected by `submit_report` persistence because `safeFileStem()` rejects `..`.

Evidence:

- `schema/ui-blueprint.schema.json:97`: screen id pattern allows dot notation and does not ban `..`.
- `apps/mcp-server/src/workspace.ts:86`: `safeFileStem()` rejects any `..`.
- `apps/mcp-server/src/tools/submit-report.ts:51`: report filename uses `screenId`.

Suggested fix: Either tighten the schema to ban `..`, or encode/slugify report filenames instead of rejecting otherwise valid Blueprint ids.

## 3. Bug Hunter Agent

### High: `aub-workspace` editor auto-connect does not send RPC token

Failure mode: `aub-workspace` generates `rpcToken` and starts the MCP server with `--rpc-token`, but the editor URL puts the token in the page-level query parameter. `App` reads only the `mcp` query parameter as the endpoint, and `normalizeWorkspaceEndpoint()` only extracts token from the endpoint URL itself. The first RPC call can fail with 401.

Evidence:

- `packages/workspace-cli/bin/aub-workspace.mjs:895-919`: token is generated and appended as page-level `token`.
- `apps/editor/src/App.tsx:218-220`: only the `mcp` query is used as the endpoint.
- `apps/editor/src/lib/workspace-client.ts:205-218`: token is parsed only from the endpoint URL.
- `apps/editor/src/lib/workspace-client.ts:226-229`: Authorization is sent only when `connection.rpcToken` exists.
- `apps/mcp-server/src/http.ts:78-83`: missing/invalid token returns 401.

Suggested fix:

```js
const mcpEndpoint = new URL(`http://${args.host}:${mcpPort}/mcp`);
mcpEndpoint.searchParams.set('token', rpcToken);
editorUrl.searchParams.set('mcp', mcpEndpoint.href);
```

Alternatively, make `App.tsx` merge the page-level `token` into `initialWorkspaceEndpoint`, then scrub the browser URL after connection setup.

### Medium: Handoff screenshot validation is too loose

Failure mode: `export_handoff` accepts arbitrary string values for `viewportImages`. A non-PNG or empty data URL can be written as `screenshots/*.png`, and a viewport id not declared in the Blueprint can be included.

Evidence:

- `apps/mcp-server/src/tools/export-handoff.ts:28-31`: schema is just `record(string)`.
- `scripts/handoff-package.lib.mjs:43-45`: only validates the viewport id as a ZIP segment.
- `scripts/handoff-package.lib.mjs:118-121`: `dataUrlToBytes()` only splits on comma and base64-decodes.

Suggested fix:

```js
const declaredViewports = new Set(blueprint.viewports.map((viewport) => viewport.id));
if (!declaredViewports.has(viewportId)) throw new Error(`Unknown viewport id: ${viewportId}`);

const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
if (!match) throw new Error(`Viewport ${viewportId} screenshot must be a PNG data URL.`);
const bytes = Uint8Array.from(Buffer.from(match[1], 'base64'));
const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
if (bytes.length < 8 || !png.every((byte, i) => bytes[i] === byte)) {
  throw new Error(`Viewport ${viewportId} screenshot is not a PNG.`);
}
```

## 4. Concurrency & Performance Agent

### High: Atomic write temp paths can collide in one Node process

Impact: The HTTP MCP server can handle concurrent requests. Two writes to the same target path can use the same `<target>.<pid>.tmp` temp file, causing rename failures, overwritten temp contents, or lost updates.

Evidence:

- `scripts/workspace-loop.lib.mjs:167`
- `apps/mcp-server/src/tools/write-blueprint.ts:80`
- Call sites include session, candidates, scan report, registry, and templates.

Suggested fix:

```ts
const tempPath = `${outputPath}.${process.pid}.${randomUUID()}.tmp`;
await writeFile(tempPath, content, { encoding: 'utf8', flag: 'wx' });
await rename(tempPath, outputPath);
```

For read-modify-write flows, add a per-path mutex or optimistic compare-and-swap retry.

### Medium: Scanner source reads have no concurrency or aggregate byte cap

Impact: `scan_project_ui` can scan up to 2000 files. With the 512 KiB per-file limit, worst-case memory can approach 1 GiB while many filesystem reads run concurrently.

Evidence:

- `scripts/workspace-loop.lib.mjs:56`
- `scripts/workspace-loop.lib.mjs:304`
- `scripts/workspace-loop.lib.mjs:327`
- `scripts/workspace-loop.lib.mjs:697`

Suggested fix:

```js
const MAX_TOTAL_SOURCE_BYTES = 64 * 1024 * 1024;
const CONCURRENCY = 32;
```

Use a bounded worker queue. Reserve bytes before reading, skip over-budget files, and record skips in the scan audit.

### Medium: Angular depth cap does not limit width or total nodes

Impact: `MAX_TEMPLATE_NESTING_DEPTH=200` prevents deep recursion, but wide shallow templates can still cause parse and traversal CPU/memory pressure.

Evidence:

- `scripts/angular-importer.lib.mjs:27`
- `scripts/angular-importer.lib.mjs:38`
- `scripts/angular-importer.lib.mjs:605`
- `scripts/angular-importer.lib.mjs:614`

Suggested fix: Add `MAX_ANGULAR_BUNDLE_BYTES`, `MAX_TEMPLATE_NODES`, and `MAX_ATTRIBUTES_PER_NODE`; make `walkHtml` count visited nodes and fail clearly when limits are exceeded.

## 5. Architecture Agent

### High: Token-by-default lacks an end-to-end launcher/editor contract

Architectural risk: The server security model changed to token-required by default, but the launcher/editor boundary did not get a working token propagation contract or an end-to-end regression test.

Suggested fix: Extract a shared URL construction/parsing contract or helper, then test the flow:

1. Start `aub-workspace --no-open` in a temp workspace.
2. Parse the printed `Editor:` URL.
3. Confirm the editor endpoint includes an RPC token.
4. Confirm `/rpc get_workspace_status` succeeds with the token and fails without it.

### Medium: Registry containment is not applied consistently

Architectural risk: Most registry-consuming tools now use containment helpers, but `validate_blueprint` still resolves `args.registry` directly.

Evidence:

- `apps/mcp-server/src/tools/validate-blueprint.ts:60-62`
- `apps/mcp-server/src/workspace.ts:53-61`

Suggested fix: Add a semantic helper such as `resolveWorkspaceRegistryPath()` and use it at every `buildKnownTypes({ extensionPath })` call site.

### Low: Workspace path containment has duplicated TS/MJS implementations

Architectural risk: MCP server and workspace-loop maintain similar but not identical helpers. Future fixes can drift.

Evidence:

- `apps/mcp-server/src/workspace.ts:35-84`
- `scripts/workspace-loop.lib.mjs:113-151`

Suggested fix: Extract a shared workspace path contract, or at minimum run the same test matrix against both implementations.

## Main Agent Conclusion

PR #25 is directionally correct and closes several serious security boundaries, but it introduced or left enough gaps that a follow-up PR should be treated as high priority.

Release-blocking follow-up:

1. Fix `aub-workspace` token propagation to the editor.
2. Finish composite Action input hardening.
3. Contain project member screen paths.

Important hardening follow-up:

1. Apply registry containment to `validate_blueprint`.
2. Fix `safeEquals()` byte-length handling.
3. Make atomic temp files unique and add per-path write protection.
4. Align absolute path API docs/tests with the intended resolver behavior.
5. Validate handoff screenshots as real PNGs for declared viewports.
6. Add scanner and Angular importer aggregate resource limits.

PR #25 should be followed by a focused hardening/regression PR before relying on the workspace-connected flow in production-like use.
