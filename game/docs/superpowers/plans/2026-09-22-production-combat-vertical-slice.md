# Production Combat Vertical Slice — Implementation Plan (P3)

> **For agentic workers:** Non-trivial production missions MUST follow `game/docs/architecture/architecture-worker-workflow.md` (G0-G5) and return the G5 evidence report. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove — and where necessary repair — ONE complete production battle loop end-to-end on the canonical systems: select build (Initiation Ritual) → enter stage → battle init → spawn → skills/actions → damage/vitals → buffs → seals/reactions → companions → death → victory/defeat terminal → reward settlement → replay/return. No manual state patching, no leaked listeners or retained runtime state between battles, combat rules staying outside Phaser.

**Program / spec:** `game/docs/specs/2026-09-20-post-canonical-foundation-block-spec.md` §P3. Ordering: P3 runs after P1+P2 — both are implemented and IMPLEMENT-READY on this branch (`p1-canonical-path-authority`, worktree `.agent-worktrees/p1-canonical-path-authority`); this plan binds to the landed capability + build layers.

**Architecture:** P3 is a verification-and-hardening phase, not a content phase. The loop already exists and is largely canonical (P1 path authority, P2 `resolveCombatBuild`). The work is: (a) a step-by-step census of the spec's flow against current owners and evidence; (b) a teardown/leak audit across every terminal path (victory, defeat, abandon, auto-repeat, cycle replacement, failed-cycle discard); (c) repairs ONLY where the audit finds confirmed violations; (d) an E2E spec proving the loop through the real UI.

```
Slice scenario (pinned, deterministic):
  seed a preconditioned save (skillCastCounts.linh_bao = L3 threshold -- the same
  legitimate gate precondition the ritual spec uses; the LOOP itself is never patched)
  -> create flow loads it -> ritual picks phap_tu/ngo_dao (exercises aura + seal/reaction machinery)
  -> enter stage 1 -> battle init (canonical build) -> run to victory
  -> reward settlement -> refight (clean second battle) -> exit to map
  AND
  enter stage -> exit-confirm -> abandon -> home (abandon routes straight
  home; the defeat panel is the natural-defeat surface) -> re-enter ->
  natural terminal -> result panel -> return
```

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, Pinia, Phaser, Playwright E2E.

---

## Global Constraints

- **P3 is not a rewrite.** The production loop exists: `beginBattleCycleCommitted` -> `resolveCombatBuild` -> `TurnBattle` -> `settleCombatOutcome` -> reward/repeat/terminal. The plan adds census + leak proof + E2E, and repairs only CONFIRMED defects. No gameplay redesign, no new combat content (spec ordering constraint: no content expansion during P1-P4).
- **Zero gameplay change** on reachable flows. Repairs are allowed only against a failing reproduction test or direct runtime evidence (same bar as adversarial QA).
- **Canonical seams stay canonical.** Any discovered recomposition (stats recomputed outside `resolveCombatBuild`, path inference in combat code) is repaired by routing through the P1/P2 authorities — never by adding a second path.
- **Seal/reaction evidence split (settled):** production-combat proof is a seeded headless stage battle — `SeededCombatRng` via the existing `combatRng` seam (ops:1396) makes a real `beginBattleCycle` run deterministic, so seal applications and reaction payoffs are asserted inside the actual runtime. E2E asserts what is deterministic through the real UI: aura grant on allies at entry (`getBattleBuffs`, proven pattern) and the loop-level invariants. Engine tests already prove the payoff mechanics (`ngoDaoReaction`, `reactionReproof`); M3 adds the seeded end-to-end-at-engine-level run over a real stage encounter.
- **Defeat coverage (settled):** abandon and natural defeat enter teardown through DIFFERENT code paths (ops-forced `state='defeat'` + `clearCycleEntryState` vs engine-terminal `settleCombatOutcome`), so they are audited separately. M1 covers natural defeat at engine level (an outmatched player vs a real enemy definition, run to the defeat terminal). E2E uses exit-confirm -> `abandonBattle` -> home -> re-enter -> natural terminal -> result panel — labelled the abandon path, not claimed as natural-defeat-equivalent. Implementation note: `exitCombatToHome({abandon:true})` never routes through `CombatDefeatPanel`; that panel is the natural-defeat surface only.
- **Teardown invariants under audit (M1):** per terminal path, assert release of — combatClock stopped; `battleBuffRegistry`/reaction journal/elemental registries/scheduler queue NOT shared with the next cycle; `activeBuild`/`turnRuntime`/`turnBattle` lifecycle correct (terminal battle retained for result reads, in-progress gate false); spawned enemy presentation despawned; stage lease released appropriately; survive session ended; EventBus/listener subscriptions not accumulating across battles.
- **P3 verification:** `quick` per mission; `full` (`npm run verify`) mandatory before M4 closes (battle-entry + lifecycle surface).
- **P13/P14:** the new E2E spec + `cultivation-path-ritual.spec.ts` run inside this worktree against a worktree dev server.
- **P4/P5:** adversarial QA + sequential multi-pass review per AGENTS.md.
- **P7:** commits need explicit user authorization.
- Comments in `.ts`/`.vue` ASCII-only (ratchet).

