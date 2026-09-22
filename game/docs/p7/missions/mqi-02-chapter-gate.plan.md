# M-QI-02 — Trúc Cơ Chapter Gate — plan

Spec: `mqi-02-chapter-gate.spec.md` v2 — `MQI02_SPEC_REVIEWED` (round 2; census Medium resolved).

## Steps (TDD)

1. **Failing tests first**
   - `GameManager.progressionScope.test.ts`: change the `qi_refining tầng 12 → true` case into the two-condition matrix — (a) L12 + abyssal_pool cleared → `true`; (b) L12 + floors 1–9 only → `false`; (c) L11 + abyssal_pool cleared → `false`. Keep mortal + placeholder pins unchanged.
   - `useTribulation.dotPha.test.ts`: in the auto-unequip test (`qi_refining`/12 → `triggerBreakthroughAction` true) seed `player.completedStageIds = ['qi_refining_abyssal_pool']`; add one refusal case: same fixture without the clear → `false` + `tribulationDirector.getState()` null.
   - `RealmPanel.test.ts`: seed `completedStageIds = ['qi_refining_abyssal_pool']` before the qi_refining L12 enabled assertion; add a no-clear → disabled beat.
   - `cultivationRitualFlow.integration.test.ts`: seed `player.completedStageIds = ['qi_refining_abyssal_pool']` before the post-ritual LQ L12 `triggerBreakthroughAction` call (spec v2 finding).
   - Run: new cases fail (gate not implemented), old-pass expectation confirms the baseline is understood.

2. **Production change**
   - `src/core/realm/realmSystem.ts`: `export const QI_REFINING_BREAKTHROUGH_STAGE_ID = 'qi_refining_abyssal_pool'` next to `CORE_REALM_LEVEL` (comment: QI-D5 pinned stage id).
   - `GameManagerRealmAdvanceOps.canTriggerBreakthrough`: qi_refining branch requires both conditions; docblock updated to name the two mandatory inputs (level + chapter-final stage clear) and note mortal stays level-only.

3. **Comment sync**
   - `EarlyGameSession.runTribulation` note: mirror contract now includes the stage predicate (comment only, English/ASCII per P15 for touched comments — file already uses English comments in this region; keep style consistent).

4. **Verify**
   - `npm run type-check`
   - `npx vitest run src/core/game/GameManager.progressionScope.test.ts src/composables src/components/panels src/core/simulation`
   - `git diff --cached --check`

5. **Gates**: OCR → P4 quick QA → P5 sequential passes → external impl review → commit/merge.

## Explicit non-changes

`startTribulation`, `chooseCultivationPath`, save shape, stage data, RealmPanel requirement-line read-model (M-QI-03), tribulation grade inputs, locales — all unchanged.
