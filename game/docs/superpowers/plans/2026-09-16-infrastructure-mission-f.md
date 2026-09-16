# Mission F — Verification & Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Test tooling tests the right tree, type-check covers the guard suite, one canonical verify command exists, and the Supabase boundary is account-keyed with timeouts and refresh.

**Architecture:** a dedicated `tsconfig.tests.json` project brings `tests/architecture` + `tests/lab` under `vue-tsc --build`; lab sweeps move behind their own vitest config so the default gate is `src/**/*.test.ts` + `tests/architecture/**/*.test.ts` only; dev/playwright ports derive a stable per-checkout value (no shared fixed port, `strictPort` on); `npm run verify` is the single evidence command; a single `resolveSaveKey()` resolver keys every save-storage path to `…:<accountId>` (guest slot when unauthenticated); Supabase fetches carry an `AbortSignal` timeout, stored sessions carry expiry + `userId`, and authenticated boot runs a newest-wins remote sync.

**Tech Stack:** TypeScript project references, Vite/Vitest/Playwright config, npm scripts, Supabase (fetch-based services), localStorage/sessionStorage.

**Spec:** `docs/specs/2026-09-16-audit-remediation-spec.md` (Mission F + locked F8 decisions). Audit evidence: `docs/qa/2026-09-16-full-project-scout-audit.md` T7-60..68, T5-46, T5-49, T3-24.

**Sequencing note (verified against master `c57e8175`):** Missions A and B are planned but not merged in this checkout — `App.vue:95-108` still has the old `battleRunMode`-only dirty check and `onCharacterCreated` (`App.vue:647-676`) still saves post-boot. This plan's tasks do not depend on those diffs, but Task 9-11 touch `useAppLifecycle.bootGame`, which Mission B2 extends — if B lands first, apply the same seams inside the extended function.

## Global Constraints

- **Dev-stage rule:** no live players — never write save migrations or old-shape compat shims. The SQL talent-cardinality fix edits the existing migration file **in place** (locked decision); stored sessions from before this change simply fail validation and re-authenticate.
- P8: no `any`. Narrow with `unknown` + guards. P15: English ASCII comments in `.ts`/`.vue`/`.mjs` files. P16: new user-facing strings go through `t()` keys (none of these tasks add UI strings).
- **Verification:** config changes (Tasks 1-6) → P3 **full**: `npm run type-check` + `npm run build` + `npx vitest run` (after Task 5 exists, `npm run verify` is the same thing). Code tasks (7-11) → P3 quick + the named test scopes.
- P13/P14: Tasks 9-11 touch the boot/auth wiring — unit tests are not enough; run the relevant Playwright specs (`boot-fresh`, `save-reload`, `error-recovery`) **inside the implementation worktree** before the branch is merge-ready. The old P14 worktree deferral is retired: a genuine environment failure is an explicit blocker with captured evidence — never merge to `master` to obtain browser evidence.
- Worktree: `.agent-worktrees/infrastructure` (branch `chore/infrastructure`).
- Known-stale audit detail: audit T7-66 says "`.env` not gitignored" — the **repo-root** `.gitignore` already covers `.env`/`.env.*`; `game/.gitignore` does not. Task 6 adds the game-level rules as defense-in-depth; treat it as hardening, not a live leak.

---

### Task 1: tsconfig coverage for `tests/architecture` + `tests/lab` (audit T7-60, spec F1)

**Files:**
- Create: `game/tsconfig.tests.json`
- Modify: `game/tsconfig.json` (add project reference)
- Modify: whichever `tests/**` files fail type-check on first run (fix-forward — see Step 3)

**Interfaces:**
- Consumes: `@vue/tsconfig/tsconfig.dom.json` (same base as `tsconfig.app.json`), `@types/node` (devDependency, already installed), `@/` path alias convention from `tsconfig.app.json:10-12`.
- Produces: `npm run type-check` (vue-tsc `--build` on the root solution file) covering `tests/architecture/**/*` and `tests/lab/**/*`.

**Verified facts this design rests on:**
- `tsconfig.app.json:3` includes only `env.d.ts`, `src/**/*`, `src/**/*.vue`; `tsconfig.node.json:4-12` covers configs + `tests/e2e/**/*` + `electron/**/*.ts`. `tests/architecture` and `tests/lab` belong to no project.
- `tsconfig.node.json` is NOT a usable home: it sets `"types": ["node"]` (tsconfig.node.json:20) on a node24 base with no DOM lib — architecture tests import `@/presentation/**` modules that reference DOM types. The dom base already carries `"types": []`, which blocks `node:fs`/`node:path` — so the new project extends the dom base and opts node types back in.
- `vue-tsc --build` accepts a `noEmit` referenced project without `composite` (the existing two projects prove it — verified green `npm run type-check`).
- `tests/lab/local/` is gitignored scratch (`.gitignore:42`) that may exist on developer machines — it must be excluded so uncommitted experiments can't break the type gate.

- [ ] **Step 1: Create `game/tsconfig.tests.json`:**

```json
{
  // Test-only project so `npm run type-check` (vue-tsc --build) covers the
  // architecture guard suite and the lab harness (audit T7-60). Extends the
  // dom base like tsconfig.app because tests import @/presentation modules
  // that touch DOM types; `types` opts node back in for node:fs/node:path
  // helpers (tests/architecture/helpers/scanTs.ts).
  "extends": "@vue/tsconfig/tsconfig.dom.json",
  "include": ["tests/architecture/**/*", "tests/lab/**/*"],
  // tests/lab/local/ is gitignored personal scratch — never part of the gate.
  "exclude": ["tests/lab/local/**"],
  "compilerOptions": {
    "types": ["node", "vite/client"],
    "paths": {
      "@/*": ["./src/*"]
    },
    "noUncheckedIndexedAccess": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.tests.tsbuildinfo"
  }
}
```

- [ ] **Step 2: Register the project** in `game/tsconfig.json` — add `{ "path": "./tsconfig.tests.json" }` to the `references` array.

- [ ] **Step 3: Run `npm run type-check` — expect failures.** These suites were never type-checked; real errors will surface. Fix them in place, minimally:
  - `noUncheckedIndexedAccess` index/record access in tests → `?? undefined`, `!` on already-length-asserted values, or restructure the lookup.
  - Missing/loose types in `tests/lab/harness.ts`/`realData.ts`/`tests/architecture/helpers/scanTs.ts` → annotate.
  - If a surfaced error is a REAL bug in a guard (wrong path, dead assertion), fix the guard's code — do not weaken assertions to silence the compiler.
  - Do NOT add `// @ts-*`, `any`, or loosen `strict`/`noUncheckedIndexedAccess` to make errors go away.

- [ ] **Step 4: Iterate until green, then full verify** (config change): `npm run type-check && npm run build && npx vitest run`.

- [ ] **Step 5: Commit** `git add -A && git commit -m "chore(tsconfig): type-check architecture and lab test suites"`

---

### Task 2: Presentation-gate key drift (audit T7-67, first half)

**Files:**
- Modify: `game/tests/architecture/presentationGate.test.ts:27-36`

