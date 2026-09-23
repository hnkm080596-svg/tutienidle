# M-QI-08 — Grade-Aware Essence Family — implementation notes

Spec: `mqi-08-essence-family.spec.md` v3 (MQI08_SPEC_REVIEWED, round 3).
Plan: `mqi-08-essence-family.plan.md`.

## Implementation summary

- `src/data/realm/PhysiqueEssence.ts` (new): the canonical physique-essence
  registry - `PHYSIQUE_ESSENCES` (pham/bao/phap in ladder order), forward
  `physiqueEssenceMaterialId`, reverse `physiqueEssenceGradeOf`, the pinned
  `PHYSIQUE_ESSENCE_BAND` realm->grade map with the exact-key
  `PhysiqueEssenceBandRealm` union, sparse `physiqueEssenceBand`/
  `physiqueEssenceBandDrop` lookups (Map-backed; absent realm -> undefined),
  and `PHYSIQUE_ESSENCE_BAND_DROPS` derived band->grade->materialId so a
  band entry cannot name a wrong-grade material by construction. The legacy
  id literal stays defined once via `TINH_HOA_PHAM_THE_MATERIAL_ID`.
- `materials.ts`: `tinh_hoa_bao_the` + `tinh_hoa_phap_the` in a typed
  `physiqueEssenceMaterials` const spread into the main `materials` array
  (file convention; essence/monster, no stackLimit/years/element/profession).
- `BodyChapter.ts`: `bodyChapterEssenceGrade(currency)` - namespace-gated
  predicate (`bag === 'material'` AND family id); the contract owner holds
  the bag-namespace rule. `BodyChapterCurrency` unchanged.
- `BattleLootSystem.ts`: essence-particle check widened from the literal
  pham id to `physiqueEssenceGradeOf(drop.itemId) !== undefined` -
  presentation classification only.
- `HiddenBeasts.ts`: comment documents the huyet_mong pham signature
  exception (spec sec.3.5) - data unchanged.
- Tests: `PhysiqueEssence.test.ts` (13 tests) + 2 particle-routing tests in
  `BattleLootSystem.dropResult.test.ts`.

## Verification evidence

- `npm run verify` (P3 full): green - type-check + build + 738 files /
  6607 tests / 4 expected-fail. Run TWICE: once pre-Pass-3 and once on
  the final post-Pass-3 state (identical counts; the Pass-3 refactor was
  internal lookup mechanics only).
- `tests/architecture/asciiComments.test.ts` (P15): green after fixing one
  reworded comment token.
- OCR (P18, delegation mode): 7 reviewable files (2 docs excluded -
  C2C-reviewed); 7/7 reviewed, 0 skipped, 0 confirmed Medium+.
- P4 adversarial QA (quick): PASS WITH EVIDENCE -
  `docs/qa/2026-09-23-mqi-08-essence-family-quick.md`. Mapper flagged
  deepAuditCandidate (3 domains); escalation declined with documented
  bounding: no persistence surface (material save validation is structural
  only), no transaction change, behavior-identical particle predicate on
  all reachable drops, essence-stream consumer reads only `event.kind`.

## Sequential Review Pass 1

  Reviewed state: post-OCR implementation state (all gates above green).
  Findings:
  - Low: per-band drop assert could pass vacuously if a band ever mapped
    to an unauthored rung (both sides undefined). Fixed in-pass with a
    `toBeDefined()` assert.
  - Nit: `ESSENCE_PARTICLE_COLOR` doc comment still named only Pham The.
    Fixed in-pass.
  Fixes: both applied; `PhysiqueEssence.test.ts` rerun green (13/13).
  Verification: focused vitest green.

## Sequential Review Pass 2

  Reviewed state after Pass 1 fixes: YES
  Findings:
  - Authority: PhysiqueEssence is the sole material-id<->grade mapping;
    `TINH_HOA_PHAM_THE_MATERIAL_ID` remains a shared id literal (one
    definition site, referenced by the registry) - not a second authority.
  - `bodyChapterEssenceGrade` placement: the bag-namespace rule is a
    BodyChapterCurrency interpretation rule - correct owner.
  - Dependency direction: core->data value imports match the established
    pattern (data leaf registries); the type-only `GuaranteedDropEntry`
    import adds no runtime edge.
  - `PHYSIQUE_ESSENCE_BAND_DROPS` vs the live mortal line is a deliberate
    drift-checked duplication (spec sec.3.5), not split authority.
  - No unresolved Medium+.
  Fixes: none required.
  Verification: prior green stands (no production change in this pass).

## Sequential Review Pass 3

  Reviewed state after Pass 2 fixes: YES
  Findings:
  - Low: sparse lookups indexed `Record<union>` cast to `Record<string>` -
    runtime-correct (absent keys yield undefined, matching the declared
    `| undefined` return) but the cast internally claims total coverage.
    Refactored to Map-backed lookups consistent with the id maps.
  - P15 nit: reworded particle-color comment left the recorded baseline;
    rewritten fully ASCII.
  - Reentrancy/hot-path: pure O(1) Map.get per material drop - negligible.
  - Pill-kind drop carrying a family id: unreachable (pill branch never
    consults the predicate; the namespace predicate covers the currency
    side anyway).
  Fixes: Map-backed `physiqueEssenceBand`/`physiqueEssenceBandDrop`; ASCII
  comment. Both Low/Nit severity - no Medium+.
  Verification: type-check + focused tests + P15 green.

## Sequential Review Pass 4

  Reviewed state after Pass 3 fixes: YES (final Map-based state)
  Findings: none. The refactor changed only internal lookup mechanics;
  observable contracts identical; all focused tests and type-check green.
  Fixes: none.
  Verification: final `npm run verify` rerun on this state - green,
  738 files / 6607 passed / 4 expected-fail.

## Sequential Review Pass 5 (external review round 1)

  Reviewed state after external r1 findings: YES (M1/L1/N1 resolutions).
  Findings (external):
  - M1: band-drop test bounded chance/amount loosely; spec sec.3.5 pins
    0.7 / 1-3 as FIXED M-QI-09 sim inputs. Fixed - exact `toBe(0.7)` +
    `toEqual({min:1,max:3})` per band; mortal drift sentinel kept.
  - L1: this notes file was unstaged. Fixed - staged with the task set.
  - N1: HiddenBeasts comment-only edit vs "untouched" wording. Resolved
    by keeping the (accurate, drift-guarding) comment and amending the
    plan Step 0 wording to "no DATA change; documentation comment
    allowed" - spec sec.3.5's exception text already stands.
  Fixes: applied above.
  Verification: `PhysiqueEssence.test.ts` 13/13 green; zero production
  changes in this round (test assert + docs only).
