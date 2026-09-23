# M-F-ESSENCE — Essence Bands + Substitution Residual — plan

Spec: `game/docs/specs/m-f-essence-spec.md` (v1 — pending C2C spec
review). Records the F9 audit verdict — the TC-side essence
consumption contract is already landed and chapter-agnostic by
construction — and implements the residual pin set at the typed
`BodyChapterCurrency` boundary the M-F-CHU-THIEN `zhou_tian` chapter
will occupy. Test-only: zero production edits, no retune, no re-wire,
no save change (QI-S).

Phase 1 delivered docs only; Phase 2 begins after C2C spec + plan
gates pass.

## Step 0 — seam census (done during spec; all verified, none rewired)

- `data/realm/PhysiqueEssence.ts`: family registry
  (pham/bao/phap), pinned band map, `PHYSIQUE_ESSENCE_BAND_DROPS`,
  `PHYSIQUE_ESSENCE_CONVERSION_RATIO = { bao: 2, phap: 2 }` — all
  landed (M-QI-08/09), all locked against edits.
- `data/drop/StageDropTables.ts:39,55,71`: banded realms carry the
  authored band entries by reference — LQ→Bảo, TC→Pháp live
  (M-QI-10). Verified present; do not re-wire.
- `core/realm/body/BodyChapter.ts:103-109`:
  `bodyChapterEssenceGrade(currency)` — the namespace gate reads
  `currency.bag` then `currency.id`; no chapterId/chapterKind input.
- `core/realm/body/BodyChapterEssenceSubstitution.ts`: pure
  resolver — `essenceSubstitutionYield` / `essenceSubstitutionCoverage`
  / `planEssenceSubstitution` over the typed descriptor + `ownedOf`
  oracle; the gate lives inside (C2C 6).
- `core/game/GameManagerRealmAdvanceOps.ts:479-559`:
  `investBodyChapter` — single branch on
  `bodyChapterEssenceGrade(chapter.currency)`; `bodyChapterBag` maps
  `'material' | 'pill'` to the deps bags (both implement
  `getAmount/has/remove/add`); JSON-probe validate→consume→apply,
  `bag.has` + change-capacity preflights, all-or-nothing.
- `core/realm/body/BodyProgressionSystem.ts:131-152`:
  `investBodyChapterState` dispatches `chapter.invest`; apply-side
  gates are chapter-owned and surface `consumed = 0` pre-debit.
- `data/enemy/EnemyDropSinkInvariant.test.ts:75-79`: Pháp already
  counts as a sink through the pham chain.
- Caller census: tick auto-invest (`GameManager.ts:916`),
  `MeridianSection.vue:102`, `EarlyGameSession.ts:349`,
  `EssenceSubstitutionEconomy.ts:306` — all route through
  `investBodyChapter`. No second essence landing path exists (the
  mote arrival is a presentation wait-flag).
- Closed authoring surface owned by M-F-CHU-THIEN (NOT touched):
  `BodyChapterId` union, `BodyProgressionState`, `BODY_CHAPTERS`,
  `BODY_CHAPTER_BY_ID`, `EXPECTED_BODY_CHAPTER_KIND` pin entry, save
  version, chapter UI.
- Boundary recorded, not extended: `auxCurrency` is a raw-bag gate
  channel — no substitution (spec sec.3.4).

## Step 1 — pin tests (the entire delta)

1. `src/data/realm/PhysiqueEssence.test.ts` — inside the existing
   `bodyChapterEssenceGrade (M-QI-08 namespace rule)` describe:
   - `{ bag: 'material', id: 'tinh_hoa_phap_the' }` resolves to
     `'phap'` — the TC chapter's declared cost shape;
   - `{ bag: 'material', id: 'tinh_hoa_bao_the' }` resolves to
     `'bao'`.
2. `src/core/realm/body/BodyChapterEssenceSubstitution.test.ts` —
   `BAO_COST` + `PHAP_COST` fixtures beside `PHAM_COST` (same
   `BodyChapterCurrency` shape); new cases:
   - `essenceSubstitutionCoverage(PHAP_COST, ownedOf)` === 0 for every
     owned set — top authored rung, no substitute (contract, not
     error);
   - `planEssenceSubstitution(consumed, PHAP_COST, ownedOf)` with
     `consumed <= ownedOf('phap')` — the only in-contract input for
     Pháp (`consumed <= owned + coverage`, coverage === 0) — debits
     `[{ tinh_hoa_phap_the, consumed }]` exactly,
     `covered === consumed`, `change === undefined`;
   - NO pin for `consumed > ownedOf('phap')` at the resolver — that
     input violates the documented all-or-nothing precondition
     (`BodyChapterEssenceSubstitution.ts:25-26,107-108`) and a partial
     plan is not a contract outcome (`undefined` is the namespace
     refusal only). The under-covered consequence is a production-seam
     fact — probe `consumed = 0` → `investBodyChapter` returns 0
     before planning (fail closed) — already exercised for essence
     chapters by the M-QI-09 e2e refusal cases
     (`GameManager.essenceSubstitution.test.ts`);
   - `planEssenceSubstitution` on `BAO_COST`: `ownedOf({ phap: 6 })`,
     `consumed = 11` → debits `[{ tinh_hoa_phap_the, 6 }]` covering 12,
     `change = { tinh_hoa_bao_the, 1 }`; mixed stacks order the Bảo
     spend before the Pháp hop;
   - `essenceSubstitutionCoverage(BAO_COST, ownedOf({ phap: n }))`
     === `n * R_PHAP`.
   Constants read PRODUCTION data (`R_BAO`/`R_PHAP` convention from the
   existing file — never copied literals).
3. `src/core/realm/body/BodyChapter.test.ts` — in the
   `validateBodyChapterRegistry` suite beside the existing zhou_tian
   kind test: synthetic `fakeMeridianChapter({ id: 'zhou_tian' as never,
   chapterKind: 'zhou_tian', currency: { bag: 'material',
   id: 'tinh_hoa_phap_the' } })` —
   - `bodyChapterEssenceGrade(fake.currency) === 'phap'`;
   - `validateBodyChapterRegistry([refinement, fake])` reports no
     `bodyChapters.zhou_tian.chapterKind` issue (missing-slice noise
     expected — authored later by M-F-CHU-THIEN).

## Step 2 — gates

- P3 quick: `cd game && npm run type-check && npx vitest run
  src/core/realm/body src/data/realm src/data/drop src/data/enemy` —
  full-suite `npm run verify` is NOT triggered (test-only delta; no
  build/deps/config/state-root/wiring touch). Confirm zero
  production-file edits in the final diff.
- P18 OCR (`open-code-review`) on the diff → P4
  `tutienidle-adversarial-qa` quick → P5 sequential ≥ 3 passes.
- No P13/P14 trigger: no UI, no wiring path, no render change.
- P15 ASCII scan on new comments.
- Commit + push `devin/<ts>-m-f-essence`; PR base `p7/truc-co`.

## Acceptance criteria (per spec sec.6)

- All pins of spec sec.3.1-3.3 land in the named files; the diff
  contains only test files (+ the two docs from Phase 1).
- P3 quick green; OCR clean; QA verdict recorded; P5 passes per the
  coordinator gate order.
- Report records the zero-delta audit verdict with the sec.1 evidence
  table.