**Verified facts:**
- `src/presentation/gate/PresentationGate.ts:111` declares `theBarReader: TheBarReader` and `src/presentation/bridges/theBarBridge.ts:46` owns `THE_BAR_READER_KEY = 'theBarReader'`, routing through `writeGate`/`readOptionalGate` (:109,113) — no raw `registry.get('theBarReader')` exists. The test's literal `GATE_KEYS` list (:27-36) never gained the key, so raw access to it would pass the guard.
- Second half of T7-67 (test fixtures living under `src/` — `battleLootTestSetup.ts`, `EquipmentInstance.fixture.ts`, `combatTestHarness.ts`) is **deliberately deferred** to Mission G per the spec's known-intentional note — do not move them here.

- [ ] **Step 1: Failing test addition** — before the fix, add a drift tripwire so the list can't silently diverge again. Append a case that scans `PresentationGate.ts` source for `readOptionalGate`/`writeGate`-consumed key constants is overkill; instead document the invariant and add the missing key. (The honest fix is one line — assert it indirectly: the existing "no production file reaches a gate key through a raw registry call" case already exercises the list; adding `'theBarReader'` to it IS the fix and the test.)

```ts
const GATE_KEYS = [
  'gameManager',
  'eventBus',
  'sceneAdapter',
  'bundleManager',
  'playerVisualProfileId',
  'lastBattlePositionsSnapshot',
  'battlefieldGeometry',
  'kiemBarReader',
  // Audit T7-67 — added 2026-09-16 after drifting (theBarReader shipped in
  // Phap Tu Task 16 without joining this list). When the gate gains a key,
  // add its literal here in the same commit or the guard goes blind to it.
  'theBarReader',
]
```

- [ ] **Step 2: Run** `npx vitest run tests/architecture/presentationGate.test.ts` — expect PASS (no raw accessor exists; verified by grep). If it FAILS, a production file is doing `registry.get/set('theBarReader')` — migrate that file through `readOptionalGate`/`writeGate` instead of weakening the guard.

- [ ] **Step 3: Commit** `git add -A && git commit -m "fix(test): police theBarReader in the presentation-gate key list"`

---

### Task 3: Lab sweeps out of the default test gate (audit T7-61, spec F2)

**Files:**
- Modify: `game/vite.config.ts:82-87` (`test.include`)
- Create: `game/vitest.lab.config.mts`
- Modify: `game/package.json:14-15` (`lab`, `lab:watch` scripts)
- Modify: `game/tsconfig.node.json:4-12` (include the new config file)
- Delete: `game/tests/lab/scratch.test.ts`
- Modify: `game/tests/lab/README.md` (drop the scratch-file reference)

**Verified facts:**
- `vite.config.ts:86` — `include: ['src/**/*.test.ts', 'tests/**/*.test.ts']` picks up `tests/lab/*.test.ts` in `npm test` today. `tests/e2e` uses `*.spec.ts` so it is unaffected either way.
- `package.json:14` `"lab": "vitest run tests/lab"` — a positional path filter still respects `include`, so narrowing `include` alone would silently break `npm run lab` ("No test files found"). The lab entry point needs its own config.
- Lab tests need the `@/` alias (`tests/lab/scratch.test.ts:7` imports `@/core/material/SpiritStoneMaterial`) but no Vue plugin (lab is headless core only).

- [ ] **Step 1: Narrow the default gate** — `vite.config.ts` test block:

```ts
  test: {
    environment: 'node',
    // Architecture/meta guards live under tests/ (kept out of app source);
    // e2e specs (*.spec.ts, Playwright) are unaffected.
    // tests/lab is assertion-light experiment sweeps (audit T7-61) — it has
    // its own config (vitest.lab.config.mts, `npm run lab`) and is OUT of
    // the default gate so committed experiments can't pass/fail the suite.
    include: ['src/**/*.test.ts', 'tests/architecture/**/*.test.ts'],
  },
```

- [ ] **Step 2: Create `game/vitest.lab.config.mts`:**

```ts
/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Lab harness entry point (tests/lab/README.md). Separate from the default
// gate: `vitest run` uses vite.config.ts whose include no longer covers
// tests/lab, so `npm run lab`/`lab:watch` point vitest here explicitly.
// environment: 'node' + the @/ alias mirror vite.config.ts's test block.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/lab/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Update scripts** — `package.json`:

```json
    "lab": "vitest run --config vitest.lab.config.mts",
    "lab:watch": "vitest --config vitest.lab.config.mts",
```

- [ ] **Step 4: Cover the new config in type-check** — add `"vitest.lab.config.*"` to `tsconfig.node.json` `include` (alongside `"vitest.config.*"` at :6).

- [ ] **Step 5: Delete `game/tests/lab/scratch.test.ts`** (committed example sweep; per spec F2 the example belongs in gitignored `tests/lab/local/`). Update `tests/lab/README.md`: the `npx vitest run tests/lab/scratch.test.ts` line becomes `npx vitest run --config vitest.lab.config.mts tests/lab/<file>` and the "same API" note stays.

- [ ] **Step 6: Verify** — `npx vitest run` completes with zero lab files collected (`grep` the summary: no `tests/lab/` paths); `npm run lab` still runs the committed sweeps (`balanceSweep`, `progressionSweep`). Then full: `npm run type-check && npm run build && npx vitest run`.

- [ ] **Step 7: Commit** `git add -A && git commit -m "chore(test): move lab sweeps behind their own vitest config"`

---

### Task 4: Per-checkout dev/e2e port + strict identity (audit T7-62/T7-63, spec F3)

**Files:**
- Create: `game/scripts/dev-port.ts`
- Modify: `game/vite.config.ts:9-28` (comment + `server`/`preview` blocks)
- Modify: `game/playwright.config.ts:3-7,54-66`
- Modify: `game/tsconfig.node.json:4-12` (add `scripts/**/*.ts`)

**Verified facts:**
- `vite.config.ts:22-23` — `port: Number(process.env.DEV_PORT ?? 5175), strictPort: false` (same for `preview` :26-27). The standing-slot comment (:17-20) documents master 5173/UITemp 5174/worktree 5175, but the code gives EVERY checkout 5175 — the convention was never implemented.
- `playwright.config.ts:6` reads the same `DEV_PORT ?? '5175'`; `:57` `reuseExistingServer: true` lets Playwright silently test a stale/foreign server.
- `playwright.config.ts:64` `VITE_PRESENTATION_DEADLINE_SCALE: '3'` — consumed only by `App.vue:175-179` (scale > 1 installs a multiplied `setTimeout` scheduler for presentation transition deadlines). It cannot reach gameplay pacing; it exists because measured parallel-run contention trips wall-clock deadlines (comment :60-63). Per-spec env scoping is not possible (`webServer.env` is process-global), so the decision is: **keep it, retighten the comment** to state scope (e2e-only, transition deadlines only) and the exit condition (revisit when the suite runs serially or on CI with stable resources). Dropping it would reintroduce the measured flake set documented at playwright.config.ts:11-42.
- Both config files are transpiled by their loaders, so a shared `.ts` helper imports cleanly; `tsconfig.node.json` needs `scripts/**/*.ts` for it to be type-checked.

- [ ] **Step 1: Create `game/scripts/dev-port.ts`:**

```ts
// Per-checkout dev port (audit T7-62): a stable hash of the checkout root
// directory so parallel worktrees get distinct ports without bookkeeping,
// and strictPort can stay on. DEV_PORT env still overrides for pinning.
export function devPortForRoot(rootDir: string): number {
  let hash = 0
  for (const char of rootDir) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0
  }
  return 5300 + (Math.abs(hash) % 700)
}
```

- [ ] **Step 2: `vite.config.ts`** — replace the `server`/`preview` blocks and their comment (:17-28):

```ts
import { devPortForRoot } from './scripts/dev-port'

