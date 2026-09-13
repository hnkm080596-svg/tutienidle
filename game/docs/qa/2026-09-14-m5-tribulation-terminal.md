# M5 — Unique tribulation terminal (ARCH-006 first half) — G5 evidence

Date: 2026-09-14. Worker: mission M5. Worktree
`.agent-worktrees/arch-m5-tribulation-terminal`, branch
`arch/m5-tribulation-terminal` (fork `81c30e04`).

## G0 task card

```text
TASK CARD
Task / user request: M5 — TribulationDirector commits exactly one
  terminal outcome; a lethal strike ends the run; enterChapter never
  overwrites a committed defeat with victory (ARCH-006 first half).
Assigned worktree / branch:
  E:\tutienidle\.agent-worktrees\arch-m5-tribulation-terminal /
  arch/m5-tribulation-terminal
Requested observable behavior: on the audit repro (real authored
  foundation_establishment chapters, qi_refining player, defense=105,
  mind questions answered correctly, 0.1s ticks) the outcome stream is
  ["defeat"] only, final state 'defeat', hp 0 — never defeat-then-victory.
Single responsibility / invariant: exactly one terminal transition per
  run, owned by TribulationDirector; 'tribulation_outcome' emitted once
  from one site.
Current owner: src/core/tribulation/TribulationDirector.ts
  (tickTank, applyLightningDamage, enterChapter — same owner retained).
Target owner: same file, new private commitOutcome() terminal site.
Existing primitive/mechanism reused: ActiveTribulationState.state
  ('ongoing' | 'victory' | 'defeat') is already the terminal state — the
  guard is a check on it, not a new abstraction.
Missing capability: a guarded commit function; real callers are
  applyLightningDamage (defeat) and enterChapter (victory).
Production chain: App.vue tick() -> gameManager.tickOps.update(delta)
  -> GameManagerTickOps.updateBattleFixedStep -> tribulationDirector.update
  (:284) -> tickStep -> tickTank -> strikeLightning -> applyLightningDamage
  -> EntityVitalsSystem.applyDamage -> commitOutcome -> 'tribulation_outcome'.
  Consumer: App.vue:468 checkTribulationOutcomeAction polls getState()
  -> TribulationOutcomeService.resolveVictory/resolveDefeat ->
  presentation (curtain/announcement).
State: this.active/snapshotHp written only by director methods; readers
  getState()/getPresentationSnapshot(); reset via clear(); no
  persistence; presentationSession.isBlocking() gates update.
Expected files and why:
  - src/core/tribulation/TribulationDirector.ts — owns the invariant.
  - src/core/tribulation/TribulationDirector.terminal.test.ts — tests the
    invariant (new file, matching TribulationDirector.loiKiep.test.ts
    convention).
  - docs/qa/2026-09-14-m5-tribulation-terminal.md — this report.
Explicit non-goals: settlement relocation / commit ownership (M6);
  chapter/damage/reward balance; presentation files (TribulationScene,
  useTribulation, coordinator); TribulationOutcomeService refactor.
Applicable roadmap phase: §0.8a wave 1 M5; R8.2 (tribulation outcome
  chain already domain-owned — this fix hardens the RUN -> terminal end).
Tests and gates: new terminal suite (L02 port + boundary matrix);
  P3 quick (type-check + tribulation + coupled suites); P13/P14 not
  triggered (no wiring-critical files).
Stop condition: repro green + tribulation scope green + type-check.
Unresolved material assumptions: none.
```

## G1 — Q1-Q12 evidence

