# Deep QA — Whole-Codebase Architecture & Adversarial Audit

- Date: 2026-09-13
- Mode: deep (explicit user request: whole-codebase architecture-failure search + deep QA)
- Verdict: **FAIL** — one Critical confirmed defect (tribulation completion soft-locks the
  game in production), two Medium confirmed defects (online auto-farm tick), plus
  suspected/low items and dead-authority residue listed below.
- Branch: `master` (read-only audit; only test/report files were added)

## Scope and risk map

Whole codebase, current `master`. Rebuilt the system map from current code rather
than trusting roadmap prose; compared against the Mission 0 audit
(`docs/architecture/mission-0-architecture-audit-2026-09-08.md`) and `docs/roadmap.md`.

| Area | Risk | Result |
| --- | --- | --- |
| Presentation routing / session lifecycle (coordinator, sessions, route adapters) | Critical | 1 confirmed defect (F1) |
| Tribulation outcome authority (R8.2) | Critical | outcome domain migration is clean; the *presentation wiring* to it is broken (F1) |
| Auto-farm / offline settlement | High | 2 confirmed defects on the online tick path (F2a/F2b); offline path verified guarded |
| Save/restore boundary (R10) | High | verified clean — identity, replacement semantics, preflight, once-only settle all present |
| Quest lifecycle (R8.1 / AR-09) | High | verified clean — `getActiveQuests` is a pure read; `reconcileActiveQuests` owns activation |
| Paid random / equipment preview (R9 / AR-21) | High | verified clean — ticket-capability contract pinned by `paidRandomContract` guard |
| Vitals write authority (R1 / AR-01) | High | verified clean — zero presentation-layer entity HP/Ward/alive mutations |
| Core import direction (A6) | High | verified clean — earlier grep hits were `core/presentation/*` primitives, not the Vue layer |
| Formation loadout commit (AR-11 residual) | Medium | suspected/low (F4) — direct store write, graceful consumers, stale draft |
| Auto-farm reward shim | Medium | suspected/low (F3) — `as unknown as Battle` contract lie, currently inert |
| Dead authority residue (R13 parked) | Low | dead flags/hooks listed — debt, not defects |
| i18n key coverage | Low | coverage gap — missing keys in both locales observed in e2e console |

## Invariant ledger (high-risk hypotheses exercised)

| State / owner | Action → transition | Invariant | Attack operator | Oracle | Layer | Result |
| --- | --- | --- | --- | --- | --- | --- |
| `coordinator.currentRoute` / GamePresentationCoordinator | tribulation finishes → tick calls `checkTribulationOutcomeAction` | recoverability + lifecycle: outcome application must be paired with a route back to `home` | production call site omits `presentation` (App.vue:451) | route snapshot after outcome | integration (`tribulationRouting.test.ts`) | **FAIL** (F1) |
| `player.autoFarmStage.lastCheckedMs` / GameManagerAutoFarmOps | online tick with malformed `perfectClearSeconds` | boundedness + determinism: cycle count must be finite and non-negative | `cycleSeconds = 0` → `elapsed/0 = Infinity`; `= NaN` → `NaN <= 0` false → poison write | `processDefeatedEnemies` call count; `Number.isFinite(lastCheckedMs)` | unit (`autoFarmAdversarial.test.ts`) | **FAIL** (F2a/F2b) |
| `tribulationDirector.active` / TribulationDirector | duplicate outcome check after `clear()` | idempotency: second check is a no-op | repeat | `getState()` stays null, no double-settle | integration | pass |
| session hold / PresentationSession | tribulation start while held | boundedness: no tick/question/strike progress before release | advance 30s held + answer attempt | state unchanged; `answerQuestion` false | integration | pass |
| `player.formationLoadout` / TranPhapPanel | confirm draft | single-writer + validation at commit | stale companion ids; duplicate combatant ids | battle build skips stale/dup ids gracefully | static + `BattleLootSystem.companionExp` tests | graceful (F4 note) |
| `battle.player` in auto-farm shim | heal-on-kill talent + idle cycle | A2/A4: combat-shaped API must not be fed a non-Battle | dead enemy entity as `battle.player` | vitals/heal events for phantom entity | static | inert today (F3) |
| restore transaction / SaveSystem | boot restore, repeated payload | replacement + once-only settle | double restore; registry drift | `computeRestoreIdentity`, `preflightSaveRegistryReferences` | unit suite | pass (R10) |
| quest activation / QuestSystem | `getActiveQuests` query | query purity (A3/A7): reads must not activate | call from panel without tick | no `ensureActive` inside getter | static + guards | pass (AR-09 fixed) |

## Findings

### F1 — CRITICAL / Confirmed: tribulation completion never routes home (soft-lock)

- **Owner:** `App.vue:451` → `checkTribulationOutcomeAction` (`src/composables/useTribulation.ts:130-185`); routing authority `GamePresentationCoordinator`.
- **Invariant:** lifecycle/recoverability — a finished tribulation session must be
  followed by a `request({ target: 'home' })`; the coordinator is the only route owner.