// Port per checkout (audit T7-62, 2026-09-16): derived from the checkout
// root path so each worktree owns a distinct port; strictPort makes a
// collision fail loudly instead of silently serving the wrong tree.
// playwright.config.ts derives the same value, so its webServer always
// targets this server. Override: DEV_PORT=5999 npm run dev.
const devPort = Number(process.env.DEV_PORT ?? devPortForRoot(fileURLToPath(new URL('.', import.meta.url))))

export default defineConfig({
  server: {
    port: devPort,
    strictPort: true,
  },
  preview: {
    port: devPort,
    strictPort: true,
  },
```

(Keep the existing `isElectron` comment block above it; `fileURLToPath`/`URL` are already imported at :2.)

- [ ] **Step 3: `playwright.config.ts`** — replace :3-6 and :54-66:

```ts
// Port per checkout (2026-09-16) — same derivation as vite.config.ts, so
// the spawned dev server and baseURL always agree. DEV_PORT env overrides.
import { devPortForRoot } from './scripts/dev-port'
import { fileURLToPath } from 'node:url'

const DEV_PORT = String(process.env.DEV_PORT ?? devPortForRoot(fileURLToPath(new URL('.', import.meta.url))))
```

```ts
  webServer: {
    command: 'node node_modules/vite/bin/vite.js',
    url: `http://localhost:${DEV_PORT}`,
    // Never reuse a foreign server on CI — a stale worktree server is the
    // T7-62 false-green. Local reuse stays for the manual-server workflow.
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      // E2E-only contention relief (R12 retained debt): scales the
      // presentation-coordinator transition deadlines, nothing else
      // (App.vue:175-179 reads it; production timing untouched). Kept
      // suite-wide because webServer.env cannot scope per-spec; revisit
      // when the suite runs serially or on provisioned CI hardware.
      VITE_PRESENTATION_DEADLINE_SCALE: '3',
    },
  },
```

- [ ] **Step 4:** add `"scripts/**/*.ts"` to `tsconfig.node.json` `include`.

- [ ] **Step 5: Verify** — `npm run type-check`; `npx playwright test --list` (config loads, port resolves); `DEV_PORT=5999 npx vite --port-from-config` sanity: run `npx vite` briefly and confirm the printed port is the derived one (not 5175). Run `npx playwright test tests/e2e/boot-fresh.spec.ts` inside the worktree — no P14 deferral; a genuine launch failure is an explicit blocker, record the evidence.

- [ ] **Step 6: Commit** `git add -A && git commit -m "chore(e2e): per-checkout strict ports, no stale-server reuse on CI"`

---

### Task 5: Canonical `verify` command (audit T7-64, spec F4)

**Files:**
- Modify: `game/package.json` (scripts)
- Modify: `AGENTS.md` (repo root — `E:\tutienidle\AGENTS.md`, Part 1 P3 section)

- [ ] **Step 1:** add to `scripts` (after `"type-check"`):

```json
    "verify": "npm run type-check && npm run build && npx vitest run",
```

- [ ] **Step 2: Document in AGENTS.md** — in the P3 rule, after the `full` bullet, add one line: `The canonical evidence command is \`npm run verify\` (= type-check + build + full vitest). Agents reporting verification run it from \`game/\`.`

- [ ] **Step 3: Verify** — `npm run verify` green end-to-end.

- [ ] **Step 4: Commit** `git add -A && git commit -m "chore(scripts): canonical npm run verify"`

---

### Task 6: Environment + packaging hygiene (audit T7-65/T7-66, spec F5)

**Files:**
- Modify: `game/.gitignore` (after `*.local` at :18)
- Modify: `game/index.html:2,7`
- Modify: `game/package.json:24-25` (electron scripts), `:32` (vue), `:63-77` (overrides), `devDependencies` (add `cross-env`)
- Modify: `game/scripts/check-bundle-split.mjs:5-7` (usage comment)
- Modify: `game/electron-builder.yml:25-28` (drop fake icon key)
- Delete: `game/scripts/patch-t14.cjs`

**Verified facts:**
- `.env` safety: repo-root `.gitignore` already covers `.env`/`.env.*`/`!.env.example`, and `game/.env.example` exists — the game-level file needs the same rules for a bare `game/` checkout. (P11: never read the real `.env`.)
- `index.html:2` `lang=""` — the i18n default locale is `'vi'` (`src/i18n/index.ts:9`); the auth screen renders `<h1>Tiên Hiệp Idle</h1>` (`AuthEntryScreen.vue:66`). `public/favicon.ico` exists, so the existing `<link rel="icon">` is already valid.
- `scripts/patch-t14.cjs` is a one-off codemod (rewrites GameManager.ts by string anchors), zero references anywhere — delete.
- `check-bundle-split.mjs` real flag is `--dist <dir>` (:21-23); the usage comment at :7 says `` `check-bundle-split dist` `` — wrong.
- `electron-builder.yml:27-28` marks `build/icon.ico` a placeholder and the file does not exist — remove the key so `dist:win` is honest (electron-builder falls back to the default icon).
- `set ELECTRON=1` (package.json:24-25) is cmd.exe syntax — fails on PowerShell/bash. Spec authorizes `cross-env` (new devDependency).
- Installed Vue is `3.6.0-rc.3`; `vue: "rc"` + 14 `@vue/*` overrides to `rc` mean reproducibility rests on the lockfile alone (T7-65). The `rc` dist-tag is deliberate (vapor packages are overridden), so pin the exact resolved version instead of downgrading.

- [ ] **Step 1: `game/.gitignore`** — after the `*.local` line (:18), add:

```gitignore

# Local env files (Supabase anon key etc.) — the repo-root .gitignore
# already covers these; repeated so a bare game/ checkout stays safe.
# .env.example stays tracked as the template.
.env
.env.*
!.env.example
```

- [ ] **Step 2: `index.html`** — `<html lang="vi">` and `<title>Tiên Hiệp Idle</title>` (UTF-8 diacritics are fine here; matches the auth-screen brand and `i18n` default locale).

- [ ] **Step 3: Delete `scripts/patch-t14.cjs`.**

- [ ] **Step 4: `check-bundle-split.mjs`** — fix the usage comment (:5-7): change `` `check-bundle-split dist` `` to `` `node scripts/check-bundle-split.mjs --dist dist` `` so the documented CI invocation matches the `--dist` flag the parser actually reads.

- [ ] **Step 5: `electron-builder.yml`** — delete the placeholder comment + `icon: build/icon.ico` (:27-28), leaving `win: { target: nsis }`. Add a comment noting the default Electron icon is used until a real `.ico` ships.

- [ ] **Step 6: cross-env** — `npm i -D cross-env`, then:

```json
    "electron:dev": "cross-env ELECTRON=1 vite",
    "dist:win": "cross-env ELECTRON=1 npm run build && electron-builder --win"
```

- [ ] **Step 7: Pin Vue** — `"vue": "3.6.0-rc.3"` and every `overrides` entry `"rc"` → `"3.6.0-rc.3"`; run `npm install` to regenerate the lockfile. Document the deliberate choice in the AGENTS.md note added by Task 5's step (append: `Vue tracks the 3.6 prerelease line deliberately (vapor packages); it is pinned to an exact version, not the rc dist-tag — bump it intentionally, never via a tag.`).

- [ ] **Step 8: Verify** — `npm run verify` (full). Additionally: `git check-ignore -v .env` inside `game/` shows the new rule winning; `npm run electron:dev` boots vite with `ELECTRON` set (the `vite-plugin-electron` branch activates — visible from `[electron]` log lines or `dist-electron/` output). Defer the electron run if the worktree can't spawn it; note it.

- [ ] **Step 9: Commit** `git add -A && git commit -m "chore: env, packaging and dependency hygiene"`

---

### Task 7: Single tick-interval authority (audit T5-46, spec F6)

**Files:**
- Modify: `game/src/core/idle/SpeedSettings.ts` (whole file — constant value + comment)
- Modify: `game/src/composables/useAppLifecycle.ts:120` (delete local `TICK_INTERVAL_MS`, import instead)
- Test: `game/src/composables/useAppLifecycle.test.ts`

**Verified facts:**
- `SpeedSettings.ts:14` exports `TICK_INTERVAL_MS = 100` with a comment describing the 1000→200→100ms plan; it has **zero importers** (grep confirms only the defining file). The live cadence is the local `TICK_INTERVAL_MS = 1_000` at `useAppLifecycle.ts:120`, consumed at `:172` by `scheduleInterval`.
- Code truth: the running game ticks at 1000ms and computes real `deltaSeconds` (`App.vue:435`), so the interval controls smoothness only. Wiring the 100ms constant in would 10× the tick rate — a real behavioral change, NOT a pure refactor. The correct fix is a single authority holding the TRUE value.

- [ ] **Step 1: Failing test** — in `useAppLifecycle.test.ts`, extend the `scheduleInterval` stub to record `timeoutMs` and assert the tick interval uses the shared constant:

```ts
// in makeStubs():
const intervalCalls: Array<{ timeoutMs: number }> = []
scheduleInterval: (callback: () => void, timeoutMs: number): number => {
  intervals.push(callback)
  intervalCalls.push({ timeoutMs })
  return intervals.length
},
// (return intervalCalls too)

it('tick loop cadence comes from SpeedSettings.TICK_INTERVAL_MS (audit T5-46)', () => {
  const stubs = makeStubs()
  const lifecycle = makeLifecycle(stubs)

  lifecycle.startTickLoop(() => undefined)

  expect(stubs.intervalCalls[0]?.timeoutMs).toBe(TICK_INTERVAL_MS) // imported from '../core/idle/SpeedSettings'

  lifecycle.stopAll()
})
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run src/composables/useAppLifecycle.test.ts`): SpeedSettings exports `100`, the loop schedules `1000`.

