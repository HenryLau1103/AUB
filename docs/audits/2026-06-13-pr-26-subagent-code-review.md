# PR #26 Subagent Code Review

Date: 2026-06-13
PR: #26 `[codex] Harden workspace security follow-ups`
Range: `1eb94cd0cb7ed63510da0c48ebdd91ccdbd1bb58..07649900859d3825a5782d33444396ec05e13a4c`

## 1. Security Agent

### High: CLI project loader still bypasses member screen containment

`loadProject()` only applies member screen containment when callers pass `workspaceRoot`. MCP and CI paths do this, but CLI paths still call the unsafe default and can read external member screens before validation rejects the project.

Evidence:

- `scripts/project.lib.mjs:141` defines `loadProject(..., options = {})`.
- `scripts/project.lib.mjs:153` only uses contained resolution when `options.workspaceRoot` exists.
- `scripts/project.mjs:56` and `scripts/project.mjs:262` call `loadProject(projectPath)` without containment.
- `scripts/validate.mjs:69` routes `pnpm validate <project>` into the same unsafe path.

Suggested change:

```js
const loaded = await loadProject(projectPath, {
  workspaceRoot: dirname(projectPath),
});
```

Prefer making `loadProject()` fail closed by default, with an explicit `allowExternalScreens: true` escape hatch if legacy external screens must remain supported.

### Medium: Registry filename check can be bypassed by suffix

`resolveWorkspaceRegistryPath()` intends to allow only `aub.registry.json`, but `/aub\.registry\.json$/i` also accepts names such as `evil-aub.registry.json`.

Suggested change:

```ts
if (basename(registryPath).toLowerCase() !== 'aub.registry.json') {
  throw new Error(`Registry path must point to aub.registry.json: ${filePath}`);
}
```

### Low: RPC token remains visible in URL surfaces

The launcher now propagates the token correctly, but the token is still embedded in the editor URL printed to the terminal and can remain in browser history.

Suggested change: after editor bootstrap reads the `mcp` query, call `history.replaceState()` to remove the token-bearing URL. Consider printing a redacted URL in CLI logs.

### Low: Resource caps remain incomplete

Angular import has aggregate byte caps but lacks explicit file-count, path-length, and component-count caps. Handoff screenshots validate PNG signatures but lack per-image and total decoded byte caps.

## 2. Quality Agent

### High: Registry containment can still be bypassed through auto-discovery

Explicit registry paths are workspace-contained, but `buildKnownTypes()` still auto-discovers `aub.registry.json` by walking parent directories. MCP tools that omit `registry` can therefore read a parent registry outside the workspace.

Evidence:

- `scripts/registry.lib.mjs:40-44`
- `scripts/registry.lib.mjs:190-198`
- `apps/mcp-server/src/tools/validate-blueprint.ts:60-63`
- `apps/mcp-server/src/tools/export-handoff.ts:64-66`

Suggested change:

```ts
const extensionPath = args.registry
  ? await resolveWorkspaceRegistryPath(ctx.root, args.registry)
  : await discoverWorkspaceRegistryPath(ctx.root, startDir);
const knownTypes = await buildKnownTypes({ extensionPath, discover: false });
```

Add a regression test where a temp workspace lives under a parent directory containing `aub.registry.json`; validation must not discover the parent registry.

### High: Project containment is not the shared helper default

Same core issue as Security Agent: safe containment is caller-dependent. Move the boundary into the shared loader/API, not only selected call sites.

### Medium: Launcher regression test builds apps inside root `pnpm test`

`tests/workspace-cli-init.test.mjs` can build editor and MCP dist artifacts if they are missing. This makes root unit tests slower, more stateful, and less aligned with the repo's explicit merge checks.

Suggested change: move this to an explicit integration test script, or skip with a clear prebuilt-runtime requirement when dist is missing.

## 3. Bug Hunter Agent

### High: Browser-side handoff export can fail because `Buffer` is used

The editor dynamically imports `scripts/handoff-package.lib.mjs`. The new PNG data URL decoder uses `Buffer.from(...)`, but browser runtime does not provide Node `Buffer`.

Evidence:

- `apps/editor/src/lib/io.ts:43-55`
- `apps/editor/src/App.tsx:1041-1055`
- `apps/editor/src/components/Canvas.tsx:408-423`
- `scripts/handoff-package.lib.mjs:121-131`

Suggested change:

```js
function base64ToBytes(base64) {
  if (typeof globalThis.atob === 'function') {
    return Uint8Array.from(globalThis.atob(base64), (ch) => ch.charCodeAt(0));
  }
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(base64, 'base64'));
  }
  throw new Error('Base64 decoder is unavailable.');
}
```

Also replace browser-reachable `Buffer.byteLength(content)` usage with `new TextEncoder().encode(content).byteLength` or a cross-runtime helper.

### Medium: Project member path contract may reject valid workspace-internal layouts

The schema forbids any `../`, while runtime containment requires member screens to stay under the project file directory. If the intended contract is workspace-contained screens, then `flows/app.aub.project.json` cannot reference `../screens/home.ui.json` even when both paths are inside the workspace.

Suggested change: decide one contract. If screens must be descendants of the project directory, update `project init`, docs, schema description, and TS comments. If screens only need workspace containment, allow relative parent segments in schema and enforce containment through realpath runtime checks.

