# M-F-TECHNIQUE — Technique Frozen-Cycle Model — plan

Spec: `game/docs/specs/m-f-technique-spec.md` (v1 — pending C2C spec
review). Implements F4 (per-grade frozen-cycle model: rank 0..18,
realmLevel-scaled ceiling, frozen per-grade history, grade-up catch-up
transaction) + F5 (node-gate semantics read the live cycle) +
F-BREAK-CONFIRM (unperfected breakthrough warning). Scope limits per
ruling: no authored gate placement/re-tuning (M-F-CONTENT-TC), no
cost/inheritance coefficients (balance pass), no UI redesign, no
migration (v75 rejects old saves).

Phase 1 delivered docs only; Phase 2 begins after C2C spec + plan
gates pass.

## Step 0 — seam census (done during spec)

- `core/technique/TechniqueProgression.ts`: owns `TECHNIQUE_RANK_CAP`
  (10→18), `getTechniqueMasteryForNextRank` (300×grade — unchanged),
  `getTechniqueTierForRank` (band rescale to `0|1-4|5-9|10-18`),
  `getTechniqueGradeCeiling = getRealmIndex` (unchanged),
  `canAdvanceTechniqueGrade` (reworked to catch-up check),
  `getTechniqueGradeUpgradeCost` (unchanged). New pure helpers live
  here: `getTechniqueRankCeiling`, `resolveTechniqueCompletionState`,
  `projectTechniqueCompletion`, `computeTechniqueGradeInheritance`.
- `core/technique/Technique.ts`: interface gains required
  `gradeHistory: Record<number, TechniqueCycleOutcome>`; type
  `TechniqueCycleOutcome` + `TechniqueCompletionState` +
  `TechniqueGradeInheritance` authored beside it.
- `core/technique/TechniqueSystem.ts`: owns the live-cycle invariants —
  `gainMastery(amount, realmId, realmLevel)` clamps cascade at the
  effective ceiling and discards overflow (existing convention);
  `advanceTechniqueGrade()` becomes the seal+advance transaction
  (write-if-absent record, grade+1, rank/mastery 0, build preserved,
  inheritance applied, mirror republished); new
  `sealFrozenCycle(newRealmId, departedRealmLevel)` seals when
  `getRealmIndex(newRealmId) > grade` (departed level feeds
  `resolveTechniqueCompletionState`); `grant` initializes
  `gradeHistory: {}`. `progressSink` mirror unchanged
  (`{rank, grade}` live cycle only).
- `data/technique/Techniques.ts`: all 6 templates add
  `gradeHistory: {}` — clone-on-grant carries it.
- `core/tribulation/TribulationOutcomeService.ts:~201`: THE major-realm
  write seam — BEFORE `player.realmId = facts.targetRealmId;
  realmLevel = 1` it calls
  `realmAdvanceOps.applyTechniqueRealmTransition(player,
  facts.targetRealmId)` (naming mirrors
  `applySwordPathRealmTransition`; placed before the write because the
  departing `player.realmLevel` is the freeze-time ceiling for
  `dai_thanh`), which delegates to `sealFrozenCycle`. The qi_refining
  announcement-only early return is untouched. `chooseCultivationPath`
  needs no call (technique granted after the realm write).
  `BreakthroughOutcomeService` never crosses realms — no seam.
- `core/game/GameManagerRealmAdvanceOps.ts:~399`:
  `tryAdvanceTechniqueGrade` — preconditions become
  `grade < getRealmIndex(realmId)` + combat guard + material spend
  (existing `getTechniqueGradeUpgradeCost` channel unchanged), then the
  transaction; new `applyTechniqueRealmTransition(player,
  targetRealmId)` alongside it.
- `core/game/BattleLootSystem.ts:~189` `settleTechniqueMastery`:
  passes `this.player.realmId`/`realmLevel` (already available via
  `setSession`) into `gainMastery`. Realm context enters at the settle
  seam — the cascade never reaches for player state itself.
- `services/save/saveVersion.ts`: `CURRENT_SAVE_VERSION 74 → 75`
  (reject-old convention, no translator).
- `core/game/GameManagerSaveRestore.ts:~165` preflight: `gradeHistory`
  required; per-record shape (`finalRank` int `0..18`,
  `completionState` enum) + canonical key-set coherence — keys exactly
  `{1..grade-1}` ∪ (`{grade}` iff `grade < realmIndex`): every
  superseded grade sealed, lagging live grade sealed, in-band live
  grade carries no record; `rank 0..CAP` reads the new 18;
  `techniqueProgress` mirror block in `saveShapeValidation.ts`
  unchanged (live-cycle mirror only).
