# M-QI-07 — Physique Transformation Authority — plan

Spec: `mqi-07-physique-transformation.spec.md` (v4 — resolves r3 finding; MQI07_SPEC_REVIEWED, round 4). Implements QI-D4/D4b/D4d/QI-S: persisted `player.physiqueGrade`, the 6/6 `body_refinement`-completion transform (`pham → bao`), the 10-rung ladder catalog, save v74 validation + cross-field coherence at the semantic preflight, and the BodyRefinementSection display line. No stat bonuses, no migration.

## Step 0 — seam census (done during spec)

- `Player.ts`: `PlayerData.physiqueGrade` new required field; `createDefaultPlayer` seeds `'pham'`. `bodyProgression` stays a pure chapter-slice record (spec INV-6).
- `BodyChapter.ts`: `BodyChapterShared` gains `physiqueAdvancement?: { from: PhysiqueGradeId; to: PhysiqueGradeId }`; `bodyRefinementChapter` declares `{from:'pham', to:'bao'}`; `meridianChapter` declares none.
- `BodyProgressionSystem.ts`: `investBodyChapterState` gains TWO rules — the pre-invest grade gate (`gradeIndex < fromIndex → return 0`, vacuous for `pham`) and the post-mutation transform write (`consumed > 0 && isComplete && grade === from → grade = to`); `assertBodyProgressionIntegrity` gains the exact-grade coherence check (`physiqueGrade === derivePhysiqueGrade(player)` — walks the contiguous authored prefix); new `getPhysiqueGrade(player)` read-model.
- `GameManagerRealmAdvanceOps.investBodyChapter` (:466-481) — the only production invest caller; unchanged (both rules live inside the dispatched system call).
- `saveVersion.ts`: 73 → 74 + header comment (no migration, QI-S).
- `saveShapeValidation.ts`: `player.physiqueGrade` required + `isPhysiqueGradeId` membership.
- `GameManagerSaveRestore` (:573 `applyAllBodyModifiers`, :234 preflight): restore does NOT touch physiqueGrade — round-trip only (INV-2); the :234 delegated integrity call now rejects `6/6 + 'pham'` (INV-8).
- `BodyRefinementSection.vue`: summary row gains localized physique line (`panels.realm.bodyRefinement.physique` + `physiqueGrades.<id>` both locales).
- `mission-graph.md:104` (master doc, lands with the ledger): "default Phàm, migration" wording corrected to the QI-S contract (no migration — v74 rejects old saves).

## Step 1 — TDD failing tests first

1. `src/data/realm/PhysiqueLadder.test.ts` (new): exact QI-D4 order; `isPhysiqueGradeId` accept/reject matrix; `getPhysiqueGradeIndex` positions.
2. `src/core/realm/body/BodyProgressionSystem.physique.test.ts` (new): tier-6 completion → `pham→bao`; 5/6 → stays `pham`; re-evaluated post-completion → no-op; off-mortal completion → transforms; pre-seeded `bao` + complete → stays `bao`; meridian complete → unchanged; exported `canProgressPhysiqueChapter` helper: synthetic `{from:'bao',to:'phap'}` false at `pham`, true at `bao`+; real `investBodyChapterState` still transforms on the vacuous `pham` binding.
3. `src/core/game/GameManager.bodyPhysique.test.ts` (new): `investBodyChapter` real-bag seam — completing 6/6 transforms + debits consumed essence only.
4. `saveShapeValidation` + `GameManagerSaveRestore.boundary`: missing/non-member `physiqueGrade` → issues; valid → pass; `version < 74` → incompatible; `6/6 + 'pham'`, `5/6 + 'bao'`, AND `6/6 + 'phap'/'tien'` saves → integrity throw before owner mutation; `6/6 + 'bao'` → restores clean.
5. `BodyRefinementSection` mounted: renders the localized physique line + current rung; seeded `bao` → `Bảo Thể` label (vi).
6. Authored-definition integrity (in PhysiqueLadder.test or BodyChapter test): declared `physiqueAdvancement`s form a **contiguous, gapless prefix starting at `pham`** — adjacent pairs (`toIndex === fromIndex + 1`), `from`-unique, `from` set exactly `{'pham', ..., <last from>}` with no gap; `body_refinement` binds exactly `pham→bao`.

## Step 2 — ladder catalog + schema

- `src/data/realm/PhysiqueLadder.ts` (new): `PhysiqueGradeId` union, `PhysiqueGradeDefinition { id }`, `PHYSIQUE_GRADES` ordered defs, `isPhysiqueGradeId`, `getPhysiqueGradeIndex`.
- `Player.ts`: `physiqueGrade: PhysiqueGradeId` field + `'pham'` default.
- `BodyChapter.ts`: `physiqueAdvancement` on `BodyChapterShared`; `bodyRefinementChapter` binds `pham→bao`.

## Step 3 — transform hook + integrity + read-model

- `BodyProgressionSystem.ts`: invest gate + post-mutation write in `investBodyChapterState`; coherence check in `assertBodyProgressionIntegrity`; `getPhysiqueGrade` export.
- Locales: `panels.realm.bodyRefinement.physique` label + `physiqueGrades.<id>` rung names (vi: `Phàm Thể…Tiên Thể`; en: `Mortal Physique…Immortal Physique`).

## Step 4 — save boundary + fixture sweep + UI

- `saveVersion.ts` 73→74 + comment; `saveShapeValidation.ts` membership check; serializer pass-through verify.
- Fixture sweep: every `completedTiers: 6` fixture on the integrity/restore path seeds `physiqueGrade: 'bao'` (canonical completed state); sweep the remaining 19-file surface for canonical honesty.
- `BodyRefinementSection.vue`: physique line in the summary block reading `getPhysiqueGrade` + `t(physiqueGrades.<id>)` via `stateVersion`.

## Step 5 — verification

- `npm run verify` (= type-check + build + full vitest — P3 full; PlayerData field + save schema + new authority warrant it).
- P15 ASCII-comment gate on touched files.
- P13/P14 (worktree dev server): drive the REAL production path — seed the last tier just below cap + Essence, let the world tick → `investBodyChapter` complete it, observe `Thể Phách: Bảo Thể`; seeded `pham` save shows `Phàm Thể`.
- P18 OCR → P4 adversarial QA → P5 sequential passes → external impl review.
