# M3 / ARCH-004 / L03 — Accepted presentation-session handoff

Date: 2026-09-14 · Branch: `arch/m3-session-handoff` · Worktree: `.agent-worktrees/arch-m3-session-handoff` · Mode: full
Verdict: **PASS WITH EVIDENCE** (with documented pre-existing failures — see Verification)

## Task card (G0/G1)

**Invariant:** the `RouteRequest`/`SessionRef` a domain command accepted is the
identity carried through admission → resource preparation → `renderer.prepare`
→ READY → attach/release — never re-derived from ambient session state.

**Defect (L03):** `behindCurtain: () => boolean` discarded the command-created
`RouteRequest`. The coordinator re-queried `sessionPort.getCurrentSession()`
unscoped, which prefers retained combat (`combat ?? tribulation ?? null`). With
a terminal combat session retained at Home, an admitted tribulation transition
adopted/prepared the *combat* session.

**Scope:** `GamePresentationCoordinator`, `RouteRequest`/`SceneReadyPort`
contracts, `PhaserSceneAdapter` READY matching, scene READY echoes,
`SessionPresentationPort` identity-scoped liveness. No new routing manager; no
gameplay formula or ownership changes.

## Files changed → purpose

| File | Purpose |
|---|---|
| `src/presentation/PresentationContracts.ts` | arm-2 `behindCurtain: () => RouteRequest \| null` — returns the accepted request; `null` fails the transition. arm-1/arm-3 unchanged. |
| `src/presentation/createGamePresentation.ts` | `runAdmitted` behindCurtain returns `accepted` (the command's accepted request); non-session arm wraps to boolean. |
| `src/presentation/GamePresentationCoordinator.ts` | Adopts returned request's session (kind + target checked); rebinds `preparedRequest = { target, session: adopted }` for `assets.ensureFor` / `renderer.prepare` / `failedRequest`; `retry()` validates via `isCurrentSession` and never re-runs behindCurtain. |
| `src/core/presentation/PresentationSession.ts` | `SessionPresentationPort.isCurrentSession(session)` — kind+id liveness; `getCurrentSession` doc-marked recovery-only. |
| `src/core/game/GameManager.ts` | Composite port implements `isCurrentSession` via kind-scoped `getCurrentPresentationSession(session.kind)`. |
| `src/core/game/GameManagerTurnBattlePresentationOps.ts` | Combat-side port delegates `isCurrentSession` to `PresentationSession`. |
| `src/presentation/PhaserSceneAdapter.ts` | `ReadyContext.gameGeneration` required; READY resolves only on exact `transitionId`+`sessionId`+`gameGeneration` match (no undefined-wildcard); generation echoed in `scene.start` and `rebindSession` payloads. |
| `src/presentation/gate/PresentationGate.ts` | `SceneReadyPort.reportReady` context gains required `gameGeneration`. |
| `src/game/scenes/CombatScene.ts` | `init`/`rebindSession` accept + echo `gameGeneration`; init assigns unconditionally (no stale-identity leak on data-less restart). |
| `src/game/scenes/TribulationScene.ts` | Same init/echo change. |
| `src/game/scenes/MainScene.ts` | Echoes `gameGeneration` only — stays non-session (no sessionId). |
| `src/presentation/sessionHandoff.test.ts` | NEW — 5 L03 regression tests (455 lines). |
| 4 existing test files | Updated for strict READY + new contract. |

## Behavior before → after

- **Before:** `behindCurtain` returned boolean; coordinator re-queried ambient
  unscoped `getCurrentSession()` → retained combat shadowed an admitted
  tribulation session; READY matched on transitionId with optional fields
  acting as wildcards; retry re-queried ambient session (or re-ran nothing).
- **After:** the accepted `RouteRequest` travels to the coordinator, which
  adopts *that* session, holds it, and passes the session-bound request to
  `assets.ensureFor` and `renderer.prepare`; READY requires exact
  transition+session+generation identity; `failedRequest` records the
  session-bound request; `retry()` resumes it only while
  `isCurrentSession` confirms it live for its own kind, and never re-issues
  the domain command.

## Owner and migrated consumers

- **Owner of the admitted-session identity:** the domain command's accepted
  `RouteRequest`, adopted by `GamePresentationCoordinator.executeTransition`
  (src/presentation/GamePresentationCoordinator.ts:320-368).
- **Consumers migrated:** `assets.ensureFor` and `renderer.prepare` now receive
  `preparedRequest` (session-bound), not the sessionless arm-2 original;
  `retry()` consumes `sessionPort.isCurrentSession` instead of unscoped
  `getCurrentSession`.
- **Unchanged consumers:** `handleSessionStarted` recovery path (event +
  one-shot `getCurrentSession` recovery query at startup — documented as
  recovery-only); `useBattleActions`/`useTribulation` commands (already
  kind-scoped `getCurrentPresentationSession(kind)`); arm-3 non-session
  behindCurtain callers (App.vue:248, useBattleActions.ts:124,
  useTribulation.ts:176) — boolean contract preserved via wrapper.

## Old/alternate path status

- `getCurrentSession()` unscoped: **retained**, deliberately — it is the
  recovery-only query for the startup/event buffer path; doc-marked as not an
  identity source for admitted transitions.
- arm-1 `{session, behindCurtain?: () => boolean}`: retained, no production
  caller combines both today (inventory: createGamePresentation.ts:79 arm-1
  no-callback; all boolean callbacks are arm-3). Kept for contract
  completeness.

## Q1–Q12 / triggered modules

- **Q1:** PASS — observable: tribulation entered on its own session while a
  terminal combat session stays retained; strict READY; retry resumes recorded
  session. Tests: sessionHandoff.test.ts (5).
- **Q2:** PASS — owner = accepted `RouteRequest` adopted by coordinator
  (single adoption point); no second session source in the transition path.
- **Q3:** PASS — session lifecycle still owned by `PresentationSession`/
  `GameManager`; coordinator only holds/attaches/releases the adopted ref.
- **Q4:** PASS — real chain: `useBattleActions.runStageStart` /
  `useTribulation.startTribulation` → `runAdmitted` → `coordinator.request` →
  `executeTransition` → `assets.ensureFor`/`renderer.prepare` → scene READY.
  Verified end-to-end by tribulation-flow Playwright spec (real browser).
- **Q5:** PASS — reused `RouteRequest`/`SessionRef`/`PresentationHold`; one
  additive port method `isCurrentSession` (stable concept: identity-scoped
  liveness; consumers: coordinator retry + composite port).
- **Q6:** PASS — no new imports across layer boundaries; `SessionRef`/
  contracts already shared below consumers.
- **Q7:** PASS — READY remains an ack; no gameplay outcome decided in
  presentation; domain command still runs domain-side inside the curtain.
- **Q8:** PASS — session-bound request preserves target+session semantics to
  both consumers; mismatched-target accepted request throws explicitly.
- **Q9:** PASS — `isCurrentSession` is observational (no
  hold/attach/advance side effect).
- **Q10:** PASS — duplicate/late READY rejected (`pendingWaiter` nulled
  before resolve); stale transition/session/generation all reject; aborted
  waiter cleaned via `onAbort`; sessionless accepted request → explicit throw.
- **Q11:** PASS — unscoped `getCurrentSession` retained only for documented
  recovery; no other ambient identity reads remain on the admitted path.
- **Q12:** PASS — 11 production files all map to the invariant; verification
  below; unrelated findings reported as debt, not fixed.
- **Triggered modules — S (session/async/lifecycle):** S4 PASS (old READY
  cannot satisfy a new waiter — transition+session+generation identity);
  S5 PASS (waiter cleanup on abort/setGame/dispose exercised by existing
  adapter tests + strict-match tests). L3 PASS — see P13.
- **N/A:** C (no combat rules/stats touched), E (no economy), L1/L2/L4 (no
  progression/reward paths), U1–U5 (no new UI primitive, projection, asset
  catalog, or i18n surface — code comments ASCII).

## Verification (exact commands / results)

- `npm run type-check` — **PASS** (vue-tsc --build, exit 0).
- `npx vitest run src/presentation` — **PASS**: 28 files / 212 tests,
  including sessionHandoff.test.ts 5/5.
- `npm run build` — **PASS** (1739 modules; only pre-existing chunk-size
  warnings).
- `npx vitest run` (full suite) — **all failures pre-existing/unrelated:**
  - `GameManager.perfectClear.feasibility.test.ts` ×3 (`qa_floor_1/5/10`) —
    reproduced identically on base `81c30e04` with changes stashed → not
    task-caused (P12: pre-existing balance failure, audit-documented).
  - `tests/architecture/eslintCoreSeverity.test.ts` — timeout under
    full-suite load; **passes in isolation** → flake, not task-caused.
- `npx eslint` on changed files — **0 errors**; warnings only, all
  pre-existing or the established `as any` test-mock idiom (5 in new test
  file, matching sibling routing tests' convention — flagged per P8).
- Playwright (real browser):
  - `tests/e2e/presentation-routing.spec.ts` — **PASS**.
  - `tests/e2e/tribulation-flow.spec.ts` — **PASS** (exercises the real
    admitted `runAdmitted('tribulation')` path end-to-end under strict READY).
  - `tests/e2e/turn-combat-hud.spec.ts` — **FAIL, pre-existing**: identical
    failure signature in audit baseline artifacts
    (`audit-playwright-artifacts/turn-combat-hud-*/error-context.md`: same
    120 s wait for `.combat-victory-panel`/`.combat-defeat-panel`, same
    "Động 1 6/10 quái" progress point). Combat pacing/timing issue on the
    base branch — unrelated to session handoff (transition/entry succeeded;
    battle was mid-run at timeout).

## P4 adversarial QA — PASS WITH EVIDENCE

Probes exercised (all resolved):

- arm-2 curtainResult lacking session → explicit 'produced no session' throw.
- curtainResult target mismatch → explicit throw before adoption.
- sessionless/data-less scene restart → init assigns unconditionally; echoes
  `undefined`/0 — never matches a session waiter (also fixes a latent
  sessionId=0 truthiness-drop edge).
- READY with omitted sessionId against session waiter → rejected; READY with
  sessionId against non-session waiter → rejected (stricter than before:
  undefined-waiter previously accepted any sessionId).
- Duplicate/late READY after resolve → rejected (`!waiter`).
- Game host replaced mid-wait → `setGame` bumps generation AND rejects waiter.
- Retry paths: behindCurtain-bearing failedRequest → reject (no domain
  re-run); session-bound failedRequest → `isCurrentSession` kind-scoped
  liveness; arm-3 home teardown retry → reject (boolean contract preserved).
- Hold lifecycle: arm-2 failure post-hold → detach 'hold' → retry re-holds
  recorded session (designed semantics); pre-hold command rejection → curtain
  reopens, no leak.
- Same-route combat rebind → new sessionId+generation in rebind payload and
  READY echo (test: sessionHandoff 'rebind carries NEW session identity').

Residual note (<80 confidence, no action): an untyped runtime caller could
pass `{session: A, behindCurtain: () => RouteRequest}` and produce a
hold-A/adopt-B mismatch — unreachable through typed callers (arm-1's
behindCurtain is `() => boolean`; all production session admissions go
through `runAdmitted` arm-2).

## P5 code review — PASS

Self-review of the full aggregate diff (16 files): no ≥80-confidence
findings. Identity adoption is single-point; non-session routes preserved;
no `any` introduced in production code; comments plain ASCII English.

## P13/P14 evidence

- P13 (wiring-critical: Phaser scene lifecycle + Vue↔Phaser bridge):
  presentation-routing + tribulation-flow E2E both drive the real
  boot → admit → transition → scene READY → home-return chain in a live
  browser — PASS. turn-combat-hud fails at base identically (pre-existing).
- P14: this worktree runs Playwright successfully (specs above ran in a real
  browser here); no additional visual-only surface was changed (no CSS,
  layout, sprite, or drag paths touched).

## Unresolved task work

- **Commit pending** — P7: awaiting explicit user authorization.
- `turn-combat-hud` pacing failure is pre-existing; whether to repair it is
  outside this mission's scope (likely tied to the enemy attackSpeed
  re-authoring line of work).

## Retained debt / Notes-Suggestions

- `GameManager.perfectClear.feasibility.test.ts` ×3 — pre-existing balance
  failures on base (audit-documented); belongs to combat-balance scope.
- `eslintCoreSeverity.test.ts` — full-suite load flake; consider a longer
  timeout or isolation if it recurs.
- arm-1 `{session, behindCurtain}` contract arm has no production caller
  combining both fields — candidate for contract tightening in a future
  cleanup, not required by this invariant.