- [ ] **Step 3: Implement** — `SpeedSettings.ts` becomes the single authority with the true value and an honest comment (P15 English):

```ts
/**
 * Real game-loop tick cadence (ms between outer ticks) — the single
 * authority consumed by useAppLifecycle's tick loop. Value only controls
 * SMOOTHNESS, never pace: the tick consumes the real measured deltaSeconds
 * (App.vue), so a delayed timer still simulates the full elapsed time and
 * combat's fixed-step coalescing (CombatScene applyPendingPositions)
 * absorbs bursts. The older 1000 -> 200 -> 100ms shortening plan never
 * landed; 1000ms is the measured live cadence.
 */
export const TICK_INTERVAL_MS = 1_000
```

`useAppLifecycle.ts`: `import { TICK_INTERVAL_MS } from '../core/idle/SpeedSettings'` and delete the local `const TICK_INTERVAL_MS = 1_000` (:120). `AUTOSAVE_INTERVAL_MS` stays local — it is unrelated.

- [ ] **Step 4: Run — expect PASS** (same command) + `npm run type-check`.

- [ ] **Step 5: Commit** `git add -A && git commit -m "fix(clock): single tick-interval authority"`

---

### Task 8: EventBus dispatch isolation (audit T5-49, spec F7)

**Files:**
- Modify: `game/src/core/events/EventBus.ts:33-50` (`emit`)
- Test: `game/src/core/events/EventBus.test.ts` (extend the existing file)

**Interfaces:**
- Contract change: `emit` iterates a **snapshot** of the handler Set — handlers added mid-dispatch fire on the NEXT emit, not this one; handlers removed mid-dispatch still fire if already snapshotted (standard EventEmitter snapshot semantics); a throwing handler is logged (`console.error` with the event type) and the remaining handlers still run. The throw does not propagate to the emitter.

- [ ] **Step 1: Failing tests** — append a describe block:

```ts
describe('EventBus — dispatch isolation (audit T5-49)', () => {
  it('a throwing handler does not abort remaining handlers and does not propagate', () => {
    const bus = new EventBus()
    const after = vi.fn()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    bus.on('damage', () => { throw new Error('listener bug') })
    bus.on('damage', after)

    expect(() => bus.emit('damage', { amount: 1 })).not.toThrow()
    expect(after).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalled()

    errorSpy.mockRestore()
  })

  it('a handler added during dispatch does not fire in the current emit', () => {
    const bus = new EventBus()
    const late = vi.fn()

    bus.on('loot', () => bus.on('loot', late))
    bus.emit('loot', { itemId: 'x' })

    expect(late).not.toHaveBeenCalled()

    bus.emit('loot', { itemId: 'y' })
    expect(late).toHaveBeenCalledTimes(1) // fires from the NEXT emit
  })

  it('a handler removed during dispatch still ran if already snapshotted', () => {
    const bus = new EventBus()
    const removed = vi.fn()
    const first = vi.fn(() => bus.off('tick', removed))

    bus.on('tick', first)
    bus.on('tick', removed)
    bus.emit('tick', 1)

    expect(removed).toHaveBeenCalledTimes(1)
    bus.emit('tick', 2)
    expect(removed).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run src/core/events/EventBus.test.ts`): the first test fails on `not.toThrow()`/`after` (live iteration propagates the throw), the second fails because `late` fires during the same emit.

- [ ] **Step 3: Implement** — replace the `emit` loop (:44-49):

```ts
    // Snapshot before dispatch (audit T5-49): handlers added mid-emit fire
    // next time, never mid-iteration; each handler is isolated so one
    // throw cannot abort the chain or reach core tick emitters.
    for (const handler of [...handlers]) {
      try {
        (handler as EventHandler<T>)(event)
      } catch (error: unknown) {
        console.error(`[EventBus] listener for "${eventType}" threw`, error)
      }
    }
```

- [ ] **Step 4: Run — expect PASS** (same command).

- [ ] **Step 5: Commit** `git add -A && git commit -m "fix(events): isolate handler failures, snapshot dispatch"`

---

### Task 9: Per-account save keys (spec F8 part 1, locked decision)

