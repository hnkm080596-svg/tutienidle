# M-QI-04 — `hoi_xuan_thao` deferred cleanup (QI-D8)

Status: spec v2 for external review — v2 adds `PillRework.test.ts` to the census (r1 Medium) and fixes quest-state wording (r1 Low).
Branch: `p7-mqi-04-hoi-xuan-deferral`. Worktree: `.agent-worktrees/mqi-04-hoi-xuan-deferral`.
Depends on: none (standalone fix).

## 1. Locked contract (QI-D8, `docs/p7/decisions.md` L173-177)

- `hoi_xuan_thao` is **DEFERRED, not legacy**: keep identity/data tolerance; remove from the live chapter loop until a real effect/sink is authored.
- Retarget `daily_collect_hoi_xuan_thao` → collect `tu_linh_thao_qi_refining_decade` (live LQ herb → `tu_linh_dan` → cultivation).
- Động Thiên grotto pool prunes the retired family — `hoi_xuan_thao` stops being generated while deferred. Quest retarget alone is insufficient.

## 2. Current state (G0 evidence)

- `PillFamilies.ts:33` — `hoi_xuan_dan` already `retired: true` (M10/ARCH-008): generated recipes carry `retired: true`; `AlchemySystem` rejects start + hides them.
- `ProductionCatalog.ts:157-163` — `THANH_VAN_GROTTO_HERB_BASES` iterates ALL `PILL_FAMILIES` including retired → `hoi_xuan_thao_*` still drops live from Động Thiên across every realm/age.
- `materials.ts:226-257` (`buildReworkPillHerbs`) — generates `hoi_xuan_thao_<realm>_<age>` material defs for all tiers/ages (id tolerance surface).
- `quests.ts:28-34` — `daily_collect_hoi_xuan_thao` targets `hoi_xuan_thao_qi_refining_decade` ×5, reward 15 skillInsight, `cadence: 'daily'`.
- Quest progress/state is keyed by `questId` (`QuestManager.state.active` rows carry per-entry `claimed`; `completedOnceIds` holds once-quest history) → keeping the quest id preserves active progress/claimed state.
- `alchemyRecipes.ts:44,56` — `grottoVariants('tu_linh_thao_qi_refining')` on Yêu Đan recipes is unrelated.

## 3. Change surface

### 3.1 Quest retarget (`src/data/quest/quests.ts`)

- `daily_collect_hoi_xuan_thao`:
  - `condition.materialId` → `'tu_linh_thao_qi_refining_decade'` (amount 5 unchanged).
  - `name` → `'[Hàng Ngày] Thu Thập Tụ Linh Thảo'`; `description` → `'Nộp 5 Tụ Linh Thảo mỗi ngày để nhận thưởng.'` (display must match the collected material).
  - `id`, `reward` (15 skillInsight), `cadence: 'daily'` — unchanged (id tolerance: active progress/claimed state is keyed by `questId`).
  - Comment: mark QI-D8 retarget — the Hồi Xuân Thảo daily is deferred until the family gets a real effect/sink; the live daily now feeds `tu_linh_dan`.

### 3.2 Grotto pool prune (`src/core/production/ProductionCatalog.ts`)

- `THANH_VAN_GROTTO_HERB_BASES`: exclude `family.retired === true` families — the grotto pool stops generating `hoi_xuan_thao_<realm>_<age>` across all tiers/ages (8 → 7 families per realm).
- `validateTerritory` unchanged: ≥1 grotto herb per realm still holds (7 live families remain).
- Comment sync: pool derives from non-retired families only (QI-D8).

### 3.3 DEFERRED marker (`src/data/pill/PillFamilies.ts`)

- Update the `hoi_xuan_dan` entry comment: classification per QI-D8 is DEFERRED — data/identity preserved (material defs, recipes, old-save bag entries, in-flight alchemy jobs), but the family is also pruned from the Động Thiên grotto pool and its daily quest retargeted, until a replacement effect/sink is authored.
- `retired: true` flag stays (craft/use surfaces already gate on it).

### 3.4 Explicitly unchanged

- `buildReworkPillHerbs` keeps generating `hoi_xuan_thao_*` material defs — **id tolerance**: old saves' bag entries still resolve name/icon/profession meta; no save migration.
- `alchemyRecipes` keeps generating `hoi_xuan_dan_*` recipes with `retired: true` — start-job rejection unchanged; in-flight legacy jobs resolve.
- `AlchemySystem`, `ProductionSystem`, `QuestManager` — no engine changes.
- No other quest, enemy drop, or reward touched.

## 4. Acceptance oracles

1. `daily_collect_hoi_xuan_thao` collects `tu_linh_thao_qi_refining_decade`; name/description reference Tụ Linh Thảo; id/cadence/reward unchanged.
2. `THANH_VAN_GROTTO_HERBS` contains zero `hoi_xuan_thao_*` entries for every realm/age; every realm still has ≥1 herb (7 families).
3. `materials` still contains `hoi_xuan_thao_qi_refining_decade` (id tolerance) — old-save bag entries resolve.
4. `alchemy_hoi_xuan_dan_*` recipes still exist with `retired: true`; `startAlchemyJob` still rejects them (M10 contract).
5. `validateTerritory(TERRITORY_THANH_VAN, …)` still passes.

## 5. Affected-test census

- `PillRework.test.ts:21-28` — **deterministic failure without rewrite**: loops ALL `PILL_FAMILIES` asserting each family's mortal herb exists in `THANH_VAN_GROTTO_HERB_BASES` and pins 8 unique grotto names. Post-QI-D8 contract: all 8 families/recipes/material identities stay resolvable, but only the 7 non-retired families appear in the live grotto pool. Rewrite: recipe assertion stays over all 8; grotto assertion iterates `PILL_FAMILIES.filter(f => f.retired !== true)`; unique-name count 8→7; add explicit pin that `hoi_xuan_thao_*` is absent from BASES/HERBS.
- `quests.test.ts` — catalog assertions may pin the quest's condition; update to the new target + add retarget pinning.
- `GameManager.questLifecycle.test.ts` / `GameManager.r81qa.test.ts` — check for `daily_collect_hoi_xuan_thao`/`hoi_xuan_thao` references; update if seeded.
- `ProductionSystem*.test.ts` / `ProductionBalance.simulation.test.ts` — consume `THANH_VAN_GROTTO_HERBS`; pool shrinks 8→7 herbs/realm; sim ratios redistribute (assertions are inequality-based — verify, update only if a pin assumes 8).
- `MaterialBagFilter.test.ts` — `hoi_xuan_thao_mortal_decade` fixture still resolves (material defs kept) — no change expected.
- `GameManager.authoredParity.test.ts` — retired-recipe contract unchanged — no change expected.

## 6. Non-goals

- No new effect/sink for `hoi_xuan` (deferred content).
- No quest-id rename, no reward rebalance (balance phase owns magnitudes).
- No save migration/translators.
- No removal of `hoi_xuan_thao_*` material defs or `hoi_xuan_dan_*` recipes.
