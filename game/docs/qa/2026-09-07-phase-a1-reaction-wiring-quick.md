# QA Review: Phase A1 — TurnReactionManager Wiring

- Date: 2026-09-07
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/core/battle/turn/TurnReactionManager.ts` (new)
  - `game/src/core/battle/turn/TurnReactionManager.test.ts` (new, 15 tests)
  - `game/src/core/battle/turn/TurnBuffSystem.ts` (+3 ported methods) + test
  - `game/src/core/battle/turn/TurnBattleSystem.ts` (constructor + ailment hook) + test
  - `game/src/core/battle/turn/TurnSkillAction.ts` (`appliesAilment` field)
  - `game/src/data/skill/TurnBasicAttacks.ts` (5 skill entries)
  - `game/src/core/game/GameManager.ts` (2 production constructor sites)

## Scope and Risk Map

Risk map returned 4 domains (combat-and-tribulation, economy-and-progression,
pinia-phaser-sync, time-and-offline), `deepAuditCandidate: true`,
`unmappedPaths: []`. Manual bounding:

- **time-and-offline**: no clock owner/timestamp touched; reaction logic runs
  inside the existing fixed-step turn resolution with no new timing surface.
- **economy-and-progression**: reaction damage/buffs are battle-scoped state
  on `TurnBuffPool` (not persisted, INV-4 precedent); no reward/cost path.
- **pinia-phaser-sync**: verified zero `'reaction'` listeners exist in
  `game/src/game/**`, `components/**`, `composables/**` (grep count 0) — the
  newly-firing event has no presentation consumer, so no Phaser lifecycle
  surface changes. Confirmed no dormant VFX becomes reachable (plan's
  escalation condition not met).
- **combat-and-tribulation**: primary domain, reviewed in depth below.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
|---|---|---|---|---|---|---|---|
| INV-A1-1 | `TurnReactionManager` consume branches | Reaction fires on pair match | Exactly-once: at most 1 reaction per `checkAndTrigger` call; both sides consumed | Repeat (`bong`+`te_cong`, reverse order) | HP delta exact (70), pool empty, 1 event | Unit (ported suite, 15 tests) | High |
| INV-A1-2 | Same, `appliesAilmentId` branch | Dung Nham/Trói Chân/Huyết Độc | Atomicity: both sources removed exactly when the new ailment is added | Value mutation (each shape) | `getActiveIds()` exact contents | Unit | High |
| INV-A1-3 | `maxHpReductionPercent` (Thiêu Huyết) | Repeated reactions | Boundedness: cumulative reduction capped at 30%; `maxHp` never < 1 | Repeat at cap boundary (0.29 pre-set) | cap 0.30, maxHp ×0.99 | Unit (ported cap test) | High |
| INV-A1-4 | `keepsAilmentId` branch | Water extension stat present/absent | Determinism of consume vs keep | Value mutation (`waterReactionExtensionSeconds` 0 vs 1) | kept id present vs both removed | Unit (2 ported tests) | Medium |
| INV-A1-5 | `appliesBuffId` branch (Độc Thế) | Reaction with `sourceBuffs` | Targeting: buff lands on SOURCE pool, not target | Stale state (wrong pool) | source modifiers exact (2 entries) | Unit (ported) | Medium |
| INV-A1-6 | `TurnBattleSystem` ailment hook | Skill with `appliesAilment` hits | Chance gate: applies iff roll < chance; no registry → no throw, no apply | Value mutation (chance 1 / 0 / registry absent) | pool `hasAny` true/false; no throw | Unit (3 new tests) | High |
| INV-A1-7 | Per-target loop, AOE hits | Multi-target skill with `appliesAilment` | Conservation: each hit target gets its own independent roll (loop-scoped, not single-shot like `appliesBuff`) | Repeat (AOE shape) — *static inspection only, no AOE fixture in this task's tests* | per-target pool entries | Code inspection | Medium — coverage gap noted |
| INV-A1-8 | `GameManager` production wiring | Real stage battle, Pháp Tu fire basic | Wiring: real `TurnReactionManager` constructed at BOTH production call sites; `PHAP_TU_BASICS.fire` carries `appliesAilment` | Stale state (only test fixtures wire the manager) | End-to-end test drives real `PHAP_TU_BASICS.fire` + real registry → reaction event fires | Integration (Task 4 e2e test) | High (P13 class) |
| INV-A1-9 | Loop safety of `getActiveIds()` iteration | `removeInstance` during iteration | Recoverability: iteration over live pool must not skip/misfire | Reorder (remove inside loop) | ported tests pass — `TurnBuffPool.getAll()` returns a copy (`[...this.buffs]`), verified by read | Code inspection + unit | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| `npx vitest run` (full, worktree) | **2875/2875 pass, 437 files** | post-Task-4 |
| `npm run type-check` | 0 errors | every task |
| `npm run build` | ✓ built (exit 0) | Task 4 gate |
| `Playtest.continuousCombat.test.ts` (the one production-adjacent test that listens to `'reaction'`) | 1/1 pass | legacy-engine playtest unaffected by the turn port (separate systems, no shared runtime coupling) |
| Grep for `'reaction'` listeners in `game/src/game/**` + components + composables | 0 results | no presentation surface newly reachable → no P14 trigger |
| Legacy `ReactionManager.test.ts` | untouched, still passing (18/18 in full suite) | legacy engine behavior unchanged (A1 adds alongside, per C1 gating) |

## Findings

### Suspected (non-blocking)

1. **AOE multi-target ailment roll has no direct test** (INV-A1-7). The hook
   is correctly placed inside the per-target loop (same scope as
   `rollOnHitEffects`), so multi-target independence holds by construction,
   but no AOE-shaped fixture exercises it. Coverage gap — recommend an AOE
   fixture test when A4 content adds multi-target elemental skills.
2. **`waterReactionExtensionSeconds` semantics**: the spec's Component 1
   flagged this as a possible reduced-fidelity spot. Implementation-time
   check: `getSkillRuntimeStat(source, ...)` + `source.skillStats` work
   identically for turn-based `CombatEntity` (already used by
   `TurnBuffSystem.resolveMaxStacks`), and the ported keep/extend tests pass
   unchanged — the degraded fallback is NOT needed; fidelity is full. The
   unit is named `Seconds` but the turn policy preserves the number as turns
   (locked conversion policy); renamed nothing (P10 — field is shared with
   the legacy engine).

### Confirmed: none.

## New or Changed QA Tests

- `TurnReactionManager.test.ts` (15 tests) — full behavior port of the
  legacy suite minus the 2 spawnLavaZone-specific tests (parameter dropped
  by design); Dung Nham coverage merged into the base ailment-shape test.
- `TurnBuffSystem.test.ts` (+4) — getActiveIds/remove/renewWithExtension
  port coverage.
- `TurnBattleSystem.test.ts` (+4) — chance gate (1/0), registry-absent
  no-throw, and the real-content end-to-end Bốc Hơi proof through
  `PHAP_TU_BASICS.fire` + `TURN_BUFF_REGISTRY` + real `TurnReactionManager`.

## Gaps and Residual Risk

- AOE multi-target roll unexercised (Suspected #1 above) — bounded, no
  production data path hits it today (all 5 wired skills are single-target).
- `appliesBuff`-branch registry lookups remain unguarded by design (ids are
  compile-time-authored in `ElementReaction.ts` and verified resolving by
  the ported suite; boss-trigger's runtime-data risk does not apply here —
  the reaction table is static data, not content-authored participant state).

## Pre-existing Failures

None — full suite green before and after on this branch.
