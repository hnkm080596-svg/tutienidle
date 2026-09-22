# P7 M-QI-07 — Physique Transformation Authority — Spec

Status: v4 (resolves r3 finding; MQI07_SPEC_REVIEWED, round 4)
Depends on: P7-M5 (unified BodyProgression chapter authority — merged),
P7-M-F (base-stat chapter kind — merged), QI-D4 + QI-D4b + QI-D4d + QI-S
(decisions.md:156-203).
Mission-graph scope: persisted `physiqueGrade`; the 6/6 Body-Refinement
chapter-completion transform transaction; 10-rung ladder data; display
read-model. No stat bonuses (QI-D4d — deferred). No migration (QI-S —
version bump rejects old saves).

## 1. Intent

F8 (recorded in `decisions.md` QI-D4 + `mission-graph.md` M-QI-07):
"normal Body progression controls Physique; one full authored normal
chapter → exactly one grade; perfection is a separate axis; never
derive from realm or essence band." Today **no physique field or
system exists**
anywhere — the Luyện Thể chapter completes 6 tiers and records nothing
about the player's Thể Phách, and the M-QI-08 essence economy (Tinh Hoa
`<Grade>` Thể bands, downward substitution) has no grade identity to
resolve against.

QI-D4 pins the contract: physique transforms **exactly once** when the
associated 6-tier Body Refinement chapter reaches 6/6; the transaction
is persistent, deterministic, and idempotent; late completion (e.g.
finishing Mortal Luyện Thể after advancing to Luyện Khí, which
`isTierRequiredRealmLevelMet` already allows) still triggers it.

## 2. Decision — grade-as-proof, no separate transform flag

Two persisted shapes were considered:

| Shape | Semantics |
|---|---|
| A. `player.physiqueGrade` only; transform = write next rung at completion | The grade value itself proves which transforms have applied — `body_refinement` binds `pham → bao`; a grade already past `pham` proves the transform applied (or was superseded by a later chapter's transform). |
| B. `physiqueGrade` + per-chapter `transformApplied` flag | Doubles the persisted surface to record what the grade already proves; a flag could disagree with the grade (second source of truth). |

**Chosen: A** — QI-D4 explicitly allows "one canonical state proving
both" (chapter completion proven by `bodyProgression.body_refinement`,
application proven by the grade's position). Idempotence is a property
of the source-guard: the transform applies only when
`player.physiqueGrade === from`, so it cannot apply twice, and a
restored save (which never re-runs `invest`) cannot re-advance.

The single-state choice is only valid because the integrity boundary
**enforces** the coherence it asserts — §5 adds a cross-field
chapter↔grade check at the semantic preflight so an incoherent
persisted pair (`completedTiers === 6` + `physiqueGrade === 'pham'`)
fails closed instead of silently stranding a transform the invest
channel can never re-offer (r1-M1).

## 3. Schema + ladder data

```ts
// Player.ts — PlayerData gains a required field
physiqueGrade: PhysiqueGradeId
```

- `createDefaultPlayer` seeds `'pham'` (start-of-journey rung, QI-D4b).
- `PhysiqueGradeId` lives in the new catalog
  `src/data/realm/PhysiqueLadder.ts` — data/ folder per the
  BodyRefinement.ts convention (authored realm data):

```ts
export type PhysiqueGradeId =
  | 'pham' | 'bao' | 'phap' | 'linh' | 'huyen'
  | 'chan' | 'dao' | 'than' | 'thanh' | 'tien'

export interface PhysiqueGradeDefinition {
  id: PhysiqueGradeId
  // QI-D4d: per-grade benefit fields are authored by a later content
  // pass ON this entry — the catalog shape already carries them.
}

export const PHYSIQUE_GRADES: readonly PhysiqueGradeDefinition[] = [
  { id: 'pham' }, { id: 'bao' }, { id: 'phap' }, { id: 'linh' },
  { id: 'huyen' }, { id: 'chan' }, { id: 'dao' }, { id: 'than' },
  { id: 'thanh' }, { id: 'tien' },
] // exact QI-D4 order; array order IS the ladder
```

- Helpers: `isPhysiqueGradeId(value: unknown): value is PhysiqueGradeId`
  (membership guard — the save validator's only read) and
  `getPhysiqueGradeIndex(id)` (ladder position — consumed by the §4
  invest gate, the §5 coherence check, and the §8 authored-definition
  integrity test).
- Rung display names ride i18n (`physiqueGrades.<id>` blocks in
  `locales/vi.json` + `locales/en.json`), not embedded data strings —
  the panel's only read is `t()`.
- Per-grade stat/effect fields are **absent** today (QI-D4d) — the
  `{id}` definition entries are the extension point the future bonus
  pass writes into; no placeholder benefit fields now.

## 4. Transform transaction — system-owned, chapter-declared

The transform hook lives inside `BodyProgressionSystem`, the same
authority that owns invest dispatch (F8: "advancement hook on chapter
completion inside BodyProgressionSystem"). The *binding data* lives on
the chapter definition so a future LQ Body chapter declares its own
transition without touching the system:

```ts
// BodyChapter.ts — BodyChapterShared gains:
readonly physiqueAdvancement?: { from: PhysiqueGradeId; to: PhysiqueGradeId }
```

- `bodyRefinementChapter` declares `{ from: 'pham', to: 'bao' }`
  (QI-D4b: complete Mortal Body chapter → Bảo).
- `meridianChapter` declares nothing — Kinh Mạch completion is NOT a
  physique trigger (QI-D4).

**Two rules inside `investBodyChapterState`** (both live in the system
dispatch — the chapter contract stays data-only):

1. **Invest gate** (before `chapter.invest`): an advancement chapter
   may only progress while the current grade is **not below** its
   `from` rung. The eligibility read is a **pure exported helper** —
   the mechanism seam the r2-M2 regression drives with synthetic
   advancement pairs (`investBodyChapterState` delegates to it; the
   closed `BODY_CHAPTER_BY_ID` registry never has to accept a fake
   chapter):

   ```ts
   // BodyProgressionSystem.ts
   export function canProgressPhysiqueChapter(
     player: PlayerData,
     advancement: { from: PhysiqueGradeId; to: PhysiqueGradeId },
   ): boolean {
     return (
       getPhysiqueGradeIndex(player.physiqueGrade) >=
       getPhysiqueGradeIndex(advancement.from)
     )
   }

   // inside investBodyChapterState, before chapter.invest:
   if (
     chapter.physiqueAdvancement !== undefined &&
     !canProgressPhysiqueChapter(player, chapter.physiqueAdvancement)
   ) {
     return 0
   }
   ```

   A future `bao→phap` chapter can never even be invested while the
   player is `pham`, so a completed advancement chapter can never sit
   behind its source grade — the r1-M2 ordering hole is closed by
   construction, for today and every later chain. For the current
   chapter (`from: 'pham'`) the gate is vacuous — every valid grade
   is `>= 'pham'` — so this mission's invest behavior is unchanged.
2. **Transform write** (after a successful mutation, `consumed > 0`):

   ```ts
   if (
     chapter.physiqueAdvancement !== undefined &&
     chapter.isComplete(player) &&
     player.physiqueGrade === chapter.physiqueAdvancement.from
   ) {
     player.physiqueGrade = chapter.physiqueAdvancement.to
   }
   ```

- **Exactly once**: the grade write happens inside the same invest
  dispatch that just flipped `completedTiers` to the total — one call,
  one transition, one persisted write.
- **Source-guard = idempotence**: `physiqueGrade === from` fails for
  every later invocation (already `to`, or advanced further by a future
  chapter) — the transform can never re-apply.
- **Late completion**: the hook is unconditional on realm — finishing
  6/6 at any realm advances the grade (QI-D4).
- **Deterministic**: no RNG, no clock, pure state transition.

**Authored-definition integrity** (data guard, test-enforced —
`getPhysiqueGradeIndex` is consumed here for real): the declared
`physiqueAdvancement` transitions across `BODY_CHAPTERS` must form a
**contiguous prefix starting at `'pham'`** — each `toIndex ===
fromIndex + 1` (adjacent only — no skip, no regress), `from` values
unique (one chapter owns one transition), and the `from` set must be
exactly `{'pham', ..., <last from>}` with no gap (a `phap→linh`
binding without `bao→phap` is dead authored data and fails the guard,
never silently reaches runtime). A violation fails the
authored-integrity test.

## 5. Save boundary — v74, no migration (QI-S)

- `CURRENT_SAVE_VERSION` 73 → 74 with the conventional header comment
  (`physiqueGrade` new required field; saves < 74 rejected — dev phase,
  no translators).
- `saveShapeValidation`: `player.physiqueGrade` must be present and
  satisfy `isPhysiqueGradeId` — any other value (missing, non-string,
  unknown rung) is a validation issue, fail-closed.
- `GameSave.player` serializer emits the field (it serializes the whole
  `PlayerData` — confirm no field allowlist drops it; if a buildGameSave
  projection exists, add the field).
- **Cross-field coherence at the semantic preflight**
  (`assertBodyProgressionIntegrity` — the delegated check
  `GameManagerSaveRestore` runs before any owner mutation): the
  check derives the **exact reachable grade** from the authored
  transition prefix, not just per-chapter agreement —

  ```ts
  // derivePhysiqueGrade (system-internal oracle):
  //   walk the authored advancement chain in from-index order;
  //   start 'pham'; advance across each transition iff its owning
  //   chapter isComplete; stop at the first incomplete transition.
  // assert: player.physiqueGrade === derivePhysiqueGrade(player)
  ```

  This single comparison subsumes both v3 directions AND closes the
  r3-M1 reachability hole: `6/6 + 'pham'` (transform never applied),
  `5/6 + 'bao'` (grade outruns its chapter), AND `6/6 + 'phap'..'tien'`
  (ladder members no authored chain can produce — "known grade" ≠
  "reachable grade"; M-QI-08 resolves economy against this field, so
  an unreachable identity is a false canonical state) all fail closed
  before any owner mutation. Rejection is the repair; QI-S forbids
  recompute-on-load.
- Restore performs **no** recompute: `applyAllBodyModifiers` rebuilds
  chapter emissions only; `physiqueGrade` round-trips as persisted. A
  save with `completedTiers === 6` + `physiqueGrade === 'bao'` restores
  unchanged — this is the restore-idempotence proof (INV-2).
- **Fixture blast radius**: every fixture that seeds
  `completedTiers: 6` (or invests to 6) and then crosses the
  integrity/restore path must also seed `physiqueGrade: 'bao'` — the
  canonical completed state now includes the applied transform. The
  BodyProgressionSystem "fully-completed canonical state" fixture
  (`BodyProgressionSystem.test.ts`) and any restore-boundary fixtures
  with `completedTiers: 6` are updated in this mission; fixtures
  seeding 6/6 outside those paths are updated for canonical honesty
  where they model post-transform play (19 files touch
  `completedTiers` — sweep is mechanical, one line each).

## 6. Read-model + UI

- `BodyProgressionSystem` exports `getPhysiqueGrade(player)` — the one
  canonical read consumers use (mirrors `getBodyRefinementCompletedTiers`
  convention); direct `player.physiqueGrade` reads stay legal for the
  system itself but UI goes through the read-model.
- `BodyRefinementSection.vue` (the Luyện Thể block in RealmPanel) adds
  one summary-adjacent line: localized label + current rung name —
  `Thể Phách: Phàm Thể` / `Physique: Mortal Physique` (new keys
  `panels.realm.bodyRefinement.physique` label + `physiqueGrades.<id>`
  rung names in both locales). The line reads through the read-model
  and refreshes via `stateVersion` like the surrounding computeds.
- No toast/modal on transform in this mission (display read-model is
  the F8 scope; celebration UI is a later presentation pass).

## 7. Invariants (pins for review + QA)

- **INV-1** Exactly-once: completing `body_refinement` advances
  `physiqueGrade` `pham → bao` precisely once; a second evaluation of
  the same state is a no-op.
- **INV-2** Restore-idempotent: persisting + restoring a
  post-transform save leaves `physiqueGrade === 'bao'`; the restore
  path never re-derives or re-applies the transform (QI-S — no
  recompute-on-load).
- **INV-3** Late completion: a player at `realmId !== 'mortal'` who
  finishes 6/6 still transforms (the realm gate only paces Mortal
  progression; `isTierRequiredRealmLevelMet` already returns true
  off-mortal — the hook adds no realm condition).
- **INV-4** Meridian non-trigger: completing `meridian` never touches
  `physiqueGrade` (no `physiqueAdvancement` declared).
- **INV-5** Ordering cannot strand a transform: an advancement chapter
  cannot progress while `physiqueGrade` is below its `from` rung, so a
  completed chapter's transition is always applicable when its
  completion lands (a future two-transition chain cannot deadlock or
  skip; the write-guard stays `=== from`).
- **INV-6** `bodyProgression` stays a pure chapter-slice record:
  `physiqueGrade` lives on `PlayerData`, not inside
  `player.bodyProgression` (every key there maps 1:1 to a
  `BodyChapterId`; a non-chapter key would break that contract).
- **INV-7** Perfection axis untouched: `mortalPerfectionAchieved` and
  the breakthrough grade (`computeRefinementBreakthroughGrade` 1–6)
  are separate concepts — physique is normal-progression only (F8).
- **INV-8** Coherence is exact, not pairwise: `physiqueGrade ===
  derivePhysiqueGrade(player)` — the grade must equal what the
  contiguous authored transition chain proves from the completed
  chapters. Rejects transform-never-applied, grade-outruns-chapter,
  AND no-authored-chain-can-produce-this-rung states.
- **INV-9** Authored transitions are well-formed: declared
  `physiqueAdvancement`s form a contiguous prefix from `'pham'`
  (adjacent `toIndex === fromIndex + 1`, `from`-unique, gapless
  `from` set) — a mis-authored transition fails the data guard, not
  production state.

## 8. Tests (TDD)

1. `PhysiqueLadder.test.ts` (data) — ladder order is exactly the
   QI-D4 sequence; `isPhysiqueGradeId` accepts all 10, rejects
   unknown/empty/non-string.
2. `BodyProgressionSystem.physique.test.ts` — transform matrix:
   - invest completing tier 6 → `pham → bao` (via the real
     `investBodyChapterState` seam, chapter `isComplete` boundary);
   - partial completion (5/6) → grade stays `pham`;
   - post-completion state re-evaluated → no second advance (INV-1);
   - completion at `realmId: 'qi_refining'` → still transforms (INV-3);
   - `physiqueGrade: 'bao'` + complete chapter re-checked → stays
     `bao` (source-guard, INV-1);
   - meridian `isComplete` → `physiqueGrade` unchanged (INV-4);
   - invest gate via the exported `canProgressPhysiqueChapter` helper:
     a synthetic `{from: 'bao', to: 'phap'}` pair returns false while
     `physiqueGrade === 'pham'`, true at `'bao'`/`'phap'` (INV-5 — the
     ordering hole closed at the mechanism seam the system actually
     delegates to; no fake chapter is injected into the closed
     registry);
   - real `investBodyChapterState` regression: `body_refinement`
     (`from: 'pham'`) still invests/completes/transforms normally —
     the gate is vacuous for today's binding, not dead code.
3. `GameManagerRealmAdvanceOps` seam — `investBodyChapter` (the real
   bag-debit op) completing 6/6 transforms the grade and debits only
   consumed essence (existing debit contract preserved).
4. `saveShapeValidation` + restore boundary — v74: missing
   `physiqueGrade` → issue; non-member string → issue; valid rung →
   pass; `version < 74` save → incompatible; **`completedTiers: 6` +
   `physiqueGrade: 'pham'` → integrity rejection** (transform never
   applied); **`completedTiers: 5` + `physiqueGrade: 'bao'` →
   rejection** (grade outruns its chapter); **`completedTiers: 6` +
   `physiqueGrade: 'phap'` and `'tien'` → rejection** (no authored
   chain produces them); `completedTiers: 6` + `physiqueGrade:
   'bao'` → restores clean.
5. `BodyRefinementSection` mounted — renders the localized physique
   line with the current rung; after a seeded `bao` the label reads
   `Bảo Thể` (vi) — no transform logic in the component.
6. Authored-definition integrity — the declared `physiqueAdvancement`s
   form a contiguous prefix from `'pham'`: adjacent pairs, `from`
   unique, gapless `from` set (INV-9); the current catalog's
   `body_refinement → pham→bao` binding is asserted exactly.
7. Regression — `BodyRefinementChapter`/`BodyProgressionSystem`
   existing suites: the "fully-completed canonical state" fixture now
   seeds `physiqueGrade: 'bao'`; all other cases unchanged (the
   integrity `it.each` corruption cases still throw — the
   `completedTiers: 6` + progress-residue case already violates a
   second invariant).

## 9. Out of scope

- No per-grade stat bonuses/effects (QI-D4d — dedicated content pass).
- No essence economy: `Tinh Hoa <Grade>` family, substitution, drop
  bands = M-QI-08..10 (they resolve against `physiqueGrade` but don't
  exist yet).
- No LQ/TC Body chapters or further transform bindings (future
  content declares its own `physiqueAdvancement`).
- No transform celebration UI/toast.
- No migration/translators (QI-S — version bump rejects old saves).
