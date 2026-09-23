# M-QI-08 — Grade-Aware Essence Family — plan

Spec: `mqi-08-essence-family.spec.md` (v3 — MQI08_SPEC_REVIEWED, external spec review round 3). Implements QI-D4b/D4c/QI-S: the `Tinh Hoa <Grade>` registry keyed by `PhysiqueGradeId` (pham/bao/phap authored), two new essence materials, the pinned realm→grade band map with type-honest sparse lookups, grade-aware Body chapter costs via reverse-lookup derivation (no field added — the currency id IS the identity), authored-but-unwired per-band drop entries (numbers are fixed M-QI-09 sim inputs), and family-wide essence particle routing. No live drop changes (M-QI-10), no substitution (M-QI-09), no migration (QI-S).

## Step 0 — seam census (done during spec)

- `data/materials/materials.ts`: `tinh_hoa_pham_the` lives in `legacyMaterials` (essence/monster, default stack); new entries go in the main `materials` array.
- `data/realm/BodyRefinement.ts:5`: `TINH_HOA_PHAM_THE_MATERIAL_ID` — stays the canonical Phàm id (registry maps `pham` → it).
- `core/realm/body/BodyChapter.ts:55`: `BodyChapterCurrency { bag, id }` — UNCHANGED (r1 M1: a hand-authored `essenceGrade` field would be a second authority; grade derives via `physiqueEssenceGradeOf(currency.id)`). `BodyRefinementChapter.ts:121` unchanged.
- `core/game/GameManagerRealmAdvanceOps.ts:468-477`: the only invest caller — reads `currency.id` for get/debit; unchanged.
- `core/game/BattleLootSystem.ts:550`: essence particle check is the literal id — widened to `physiqueEssenceGradeOf(...) !== undefined`.
- `data/drop/StageDropTables.ts` / `FamilyDropTables.ts` / `HiddenBeasts.ts`: no DATA change in this mission — `PHYSIQUE_ESSENCE_BAND_DROPS` authors the per-band entries; M-QI-10 wires them. `huyet_mong` keeps its `tinh_hoa_pham_the` signature (documented catch-up valve, spec §3.5) — a comment-only edit at the signature site marks that exception.
- `PerfectionEconomy.ts` / `EarlyGameSession.ts`: mortal instruments reading the canonical Phàm id — unchanged.
- Save shape: untouched — material bag keys are dynamic strings; no version bump.

## Step 1 — TDD failing tests first

1. `src/data/realm/PhysiqueEssence.test.ts` (new): exact authored set `{pham,bao,phap}` in ladder order; unique grades/ids; forward/reverse lookups incl. unauthored rung + non-family id → `undefined`; every id resolves to a real `Material` with `category:'essence'` + `sourceType:'monster'` + no `stackLimit`/`years`/`element`/`profession`; band map equals the pinned triple and every band's grade is authored; `physiqueEssenceBand`/`physiqueEssenceBandDrop` on a non-banded realm → `undefined`; `PHYSIQUE_ESSENCE_BAND_DROPS` names its band's grade material; mortal authored entry equals the live mortal stage line.
2. Chapter-cost coherence (in PhysiqueEssence.test.ts or the body chapter test): `bodyChapterEssenceGrade(bodyRefinementChapter.currency) === 'pham'`; `bodyChapterEssenceGrade(meridianChapter.currency) === undefined`; namespace regression — a synthetic `{ bag:'pill', id:'tinh_hoa_bao_the' }` currency yields `undefined`.
3. `BattleLootSystem` test: a drop whose itemId is any family member routes the 'essence' particle; a non-family material keeps the 'item' path.
4. Guard: live `STAGE_DROP_TABLES` LQ/TC bands still emit no physique essence (premature-wiring sentinel).

## Step 2 — registry + materials

- `src/data/realm/PhysiqueEssence.ts` (new) per spec §3.1 — `PhysiqueEssenceBandRealm` union + sparse `string`-accepting lookups returning `undefined`; `PHYSIQUE_ESSENCE_BAND_DROPS` derived from band→grade→materialId so a wrong-grade reference is impossible by construction.
- `materials.ts`: `tinh_hoa_bao_the` + `tinh_hoa_phap_the` in the main array (essence/monster, descriptions in the established style).

## Step 3 — contract + routing

- `BodyChapterCurrency` untouched; `body_refinement.currency` untouched — coherence is derivable through the registry; new `bodyChapterEssenceGrade(currency)` predicate in `BodyChapter.ts` composes `bag === 'material'` + the family lookup (r2 M1 namespace rule; M-QI-09 consumes it).
- `BattleLootSystem` particle check widened to family membership.

## Step 4 — gates

- P3 full per spec §6 (`npm run verify`: type-check + build + full vitest) — the canonical evidence command, no hybrid mode (r1 M3).
- P15 ASCII scan on new comments.
- P18 OCR → P4 adversarial QA (mode per risk map — expect economy/save adjacency) → P5 sequential passes → external impl review → commit + merge + ledger.