---

## §0. Verified Current-State Baseline (branch `p1-canonical-path-authority`, post-P1+P2)

| Spec flow step | Current owner | Canonical status | Existing evidence |
|---|---|---|---|
| Select Build | `CultivationPathSystem.applyPathChoice` (ritual, atomic pair) | canonical (P1) | `cultivation-path-ritual.spec.ts` 7/7 |
| Enter Stage | `stageWaves` lease + `startStage` -> `beginBattleCycleCommitted` | canonical | `stageLease.test.ts` 14/14 |
| Battle Initialization | `resolveCombatBuild` (P2) -> `buildTurnBattle` -> `TurnBattleSystem` | canonical | `CombatBuild.test.ts` 25/25 |
| Spawn | enemy/wave assembly in ops (NOT build scope) + presentation despawn | retained ops seam | `battleCycle`/`bossRepeatCycle` |
| Skills/Actions | `TurnBattleSystem` + scheduler + authored ops lane | canonical engine | broad suite |
| Damage/Vitals | `CombatSystem` + vitals events | canonical engine | broad suite |
| Buff/Debuff | `battleBuffRegistry` (battle-local) + `applyBuildBuffs` lane | canonical engine | buff suites |
| Seal | elemental seals via `apply_buff` ops + `ElementalStateRegistry` boards | canonical | `ngoDaoReaction` tests |
| Reaction | `ReactionSystem`/`ReactionDispatcher` + journal drain (ops:175-178, 571-573, 632) | canonical | `ngoDaoReaction`/`reactionReproof` |
| Companion | `build.companions` minted + formation coords + kit clones | canonical (P2) | `CombatBuild` tests |
| Death | survive-lethal guard + death handling in engine | canonical engine | `battleCycle` suites |
| Victory/Defeat | `settleCombatOutcome` -> terminal + clock stop + battle_end | canonical | `battleCycle`/`stageLease` |
| Reward Settlement | `rewardOps.grantBattleRewardIfNeeded` + perfect-clear + loot receiver | canonical | reward suites |
| Replay / Return | `restartTurnBattleCycle` / defeat-panel refight; exit-confirm -> `abandonBattle` -> teardown | canonical | `repeatStage`/`stageRestart`/`bossRepeatCycle`, `CombatExitConfirmModal` tests |

**Census output target:** `docs/architecture/2026-09-22-combat-vertical-slice-inventory.md` — this table completed with leak surfaces + evidence links per step (M0).

---

## Mission P3-M0 — Vertical-slice census

**Files:**
- Create: `game/docs/architecture/2026-09-22-combat-vertical-slice-inventory.md`
- Modify: `game/docs/superpowers/plans/2026-09-22-production-combat-vertical-slice.md` (baseline table filled with measured facts)

- [x] **Step 1 — Walk the 14 spec steps:** for each, record owner symbol, canonical-or-retained classification, existing test/E2E evidence, and the leak surface (what per-battle state it creates: registry instances, journal cursors, listener handles, spawned entities/visuals, clock state, leases).
- [x] **Step 2 — Teardown-path enumeration:** enumerate every path that ends or replaces a battle: victory terminal, natural defeat, abandon, auto-repeat restart, `beginBattleCycle` replacing a live battle, `discardFailedCycle`, stage-restart. For each, list the teardown it must run and the test that proves it (or a gap mark).
- [x] **Step 3 — Gap report:** classify every finding as confirmed defect / coverage gap / clean. Confirmed defects feed M2; coverage gaps feed M1/M3. No production edits in M0.

