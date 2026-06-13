# PR #26 Subagent Code Review Fix Plan

Date: 2026-06-13
PR: #26 `[codex] Harden workspace security follow-ups`
Reviewed head: `f6d7769300818294006877da0bfa985ac7bf3644`
Base: `1eb94cd0cb7ed63510da0c48ebdd91ccdbd1bb58`
Range: `1eb94cd0cb7ed63510da0c48ebdd91ccdbd1bb58..f6d7769300818294006877da0bfa985ac7bf3644`

## Review Scope

Five independent subagents reviewed the updated PR diff from these dimensions:

1. Security
2. Quality
3. Bug Hunter
4. Concurrency and Performance
5. Architecture

This document consolidates their findings into an executable correction plan. The conclusion is direct: PR #26 should not be merged until the P1 blockers below are fixed and covered by regression tests.

## Executive Summary

The PR significantly improves the workspace security posture, but the follow-up review found several remaining gaps that affect real users and trust boundaries:

- Manual `aub-workspace --no-open` launch is currently not a usable authenticated workflow.
- CI verification still accepts paths that can escape the workspace boundary.
- `aub-workspace init/demo` can follow workspace symlinks and write outside the workspace.
- Implementation report machine evidence can fail while the verifier still passes.
- Component candidate scans can overwrite prior review decisions.
- Long-running or interrupted locks and temp writes still have cleanup and ownership edge cases.
- Large repository scanning still lacks directory/depth caps in some paths.

The fix should be implemented in two waves:

1. Merge-blocking safety and correctness fixes.
2. Maintainability and performance hardening.

## P1 Merge Blockers

### 1. Make `aub-workspace --no-open` usable without leaking secrets by default

Problem:

- The CLI generates an RPC token and injects it into the auto-open editor URL.
- With `--no-open`, the real URL is not opened and the printed URL is redacted.
- Copying the printed URL sends `<redacted>` as the token and results in RPC 401.

Files:

- `packages/workspace-cli/bin/aub-workspace.mjs`
- `packages/workspace-cli/README.md`
- `tests/workspace-cli-init.test.mjs`

Required fix:

1. Keep default printed URLs redacted.
2. Add an explicit manual auth option, preferably `--print-auth-url`.
3. When `--no-open` is used without `--print-auth-url`, print clear guidance:
   - The redacted URL is not directly usable.
   - Rerun with `--print-auth-url` only on a trusted local terminal.
4. If `--print-auth-url` is set, print a clearly labelled sensitive localhost editor URL.
5. Add tests that assert:
   - default output does not expose the token.
   - `--no-open` tells the user how to get a usable manual URL.
   - `--no-open --print-auth-url` prints a usable authenticated URL.

Acceptance:

- Manual launch no longer dead-ends at 401.
- Token is never printed unless the user explicitly opts in.
- README explains the exact command and risk in plain language.

### 2. Enforce workspace path confinement in CI verification

Problem:

- `scripts/ci-verify.lib.mjs` resolves config, blueprint, project, and report refs with `resolve(root, ref)` or accepts absolute refs.
- This is looser than MCP/editor workspace containment and contradicts the security docs.

Files:

- `scripts/ci-verify.lib.mjs`
- `schema/aub-ci.schema.json`
- `tests/ci-verify.test.mjs`
- `docs/github-ci.md`
- `docs/security-and-data-safety.md`

Required fix:

1. Add a single `resolveWorkspaceRef(root, ref, label)` helper.
2. Reject:
   - absolute paths.
   - `..` traversal outside workspace.
   - symlink-resolved paths outside workspace where the target must already exist.
3. Use this helper for:
   - CI config path.
   - `blueprints[]`.
   - `projects[]`.
   - report blueprint refs.
   - implementation report paths.
4. Tighten `schema/aub-ci.schema.json` with string patterns or documented constraints that disallow absolute paths.
5. Add regression tests for:
   - `../outside.ui.json`
   - absolute path refs.
   - symlink escape.
   - valid nested workspace refs.

Acceptance:

- CI verifier and MCP enforce the same workspace boundary model.
- Attempted out-of-root refs fail before any out-of-scope file is read.

### 3. Fix `aub-workspace init/demo` symlink escape

Problem:

- `writeInitFile()` uses lexical containment only.
- If `.github` or `.aub` is a symlink to an external directory, init can write outside the workspace.

Files:

- `packages/workspace-cli/bin/aub-workspace.mjs`
- `tests/workspace-cli-init.test.mjs`

Required fix:

1. Add `prepareInitWritePath(workspace, relativePath)`.
2. Resolve the workspace root with `realpath`.
3. Before writing, find the nearest existing parent and verify its `realpath` is inside the workspace.
4. After `mkdir`, verify the final parent `realpath` is still inside the workspace.
5. Use this helper for all init/demo generated files.
6. Add tests for:
   - `.github` symlink escape.
   - `.aub` symlink escape.
   - normal nested directory creation.