| ID | Answer — evidence |
|---|---|
| Q1 | Observable: `tribulation_outcome` stream `["defeat"]` (or `["victory"]`) exactly once; final `state`/`hp` consistent; no `tribulation_chapter_changed` after the outcome. Evidence: TribulationDirector.terminal.test.ts — all assertions. |
| Q2 | Owner: `TribulationDirector` — owns chapters runtime, snapshotHp, ghost entity, terminal commit. New `commitOutcome()` is the single transition site (file:490-504). |
| Q3 | `active.state`/`snapshotHp`/`cooldownUntil` — writer: director only; readers: `getState()`/`getPresentationSnapshot()` (hp mirror synced from snapshot); reset: `clear()`; no persistence. |
| Q4 | Real chain verified by source: App.vue:468 `checkTribulationOutcomeAction(player, gameManager, presentation)`; GameManagerTickOps.ts:284 `tribulationDirector.update(deltaSeconds)`; GameManager.ts:589 constructs director with real EventBus. |
| Q5 | Existing primitive: `TribulationOutcome` state field reused as the guard. No new abstraction — a boolean/flag would duplicate state the enum already carries. |
| Q6 | Imports unchanged: core events/vitals + data chapters — foundation direction intact (no presentation import added). |
| Q7 | Timing (update delta), domain commit (commitOutcome), presentation (useTribulation curtain + announcements) remain separated — unchanged boundaries; the fix only strengthens domain authority. |
| Q8 | Consumers preserve semantics: `useTribulation.checkTribulationOutcomeAction` reads `active.state` at curtain time (lines 143/153) — now stable single-terminal instead of defeat->victory mutation; `TribulationScene` listens `tribulation_lightning` only (lines 97/137); `tribulation_outcome` has no production event subscriber (grep: only tests + audit harness) — App polls state. |
| Q9 | `getState()`/`getPresentationSnapshot()` observational — they mirror `active.hp` from snapshot (pre-existing); unchanged. |
| Q10 | Duplicate/stale: `commitOutcome` no-ops when `state !== 'ongoing'` — exactly-once even under repeat calls; `update()`/`answerQuestion()` post-terminal no-op (tested: extra ticks emit nothing). Cooldown set once inside the defeat commit. |
| Q11 | Old path: none — same director; pre-fix behavior was the defect (unconditional `enterChapter` after lethal strike). |
| Q12 | Scope proof: diff touches only TribulationDirector.ts + its test + this report. `git status`/diff confirms; stop condition met. |

## Triggered domain modules

- **C1** PASS — lethal damage still flows through `EntityVitalsSystem.applyDamage` (the vitals authority); terminal tests assert hp, state, and event count together (`outcomes` array length, `hp === 0`).
- **C7** PASS — no declaration/impact/completion ACK contract in tribulation; presentation pacing untouched.
- **L2** PASS — terminal outcome is committed by the domain director, never by UI; the fix removes the last silent overwrite.
- **L4** PASS — repeated/late ticks and stale `answerQuestion` cannot duplicate the outcome (tests 6-7 of the new suite).
- S/E/U modules N/A — no save schema, inventory/economy, or UI/presentation surface touched.

## Behavior before -> after

- Before: `tickTank` called `enterChapter(index+1)` unconditionally when `secondsRemaining <= 0`; `enterChapter` wrote `state = 'victory'` + emitted `tribulation_outcome` with no liveness check. A lethal strike (regular or final) landing on the chapter-end tick produced `["defeat","victory"]`, final state 'victory', hp 0 (audit L02: defense=105). A lethal strike at a non-final chapter boundary also advanced `chapterIndex` and emitted `tribulation_chapter_changed` after the outcome.
- After: `commitOutcome` is the only site that writes a terminal state and emits `tribulation_outcome`, guarded by `active.state === 'ongoing'`; `enterChapter` refuses to run once terminal; `tickTank` rechecks liveness after the strike loop and after the final strike; `strikeLightning`/`applyLightningDamage` no-op when terminal.

## Files changed -> purpose

| File | Purpose |
|---|---|
| `src/core/tribulation/TribulationDirector.ts` | Single terminal-transition guard; one emit site; liveness rechecks; `enterChapter` requires 'ongoing'. |
| `src/core/tribulation/TribulationDirector.terminal.test.ts` | New regression suite (7 tests) — L02 port + boundary matrix. |

## New-regression spec (G2)