## Mission P3-M1 — Cross-battle teardown audit

**Files:**
- Create/Modify: `game/src/core/game/GameManager.battleTeardown.test.ts` (or extend `battleCycle`/`stageLease` suites where the assertion belongs to an existing fixture)
- Modify: production files ONLY where a confirmed leak is found (each repair is its own TDD fix).

- [x] **Step 1 — Terminal-path matrix test:** for each of victory / natural defeat / abandon / repeat-restart / live-replacement / failed-cycle: run two sequential battles and assert the second cycle gets (a) a fresh battle-local buff registry (no carried buff instances — leak sentinel: a transient battle-1 seal/debuff on a target must NOT appear on battle-2 targets, while expected entry buffs like the aura ARE freshly re-granted per battle), (b) a fresh reaction journal + elemental boards, (c) drained scheduler queue (no stale ops), (d) cleared `activeBuild` + fresh resolve, (e) combatClock restarted clean, (f) no survive-session bleed. Natural defeat is driven for real at engine level: an outmatched player vs a real enemy definition run to the `defeat` terminal — abandon is NOT used as its proxy.
- [x] **Step 2 — Listener/subscription audit:** count EventBus subscriptions (or the concrete listener registry) before battle 1 and after battle 2 teardown — assert no accumulation. If EventBus lacks a count surface, assert behavioral parity: events from battle 2 don't reach battle-1 handlers (double-fire detection via a spy).
- [x] **Step 3 — Presentation lifecycle:** assert spawned enemy visuals/entities from battle 1 are despawned (not merely invisible) when battle 2 begins — reuse existing despawn assertions where present (`turnBattle.enemies` cleanup already guarded at ops:1668).

## Mission P3-M2 — Canonical-flow gap repairs (conditional)

- [x] Apply ONLY for confirmed M0/M1 findings. Each fix: failing test that pins the defect -> smallest coherent repair (route through canonical authority) -> focused reverify. Suspected-but-unproven items are recorded in the inventory doc, not fixed. — **1 confirmed defect found and repaired (by M3 E2E, not the engine audit):** `CombatExitConfirmModal`'s overlay inherited `pointer-events:none` from `.combat-scene-overlay`, so the exit-confirm buttons were unclickable in production (unit tests never caught it — jsdom does no hit-testing; the spec's Playwright click log showed canvas intercepting every attempt). Repaired with `pointer-events:auto` matching `CombatResultModal`'s pattern; the E2E abandon loop is the reproduction/oracle.

## Mission P3-M3 — E2E vertical slice spec

**Files:**
- Create: `game/tests/e2e/combat-vertical-slice.spec.ts`
- Modify: `game/tests/e2e/helpers.ts` ONLY if a shared helper is missing (reuse `__tutienPhaserGame.registry.get` + `getBattleBuffs`/`getTurnBattle`/`isTurnBattleInProgress` patterns from the ritual spec).