- **Mechanism:** `App.vue:451` calls `checkTribulationOutcomeAction(player, gameManager)`
  **without** the `presentation` argument. The function then runs `applyOutcome()`
  synchronously — domain outcome applies, `tribulationDirector.clear()` ends the
  session via `PresentationSession.end()` (which emits nothing — no session-ended
  event exists), `useUiStore().exitTribulationScene()` writes a flag nothing reads,
  and `tribulation_scene_exit` is emitted to zero listeners. **No
  `coordinator.request({ target: 'home' })` is ever issued** — the intended path
  (`presentation.coordinator.request({ target:'home', behindCurtain: applyOutcome })`,
  lines 169-179) only runs when `presentation` is passed, and the only caller that
  supplies it (`useTribulation().checkTribulationOutcome`) has **zero production
  callers** (BreakthroughRequirementPanel uses only `triggerBreakthrough`).
- **Observable result:** `currentRoute` stays `'tribulation'` forever →
  `GameRoot.isTribulationSceneActive` (route-derived) stays true → `isFullSceneActive`
  hides LeftPanel/RightPanel/command wheel/all panels → `TribulationSceneOverlay`
  renders `v-if="active"` → `active` is null → nothing → the Phaser `TribulationScene`
  is never deactivated → the result state shows only "VƯỢT KIẾP"/"KIẾP THẤT BẠI"
  text with **no exit control**. Player is stranded on a black tribulation backdrop
  (plus the world-announcement overlay). Only a page reload recovers.
- **Evidence:** intended-failing reproduction in
  `src/presentation/tribulationRouting.test.ts` —
  `REPRO: production outcome check (no presentation arg, as App.vue calls it) leaves
  the route stranded on tribulation` fails deterministically:
  `expected 'tribulation' to be 'home'`.
- **Blast radius:** every tribulation completion — victory AND defeat — including
  Quán Khí (mortal→qi_refining), the first realm gate, reachable in the first
  session. Ship-blocker for beta.
- **Why prior QA missed it:** R8.2 tests exercise the presentation-aware call
  signature; composable unit tests intentionally use the no-presentation fallback.
  No test exercised the *actual App.vue call signature* against a real coordinator.
  No e2e spec covers the tribulation flow at all. Classic wiring-gap class
  (P13: green unit suite, broken wiring).
- **Regression window:** introduced by the combination of `099b8917` (single
  route/readiness authority — made the ui flag fallback dead in production) and
  `229db663` (R8.2 — added the `presentation` branch without updating the App.vue
  call site).

### F2 — Medium / Confirmed: `tickAutoFarm` lacks the offline path's `cycleSeconds` guards

`src/core/game/GameManagerAutoFarmOps.ts:140-149` (online `tickAutoFarm`) checks only
`cycleSeconds === undefined`, while `settleAutoFarmOffline` (line 98) rejects
`!(cycleSeconds > 0) || !Number.isFinite(cycleSeconds)`. `saveShapeValidation` never
inspects `perfectClearSeconds`, so a malformed save value reaches the tick loop.

- **F2a — `cycleSeconds = 0` → unbounded reward loop.** `cycleMs = 0` →
  `completedCycles = Math.floor(elapsed / 0) = Infinity` → `for (i < Infinity)`
  → production freeze (real code has no escape). Repro test uses a counting
  stub with a safety cap and fails for the intended reason
  (`safety cap: loop exceeded 10 iterations` — zero cycles should have rolled).
- **F2b — `cycleSeconds = NaN` → `lastCheckedMs` poisoned to NaN permanently.**
  `NaN <= 0` is false so the early return is skipped; the loop body runs zero
  times but `lastCheckedMs += NaN * NaN` writes NaN — every subsequent tick derives
  `elapsedMs = NaN` → auto-farm silently never pays out again, no error. Repro
  fails: `Number.isFinite(lastCheckedMs)` is false after one tick.
- **Invariant:** boundedness/determinism + recoverability from corrupt persisted
  data. **Owner:** `GameManagerAutoFarmOps` (+ save validator gap).
- **Blast radius:** requires malformed `perfectClearSeconds` (corruption, tampered
  import, or residue across versions). F2a is a hard hang; F2b is silent permanent
  income loss. Reachability is low-probability but the fix is a one-line guard
  alignment.
- **Evidence:** `src/core/game/GameManager.autoFarmAdversarial.test.ts` — two new
  intended-failing tests under `Adversarial — online auto-farm tick invariants`.

### F3 — Low / Suspected: auto-farm reward path passes a `Battle` that is not a `Battle`

`GameManagerAutoFarmOps.rollAutoFarmCycleReward` builds
`{ player: killedEntities[0]?.entity, enemies: killedEntities } as unknown as Battle`
— `player` is a **dead-flagged enemy entity with full `currentHp`**. The comment
claims the heal-on-kill branch is inert, but `battle.player.currentHp > 0` is true,
so with the Huyết Chiến talent `applyHealing` actually executes against the dead
enemy (emits `entity_vitals_changed` for a phantom id; `applied = 0` since HP is
already max; no resurrection — `applyHealing` never touches `alive`).