**Files:**
- Create: `game/src/services/save/saveKeys.ts` (the single resolver)
- Modify: `game/src/services/save/SaveSystem.ts` (:27, :35, :41-42, :49 constants → resolvers; every `localStorage` call site at :392, :419, :470, :503, :520-523, :528, :532, :536-543, :548-556, :619-634)
- Modify: `game/src/services/cloudSave/LocalCloudSaveService.ts:1,5,28,41` (`SAVE_REVISION_KEY` → `resolveRevisionKey()`)
- Modify: `game/src/services/supabase/SupabaseSession.ts` (stored shape gains `userId`/`mode`/`expiresAtMs` — `expiresAtMs` consumed by Task 10)
- Modify: `game/src/services/auth/AuthService.ts:8-12` (`AuthSession` gains `userId?: string`)
- Modify: `game/src/services/auth/SupabaseAuthService.ts:6,39-40` (store + return `userId`)
- Modify: `game/src/components/onboarding/AuthEntryScreen.vue:10,42` (emit the session, not just the mode)
- Modify: `game/src/App.vue:643-645` (`onAuthenticated` binds the account slot)
- Modify tests: `SaveSystem.test.ts` (:17-19 consts + every literal `localStorage.setItem(SAVE_KEY…)`), `SaveMigration.test.ts` (:23,48,67,70,71), `saveVersion.test.ts` (:5,82,105), `SaveSystem.quota.test.ts` (:3,41), `LocalCloudSaveService.quota.test.ts` (:7-8 + all uses), `SaveSystem.bootRestore.test.ts`/`SaveRoundTrip.test.ts`/`SaveSystem.saveLoadRoundTrip.test.ts`/`SaveSystem.restoreIdentity.test.ts`/`SaveSystem.snapshotIsolation.test.ts` (check each for literal keys)
- Modify e2e: `tests/e2e/helpers.ts` (add exported `GUEST_SAVE_KEY`), `cultivation-path-ritual.spec.ts` (:29,73,122,361,427), `save-reload.spec.ts` (:44,55,96), `standing-slot-panel.spec.ts` (:40,71,129), `tribulation-flow.spec.ts` (:41,77,146), `error-recovery.spec.ts` (:19)

**Complete localStorage save-path enumeration (verified by grep — these are ALL the save-slot touch points; nothing else reads/writes the save keys):**
- `SaveSystem.ts` — `SAVE_KEY` (export :27; used :392, :419, :520, :532, :542, :551, :634), `BACKUP_KEY` (:35; used :523, :528, :536), `IMPORT_DISCARDED_EQUIPMENT_HANDOFF_KEY` (:41-42; used :470, :503, :543, :552, :621-626), `SAVE_REVISION_KEY` (:49; used :556).
- `LocalCloudSaveService.ts` — `SAVE_REVISION_KEY` (:5 read, :28 write, :41 rollback).
- `player.ts:305-315` `load()` calls `loadGame()` — resolves automatically, no change needed.
- NOT per-account (deliberately device-level — leave alone): `uiFlagsPersistence.ts` `UI_AUTOMATION_STORAGE_KEY` (:14, comment :6-8 already declares it a device preference), `stores/audio.ts`, `composables/uiScale.ts`, `core/dev/DevMode.ts`, `CombatScene`/`ThanhVanBackdropArt`/`BattlefieldRenderMode` debug flags.

**Interfaces:**
- `resolveSaveAccountId(): string` — explicit binding (set at authenticate) → stored Supabase session fallback → `'guest'`. Guards `typeof sessionStorage === 'undefined'` for the node vitest env.
- `resolveSaveKey()`/`resolveBackupKey()`/`resolveRevisionKey()`/`resolveImportHandoffKey(): string` — `` `${base}:${resolveSaveAccountId()}` ``.
- `setSaveAccountId(accountId: string | null): void` — the explicit binding; `null` re-arms the session fallback.
- `accountIdForSession(session: { mode: string; userId?: string; loginId?: string }): string` — `'guest'` for guest sessions (locked decision: guest = unauthenticated slot even when Supabase issued a real anonymous `user.id`), else `userId ?? loginId ?? 'guest'`.

- [ ] **Step 1: Failing tests** — new `game/src/services/save/saveKeys.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import {
  GUEST_ACCOUNT_ID,
  accountIdForSession,
  resolveSaveAccountId,
  resolveSaveKey,
  resolveRevisionKey,
  setSaveAccountId,
} from './saveKeys'

describe('saveKeys — per-account resolution (spec F8)', () => {
  afterEach(() => setSaveAccountId(null))

  it('no session, no binding → guest slot', () => {
    expect(resolveSaveAccountId()).toBe(GUEST_ACCOUNT_ID)
    expect(resolveSaveKey()).toBe('tien-hiep-idle-save:guest')
    expect(resolveRevisionKey()).toBe('tien-hiep-idle-save-revision:guest')
  })

  it('explicit binding wins and namespaces every key', () => {
    setSaveAccountId('account-uuid-1')
    expect(resolveSaveKey()).toBe('tien-hiep-idle-save:account-uuid-1')
    setSaveAccountId('account-uuid-2')
    expect(resolveSaveKey()).toBe('tien-hiep-idle-save:account-uuid-2')
  })

  it('guest-mode sessions always resolve to the guest slot', () => {
    expect(accountIdForSession({ mode: 'guest', userId: 'anon-uuid' })).toBe('guest')
  })

  it('login/register sessions resolve to userId, falling back to loginId (mock auth)', () => {
    expect(accountIdForSession({ mode: 'login', userId: 'u-1', loginId: 'dao_huu' })).toBe('u-1')
    expect(accountIdForSession({ mode: 'register', loginId: 'dao_huu' })).toBe('dao_huu')
  })
})
```

Plus a SaveSystem-level isolation test in `SaveSystem.test.ts` (after the resolver exists — write it in this step, watch it fail on the old single-key code):

```ts
it('two accounts hold independent save slots; guest sees neither (spec F8)', () => {
  setSaveAccountId('acct-a')
  writeGameSave(validGameSave('A'))
  setSaveAccountId('acct-b')
  expect(loadGame().status).toBe('empty')
  writeGameSave(validGameSave('B'))
  setSaveAccountId(null)
  expect(loadGame().status).toBe('empty') // guest slot untouched
  setSaveAccountId('acct-a')
  const loaded = loadGame()
  expect(loaded.status).toBe('ok')
  if (loaded.status === 'ok') expect(loaded.save.player.name).toBe('A')
})
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run src/services/save`) — `saveKeys` module does not exist; isolation test fails because `setSaveAccountId` is a no-op import error.

- [ ] **Step 3: Implement `saveKeys.ts`:**