- [x] **Step 1 — Victory loop (ngo_dao):** seed the linh_bao-L3 precondition via `seedAndReload` (existing fixture, pre-battle save state — the loop is unpatched) -> ritual picks `phap_tu`/`ngo_dao` -> enter stage 1 -> assert init: `getTurnBattle()` players+enemies minted, `getBattleBuffs(allyId)` includes `van_phap_than_hoa` -> run to `victory` -> assert reward settlement (victory panel + `completedStageIds` gains the stage — NOT specific loot contents; `SeededCombatRng` does not drive drop/economy rolls) -> refight -> assert the second battle mints fresh entity instances (entity refs differ — checked against the WINNING terminal object captured immediately before retry, not the stage-entry battle), battle-1 transient buffs absent while expected entry buffs are freshly re-granted, `totalTurnsElapsed`/`roundsElapsed` reset -> exit -> `isTurnBattleInProgress()` false. — **Done:** `tests/e2e/combat-vertical-slice.spec.ts` test 1 green (defeat->retry resilience included; the fresh-instance oracle compares against the exact winning terminal battle).
- [x] **Step 2 — Seeded production-combat proof (engine level, deterministic):** new test (e.g. `GameManager.verticalSlice.test.ts`) drives a REAL stage-1 `beginBattleCycle` under `SeededCombatRng` with the ngo_dao build -> assert the battle terminates in `victory`, at least one canonical seal (`hoa_an`/`han_tuc`/`doc_can`/`liet_thuong`/`tran_an`) was applied to an enemy through the authored op lane, and the reaction journal recorded >=1 `reaction_resolved` (if the committed seed's rolls never form a legal seal pair, adjust the seed so the combination is exercised — the assertion must hold for the committed seed). Reward settlement asserted via stage completion (`completedStageIds`/reward-ops outcome), not loot contents. — **Done (seed 20260922):** victory in 279 combat steps; all 5 canonical seals observed on enemies; 9 `reaction_resolved` across 5 distinct ids (xuyen_tho x3, tuc_viem x2, nhuan_moc, duong_viem, tu_thuy) — the distinct-id set is pinned; determinism test replays seed 777 to identical outcome.
- [x] **Step 3 — Defeat/abandon loop:** enter a stage -> exit-confirm -> abandon -> assert `state === 'defeat'` + `isTurnBattleInProgress()` false. **Routing correction found during implementation:** `exitCombatToHome({ abandon: true })` routes straight HOME under the presentation curtain — the defeat panel (`CombatDefeatPanel`) is the NATURAL-defeat surface, not the abandon surface, so there is no "refight from the defeat panel" step on this path. The implemented loop asserts: abandon -> home -> re-enter stage -> fresh battle -> run to a natural terminal -> whichever result panel surfaces -> return to map -> no battle in progress. Natural-defeat terminal coverage lives in M1 Step 1 (engine level), not here. — **Done:** spec test 2 green.

## Mission P3-M4 — Gates + docs

- [x] `npm run verify` (full) green; the new E2E + `cultivation-path-ritual.spec.ts` green inside this worktree. — verify: 692 files / 6051 tests (4 expected-fail); combat-vertical-slice 2/2; ritual 7/7. Post-review round strengthened the M1 matrix (scheduler identity, clock-zero mints, aura instanceId freshness, survive-charge re-derivation, reaction double-fire oracle) per external CHANGES findings.
- [x] P18 OCR over the P3 delta; P4 adversarial QA (quick — bound the mapper's deep-audit flag if raised); 3 sequential review passes; external review loop to IMPLEMENT-READY. — OCR: 4/4 P3-delta files reviewed, 2 nits fixed (dead `void` refs, weak determinism fingerprint); QA: PASS WITH EVIDENCE; 3 passes recorded below.
- [x] Docs: `docs/systems/combat-overview.md` (or `combat-build.md`) gains the verified loop map + teardown invariants; inventory doc finalized. — `combat-overview.md` gained "Vòng đời battle & teardown (P3)"; inventory gained the audit outcome section.

---

## Exit criteria (spec §P3)

- one full battle loop works without manual state patching — proven by the E2E victory loop (UI-driven, no engine writes);
- replay starts from clean battle state — proven by M1 matrix + E2E refight assertions;
- victory and defeat both clean up correctly — victory + natural defeat + abandon each proven by the M1 terminal matrix (natural defeat driven for real at engine level), plus the E2E abandon loop;
- runtime combat rules remain outside Phaser — existing boundary guards (`battleLifecyclePathBoundary`, `buildCompositionBoundary`, `frontendImportDirection`) stay green.

## Ledger

| Rule/state | Current authority | P3 disposition |
|---|---|---|
| Battle entry composition | `resolveCombatBuild` (P2) | consumed, unchanged |
| Path/way identity | `CultivationPathSystem` + capabilities (P1) | consumed, unchanged |
| Per-battle registries (buffs, reactions, seals, scheduler) | battle-local instances in ops/engine | audited for cross-cycle leakage |
| Combat clock | ops-owned, stops at terminal | audited |
| Reward settlement | `rewardOps` + loot receiver | verified end-to-end |
| Stage lease | `stageWaves` | verified release/restart |
