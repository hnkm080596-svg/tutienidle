# QA Review: error-route mount witness shadowed by SaveIncompatibleScreen

- Date: 2026-09-16
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/App.vue`, `game/src/App.routeMountWitness.test.ts`

## Scope and Risk Map

`changed-risk-map.mjs` routed `game/src/App.vue` → `ui-input-lifecycle` (`deepAuditCandidate: false`); the new test file was `unmappedPaths` — it is a static template guard with no production surface, bounded by inspection. One-hop consumers inspected: `useBootFlow` (stage derivation, unchanged), `GamePresentationCoordinator` (prepare/READY contract, unchanged), `RouteMount.vue` (renderless witness, unchanged), `SaveIncompatibleScreen.vue` (moved inside the witness; keeps its own `OVERLAY_LAYERS.saveGate` binding — `overlayLayers.test.ts` unaffected). Not escalated: the change is a template-ordering repair inside one file plus a same-route Back guard; no save data, clock, economy, or Phaser lifecycle semantics change.

Root cause (confirmed with runtime reproduction before the fix): `useAppLifecycle` reports an incompatible/corrupted save via `saveIssue.report(...)` then `boot.fail()` → `coordinator.request({target:'error'})` → `renderRoute='error'`, `phase='awaiting-ready'`. In `App.vue` the sibling `<SaveIncompatibleScreen v-else-if="saveIssue.status" />` sat BEFORE `<RouteMount v-else-if="entryStage === 'error'" route="error">` in the same v-if chain, so it matched first and the error-route mount witness never existed → `CompositeRenderer.prepare` waited on `markRouteMounted('error')` → 10s `prepareReady` deadline → `Renderer readiness timed out`, `phase='failed'`, `currentRoute` still `auth` (user sees Auth again), and the recovery screen was stranded behind the closed curtain (saveGate 4000 < curtain 5000; the catch block does not reopen the curtain for requests without `behindCurtain`). Retry re-entered the identical state — deterministic.

Git archaeology (subagent): the sibling ordering predates the coordinator era and was harmless then; the coordinator merge `275bdf13` (~Sep 9) gave the error route a Vue mount-witness contract while keeping the shadow — earliest verified co-presence `82d64060`. Not caused by `5249c558`.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-ERR-1 | `renderRoute='error'`, `saveIssue.status` set | `boot.fail()` → request('error') → prepare | Synchronization: every renderRoute mounts exactly one RouteMount witness for that route | Reorder (sibling branch shadows witness) | `data-phase` reaches `idle`; `.save-incompatible` visible; no `.transition-overlay__error` | Browser (Edge, live) + static guard | Critical — boot-blocking |
| INV-ERR-2 | `renderRoute='error'`, `saveIssue.status` null | generic `boot.fail()` | Same invariant for the generic content variant | Value mutation (null status) | `.boot-error` renders inside the witness | Template structure (both variants under one RouteMount) | High |
| INV-ERR-3 | `phase='failed'`, `isBooted=false` | overlay Back → `onTransitionBack` | Recoverability: Back must request a route whose witness exists | Stale state (pre-boot game-route request) | `request('auth')` is admissible from every pre-boot committed route (same-route + edges) | Coordinator admission tests + code | High — same hang class |
| INV-ERR-4 | failed 'error' transition → Retry | `coordinator.retry()` re-runs `target:'error'` | Idempotency: retry resolves the now-mounted witness | Repeat | Both error content variants are inside the witness, so the retry's `markRouteMounted('error')` fires | Construction + coordinator retry tests | High |
| INV-ERR-5 | `v-else` catch-all (stage 'game') | any future BootStage value | Route content selected only by route identity | Cross-system chain | Documented residual: `LoadingScreen v-if="!isBooted"` has no witness — reachable only if a game route is requested pre-boot; the `onTransitionBack` guard removes the one live requester | — | Medium — latent |
| INV-ERR-6 | `saveIssue.status` never cleared (`saveIssue.clear()` has no callers) | second unrelated boot error in same session | Monotonicity of error variant selection | Stale state | Unreachable today: SaveIncompatibleScreen exits all reload the page | — | Low — latent |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/App.routeMountWitness.test.ts` before fix | 3/3 FAIL (RED) — sibling SaveIncompatibleScreen detected, missing witness | Intended failure for the exact defect |
| Same after fix | 3/3 PASS (GREEN) | Invariant enforced structurally |
| `npm run type-check` | PASS | `vue-tsc --build`, no errors |
| `npx vitest run` (full suite) | 601/602 files, 4813 tests PASS, 4 expected-fail | Sole failure `eslintCoreSeverity.test.ts` timed out under suite load; passes in isolation (2.4s) — environment flake, not task-caused |
| `npm run build` | PASS | vite build 7.47s |
| Live browser — save `version:40` (current 64) → guest click | `.save-incompatible` visible at t≈1s, `phase: opening → idle`, stable 16s past the old 10s deadline, zero console errors | Previously: same screen appeared, then `Renderer readiness timed out` at ~10s and retry looped identically — reproduced before fix |
| Live browser — corrupted JSON save | Same result: corrupted message shown, `phase=idle`, no timeout at 14s | Second save-issue variant |
| `App.wiring.test.ts`, `useBootFlow`, coordinator, VueRouteAdapter suites | 69/69 PASS | No regression in adjacent wiring |

## Findings

None confirmed against this task. The pre-fix defect was reproduced live, fixed, and re-verified live.

## New or Changed QA Tests

- `game/src/App.routeMountWitness.test.ts` (task-authored, RED→GREEN): parses `App.vue`'s template AST via `@vue/compiler-dom` and asserts (1) every `entryStage`/`saveIssue`-conditioned sibling in the entry chain is a `RouteMount`, (2) each stage-conditioned RouteMount declares the matching coordinator route, (3) `SaveIncompatibleScreen` renders inside `<RouteMount route="error">`. Same static-guard philosophy as `App.wiring.test.ts`.

## Gaps and Residual Risk

- `tests/e2e/error-recovery.spec.ts` cannot detect this bug class (its OR-assertion accepts both buggy and fixed DOM); tightening it to assert `data-phase='idle'`/error-card absence is a noted coverage gap, not addressed here.
- INV-ERR-5 residual: the game-stage `v-else` still gates the route witness on `isBooted` (`GameRoot v-if="isBooted"`). The only previously reachable trigger (Back→'home' pre-boot) is now guarded in `onTransitionBack`; a *future* pre-boot game-route requester would re-open it. Closing it structurally (ungating GameRoot) was rejected — mounting the Phaser tree before player data exists is a larger blast radius.
- INV-ERR-6 latent: `saveIssue.clear()` has zero callers; contained because every SaveIncompatibleScreen exit reloads the page.
- Live retry/back could not be exercised end-to-end (the error card no longer appears on this path); retry/back correctness rests on the coordinator's same-route admission contract (lines 227-230) plus its existing test suite.

## Pre-existing Failures

- `tests/architecture/eslintCoreSeverity.test.ts` — 60s timeout under full-suite load; passes standalone. Environment flake, unrelated to this diff.