Acceptance:

- `aub-workspace init --force` cannot write outside the selected workspace through symlinks.

### 4. Make implementation evidence failures actually fail verification

Problem:

- `requireEvidence` currently checks that machine evidence exists.
- It fails only `overflow.pass === false`.
- Other evidence types with `pass: false` or `expected !== actual` can still pass.

Files:

- `scripts/implementation-report.lib.mjs`
- `tests/implementation-report.test.mjs`
- `scripts/capture-implementation-report.mjs`

Required fix:

1. Add generic machine evidence validation:
   - any `evidence.pass === false` must fail.
   - when both `expected` and `actual` exist, mismatch must fail.
2. Keep existing overflow-specific messages, but make generic evidence checks apply to:
   - `dom_query`
   - `computed_style`
   - `component_reuse`
   - `interaction`
   - future machine-readable evidence types.
3. Add tests for:
   - failed `dom_query`.
   - failed `computed_style`.
   - expected/actual mismatch.
   - successful report with valid evidence.

Acceptance:

- A report cannot pass `--require-evidence` by merely including evidence objects.
- Evidence must support the acceptance result.

## P2 Required Before Ready-for-Review

### 5. Preserve component candidate review state across rescans

Problem:

- `scanProjectUi()` overwrites `.aub/component-candidates.json`.
- Prior `map_core`, `ignore`, or `create_extension` decisions can be reset to `candidate`.

Files:

- `scripts/workspace-loop.lib.mjs`
- `tests/workspace-loop.test.mjs`

Required fix:

1. Add `mergeScannedCandidatesPreservingReviews(previous, next)`.
2. Match candidates by stable `id`.
3. Preserve:
   - `status`
   - `approvedAs`
   - `reviewedAt`
   - `reviewHistory`
4. Run scan writes under the same candidate review lock used by approval.
5. Add tests:
   - scan -> approve -> rescan keeps approval.
   - scan -> ignore -> rescan keeps ignore.
   - new candidate is still added.
   - removed source candidate remains only if needed for audit, or is marked stale explicitly.

Acceptance:

- Repeated scans do not destroy human review decisions.

### 6. Make candidate extension approval recoverable

Problem:

- `create_extension` writes `aub.registry.json` first, then updates `.aub/component-candidates.json`.
- A crash between the two writes can leave registry and candidate state inconsistent.

Files:

- `scripts/workspace-loop.lib.mjs`
- `tests/workspace-loop.test.mjs`

Required fix:

1. Require candidate status to be `candidate` before any new review transition.
2. Add a pending or reconciliation state for `create_extension`.
3. Prefer this flow:
   - acquire candidate review lock.
   - mark candidate `review_pending` with intended extension type.
   - write registry.
   - finalize candidate as approved.
4. Add idempotent reconciliation:
   - if registry already contains the intended extension and candidate is pending, finalize candidate.
   - if candidate is reviewed, reject duplicate review action.
5. Add tests for:
   - duplicate review rejection.
   - registry already contains extension.
   - simulated partial state recovery.

Acceptance:

- Candidate review has a strict state machine.
- Registry and candidate audit state can recover from partial writes.

### 7. Harden cross-process locks and temp cleanup

Problem:

- Lock release does not verify ownership.
- Stale takeover can delete a live holder's lock if the process is paused long enough.
- Temp files can remain if rename fails.

Files:

- `scripts/workspace-loop.lib.mjs`
- `apps/mcp-server/src/workspace.ts`
- `tests/workspace-loop.test.mjs`
- `apps/mcp-server/test/tools.test.mjs`

Required fix:

1. Add an owner token to each lock directory.
2. Release only when the current process owns the lock token.
3. On owner write failure, best-effort remove the just-created lock directory.
4. Add heartbeat or make stale cleanup conservative:
   - stale removal must verify owner metadata.
   - stale timeout should be clearly longer than expected write duration.
5. Wrap temp file rename paths in cleanup logic:
   - remove temp file on failed rename/write.
   - never remove final target after successful rename.
6. Add tests for:
   - release does not remove another owner's lock.
   - owner write failure cleanup.
   - stale takeover does not break active ownership.
   - temp file cleanup on simulated failure.

Acceptance:

- Locks preserve mutual exclusion across stale cleanup edge cases.
- Failed writes do not leave avoidable temp artifacts.

### 8. Align CORS allowed origins with auth allowed origins

Problem:

- Auth accepts configured `--rpc-allowed-origins`.
- CORS preflight only allows localhost and GitHub Pages.
- A configured browser origin can still fail before reaching RPC.

Files:

- `apps/mcp-server/src/http.ts`
- `apps/mcp-server/test/http-auth.test.mjs`