```ts
import { readSupabaseSession } from '../supabase/SupabaseSession'

// Spec F8 (locked 2026-09-16): every save-storage key is namespaced to the
// authenticated account — 'tien-hiep-idle-save:<accountId>' — with a shared
// 'guest' slot for unauthenticated play. One resolver feeds every storage
// path; nothing templates the key inline.
export const GUEST_ACCOUNT_ID = 'guest'

const SAVE_KEY_BASE = 'tien-hiep-idle-save'
const BACKUP_KEY_BASE = 'tien-hiep-idle-save-backup'
const REVISION_KEY_BASE = 'tien-hiep-idle-save-revision'
const IMPORT_HANDOFF_KEY_BASE = 'tien-hiep-idle-import-discarded-equipment-count'

// Bound at authenticate time (App.vue onAuthenticated). null = fall back to
// the stored Supabase session (survives reload inside the same tab via
// sessionStorage), then to guest. Any future logout path MUST call
// setSaveAccountId(null) — the stored session is cleared separately.
let explicitAccountId: string | null = null

export function setSaveAccountId(accountId: string | null): void {
  explicitAccountId = accountId
}

export function resolveSaveAccountId(): string {
  if (explicitAccountId !== null) return explicitAccountId
  // Node/vitest has no sessionStorage — resolver stays pure there.
  if (typeof sessionStorage === 'undefined') return GUEST_ACCOUNT_ID
  const session = readSupabaseSession()
  return session?.mode !== 'guest' && session?.userId ? session.userId : GUEST_ACCOUNT_ID
}

export function accountIdForSession(session: { mode: string; userId?: string; loginId?: string }): string {
  if (session.mode !== 'login' && session.mode !== 'register') return GUEST_ACCOUNT_ID
  return session.userId ?? session.loginId ?? GUEST_ACCOUNT_ID
}

export function resolveSaveKey(): string { return `${SAVE_KEY_BASE}:${resolveSaveAccountId()}` }
export function resolveBackupKey(): string { return `${BACKUP_KEY_BASE}:${resolveSaveAccountId()}` }
export function resolveRevisionKey(): string { return `${REVISION_KEY_BASE}:${resolveSaveAccountId()}` }
export function resolveImportHandoffKey(): string { return `${IMPORT_HANDOFF_KEY_BASE}:${resolveSaveAccountId()}` }
```

- [ ] **Step 4: Extend the session/auth surfaces:**

  `SupabaseSession.ts` — widen the stored shape (new fields optional so a pre-change stored session still validates and simply resolves as guest):

```ts
export type SupabaseSessionMode = 'guest' | 'login' | 'register'

interface StoredSupabaseSession {
  accessToken: string
  refreshToken: string
  sessionId: string
  /** auth.users uuid — remote character/save rows key on it. Optional: sessions stored before Mission F lack it. */
  userId?: string
  /** Auth mode at login time; guest sessions keep their uuid but still map to the shared guest save slot. */
  mode?: SupabaseSessionMode
  /** Access-token deadline (ms) for proactive refresh — Task 10. */
  expiresAtMs?: number
}
```

