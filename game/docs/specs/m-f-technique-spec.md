# M-F-TECHNIQUE — Technique Frozen-Cycle Model — Spec

Status: v1 — draft (worker-authored, pending C2C spec review)
Depends on: M-QI-06 (authored technique gates + `techniqueProgress`
mirror — merged on `p7/truc-co`), realm-18 landings (REALM18 — all
major realms run realmLevel 1..18), M-F-CEILING (release policy).

Mission-graph scope: F4 (per-grade frozen-cycle progression model) +
F5 (technique→node gate semantics under the model) + F-BREAK-CONFIRM
(unperfected breakthrough warning).

Not in scope: authored node-gate placement or re-tuning beyond the
M-QI-06 proving set (content pass — M-F-CONTENT-TC), mastery cost /
inheritance coefficient values (balance pass), UI redesign, save
migration (dev-phase convention: bump = reject, no translator).

## 1. Intent

The technique progression model becomes a **per-grade rank cycle**
(frozen-cycle model):

- The rank ladder is `0..18` (was `0..10`; `TECHNIQUE_RANK_CAP 10 → 18`).
- While the live grade equals the current major-realm band
  (`technique.grade == getRealmIndex(player.realmId)`), the trainable
  rank ceiling follows the minor realm level:
  `rankCeiling = min(18, player.realmLevel)`. Reaching rank 18 requires
  realmLevel 18 — perfection is only reachable at the realm's summit.
- **Realm exit freezes the live cycle.** When the player's major realm
  advances past the live grade's band, that cycle seals into per-grade
  frozen history `{finalRank, completionState}` and rank training stops
  until a manual grade-up.
- `completionState` = `resolveTechniqueCompletionState(finalRank,
  realmLevelAtFreeze)`: `vien_man` iff `finalRank == 18`; `dai_thanh`
  iff `finalRank == realmLevelAtFreeze` (the achievable ceiling at
  freeze — the player trained as far as that realm could go) and
  `finalRank > 0`; `partial` otherwise. The stay-vs-advance tension is
  preserved: `CORE_REALM_LEVEL = 12` admits tribulation at realmLevel
  12, so exiting before 18 forecloses vien_man permanently.
- **Manual grade-up transaction**: the only way to advance the live
  grade; legal iff `technique.grade < getRealmIndex(player.realmId)`
  (catch-up into the current band — the band cap cannot exceed the
  realm index, so a grade can only lag its band *after* a freeze;
  the old `rank >= CAP` precondition is dead and must not deadlock
  unperfected freezes). The transaction preserves frozen history and
  build, applies the inheritance scaffold, and starts the new cycle at
  `rank 0 / mastery 0`. Sequential catch-up is allowed (grade 1→2→3
  through a skipped band); the skipped cycle's record seals at its own
  `finalRank 0 / partial` and stays untrainable forever.
- **Rank training is disabled whenever the live grade sits below the
  current realm band** (`rankCeiling = 0`): a frozen or skipped cycle
  cannot train.
- **Inheritance scaffold is monotonic and never grants Rank**: the
  grade-up result is a function `computeGradeInheritance(outcome)` of
  the sealed outgoing record, monotonic nondecreasing in
  `(finalRank, completionState)`, whose application never raises
  `rank`/`mastery` above 0 on the new cycle. Authored carry-over values
  are deferred to a balance pass; the seam and its monotonicity
  contract land now.
- **The breakthrough confirm surface warns when the live cycle would
  freeze unperfected** (projected completionState ≠ vien_man).

## 2. Canonical state

`Technique` gains one persisted field:

```ts
interface TechniqueCycleOutcome {
  finalRank: number;                                  // integer 0..18
  completionState: 'partial' | 'dai_thanh' | 'vien_man';
}

// on Technique:
gradeHistory: Record<number, TechniqueCycleOutcome>;  // grade -> sealed outcome
```

- `gradeHistory` is authored `{}` on every template and initialized on
  grant; it is canonical technique-scoped state — it persists inside
  the technique holder entry (same clone-on-restore seam as
  `grade`/`rank`/`mastery`) and is never republished to
  `player.techniqueProgress` (the mirror stays the live cycle's
  `{rank, grade}` only).
- Record keys are integer grades `>= 1` and `<= technique.grade` (a
  record for a grade above the live grade is corrupt). A record key
  equal to the live grade means that cycle is already frozen and
  awaiting catch-up.
- Sealed records are **immutable**: every seal site is write-if-absent
  and never overwrites an existing record.

## 3. Ceiling + training contract