Required fix:

1. Extract one origin allow helper.
2. Use it in both auth and CORS middleware.
3. Add tests for:
   - configured origin preflight succeeds.
   - unconfigured origin preflight does not receive allow headers.
   - configured origin POST succeeds with valid token.

Acceptance:

- `--rpc-allowed-origins` means the same thing for auth and browser CORS.

## P3 Hardening and Product Consistency

### 9. Cap large repo discovery by files, directories, and depth

Problem:

- CI discover and workspace scanning have file caps but incomplete directory/depth caps.
- Large monorepos can burn CI time before reaching useful work.

Files:

- `scripts/ci-verify.lib.mjs`
- `scripts/workspace-loop.lib.mjs`
- `tests/ci-verify.test.mjs`
- `tests/workspace-loop.test.mjs`

Required fix:

1. Add caps:
   - `MAX_DISCOVER_FILES`
   - `MAX_DISCOVER_DIRS`
   - `MAX_DISCOVER_DEPTH`
   - workspace scanner directory/depth counters.
2. Return warnings or failures when limits are hit.
3. Add audit fields:
   - `directoriesVisited`
   - `directoriesSkippedByDepth`
   - `discoverLimitReached`
4. Share ignore rules where practical.

Acceptance:

- CI and scanner fail predictably on pathological repository shapes instead of walking indefinitely.

### 10. Avoid double CI verification for PR comments

Problem:

- The action runs `ci-verify.mjs`.
- The PR comment step calls `verifyWorkspace()` again through `create-pr-safety-comment.mjs`.

Files:

- `action.yml`
- `scripts/ci-verify.mjs`
- `scripts/create-pr-safety-comment.mjs`
- `scripts/pr-safety-comment.lib.mjs`

Required fix:

1. Add `ci-verify.mjs --json-output <path>`.
2. Make the comment script accept a precomputed result JSON.
3. In the GitHub Action, run verification once and reuse the JSON for the comment.
4. Keep backward compatibility for local comment generation.

Acceptance:

- PR Action produces the same comment without running full verification twice.

### 11. Fix runtime version reporting

Problem:

- Package version is `0.4.0`.
- CLI `--version` and HTTP `/health` report `0.3.0`, which is the Blueprint format version.

Files:

- `packages/workspace-cli/bin/aub-workspace.mjs`
- `apps/mcp-server/src/http.ts`
- `package.json`
- `packages/workspace-cli/package.json`
- related tests

Required fix:

1. Separate product/runtime version from Blueprint `format_version`.
2. Read runtime version from package metadata or one shared generated constant.
3. Keep `/health` free of sensitive workspace path details.

Acceptance:

- Runtime diagnostics report the installed AUB package version, not the Blueprint schema version.

### 12. Fix packaged runtime root resolution order

Problem:

- `findAubRuntimeRoot()` can prefer a host project over packaged `vendor/aub`.
- In `npx` usage, a target project that happens to contain AUB-like files could be mistaken as runtime.

Files:

- `packages/workspace-cli/bin/aub-workspace.mjs`
- `tests/workspace-cli-init.test.mjs`
- `pnpm workspace:package` output checks

Required fix:

1. Prefer packaged `vendor/aub` when present and complete.
2. Use repo fallback only for real development checkout.
3. Require both:
   - `apps/mcp-server/dist/http.js`
   - `apps/editor/dist/index.html`
4. Add tests for packaged mode and host-project collision.

Acceptance:

- `npx aub-workspace` consistently uses the packaged runtime.

### 13. Add session contract validation

Problem:

- `.aub/session.json` is a core editor/MCP/agent handoff contract.
- MCP update currently accepts arbitrary patch objects.

Files:

- `schema/aub-session.schema.json`
- `apps/mcp-server/src/tools/update-aub-session.ts`
- `scripts/workspace-loop.lib.mjs`
- `apps/editor/src/lib/workspace-client.ts`
- `tests/workspace-loop.test.mjs`
- `apps/mcp-server/test/tools.test.mjs`

Required fix:

1. Add a session schema or shared validator.
2. Allow only known fields:
   - `activeBlueprint`
   - `activeProject`
   - `targetRoute`
   - `preview`
   - `updatedAt`
3. Validate path-like fields with workspace containment.
4. Reject unknown keys unless there is an explicit `metadata` namespace.

Acceptance:

- Session state remains stable across editor, MCP, and agent usage.

### 14. Normalize report filename conventions

Problem:

- `submit_report` writes generic `.json`.
- `report:capture` and docs use `.implementation-report.json`.

Files:

- `apps/mcp-server/src/tools/submit-report.ts`
- `scripts/capture-implementation-report.mjs`
- `README.md`
- `docs/github-ci.md`

Required fix:

1. Standardize persisted report output to `.implementation-report.json`.
2. Keep backward compatibility when reading existing `.json` report paths.
3. Update docs and tests.

Acceptance:

- Users see the same report naming convention across CLI, MCP, and docs.

## Deferred Refactor

### Split `workspace-loop.lib.mjs`

Problem:

`scripts/workspace-loop.lib.mjs` now owns too many responsibilities:

- session management.
- workspace status.
- scanner.
- source cache.
- template generation.
- component candidates.
- locks.
- implementation report summary.

Decision:

Do not block PR #26 on this large refactor. First stabilize behavior and tests. Then split into:

- `workspace-session.lib.mjs`
- `workspace-scan.lib.mjs`
- `workspace-template.lib.mjs`
- `component-candidates.lib.mjs`
- `workspace-status.lib.mjs`
- `workspace-locks.lib.mjs`

Acceptance:

- No behavior change in the refactor PR.
- Existing tests remain green before and after each extraction.

## Implementation Order

1. Fix CLI manual auth flow and docs.
2. Fix CI path confinement and tests.
3. Fix CLI init/demo symlink containment and tests.
4. Fix implementation evidence validation and tests.
5. Fix candidate rescan preservation and review state machine.
6. Harden locks and temp cleanup.
7. Align CORS/auth origin helper.
8. Add large repo directory/depth caps.
9. Remove duplicate CI verification for PR comments.
10. Fix runtime version and `/health` output.
11. Fix packaged runtime root resolution.
12. Add session schema validation.
13. Normalize report filename convention.
14. Defer `workspace-loop.lib.mjs` split to a separate refactor PR after behavior is stable.

## Required Validation

Run from `/Users/h/Workspace/AUB`:

```bash
pnpm test
pnpm typecheck
(cd apps/editor && pnpm typecheck)
(cd apps/editor && pnpm build)
(cd apps/mcp-server && pnpm typecheck && pnpm build && pnpm test)
pnpm site:locales:check
pnpm workspace:package
git diff --check
```

Run the repository data safety check before committing. It must verify that no
local private project names, local private paths, or locally identifiable test
project terms are present in committed fixtures, docs, or snapshots.

```bash
node --test tests/data-safety.test.mjs
```

Expected result: pass with no findings.

## Merge Readiness Criteria

PR #26 can be marked ready for review only after:

1. All P1 items are implemented with regression tests.
2. P2 items related to candidate state, lock ownership, and CORS consistency are implemented.
3. Full validation passes.
4. Data safety scan has no local project leaks.
5. The final audit conclusion states that no merge-blocking findings remain.

## Implementation Status

Implemented in this follow-up:

- P1 manual launch: `aub-workspace --no-open` now gives clear redacted-output guidance, and `--no-open --print-auth-url` is the explicit opt-in path for a working manual local URL.
- P1 CI path confinement: CI config, Blueprint refs, project refs, and report refs now reject absolute paths, parent traversal, and symlink escapes outside the workspace.
- P1 init/demo symlink containment: generated files use realpath parent checks before writing.
- P1 evidence gate: machine evidence with `pass: false` or mismatched `expected`/`actual` now fails verification.
- P2 component candidates: rescans preserve reviewed decisions and stale reviewed candidates remain auditable.
- P2 extension approval: `create_extension` now uses a pending -> registry -> finalize state machine and rejects duplicate reviews.
- P2 lock/temp hardening: workspace locks use owner tokens, heartbeat metadata, ownership-aware release, and temp cleanup on failed rename.
- P2 CORS/auth consistency: configured RPC allowed origins are shared by auth and CORS preflight.
- P3 runtime diagnostics: `aub-workspace --version` reports the package version, and `/health` no longer returns the workspace absolute path.
- P3 packaged runtime root: source checkouts are distinguished from packaged runtime payloads to avoid choosing the wrong host project.

Deferred and not considered merge-blocking for PR #26:

- Split `workspace-loop.lib.mjs` into smaller libraries.
- Add a formal `.aub/session.json` schema.
- Remove duplicate CI verification from PR comments.
- Normalize all implementation report filename conventions.
- Add directory/depth caps to every remaining discovery path beyond the existing scan file and source byte caps.

## Final Validation

Completed successfully after implementation:

- `pnpm test` - 187 pass.
- `pnpm typecheck`.
- `(cd apps/editor && pnpm typecheck && pnpm build)`.
- `(cd apps/mcp-server && pnpm typecheck && pnpm build && pnpm test)` - 63 pass.
- `pnpm site:locales:check`.
- `pnpm workspace:package`.
- `git diff --check`.
- repository data safety check.

## Final Audit Conclusion

No merge-blocking findings remain from this subagent review cycle. PR #26 can be pushed with this follow-up commit and moved out of draft after CI confirms the same checks remotely.