(`readSupabaseSession`'s validation keeps requiring the original triple and passes the optionals through.)

  `AuthService.ts` — `AuthSession` gains `/** Supabase auth.users id — absent for mock-auth sessions. */ userId?: string`.

  `SupabaseAuthService.ts` — `GoTrueResponse` gains `expires_in?: number`; the `storeSupabaseSession` call (:39) becomes `storeSupabaseSession({ accessToken: auth.access_token, refreshToken: auth.refresh_token, sessionId, userId: auth.user.id, mode, expiresAtMs: auth.expires_in ? Date.now() + auth.expires_in * 1000 : undefined })`; the returned session gains `userId: auth.user.id`.

  `AuthEntryScreen.vue` — `defineEmits<{ authenticated: [session: AuthSession] }>()` (import the type), and :42 becomes `emit('authenticated', result.session)` — move it inside the `if (!result.ok) return` flow exactly where it is; `result.session` is only defined on `ok`.

  `App.vue` — `import { accountIdForSession, setSaveAccountId } from './services/save/saveKeys'` + `import type { AuthSession } from './services/auth/AuthService'`; replace :643-645:

```ts
function onAuthenticated(session: AuthSession) {
  // Spec F8 — bind the save slot BEFORE boot loads: every storage path
  // resolves through resolveSaveKey() from this point on.
  setSaveAccountId(accountIdForSession(session))
  void bootGame(false)
}
```

  Template :746 unchanged (`@authenticated="onAuthenticated"` — payload type flows through).

- [ ] **Step 5: Rewire the storage paths.** In `SaveSystem.ts`: delete the `SAVE_KEY`/`BACKUP_KEY`/`IMPORT_DISCARDED_EQUIPMENT_HANDOFF_KEY`/`SAVE_REVISION_KEY` constant declarations (:27-49 — keep the version-history comment block, it documents the *value* history not the key shape; add a one-line note that keys are now per-account via `saveKeys.ts`), import the four resolvers, and replace every use:

  - `writeGameSave` (:392): `localStorage.setItem(resolveSaveKey(), JSON.stringify(save))`
  - `loadGame` (:419): `localStorage.getItem(resolveSaveKey())`; handoff get/remove (:470,:503) → `resolveImportHandoffKey()`
  - `backupCurrentSave` (:519-525): `getItem(resolveSaveKey())` → `setItem(resolveBackupKey(), raw)` (keep the existing try/… behavior from Mission A if landed — as of master it is unguarded; do not re-add Mission A work here, just swap the keys)
  - `hasBackup` (:528) → `resolveBackupKey()`; `getRawSave` (:532) → `resolveSaveKey()`
  - `restoreBackup` (:535-546): `getItem(resolveBackupKey())` → `setItem(resolveSaveKey(), raw)` + `removeItem(resolveImportHandoffKey())`
  - `deleteSave` (:548-557): `removeItem(resolveSaveKey())`, `removeItem(resolveImportHandoffKey())`, `removeItem(resolveRevisionKey())`
  - `importSaveRaw` (:619-634): handoff write/remove → `resolveImportHandoffKey()`, final write → `resolveSaveKey()`

  `LocalCloudSaveService.ts`: import `resolveRevisionKey` from `'../save/saveKeys'`; :5, :28, :41 all become `resolveRevisionKey()` calls (the `SAVE_REVISION_KEY` import is removed — revision-first ordering comment stays, still true).

- [ ] **Step 6: Update the test/e2e call sites.** In unit tests replace literal/constant keys with resolver calls (`localStorage.setItem(resolveSaveKey(), raw)` etc.) and add `setSaveAccountId(null)` to `beforeEach` in any file that binds an account. In e2e, add `export const GUEST_SAVE_KEY = 'tien-hiep-idle-save:guest'` to `tests/e2e/helpers.ts` and repoint every spec constant + every literal inside `page.evaluate`/`addInitScript` (the evaluate bodies carry string literals — update them to `'tien-hiep-idle-save:guest'` inline; keep the existing comment noting literals can't serialize from module scope).

- [ ] **Step 7: Run — expect PASS**: `npx vitest run src/services/save src/services/cloudSave` + `npm run type-check`. P13: run `npx playwright test tests/e2e/save-reload.spec.ts tests/e2e/error-recovery.spec.ts tests/e2e/boot-fresh.spec.ts` — the seeded-key paths are exactly what this task changed (run inside the worktree per current P14 — no deferral; an environment failure is an explicit blocker, record it).

- [ ] **Step 8: Commit** `git add -A && git commit -m "feat(save): per-account local save slots"`

---

### Task 10: Supabase fetch timeout + token refresh (audit T3-24, spec F8 part 2)

**Files:**
- Modify: `game/src/services/supabase/SupabaseHttp.ts` (timeout)
- Modify: `game/src/services/supabase/SupabaseSession.ts` (add `resolveSupabaseSession` — refresh-aware accessor)
- Modify: `game/src/services/character/SupabaseCharacterCreationService.ts:22-26,29-43,55` (`session()` → refresh-aware)
- Test: `game/src/services/supabase/SupabaseHttp.test.ts` (new), `game/src/services/supabase/SupabaseSession.test.ts` (new)

**Interfaces:**
- `requestSupabase` gains a 10s `AbortSignal.timeout` merged with any caller signal via `AbortSignal.any`. Timeout/abort rejections surface through the existing caller catch chains as `server_unavailable` — no new error type needed.
- `resolveSupabaseSession(config): Promise<StoredSupabaseSession | null>` — returns the stored session when `expiresAtMs` is >30s out or absent-but-freshly-issued; refreshes via `POST /auth/v1/token?grant_type=refresh_token` when expired/missing-expiry; clears storage and returns `null` on refresh failure (spec: "on failure → signed-out state, not silent stall").

- [ ] **Step 1: Failing tests** — `SupabaseHttp.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { requestSupabase } from './SupabaseHttp'

const config = { url: 'https://example.supabase.co', anonKey: 'anon' }

describe('requestSupabase — timeout (audit T3-24)', () => {
  it('passes an AbortSignal that aborts on the 10s timeout', async () => {
    let captured: RequestInit | undefined
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      captured = init
      return new Response('{}', { status: 200 })
    }))

    await requestSupabase(config, '/rest/v1/x')
    expect(captured?.signal).toBeInstanceOf(AbortSignal)
    vi.unstubAllGlobals()
  })

  it('a fetch that never settles rejects within the timeout window', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('The operation timed out', 'TimeoutError')))
      }),
    ))

    const pending = requestSupabase(config, '/rest/v1/x')
    const settled = pending.then(() => 'resolved', (e: unknown) => (e as DOMException).name)
    await vi.advanceTimersByTimeAsync(11_000)
    expect(await settled).toBe('TimeoutError')
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })
})
```

  `SupabaseSession.test.ts` — stub `sessionStorage` + `fetch`; seed `storeSupabaseSession({accessToken:'old', refreshToken:'rt', sessionId:'s1', userId:'u1', mode:'login', expiresAtMs: Date.now() - 1000})`; mock fetch to return `{access_token:'new', refresh_token:'rt2', expires_in:3600, user:{id:'u1'}}`; assert `resolveSupabaseSession` returns accessToken `'new'`, persists it, and that a 400 refresh → `null` + `readSupabaseSession()` null.

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run src/services/supabase`): no signal today; `resolveSupabaseSession` doesn't exist.

- [ ] **Step 3: Implement** — `SupabaseHttp.ts`:

```ts
// Audit T3-24 — no request may hang forever: every Supabase call carries
// a 10s deadline, merged with any caller-provided signal.
export const SUPABASE_REQUEST_TIMEOUT_MS = 10_000

// inside requestSupabase, before fetch:
  const timeoutSignal = AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS)
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal

  const response = await fetch(`${config.url}${path}`, {
    ...init,
    signal,
    headers: { /* unchanged */ },
  })
```

  `SupabaseSession.ts` — append the refresh-aware accessor:

```ts
import type { SupabaseConfig } from './SupabaseConfig'
import { requestSupabase } from './SupabaseHttp'

const REFRESH_SKEW_MS = 30_000

interface GoTrueRefreshResponse {
  access_token: string
  refresh_token: string
  expires_in?: number
}

/**
 * Stored session with a live access token. Refreshes via GoTrue when the
 * token is expired (or was stored before expiry tracking existed); on
 * refresh failure the session is cleared and the caller treats the user
 * as signed out — never a silent stall (spec F8).
 */
export async function resolveSupabaseSession(config: SupabaseConfig): Promise<StoredSupabaseSession | null> {
  const session = readSupabaseSession()
  if (!session) return null
  if (session.expiresAtMs !== undefined && session.expiresAtMs - REFRESH_SKEW_MS > Date.now()) {
    return session
  }

  try {
    const auth = await requestSupabase<GoTrueRefreshResponse>(config, '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    })
    const next: StoredSupabaseSession = {
      ...session,
      accessToken: auth.access_token,
      refreshToken: auth.refresh_token,
      expiresAtMs: auth.expires_in ? Date.now() + auth.expires_in * 1000 : undefined,
    }
    storeSupabaseSession(next)
    return next
  } catch {
    clearSupabaseSession()
    return null
  }
}
```

  `SupabaseCharacterCreationService.ts` — `private session()` becomes `private async session()` returning `Promise<StoredSupabaseSession>` via `await resolveSupabaseSession(this.config)` (throw the same `'Authentication session is missing'` on `null`); the three call sites (:29,:39,:55) already `await` their methods — `const session = await this.session()`.

  `SupabaseAuthService.logout` (:49-56) stays best-effort on the raw stored token — refreshing just to revoke adds a round-trip for no contract gain.

- [ ] **Step 4: Run — expect PASS** (same command) + `npm run type-check`.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(supabase): request timeout and refresh-token flow"`

---

### Task 11: Remote save newest-wins at authenticated boot + in-place SQL fix (audit T3-24, spec F8 part 3)

**Files:**
- Modify: `game/supabase/migrations/202608240001_online_auth_character.sql` (:54 constraint + name, :150 RPC check — **in place**, locked dev-stage decision)
- Create: `game/src/services/cloudSave/SupabaseRemoteSave.ts`
- Modify: `game/src/services/cloudSave/CloudSaveServiceFactory.ts` (export the boot sync; update the AR-15 comment)
- Modify: `game/src/composables/useAppLifecycle.ts` (:29-73 deps — optional `remoteSync`; :228-234 call it before `coordinator.load()`)
- Modify: `game/src/App.vue:358-409` (lifecycle deps — pass `remoteSync`)
- Test: `game/src/services/cloudSave/SupabaseRemoteSave.test.ts` (new), `game/src/composables/useAppLifecycle.test.ts` (extend stubs)

**Interfaces:**
- `syncRemoteSaveOnLogin(config: SupabaseConfig): Promise<'pulled' | 'pushed' | 'skipped' | 'unavailable'>`:
  - `skipped` when no session, `mode === 'guest'`, no `userId`, or the account has no `characters` row (the FK target for `character_saves` — a remote save cannot exist without it).
  - Pull: `GET /rest/v1/characters?select=id&user_id=eq.{userId}&limit=1` → `GET /rest/v1/character_saves?select=payload,save_revision,updated_at&character_id=eq.{id}&limit=1`. Remote wins when `Date.parse(updated_at)` > local `save.player.lastSavedAt` AND the payload is usable (`version === CURRENT_SAVE_VERSION` + `validateGameSaveShape().ok`) — then write `JSON.stringify(shape.normalizedSave)` to `resolveSaveKey()` (same normalization `loadGame` applies) + `resolveRevisionKey()` = `save_revision`. An unusable/missing payload counts as "no remote".
  - Push (remote absent or older, local `loadGame()` ok): `POST /rest/v1/character_saves` with `Prefer: resolution=merge-duplicates`, body `{character_id, user_id, schema_version: CURRENT_SAVE_VERSION, save_revision: <local revision>, payload: <local save>}`.
  - Any thrown/HTTP error → `unavailable`; the boot caller logs and proceeds on the local slot.
- Lifecycle dep `remoteSync?: () => Promise<unknown>` — invoked inside `bootGame` after `boot.startSaveLoad()` and before `coordinator.load()`, only when `!createNewCharacter`, wrapped in try/catch (`console.warn` + continue). The existing generation fence at :242 already covers continuations after this await.
- Guest progress is NOT migrated into a fresh account slot on register — the account slot starts empty and the normal character-creation flow runs. Documented decision (flag to owner if product wants adopt-guest-on-register later).

- [ ] **Step 1: SQL in-place fix** — `202608240001_online_auth_character.sql`:
  - :54 `constraint characters_three_talents check (cardinality(selected_talent_ids) = 3)` → `constraint characters_one_talent check (cardinality(selected_talent_ids) = 1)`
  - :150 `cardinality(p_talent_ids) <> 3 or cardinality(array(select distinct unnest(p_talent_ids))) <> 3` → `<> 1` in both places, and keep the `<@ roll_row.talent_ids` membership check.
  - Add a comment noting the client contract: `CHARACTER_CREATION_TALENT_COUNT = 1` (`CharacterCreationService.ts:8`).
  - **Also required for the push path (verified gap):** the migration only creates `for select` RLS policies (:173-178) — `create_character` writes via `security definer` so it never needed them, but the Step-4 upsert `POST /rest/v1/character_saves` is a direct table write and would be denied. Add beside `saves_own_read`:

```sql
create policy saves_own_insert on public.character_saves for insert with check (user_id = auth.uid());
create policy saves_own_update on public.character_saves for update using (user_id = auth.uid()) with check (user_id = auth.uid());
```

- [ ] **Step 2: Failing tests** — `SupabaseRemoteSave.test.ts`: stub `fetch`, `localStorage`, `sessionStorage` (same `MemoryStorage` pattern as `SaveSystem.test.ts:24-51`); seed a stored session `{mode:'login', userId:'u1', …, expiresAtMs: future}`; bind `setSaveAccountId('u1')`. Cases: guest session → `skipped` + zero fetch calls; no `characters` row → `skipped`; remote `updated_at` newer than local `lastSavedAt` → local slot overwritten, revision set, returns `pulled`; remote older → POST merge-duplicates observed, returns `pushed`; remote payload `{}` (the `p_initial_save` shape `SupabaseCharacterCreationService` sends today) → treated as absent; fetch rejection → `unavailable`.
  `useAppLifecycle.test.ts`: add `remoteSync: vi.fn(async () => 'skipped')` to `makeStubs`/`makeLifecycle`; assert it is awaited before `coordinator.load` via `invocationCallOrder`, is skipped for `createNewCharacter: true`, and that a rejection still reaches `coordinator.load` (boot proceeds).

- [ ] **Step 3: Run — expect FAIL** (`npx vitest run src/services/cloudSave/SupabaseRemoteSave.test.ts src/composables/useAppLifecycle.test.ts`).

- [ ] **Step 4: Implement** `SupabaseRemoteSave.ts` per the interface contract above (imports: `requestSupabase` from `../supabase/SupabaseHttp`, `resolveSupabaseSession` from `../supabase/SupabaseSession`, `loadGame`/`CURRENT_SAVE_VERSION` from `../save/SaveSystem`, `validateGameSaveShape` from `../save/saveShapeValidation`, `resolveSaveKey`/`resolveRevisionKey` from `../save/saveKeys`, and a local `readRevision` mirroring `LocalCloudSaveService.ts:4-7` — or export that helper from `LocalCloudSaveService` and reuse it, single implementation preferred).

  `CloudSaveServiceFactory.ts`:

```ts
import { getSupabaseConfig } from '../supabase/SupabaseConfig'
import { syncRemoteSaveOnLogin } from './SupabaseRemoteSave'

const supabaseConfig = getSupabaseConfig()

// Spec F8 — boot-time newest-wins sync for authenticated accounts. This is
// NOT the AR-15 "remote adapter" (that stays a separate product decision):
// it is an explicit, optional pre-load reconciliation step wired by App.vue;
// the write path remains the local-only adapter above.
export const remoteSaveSync: (() => Promise<unknown>) | undefined = supabaseConfig
  ? () => syncRemoteSaveOnLogin(supabaseConfig)
  : undefined
```

  `useAppLifecycle.ts`: add `remoteSync?: () => Promise<unknown>` to `UseAppLifecycleDeps`, destructure it, and in `bootGame` after `boot.startSaveLoad()` (:228):

```ts
      if (!createNewCharacter && remoteSync) {
        try {
          await remoteSync()
        } catch (error: unknown) {
          // Remote reconciliation must never block boot — the local slot
          // is the authority for loadGame() either way.
          console.warn('[boot] remote save sync failed; continuing on local slot', error)
        }
      }
```

  `App.vue`: add `remoteSync: remoteSaveSync,` to the lifecycle deps (import from `CloudSaveServiceFactory` — :74 already imports `cloudSaveCoordinator` from there).

- [ ] **Step 5: Run — expect PASS** (same commands) + `npm run type-check` + `npx vitest run src/services src/composables`. P13: `npx playwright test tests/e2e/save-reload.spec.ts` still green (guest path must be untouched by remote sync — run inside the worktree per current P14, no deferral; a genuine environment failure is an explicit blocker, record it).

- [ ] **Step 6: Commit** `git add -A && git commit -m "feat(auth): account-scoped save sync at login, in-place SQL fix"`

---

## Mission F done-criteria

- `npm run type-check` covers `tests/architecture` + `tests/lab` (excluding gitignored `tests/lab/local/`); the presentation-gate key list includes `theBarReader`.
- `npx vitest run` never collects `tests/lab/**`; `npm run lab`/`lab:watch` still run the sweeps via `vitest.lab.config.mts`; `scratch.test.ts` is gone.
- Dev/preview/e2e ports derive per checkout; `strictPort: true`; `reuseExistingServer` is `!process.env.CI`; `VITE_PRESENTATION_DEADLINE_SCALE` is documented e2e-only with an exit condition.
- `npm run verify` exists, is green, and is documented in `AGENTS.md`.
- `game/.gitignore` covers `.env*`; `index.html` is `lang="vi"` + real title; `patch-t14.cjs` deleted; `check-bundle-split` usage comment matches the `--dist` flag; `electron:dev`/`dist:win` are shell-agnostic via `cross-env`; Vue pinned to `3.6.0-rc.3` (deliberate prerelease line, documented); no fake `build/icon.ico` reference.
- `TICK_INTERVAL_MS` has one authority (`SpeedSettings.ts`) consumed by the lifecycle at the true 1000ms cadence.
- EventBus dispatch is snapshot + per-handler isolated.
- Every save-storage path resolves through `resolveSaveKey()`; guest slot is shared; two accounts cannot see each other's saves; e2e seed keys updated.
- Supabase: `cardinality = 1` fixed in place; all fetches carry a 10s timeout; stored sessions refresh before expiry; authenticated boot reconciles remote newest-wins; `unavailable` never blocks boot.
- Full verification green; P4 `tutienidle-adversarial-qa` quick on the diff; P5 three-lens review round.

## Deferred / out of scope (recorded, not lost)

- T7-67 second half (test fixtures under `src/`) → Mission G, per the spec's known-intentional note.
- T7-68 remaining coverage gaps (GameClock, PersistentEffectOps, Phaser helpers, Electron paths) → not closed by this mission; the Supabase/auth tests in Tasks 10-11 cover the F-relevant slice.
- `supabase/config.toml` (local Supabase CLI scaffolding) — no local instance exists to configure; revisit when a developer actually runs `supabase start`.
- Remote **write** path per-save (a real `CloudSaveService` remote adapter) — explicitly out of scope per `CloudSaveService.ts:20-26` (AR-15); Task 11 syncs at login only.
- Adopt-guest-progress-into-account on register — decided against; flag to owner if product wants it.
