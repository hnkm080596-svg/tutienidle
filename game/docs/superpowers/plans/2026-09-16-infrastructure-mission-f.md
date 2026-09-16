# Mission F — Verification & Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development or executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Test tooling tests the right tree, type-check covers the guard suite, one canonical verify command exists, and the Supabase boundary is account-keyed with timeouts.

**Architecture:** tsconfig coverage extended to test dirs; lab tests out of the default gate; Playwright owns a strict unique port; `npm run verify` is the single evidence command; saves are keyed per account.

**Tech Stack:** TypeScript configs, Vite/Vitest/Playwright config, npm scripts, Supabase (fetch-based services).

**Spec:** `docs/specs/2026-09-16-audit-remediation-spec.md` Mission F. Audit: `docs/qa/2026-09-16-full-project-scout-audit.md` T7-60..68, T5-46, T5-49, T3-24.

## Global Constraints

- Dev-stage rule; P8 no `any`; P15 English comments.
- Config changes → P3 **full** verification (`type-check` + `build` + whole vitest run).
- F8 decisions locked: `SAVE_KEY:<userId>` + guest slot; login pulls remote newest-wins; SQL fixed in place; token refresh + fetch timeout added.
- Worktree: `.agent-worktrees/infrastructure` (branch `chore/infrastructure`).

---

### Task 1: tsconfig coverage for test dirs

**Files:** `game/tsconfig.app.json` or `tsconfig.node.json` (extend include), maybe `tests/**` tsconfig

- [ ] Add `tests/architecture/**` and `tests/lab/**` to the appropriate project include so `npm run type-check` (vue-tsc build) covers them. Fix any type errors this surfaces (they exist — the suite was never checked).
- [ ] Run `npm run type-check` — must be green including the new files.
- [ ] Commit `chore(tsconfig): type-check architecture and lab test suites`

### Task 2: Lab tests out of the default gate

**Files:** `game/vite.config.ts:86` (test include glob), `game/tests/lab/**`

- [ ] Exclude `tests/lab/**` from the default vitest include (or move lab files under a non-matching path); delete committed `tests/lab/scratch.test.ts`; keep a separate opt-in script (`test:lab`) if the sweeps are still wanted.
- [ ] `npx vitest run` no longer picks up lab files; `npm run test:lab` still can.
- [ ] Commit `chore(test): exclude lab sweeps from default test gate`

### Task 3: Playwright/Vite server identity

**Files:** `game/vite.config.ts:23` (`strictPort`), `game/playwright.config.ts:57,64`

- [ ] `strictPort: true`; unique port per worktree (derive from env/`VITE_PORT` or worktree path hash); `reuseExistingServer` only outside CI (`!process.env.CI`); reconsider `VITE_PRESENTATION_DEADLINE_SCALE=3` — scope it to a flake-tagged subset or remove if suite stays green at 1×.
- [ ] Verify `npm run e2e` (or the project's e2e script) still passes.
- [ ] Commit `chore(e2e): strict port identity, no stale-server reuse`

### Task 4: Canonical verify command

**Files:** `game/package.json` (scripts), `AGENTS.md` (document it)

- [ ] Add `"verify": "npm run type-check && npm run build && npx vitest run"`; document in AGENTS.md as the canonical full-verification contract.
- [ ] Commit `chore(scripts): canonical npm run verify`

### Task 5: Environment + packaging hygiene

**Files:** `game/.gitignore`, `game/index.html`, `game/package.json`, `game/scripts/patch-t14.cjs`, `game/scripts/check-bundle-split.mjs`, `game/electron-builder.yml`

- [ ] `.gitignore`: ignore `.env` / `.env.*` (keep `.env.example`); `index.html`: real `lang` + `<title>`; remove `patch-t14.cjs`; fix `check-bundle-split` usage comment (`--dist` flag); `set ELECTRON=1` → `cross-env`-free alternative (node script or documented per-shell note); `build/icon.ico` — add a real icon or remove the `win.icon` key (pick whichever keeps `dist:win` honest).
- [ ] Commit `chore: packaging and env hygiene`

### Task 6: Tick-constant authority

**Files:** `game/src/core/idle/SpeedSettings.ts:14`, `game/src/composables/useAppLifecycle.ts:120,172`

- [ ] Decide by code truth: live cadence is 1000ms — either wire `TICK_INTERVAL_MS` into `useAppLifecycle` as the single source (update the constant to 1000 and fix its stale comment) or delete the dead export. Preferred: single source in `SpeedSettings` consumed by the lifecycle.
- [ ] Commit `fix(clock): single tick-interval authority`

### Task 7: EventBus isolation

**Files:** `game/src/core/events/EventBus.ts:44-49`
**Test:** `EventBus` colocated test

- [ ] Failing tests: a throwing listener does not abort remaining handlers; a handler added during dispatch does not fire in the current emit.
- [ ] Implement: snapshot `Set` before dispatch; wrap each handler in try/catch → `console.error` with listener context, continue.
- [ ] Commit `fix(events): isolate handler failures, snapshot dispatch`

### Task 8: Per-account save keying

**Files:** `game/src/services/save/SaveSystem.ts` (`SAVE_KEY`, `BACKUP_KEY`, `SAVE_REVISION_KEY` usage), `game/src/services/auth/SupabaseSession.ts` (user id source), `game/src/App.vue` boot/load call sites

- [ ] Save keys become `SAVE_KEY:<userId>` — guest slot (`SAVE_KEY:guest`) when unauthenticated. Every read/write/delete/backup path resolves the active key from the session (single key-resolver function, not scattered string templates). Login/logout switches the active slot; no cross-account reads.
- [ ] Tests: two account ids → independent saves; guest → own slot; logout → no leak.
- [ ] Commit `feat(save): per-account local save slots`

### Task 9: Supabase boundary hardening

**Files:** `game/supabase/migrations/202608240001_online_auth_character.sql` (fix `cardinality=3` → `=1` in place — dev stage), `game/src/services/supabase/SupabaseHttp.ts` (AbortSignal timeout), `game/src/services/auth/SupabaseSession.ts` (refresh-token use), auth boot path (pull `characters`/`character_saves`, newest-wins vs local per Task-8 keying)

- [ ] Fetch timeout (e.g. 10s `AbortController`) on all Supabase HTTP calls → no permanent spinner.
- [ ] Refresh-token flow: before expiry, exchange refresh token; on failure → signed-out state (not silent stall).
- [ ] On authenticated boot: pull remote save for the account, compare `save_revision`/timestamp with local slot, newest wins; push local-only progress on first login.
- [ ] Tests where feasible (mock fetch); document manual check for the rest.
- [ ] Commit `feat(auth): account-scoped saves, token refresh, fetch timeout`

---

## Mission F done-criteria

- `npm run type-check` covers `tests/**`; lab tests out of the default gate; Playwright can't hit a stale server.
- `npm run verify` exists and is documented.
- `.env` can't be committed; packaging honest.
- Per-account saves; Supabase calls time out and refresh tokens.
- Full verification green; P4 QA; P5 review.