### Medium: Scanner source byte accounting is not global

`scan_project_ui` reads route, Storybook, and component source through separate paths. The final audit only reports the component read budget, so actual IO can exceed reported `sourceBytesRead`.

Suggested change: introduce a single scan-level source reader/budget shared by route, Storybook, and component detection.

### Medium: Angular template node cap is not applied uniformly

Entry templates get full-template traversal through `inferScreenName()`, but child component templates parsed through `parseTemplate()` do not receive the same full-template node cap.

Suggested change: after each `parseFragment`, run a full-template limit pass such as `walkHtml(document, () => {})`.

## 4. Concurrency & Performance Agent

### High: `overwrite: false` still has a same-path race

`write_blueprint` and `export_handoff` check existence outside the per-path write lock. Two concurrent writes to a missing path can both pass `exists()` and then overwrite in sequence.

Evidence:

- `apps/mcp-server/src/tools/write-blueprint.ts:71`
- `apps/mcp-server/src/tools/write-blueprint.ts:80`
- `apps/mcp-server/src/tools/export-handoff.ts:79`
- `apps/mcp-server/src/tools/export-handoff.ts:102`
- `apps/mcp-server/src/workspace.ts:126-142`

Suggested change:

```ts
await writeFileAtomic(outputPath, content, { overwrite: Boolean(args.overwrite) });

// Inside the per-path lock:
if (!options.overwrite && await exists(outputPath)) {
  throw new Error(`Refusing to overwrite existing file: ${displayPath}`);
}
```

Add a concurrent test where two `overwrite:false` writes target the same missing path and exactly one succeeds.

### Medium: realpath containment and write are still separated

`prepareWorkspaceWritePath()` validates parent containment, then `writeFileAtomic()` writes later. A hostile or rapidly changing workspace can swap the parent directory between validation and write.

Suggested change: move parent revalidation into the same write helper immediately before creating temp and target paths.

### Medium: Scanner budget is local rather than scan-wide

Same as Bug Hunter. This is both a correctness and performance-reporting issue.

### Medium: Launcher smoke test process cleanup is weak

`stopChild()` sends SIGTERM without a timeout/SIGKILL fallback. If the long-lived launcher process hangs during shutdown, the test can hang.

Suggested change: use a bounded shutdown helper with SIGKILL fallback.

### Low: `submit_report` filenames can collide

`submit_report` uses a millisecond timestamp in the output filename. Concurrent submissions for the same screen can collide.

Suggested change: append `randomUUID()` or a monotonic suffix to the report filename.

## 5. Architecture Agent

### High: Project trust boundary is inconsistent across MCP, CI, and CLI

The same `.aub.project.json` is treated differently depending on entrypoint. MCP/CI use workspace containment; CLI paths do not. This is an architectural boundary issue, not just a missed caller.

Suggested change: define project loading as a single fail-closed shared boundary. CLI, MCP, CI, and export should all use the same loader semantics and regression matrix.

### Medium: Project path contract is unclear

Schema, runtime, docs, and `project init` disagree about whether member screens must stay under the project directory or merely inside the workspace.

Suggested change: document and enforce one contract end to end.

### Medium: Atomic write helper protects temp collisions, not full transactions

`writeFileAtomic()` serializes final writes but does not protect caller-level read/check/write semantics. Session and component approval flows also have read-modify-write shapes that can lose concurrent updates.

Suggested change: introduce a path-scoped transaction helper:

```ts
await withWorkspacePathLock(path, async () => {
  const current = await readCurrentState(path);
  const next = merge(current, patch);
  await writeFileAtomicLocked(path, JSON.stringify(next, null, 2));
});
```

### Low: Token-by-default UX should scrub secret-bearing URLs

The token propagation design works, but the URL lifecycle should avoid leaving secrets in copyable browser/terminal surfaces.

## Main Agent Assessment

PR #26 substantially improves the previous security-hardening follow-ups: action shell interpolation is fixed, HTTP token comparison is safer, launcher token propagation now reaches the editor, path helpers are stronger, and several regression tests were added.

However, this PR is not ready to merge as-is. The blocking issues are:

1. `loadProject()` containment is still opt-in, leaving CLI project validation/export paths outside the intended trust boundary.
2. Browser handoff export likely regresses because shared code uses Node `Buffer`.
3. `overwrite:false` atomic write semantics still race because existence checks happen outside the lock.
4. Registry discovery and project path contract remain inconsistent enough to create future security and usability regressions.

Recommended merge gate: fix the three high-severity issues first, then add targeted regression tests for CLI project containment, browser handoff export, and concurrent no-overwrite writes.

## Verification Run By Main Agent

The following checks passed locally:

- `pnpm test`
- `pnpm typecheck`
- `pnpm --dir apps/editor typecheck`
- `pnpm --dir apps/editor build`
- `pnpm --dir apps/mcp-server typecheck`
- `pnpm --dir apps/mcp-server build`
- `pnpm --dir apps/mcp-server test`
- `pnpm site:locales:check`
- `pnpm workspace:package`
- `git diff --check 1eb94cd0cb7ed63510da0c48ebdd91ccdbd1bb58..07649900859d3825a5782d33444396ec05e13a4c`

Final worktree status was clean after validation.