Outcome is currently harmless, but the contract is a lie: any future
`processDefeatedEnemies` read of `battle.player` (talent scaling, lifesteal, drop
modifiers) silently inherits a dead enemy's stats. A2/A4: idle rewards reuse a
combat-shaped input with no real shared reward contract.

### F4 — Low / Suspected: `TranPhapPanel` commits persistent state with no domain validation and a stale draft

`TranPhapPanel.vue:182` writes `player.formationLoadout = {...}` directly (AR-11
residual). Mitigations observed: battle build (`buildTurnBattle`) skips stale/missing
combatant ids gracefully, EXP grant dedupes duplicated ids, and `onDrop` enforces
cell validity + uniqueness. Residual issues: no commit-time validation that
`combatantId`s still exist in `player.companions`, and `currentAssignments`/
`selectedFormationId` are initialized once at mount and never resynced with
`player.formationLoadout` — a stale copy with no refresh contract (A3). A confirm
after an external loadout change (e.g., restore without reload) would silently
overwrite it.

### Dead-authority residue (debt, not defects — R13 scope)

- `syncLegacyBattleState` dep wired to `() => {}` in
  `GameManagerTurnBattlePresentationOps.ts:73`; still called at
  `CombatAnimationRuntime.ts:294,323`.
- `ui.isTribulationSceneActive` / `enterTribulationScene` / `exitTribulationScene`,
  `ui.combatSceneDismissed` / `ui.combatOrigin` — dead writes in production
  (fallback-only reads once the route adapter is injected).
- `useTribulation().checkTribulationOutcome` — dead wrapper (no callers).
- `tribulation_scene_exit` event — emitted, zero listeners.
- `GameManagerTickOps.ts:65` comment still says "tribulation outcomes live in Vue
  until R8.2" — R8.2 shipped; comment drift.

## Verification evidence

| Command | Result |
| --- | --- |
| `npm run test` (full suite) | 534 files / 3684 tests pass; **3 fail — all intended-failing reproductions added by this audit** (F1, F2a, F2b). Zero pre-existing unit failures. |
| `npm run type-check` | Exit 0 |
| `npm run build` | Exit 0 (pre-existing >500 kB chunk warning only) |
| `npm run test:e2e` | 17/18 pass; 1 pre-existing failure — see below |

## Pre-existing failures (not audit-caused)

- `tests/e2e/standing-slot-panel.spec.ts` — **test rot**: waits for a test-only
  "Hỗn Độn Trận" formation button and a `.tran-phap-panel__grant-test` control that
  no longer exist (`TRAN_PHAP_FORMATIONS` has only the 5 real formations; the panel
  template has no grant-test button). Times out at 120 s. Side effect: the
  formation drag-drop flow currently has no working e2e oracle.

## Coverage gaps and residual risk

- **No e2e coverage of the tribulation flow** (entry → chapters → outcome → home).
  This is exactly the seam where F1 escaped: unit tests covered the
  presentation-aware signature, production used the other one.
- **i18n key drift**: e2e console shows missing keys in BOTH `vi` and `en`
  (`panels.stageSelect.*` labels/modes/hints, `panels.wheel.aria.group`,
  `onboarding.auth.eyebrow`) — silently falls back to root locale. P16-class drift;
  no guard prevents registering keys that don't exist.
- `VUE_ROUTER_R0004` warning in e2e console — a vue-router instance is active but
  has no `/` route; presentation routing is coordinator-owned. Residual
  configuration drift worth a look, not a defect.
- Static sweeps recorded but not exhaustively adjudicated: 557 content-ID-like
  conditionals in `src/core`, 279 TODO/legacy markers in `src` — sampled ones were
  legitimate or already-guarded; the guards (`artTierDebt`, `assetContainment`,
  `combatContract`, etc.) are the intended containment mechanism.
- Two-tab/cloud-save concurrency: local CAS revision handling verified by code
  read (`SAVE_REVISION_KEY` cleanup on delete); no live Supabase exercise (no
  secrets touched, per audit bounds).

## New or changed QA tests (audit-added; production code untouched)

- `src/presentation/tribulationRouting.test.ts` — added REPRO case for F1
  (fails: route stranded on `tribulation` under the real App.vue call signature).
- `src/core/game/GameManager.autoFarmAdversarial.test.ts` — added
  `Adversarial — online auto-farm tick invariants` describe with two REPRO cases
  for F2a/F2b (both fail for the intended reason).

## Notes for the ledger

F1 fits the standing "wiring migration left the real caller behind" pattern
(QA-2026-09-09-RR6/RR7 family): the unit suite proves the engine contract, the
production call site never got the new dependency. F2 fits the
"same invariant, two variants, one guarded" pattern (A9). Both have regression
tests ready to flip green on repair.