- `components/common/BreakthroughRequirementPanel.vue`: gains the
  unperfected warning block beside `stillEquipped` — reads
  `projectTechniqueCompletion` via gameManager access; en + vi keys
  under the tribulation i18n namespace.
- `core/progression/NodeSystem.ts`: `techniqueRank` evaluation routes
  through `getEffectiveTechniqueRank(progress, realmId)` — effective
  rank 0 while the live grade lags the realm (sealed-cycle rank never
  gates, frozen-before-grade-up window included); `techniqueGrade`
  reads live grade unchanged; `NodePrerequisite` kind docstrings in
  `ProgressionNode.ts` pin the effective-rank rule + frozen-surplus
  legality (M-QI-06 §5 contract already designed for this).
- No consumer of `gainMastery` exists outside BattleLootSystem and
  tests — signature widening is contained.

## Step 1 — TDD failing tests first

1. `TechniqueProgression.test.ts` (extend): `TECHNIQUE_RANK_CAP === 18`;
   `getTechniqueTierForRank` new bands at 0/1-4/5-9/10-18;
   `getTechniqueRankCeiling` in-band = min(18, realmLevel), off-band = 0;
   `resolveTechniqueCompletionState(finalRank, realmLevelAtFreeze)`
   partial/dai_thanh/vien_man at the 12-18 boundary (exit at
   realmLevel 12 with rank 12 → dai_thanh; rank < 12 → partial;
   vien_man only at rank 18); `projectTechniqueCompletion` returns the
   sealed record verbatim when present else projects live;
   `computeTechniqueGradeInheritance` monotonic under the pinned order
   (`partial < dai_thanh < vien_man`, componentwise on
   (finalRank, state) — higher rank at equal state or better state at
   equal rank never reduces output) and never grants rank;
   `getEffectiveTechniqueRank` = progress.rank in-band, 0 when
   lagging.
2. `TechniqueSystem.test.ts` (extend): `gainMastery` clamps at
   realmLevel ceiling, gains past old cap 10, overflow discarded,
   off-band (grade < realmIndex) gains 0; `sealFrozenCycle` writes the
   record write-if-absent and is idempotent on repeat calls and on
   already-caught-up grade; `advanceTechniqueGrade` seals outgoing
   cycle, preserves quality/template, resets rank/mastery, applies
   inheritance, republishes mirror `{rank 0, grade+1}`; catch-up
   1→2→3 seals skipped grade at `finalRank 0/partial`, skipped cycle
   remains untrainable.
3. `TribulationOutcomeService.test.ts` (extend): `resolveVictory` major
   breakthrough seals the live cycle into `gradeHistory` at the
   realm-write seam (assert record + post-exit `gainMastery` gains 0);
   qi_refining announcement path does not write records.
4. `GameManager.techniqueProgress.test.ts` (extend):
   `tryAdvanceTechniqueGrade` legal iff `grade < realmIndex` — rejects
   at-parity, rejects in-combat, debits the authored cost, runs the
   full transaction; old `rank >= CAP` precondition is gone; defensive
   write-if-absent seal on a live record records partial (never
   dai_thanh) — unreachable under v75, exercised directly.
5. `BreakthroughRequirementPanel.test.ts` (extend): warning renders iff
   a held technique projects `!= vien_man`; rank-18 renders none;
   already-sealed unperfected record warns; no technique = no warning.
6. `GameManagerSaveRestore`/save-shape tests (extend): v75 round-trips
   `gradeHistory`; malformed records (key > grade, rank > 18, bad enum,
   missing field) reject; key-set coherence rejects (missing record
   for grade < live grade, live-grade record while in-band, lagging
   without live-grade record); v74 payload rejected.
7. `TechniqueGateAuthored.test.ts` (extend): frozen/lagging window —
   rank gates read effective rank 0 while grade < realmIndex (sealed
   rank-9 cycle fails a rank-5 gate); post-grade-up rank-0 re-blocks
   upgrades; grade gates read live grade unchanged; owned surplus
   levels stay owned and aggregating (M-QI-06 contract under the new
   model).
8. `BattleLootSystem.techniqueMastery.test.ts` (extend): settle passes
   realm context; off-band settle discards and reports gained 0;
   pending flush unchanged.

## Step 2 — model + pure helpers

