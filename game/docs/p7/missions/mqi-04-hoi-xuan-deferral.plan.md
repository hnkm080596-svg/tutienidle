# M-QI-04 — `hoi_xuan_thao` deferred cleanup — implementation plan

Spec: `mqi-04-hoi-xuan-deferral.spec.md` v2 (approved scope per QI-D8).

## Steps

### Step 1 — TDD failing tests

1. `src/core/pill/PillRework.test.ts:21-28` — rewrite per post-QI-D8 contract:
   - recipe assertion keeps iterating all 8 `PILL_FAMILIES` (identity data resolvable);
   - grotto assertion iterates `PILL_FAMILIES.filter(f => f.retired !== true)`;
   - unique grotto name count 8 → 7;
   - new pin: `THANH_VAN_GROTTO_HERB_BASES`/`THANH_VAN_GROTTO_HERBS` contain zero `hoi_xuan_thao` entries.
   - Baseline run: the new assertions fail (filter not yet implemented).
2. `src/data/quest/quests.test.ts` — add a pinning test for the retarget:
   - `daily_collect_hoi_xuan_thao` exists, `condition.materialId === 'tu_linh_thao_qi_refining_decade'`, `cadence === 'daily'`, reward 15 skillInsight, name/description reference Tụ Linh Thảo (not Hồi Xuân).
   - Baseline run: fails on materialId/name.
3. `src/core/production/ProductionCatalog` oracle — cover via a new assertion inside `PillRework.test.ts` (BASES filter) or `ProductionSystem.realmTier.test.ts` — every realm keeps ≥1 herb. Prefer adding to `PillRework.test.ts` (same file already owns family↔grotto contract).

### Step 2 — Implementation

1. `src/data/quest/quests.ts` — retarget `daily_collect_hoi_xuan_thao`: `materialId: 'tu_linh_thao_qi_refining_decade'`, name `[Hàng Ngày] Thu Thập Tụ Linh Thảo`, description `Nộp 5 Tụ Linh Thảo mỗi ngày để nhận thưởng.`; comment: QI-D8 retarget note.
2. `src/core/production/ProductionCatalog.ts` — `THANH_VAN_GROTTO_HERB_BASES` filters `family.retired !== true`; sync the header comment (non-retired families only, QI-D8).
3. `src/data/pill/PillFamilies.ts` — update `hoi_xuan_dan` comment: DEFERRED per QI-D8 — identity preserved (material defs/recipes/bag entries/in-flight jobs), pruned from grotto pool, daily retargeted, until a real effect/sink is authored.

### Step 3 — Verification

1. `npm run type-check`.
2. Focused: `npx vitest run src/core/pill/PillRework.test.ts src/data/quest/quests.test.ts src/core/production/`.
3. Wider: quest lifecycle + authored parity + material bag filter scopes (`src/core/game/GameManager.questLifecycle.test.ts src/core/game/GameManager.authoredParity.test.ts src/components/panels/MaterialBagFilter.test.ts src/core/game/GameManagerSaveRestore.boundary.test.ts`).
4. `git diff --cached --check`.

### Step 4 — Gates

- P18 OCR over staged diff.
- P13/P14: not triggered — data/catalog change, no wiring/render surface; production-roll path verified via existing `ProductionSystem` tests.
- P4 adversarial QA (quick) — save/id-tolerance + production-pool hypotheses.
- P5 three sequential passes.
- External impl review → merge → ledger row.