```ts
getTechniqueRankCeiling(technique, realmId, realmLevel): number
// = technique.grade == getRealmIndex(realmId) ? min(18, realmLevel) : 0

resolveTechniqueCompletionState(finalRank, realmLevelAtFreeze):
  'vien_man' | 'dai_thanh' | 'partial'
// vien_man iff finalRank == 18; dai_thanh iff finalRank ==
// realmLevelAtFreeze > 0; else partial
```

- `gainMastery(amount, realmId, realmLevel)`: cascade threshold
  unchanged (`300 * grade` per rank); ranks clamp at the effective
  ceiling for the cycle; mastery consumed only up to `needed` and
  remainder discarded — same convention as the old at-cap discard (no
  banking past the ceiling). At ceiling 0 (frozen/skipped cycle) `gained = 0`
  and the whole settle amount is discarded.
- `BattleLootSystem.settleTechniqueMastery` passes
  `this.player.realmId`/`realmLevel` (already available via
  `setSession`) into `gainMastery` — the realm context enters at the
  settle seam, not inside the cascade.
- Display bands rescale to the 18-rank ladder
  (`getTechniqueTierForRank`): `0 | 1-4 | 5-9 | 10-18` — proportional
  to the legacy `0 | 1-2 | 3-5 | 6-10` envelope. (C2C flag: alternative
  uniform thirds `0 | 1-5 | 6-11 | 12-18`; mechanics identical, labels
  only.)
- `getTechniqueEffects(technique)` band lookup is unchanged in shape —
  the rescaled bands mechanically move effect tiers; authored
  gradeEffects tables are untouched.

## 4. Freeze seam

- `TribulationOutcomeService.resolveVictory` is the only major-realm
  write seam (`player.realmId = targetRealmId; realmLevel = 1` at
  ~:201-203). BEFORE that write (the departing `player.realmLevel` is
  needed for `dai_thanh` evaluation — post-write it is already 1) it
  calls `realmAdvanceOps.applyTechniqueRealmTransition(player,
  targetRealmId)` (naming mirrors `applySwordPathRealmTransition`),
  which seals the live cycle into `gradeHistory` iff
  `getRealmIndex(targetRealmId) > technique.grade`, evaluating
  `completionState` against the departing realmLevel. Idempotent:
  write-if-absent; a repeated call after the grade has caught up is a
  no-op.
- `chooseCultivationPath` (mortal→LQ initiation) needs no call: the
  technique is granted after the promotion write, so there is nothing
  to freeze; the transition helper is defensive no-op anyway.
- `BreakthroughOutcomeService.breakthrough` never crosses a major
  realm (minor realmLevel only) — no freeze; it only raises the
  ceiling.

## 5. Grade-up transaction

`tryAdvanceTechniqueGrade` (GameManagerRealmAdvanceOps) reworked:

- Preconditions: `grade < getRealmIndex(realmId)` (replaces
  `canAdvanceTechniqueGrade`'s `rank >= CAP` arm — the ceiling check on
  the realm side is unchanged), outside combat (existing guard), cost
  paid via the existing material channel (100 × targetGrade current-tier
  spirit stones — values unchanged).
- Effects, in order:
  1. Seal the outgoing cycle write-if-absent: `gradeHistory[grade] =
     {finalRank: rank, completionState}`. This is defensive — the
     realm-exit seam always sealed the cycle before `grade < realmIndex`
     became legal, so the record already exists under v75. The
     defensive path cannot recover the departing realmLevel: it records
     `vien_man` iff `finalRank == 18`, else `partial` (never claims
     `dai_thanh` on an unrecoverable ceiling). Unreachable under v75;
     conservative by construction.
  2. `grade += 1`; `rank = 0`; `mastery = 0`.
  3. Build preserved verbatim: `quality` (the only mutable build axis)
     and template identity (`gradeEffects`, `combatModifiers`,
     way/slot binding) pass through untouched.
  4. Inheritance scaffold: `computeGradeInheritance(outcome)` returns a
     typed `TechniqueGradeInheritance` payload (currently zero-valued —
     authored coefficients deferred) applied to the new cycle; contract:
     monotonic nondecreasing in the outgoing record, never grants rank
     or mastery.
  5. Mirror republished (`{rank 0, grade+1}`) via the existing sink.
- Catch-up through a skipped band: each advance seals the outgoing
  cycle at its actual `finalRank` (0 for a never-trained cycle) — so
  grade-2 skipped during a KD catch-up records `finalRank 0 / partial`.
- `canAdvanceTechniqueGrade` becomes the catch-up check
  `grade >= 1 && grade < getRealmIndex(realmId)` (grade ≥ ceiling side
  impossible by construction since ceiling = realm index; kept as a
  defensive guard).

## 6. Breakthrough confirm — unperfected warning

`BreakthroughRequirementPanel` gains a second warning block beside the
existing `stillEquipped` one:

- Read-model: `projectTechniqueCompletion(technique, realmLevel)` →
  the `TechniqueCycleOutcome` the live cycle would seal *now*:
  `resolveTechniqueCompletionState(rank, realmLevel)` for a live
  in-band cycle (`rank < realmLevel` projects `partial` — dai_thanh
  remains achievable before exit); a cycle already frozen (record
  exists for the live grade) returns its sealed record verbatim.
- The panel renders the warning iff a technique is held and projected
  `completionState !== 'vien_man'` — i.e., live rank < 18, or an
  already-sealed unperfected record. Copy names the grade and the
  projected outcome (en + vi keys under the tribulation namespace).
- Pure confirm copy — no blocking, no second confirm; the player may
  breakthrough unperfected (that is the tradeoff the warning makes
  legible).

## 7. F5 — node-gate semantics under the frozen model

Semantics only — no new authored gates, no re-tuning of the M-QI-06
proving set (thresholds 3/4/5/6 stay; re-tuning is M-F-CONTENT-TC):

- `techniqueRank` / `techniqueGrade` prerequisites evaluate the **live
  cycle's** mirror `player.techniqueProgress.{rank,grade}` — frozen
  history is never a gate input. A past cycle's rank never satisfies a
  gate.
- `levelGates` evaluate at upgrade time against the current mirror.
  After grade-up resets the live rank to 0, rank-gated upgrades
  re-block until the new cycle trains back; owned levels above the
  effective cap remain legal frozen surplus (M-QI-06 §5 contract
  unchanged: aggregators keep counting owned levels; `purchaseNode`
  unaffected).
- `techniqueGrade` gates read the live grade, which is monotonic
  nondecreasing across catch-up (grade never decreases).
- The `NodePrerequisite` kind docstrings in `ProgressionNode.ts` are
  updated to pin current-cycle semantics explicitly (doc/types delta).

## 8. Save contract

- `CURRENT_SAVE_VERSION 74 → 75`; old saves rejected per convention
  (dev phase — no migration, no compat translator).
- Preflight (`preflightSaveRegistryReferences`) extended: `gradeHistory`
  required; keys integer grades `1..live grade`; each record
  `finalRank` integer `0..18`, `completionState` in the enum; `rank`
  `0..18`; `grade` `1..getTechniqueGradeCeiling(realmId)` (unchanged);
  mastery invariants unchanged in form (`mastery >= 0`, `rank == 18 →
  mastery == 0`, `rank < 18 → mastery < cost(grade)`). History-vs-live
  coherence beyond shape is deliberately unenforced (mirror precedent).

## 9. Consistency invariants

- A technique is held iff the player is in a major realm ≥ 1 and has
  initiated — `0-or-1` holder, way-bound (unchanged).
- `0 <= rank <= 18`; `mastery >= 0`; `rank == 18 → mastery == 0`.
- `gradeHistory` keys ≤ live grade; sealed records immutable
  (write-if-absent everywhere).
- Grade ≤ realm index; grade-up is the only grade mutation; rank/mastery
  reset only inside the grade-up transaction.
- `player.techniqueProgress` mirror always equals the live
  `{rank, grade}` — republished on every mutation (unchanged authority).
- Node gates never read `gradeHistory`.

## 10. Out of scope (restated)

- Any authored techniqueRank/techniqueGrade gate placement or re-tuning
  (M-F-CONTENT-TC owns the gate map for the 18-rank envelope).
- Mastery cost curve, grade-up material cost, inheritance coefficient
  values (balance pass).
- UI redesign beyond the single warning block.
- Save migration.

## 11. Acceptance

| # | Acceptance |
|---|---|
| A1 | Rank ladder 0..18; in-band ceiling = min(18, realmLevel); mastery trains past old cap 10 and clamps at the effective ceiling. |
| A2 | Realm exit seals `{finalRank, completionState}` into `gradeHistory`; post-exit `gainMastery` gains 0 while `grade < realmIndex`. |
| A3 | Grade-up preserves history + quality, resets rank/mastery to 0, republishes mirror; catch-up 1→2→3 seals skipped cycle at `finalRank 0 / partial`; sealed cycles untrainable. |
| A4 | Inheritance scaffold: `computeGradeInheritance` monotonic in the outgoing record, applied result never raises rank/mastery. |
| A5 | Breakthrough confirm renders unperfected warning iff projected ≠ vien_man; vien_man (rank 18) renders no warning. |
| A6 | Gates read live cycle only: post-grade-up rank-0 re-blocks rank-gated upgrades; owned surplus stays owned. |
| A7 | Save v74→75; v74 saves rejected; preflight validates `gradeHistory` shape + 18-cap invariants. |
| A8 | Freeze + settle are idempotent: repeated realm-exit/advance calls never duplicate or overwrite records. |