- `Technique.ts`: `TechniqueCompletionState`, `TechniqueCycleOutcome`,
  `TechniqueGradeInheritance`, `Technique.gradeHistory` (required).
- `TechniqueProgression.ts`: cap 18; band rescale;
  `getTechniqueRankCeiling(technique, realmId, realmLevel)`;
  `resolveTechniqueCompletionState(finalRank, realmLevelAtFreeze)`;
  `projectTechniqueCompletion(technique, realmLevel)`;
  `computeTechniqueGradeInheritance(outcome)` (zero-valued payload now —
  pinned order `partial < dai_thanh < vien_man`, componentwise
  monotonicity, coefficients deferred);
  `getEffectiveTechniqueRank(progress, realmId)`;
  `canAdvanceTechniqueGrade` → `grade >= 1 && grade < getRealmIndex(realmId)`.
- `Techniques.ts`: `gradeHistory: {}` on all templates.

## Step 3 — system transaction + freeze

- `TechniqueSystem.ts`: `gainMastery(amount, realmId, realmLevel)`
  ceiling-aware cascade; `sealFrozenCycle(newRealmId,
  departedRealmLevel)` write-if-absent; `advanceTechniqueGrade()` =
  defensive-seal (partial fallback) → grade+1 → rank/mastery 0 →
  build preserved → inheritance applied → mirror republish;
  `grant` initializes `gradeHistory`.
- `GameManagerRealmAdvanceOps.ts`: `tryAdvanceTechniqueGrade`
  preconditions + transaction call; `applyTechniqueRealmTransition(
  player, targetRealmId)`.
- `TribulationOutcomeService.ts`: call before the realm write only.
- `BattleLootSystem.ts`: settle passes realm context.
- Callers of `gainMastery` outside settle (tests/mocks) updated to the
  new signature — real caller inventory in census shows only settle +
  test harness.

## Step 4 — breakthrough warning + F5 docstrings

- `BreakthroughRequirementPanel.vue`: warning block keyed on
  `projectTechniqueCompletion(...) !== 'vien_man'` when a technique is
  held; en + vi i18n keys added beside `stillEquipped` entries; warn
  copy names grade + projected outcome (P16 via `useI18n`).
- `ProgressionNode.ts`: `techniqueRank` docstring pins effective-rank
  semantics (rank 0 while live grade lags the realm; mirror stays
  literal); `techniqueGrade` pins live-grade monotonicity; both note
  frozen-surplus legality (ASCII comments, P15).
- `NodeSystem.ts`: `techniqueRank` arm routes through
  `getEffectiveTechniqueRank(progress, realmId)`.

## Step 5 — save contract

- `saveVersion.ts` → 75 + changelog comment per convention.
- `GameManagerSaveRestore.preflightSaveRegistryReferences`:
  `gradeHistory` validation per spec §8 (required field, per-record
  shape, canonical key-set coherence — `{1..grade-1}` sealed +
  `{grade}` iff lagging); CAP references read 18.
- Confirm `saveShapeValidation.ts` `techniqueProgress` mirror block
  needs no change (still `{rank, grade}`).

## Step 6 — gates

- P3: quick `npm run type-check` + `npx vitest run <technique|tribulation|save|node-gate scopes>`;
  escalate to `npm run verify` (full) — economy/progression + save-shape
  touch (P3 trigger).
- E3 simplify → P18 OCR (delegation mode) → P4 adversarial QA
  (progression/persistence vectors — deep if quick QA flags breadth) →
  P5 sequential ≥ 3 passes with per-pass evidence blocks → commit +
  push + PR base `p7/truc-co`.
- P14 likely triggers (new warning block in a Vue modal) — Playwright
  pass on the confirm surface inside the checkout.
- P15 ASCII scan on new comments; i18n keys en + vi.
- No P13 wiring trigger: no GameManager.update/boot/lifecycle path
  changed — settle seam is an existing channel.
- Report to coordinator: branch, files, per-gate evidence, limitations.

## Per-delta acceptance map

| Delta | Spec § | Plan step | Acceptance test |
|---|---|---|---|
| 1 — state + ceiling + gainMastery | §2, §3 | 2, 3 | A1 |
| 2 — grade-up transaction | §5 | 3 | A3, A4 |
| 3 — unperfected warning | §6 | 4 | A5 |
| 4 — save bump | §8 | 5 | A7 |
| 5 — F5 gate semantics | §7 | 2, 4 | A6 |
| 6 — tests | §11 | 1 | A1-A8 |
| freeze seam | §4 | 3 | A2, A8 |
