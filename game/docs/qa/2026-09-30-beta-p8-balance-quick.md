# QA Review: beta-p8-balance (boss pacing retune + grind-loop/seeded-drive harness)

- Date: 2026-09-30
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths:
  - game/src/data/enemy/MortalEnemies.ts
  - game/src/data/enemy/FoundationEnemies.ts
  - game/src/data/enemy/Enemies.test.ts
  - game/src/core/simulation/earlygame/EarlyGameLoop.ts
  - game/src/core/simulation/earlygame/EarlyGameSession.ts
  - game/src/core/simulation/earlygame/EarlyGameSession.test.ts
  - game/src/core/simulation/earlygame/ElementBossMatrix.test.ts (new)
  - game/src/core/simulation/earlygame/EssenceSubstitutionEconomy.ts

## Scope and Risk Map

changed-risk-map.mjs routed `MortalEnemies.ts` / `FoundationEnemies.ts` to
`combat-and-tribulation` (one-hop: combat presentation/controls; loot,
progression, persistence after combat). deepAuditCandidate: false.

unmappedPaths (all `core/simulation/earlygame` sim/test infrastructure):
inspected directly — `EarlyGameSession`, `EarlyGameLoop`,
`EssenceSubstitutionEconomy`, `ElementBossMatrix.test.ts`, and
`EarlyGameSession.test.ts` have no gameplay-path importers
(`EssenceSubstitutionEconomy` carries the "nothing on the gameplay path may
import it" header). Risk is bounded to test determinism, not runtime —
no deep escalation needed on that axis.

The two production-data files are pure stat edits: boss *species* inputs
point-tuned for the floor-10 solo-boss-variant window, plus mortal-band
wolf/boar softening landed earlier in the branch. No drop-table, affix,
skill, or system code changed.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-P8-01 | ENEMIES species stats / data catalog | Retuned serpent + whelp species inputs | Conservation: retuning a boss species must not nerf a normal-floor spawn of the same id | Cross-system chain: species reuse across pools | `roster.normals` lists contain neither boss id; `roster.boss` only (Stages.ts:50,118) | Source inspection | High impact, high reach if fired |
| INV-P8-02 | Floor-10 encounter | applyBossMultiplier(retuned species) | Boundedness: variant stays inside the legal-build output window | Value mutation: retuned inputs through x7/x2/x1.2/+15res | 15-cell matrix runtime: all victories, turns 12-43, bossHpLeft=0 | Deterministic vitest | High |
| INV-P8-03 | Whelp enemy definition | foundationBeast -> literal defineEnemy | Atomicity: conversion must not drop factory-emitted fields | Reorder/omission | Field-by-field compare: phases, enrage, bossTrigger, specialAttacks, signatureDrops, rewards(mastery 100 / stone 28 = t10 formula), speed 1.2 all preserved | Source inspection + Enemies.test.ts | High |
| INV-P8-04 | CANONICAL_EARLY_LOOP | +grind_to_level before tribulation | Cross-consumer slicing must stay coherent | Reorder: 3 loop consumers slice by index | EssenceSubstitutionEconomy slice(0, ritualIndex-1) and PerfectionEconomy slice(0, tribulationIndex) now include the grind step inside the mortal prefix; semantics identical (manual grind after each is a no-op). Suite green | Existing sim suites | Medium |
| INV-P8-05 | equipAll gear selection | best-per-slot bucket + canUseItemGrade gate | Old sorted-equip let the LAST (weakest) item win a slot | Stale state: occupied-slot overwrite | Matrix `eq=6` on every cell; strongest legal item per slot equipped | Sim suite | Medium (sim-only surface) |
| INV-P8-06 | Drive determinism | measureBandResidency twice per seed | Determinism: same seed -> same measurement | Repeat | Was 570 vs 557 kills (unseeded equipment rolls tip borderline battles); after drive-scoped seeded Math.random: identical runs, suite green | EssenceSubstitutionEconomy.test.ts | High |
| INV-P8-07 | Enemies.test.ts assert | species-ordered -> variant-encounter-ordered | The floor-10 encounter must remain the chapter's hardest fight | Oracle strength | Variant hp > t9 species hp AND > every other foundation species; resists sum strictly greater | Enemies.test.ts | Medium |
| INV-P8-08 | Matrix coverage | one seed per cell, curated gear | The "defeatable" claim holds beyond the pinned seed | Value mutation: seed sweep | Wood x serpent swept 4/4 seeds at final tuning during development; other cells carry visible margins (turns <= 43 of a 60-turn enrage budget) | Dev-time probe (deleted) | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | clean | Full vue-tsc build, zero errors |
| `npx vitest run src/data/enemy src/data/stage src/data/quest/quests.betaRoster.qa.test.ts src/core/simulation/earlygame src/stores/player.ngoDao.test.ts` | 18 files / 144 tests green | Includes matrix (15/15), EarlyGameSession (8/8), EssenceSubstitutionEconomy (8/8), Enemies (12/12) |
| Boss species usage grep (`Stages.ts`, zones, pools) | `roster.boss` only, never `normals` | Species stats are consumed solely via the floor-10 boss variant |
| `measureBandResidency(11)` twice | kills identical after seeded-drive fix | Was 570 vs 557 before fix |
| Wood x serpent seed sweep (dev probe) | 4/4 victory at final tuning (seeds 1021/2021/3021/4021) | Probe deleted; not encoded in suite |
| `foundationBeast` field emission vs literal | All fields preserved; rewards match t=10 formula (mastery 100, stone 28) | Diff reviewed field-by-field |
| Canonical loop end-to-end | `failedAt: null`, all 10 dong floors + qi_refining_forest cleared, cultivationPath=spell | Loop report logged in test output |

## Findings

### QA-2026-09-30-P8-1: Enemies.test.ts `t10 > t9` species-ordering assert weakened to encounter-level invariants
- Severity: Low
- Status: Coverage gap (accepted narrowing)
- Invariant: boss encounters must be strictly harder than common-floor encounters
- Preconditions: whelp species point-tuned below the legacy t9 formula species on per-swing axes (variant might 70 < t9 128, defense 40.8 < 47)
- Reproduction: the original `t10.stats.might > t9.stats.might` fails by construction under point-tuning — species inputs are tuned per fight window, not globally ordered
- Expected: assert what the player faces (the boss variant), preserving a real ordering check
- Actual: rewritten to variant-vs-chapter invariants (deepest hp pool in the foundation chapter + strictly greater resistance sum); per-swing might/defense ordering intentionally not asserted
- Evidence: Enemies.test.ts lines 86-113; variant math (x7 hp, x1.2 armor, +15 all-element resists) guarantees the encounter ordering on the axes that scale the fight
- Test file: src/data/enemy/Enemies.test.ts (edited)
- Owner subsystem: data/enemy
- Blast radius: a future regression that lowers ONLY per-swing variant might/defense would not be caught by this test; hp/resists regression still caught

### QA-2026-09-30-P8-2: ElementBossMatrix pins one seed per cell and a curated gear plan
- Severity: Low
- Status: Coverage gap
- Invariant: "each element beats each Act boss at the intended point"
- Preconditions: matrix cells are deterministic by construction (seeded battle + loot streams)
- Reproduction: wood x serpent at species hp 400/might 19 loses at seeds 2021/3021/4021 before the final tuning step (hp 350/might 19 -> 4/4 victory)
- Expected: the final tuning carries seed margin; spot-sweep evidence exists but only the pinned seed is encoded
- Actual: 15/15 cells pass at pinned seeds; margins observed are real (boss dead 17-23 turns before the 60-turn enrage on the tightest cells)
- Evidence: matrix output per cell (turns 12-43); dev-time sweep results
- Test file: none (the matrix itself is the artifact)
- Owner subsystem: core/simulation/earlygame
- Blast radius: a future tuning change could flip a marginal cell silently until the next matrix run — inherent to deterministic pinning, mitigated by the visible margins

## New or Changed QA Tests

- `src/core/simulation/earlygame/ElementBossMatrix.test.ts` (new, 15 cells): deterministic per-cell victory assertions across 5 elements x 3 Act bosses at legal progression points
- `src/data/enemy/Enemies.test.ts` (1 assert rewritten): encounter-level boss ordering instead of stale raw-species ordering
- `src/core/simulation/earlygame/EarlyGameSession.test.ts` (canonical-loop asserts flipped per committed TODO): `failedAt -> null`, `cultivationPath === 'spell'`, `qi_refining_forest` completed — encodes the grind loop converging
- `src/core/simulation/earlygame/EssenceSubstitutionEconomy.ts`: drive-scoped seeded Math.random restores the same-seed measurement contract the tuned battles broke (production loot stays unpinned by the battle rng; the economy stream is a separate salt)

## Gaps and Residual Risk

- Single-seed-per-cell matrix pinning (QA-2026-09-30-P8-2) — bounded: margins measured, tightest cell swept 4/4.
- Variant-axis coverage narrowing (QA-2026-09-30-P8-1) — accepted: the meaningful fight invariants (hp pool depth, resist bonus, enrage/phases/specials) remain asserted.
- The matrix "realistic beta build" is the curated best-legal gear plan (6 slots, dia quality, +5/+8 enhance); a worse-roll player covers the gap through the grind loop — repetition is the mechanic by design.
- Non-task-owned exclusions: none — every dirty path in the worktree is task-owned.

## Pre-existing Failures

- `EssenceSubstitutionEconomy` same-seed non-determinism existed on the base branch (unseeded equipment rolls, ~2.1k Math.random draws per drive) but was invisible because no battle outcome was marginal enough to flip kill counts. Phase-8 tuning exposed it; fixed inside the task diff (drive-scoped seeded stream) — recorded here because the defect predates this task's data edits.
