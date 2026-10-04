# Quick QA — economy-review tune (2026-10-04)

Mode: quick. Scope (task-owned): `game/src/data/alchemy/alchemyRecipes.ts`,
`game/src/data/pill/pills.ts`, `game/docs/balance/2026-10-04-economy-review.md`.
Excluded: the balance doc (unmappedPath, prose only — no runtime surface).

Changed-risk-map: domain `economy-and-progression`; one-hop consumers
"UI affordability and unlock state", "save and offline progression";
`deepAuditCandidate: false`. Manual routing confirms the mapping: the only
behavioral deltas are a per-recipe `retired` flag and a numeric constant;
no transaction path, clock, save shape, or combat settlement code changed.

## Invariant ledger + attack ranking

| # | Hypothesis | Evidence | Result |
|---|---|---|---|
| H1 | Retired recipe still craftable/listed | Live runtime: `pill_room` panel on dev server now lists only Tụ Linh Đan + Khải Linh Đan (was Tụ/Hồi/Khải); craft gate `AlchemySystem.ts:413` + model filter `GameManagerAlchemyOps.ts:322` both reject `retired === true` | Rejected (runtime + source) |
| H2 | Orphan economy census after removing recipe's purpose-sink | `betaEconomyCensus` green: herb keeps `vendor` sink label; recipe count unchanged (8 mortal / 74 total) so `EconomySimulation.test.ts` pins intact | Rejected (test) |
| H3 | Save with in-flight mortal hoi_linh job breaks on restore | Same code path as hoi_xuan retired family; B7 test in `tc6ForgedSaveFalsification.qa.test.ts` proves retired dormant jobs settle and mint correctly; recipe row still resolvable | Rejected (existing test coverage) |
| H4 | `hoi_linh_thao_mortal_*` becomes sellable unexpectedly | Vendor `isSoleRecipeIngredient` reads `alchemyRecipes`; the recipe row still exists with herbVariants intact → guard unchanged | Rejected (source) |
| H5 | `cultivationPercent` bump breaks a numeric pin | `PillSystem.profession.test.ts` reads `basePercent` dynamically; 1,678 scoped tests green incl. all architecture pins | Rejected (test) |
| H6 | `family.effect.kind === 'mp_regen'` discriminant wrong (retires nothing, or wrong recipes) | `PillFamilies.ts`: kind `'mp_regen'` is unique to `hoi_linh_dan`; new pin test asserts exactly the mortal row retired + family live elsewhere | Rejected (source + new pin) |
| H7 | Quest/tutorial gating references the recipe id | `quests.ts` and tutorial data contain no `hoi_linh`/`alchemy_` references | Rejected (source) |

## Coverage gaps / deferred (not defects)

- **Mortal players can still own/have minted `hoi_linh_dan_mortal` pills**
  (saves crafted before the tune; pill data unchanged — consume remains a
  no-op on mp 0). Behavior identical to pre-tune; item is simply
  unobtainable going forward. Not a regression.
- **Grotto still mints `hoi_linh_thao_mortal_*`** for a recipe that is
  now retired → herb only has a vendor sink at qi+. Source≠live-sink is
  pre-existing design for retired families (see QI-D8); recorded in the
  balance doc as a follow-up candidate outside this PR's data/** domain.
- Numeric pin for `tu_linh_dan` percent exists only implicitly
  (dynamic read); the tune is a data constant, so any future drift is a
  deliberate edit by definition.

## New QA artifacts

- `game/src/data/alchemy/alchemyRecipes.economyReview.qa.test.ts` — pins
  the deliberate retirement: mortal mp_regen recipe `retired === true`,
  family live at other realms, other mortal recipes unaffected.

## Verdict

PASS WITH EVIDENCE — runtime evidence for the primary hypothesis
(recipe hidden/rejected), 1,678 scoped tests + 3 new pin assertions green,
every other hypothesis rejected on source or existing coverage. No deep
escalation: no save-shape, clock, or transaction-code change; economy
impact is bounded to two data constants with an existing gate consuming
them.