```text
Invariant / module ID: exactly one terminal outcome (Q1/Q10, C1, L2/L4).
Production input: real authored foundation_establishment chapters via
  director.start(); qi_refining createDefaultPlayer; createBaseStats
  defense {0,15,100,105,130,900}; mind questions answered correctly or
  left to time out.
Action: 0.1s update ticks until state leaves 'ongoing', plus stale
  post-terminal ticks/answers.
Expected state/events: outcomes exactly ["defeat"] or ["victory"];
  hp 0 on defeat; chapterIndex frozen at the lethal chapter; no
  chapter_changed after outcome; cooldown set on defeat only.
Why the old path fails: unconditional enterChapter overwrote defeat
  with victory (boundary) or advanced the chapter post-terminal.
Observed red -> green: 3 tests red pre-fix (["defeat","victory"] twice;
  chapterIndex 2 after body-boundary death), all 7 green post-fix.
```

## Verification (P3 quick — actual commands)

| Command | Result |
|---|---|
| `npm run type-check` (vue-tsc --build) | exit 0 |
| `npx vitest run src/core/tribulation/TribulationDirector.terminal.test.ts` pre-fix | 3 red / 4 pass — reproduces L02 `["defeat","victory"]` |
| `npx vitest run src/core/tribulation` | 8 files / 44 tests PASS |
| `npx vitest run` coupled scope (useTribulation.*, cultivationRitualFlow.integration, GameManager.dotPha, BattleLootSystem.beginTribulation, realmAdvanceUnequip, data/tribulation, presentation tribulationRouting/createGamePresentation/GamePresentationCoordinator/PresentationSession, TribulationScene.inkWashUi, architecture tribulationOutcomeWiring/vitalsWriteAuthority/progressionOutcomeOwnership) | 23 files / 136 tests PASS |
| `npx eslint` on the two touched files | clean, exit 0 |

## QA (P4) / code-review (P5)

- P4-equivalent adversarial pass (no QA agent dispatch available to this
  worker): probed (a) mid-while-loop defeat — exits via `ongoing`
  condition; (b) final-strike lethal — guarded by second recheck;
  (c) non-final boundary death — `enterChapter` guard blocks advance +
  chapter_changed; (d) post-terminal `update`/`answerQuestion`/`start`
  (`active` non-null or cooldown blocks); (e) `applyMindSuccess` heal
  cannot resurrect — only reachable while 'ongoing' which implies
  `snapshotHp > 0` (the only decrementer commits defeat at <=0); (f)
  event order on a lethal strike unchanged (vitals -> outcome ->
  lightning; the outcome precedes the strike event — pre-existing
  ordering, cosmetic for the TribulationScene listener). Verdict: PASS
  WITH EVIDENCE (self-review; recommend
  coordinator re-run of the named QA skill at merge).
- P5 code review (self): no `any`; comments English ASCII (P15); the
  removed `snapshotHp > 0` in the final-strike condition is provably
  redundant (`ongoing` => `snapshotHp > 0`); `strikeLightning`'s guard is
  redundant under current callers but kept deliberately — a strike event
  without damage would be an inconsistent emission. No findings >=80.
- E3 simplify: guards are minimal, one per layer boundary; no candidate
  removal that preserves the invariant at call-site level.
- P13/P14: N/A — no App.vue/lifecycle/scene/wiring files changed; the
  `tribulationDirector.update` entry point is untouched. No browser
  evidence required for a headless state-machine guard.

## Unresolved task work / retained debt

- M6 remains the owner of settlement relocation (curtain-independent,
  idempotent commit of consequences in `useTribulation` /
  `GamePresentationCoordinator` / `TribulationOutcomeService`) — out of
  scope here by mission contract.
- Note (not fixed, pre-existing): `getState()` returns the live `active`
  object; `src/presentation/tribulationRouting.test.ts:203,257` mutates
  `active.state = 'victory'` directly as test scaffolding — bypasses
  `commitOutcome` (skips the event). Harmless for routing coverage but a
  domain-mutation shortcut worth a factory/seam in M6 if the settlement
  contract hardens.
- `tribulation_outcome` remains producer-only (no production
  subscriber); documented in audit line 309 — unchanged by this mission.
