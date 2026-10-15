# QA Report — Phase 3 Slice 3.4: Extract Gameplay Rules & Read-Models out of Vue (`V4 d, e, f, g; D6`)

- **Date**: 2026-10-15
- **Branch**: `slice-3.4-extract-gameplay-rules`
- **Worktree**: `E:\tutienidle\.agent-worktrees\phase-1-beta-fixes`
- **Base Commit**: `b89026eab` (`master`)

## 1. Scope & Changes

1. **`src/core/player/CombatPower.ts` + `src/components/scenes/character/CharacterSurface.vue` (`V4d, D6`)**:
   - Extracted `COMBAT_POWER_TERMS`, `computeCombatPower(stats)`, and `computeCombatPowerTermContribution(stats, term)` into `src/core/player/CombatPower.ts`, preserving the exact formula per Ruling `D6`.
   - Added unit tests in `src/core/player/CombatPower.test.ts`.
2. **`src/core/realm/body/BodyProgressionSystem.ts` + `src/components/scenes/body/useBodySceneModel.ts` + `src/components/scenes/body/BodySurface.vue` (`V4e`)**:
   - Exported `collectBodyChapterBaseStatDeltas(player, chapterId)` from `BodyProgressionSystem.ts`.
   - Added `numericValue` and `percent` to `BodyGainView` and `totalRows` to `BodyChapterModel` in `useBodySceneModel.ts`.
   - Removed direct `bodyRefinementChapter.collectBaseStatDeltas` call and regex string-parsing (`/^\s*([+-]?\d+(?:\.\d+)?)\s*(%?)\s*$/`) from `BodySurface.vue`.
3. **`src/core/alchemy/AlchemySystem.ts` + `src/core/game/GameManagerAlchemyOps.ts` + `src/components/scenes/alchemy/AlchemySurface.vue` (`V4f`)**:
   - Added `computeAlchemyJobProgress` in `AlchemySystem.ts` and `quoteAlchemyBrew(recipeId, herbMaterialId, player)` in `GameManagerAlchemyOps.ts`.
   - Replaced duplicated `tailMergeable`, `canBrew`, `brewBlockReason`, and per-unit deadline math in `AlchemySurface.vue`.
4. **`src/stores/player.ts` + `src/components/common/TutorialOverlay.vue` (`V4g`)**:
   - Added `markTutorialSeen()` action in `usePlayerStore` and replaced direct `player.hasSeenTutorial = true` mutation in `TutorialOverlay.vue`.
5. **`src/data/skill/SkillConstellationLayouts.ts` + `src/components/scenes/skill/SkillSurface.vue`**:
   - Extracted `DESIGN_BASIC_ID`, `ULTIMATE_NODE_ID`, `FIRE_DESIGN_POS`, `FIRE_DESIGN_EDGES`, `computeSkillPaperLayout`, and `computeSkillPaperEdges` into `src/data/skill/SkillConstellationLayouts.ts` (cloning `{ ...authored }` before applying viewport shift so `FIRE_DESIGN_POS` is never mutated across reactive recomputations).
6. **Architecture Guard**:
   - Added `tests/architecture/noVueGameplayFormulas.test.ts` (5 tests).

## 2. Verification Evidence (P3)

- `npm run type-check`: PASS (`0` errors)
- `npm run build`: PASS (`built in 8.56s`)
- `npx vitest run src/core/player/CombatPower.test.ts tests/architecture/ src/components/scenes/body/ src/components/scenes/alchemy/ src/core/alchemy/ src/core/realm/body/ src/stores/player.test.ts`: **148/148 test files PASS** (`1,299` passed, `7` expected fail, `5` skipped).

## 3. Sequential Multi-Pass Review (P5)

```
Sequential Review Pass 1
  Reviewed state: post-implementation Slice 3.4 diff
  Findings: None (Medium or higher). Noted that cloning `{ ...authored }` in `computeSkillPaperLayout` also eliminates in-place mutation of `FIRE_DESIGN_POS` entries during centering shift.
  Fixes: None required
  Verification: type-check + build + 148 Vitest files PASS

Sequential Review Pass 2
  Reviewed state after Pass 1 fixes: YES
  Findings: None (Medium or higher). Verified all 5 Vue surfaces delegate formulas, brew eligibility, store mutation, and layout tables to core/store/data owners.
  Fixes: None required
  Verification: 148/148 test files PASS

Sequential Review Pass 3
  Reviewed state after Pass 2 fixes: YES
  Findings: None (Medium or higher). Verified `alchemy.reason.*` key parity and `betaFrontendScopeExposure.test.ts` pass with `noVueGameplayFormulas.test.ts`.
  Fixes: None required
  Verification: 148/148 test files PASS
```
