# M-QI-03 — Breakthrough Requirement Read-Model — plan

Spec: `mqi-03-requirement-readmodel.spec.md` v2 — `MQI03_SPEC_REVIEWED` (round 2).

## Steps (TDD)

1. **Failing tests first**
   - `GameManager.progressionScope.test.ts`: add `getBreakthroughRequirements` cases — mortal `[level]` met/unmet; qi_refining `[level, chapterClear]` flag matrix; foundation+/golden_core → `[]`.
   - `RealmPanel.test.ts`: extend the existing button test — qi_refining L12 renders 2 requirement lines (level met / chapter unmet) + button disabled → seed `completedStageIds` → chapter met + enabled; add mortal/foundation no-block assertions; add hidden-input text exclusion assertion.
   - Expected fails: `getBreakthroughRequirements` doesn't exist; no requirement markup.

2. **Production change**
   - `GameManagerRealmAdvanceOps.ts`: `BreakthroughRequirementRow` type + `getBreakthroughRequirements(player)`; `canTriggerBreakthrough` delegates (`length > 0 && every(met)`).
   - `RealmPanel.vue`: `requirements` computed (qi_refining only), requirement block markup + minimal scoped CSS per panel conventions.
   - `vi.json`/`en.json`: `panels.realm.requirements.{level,chapterClear,met,unmet}` — vi "…tầng 12"/"Chương 10 hoàn thành", en "…level 12"/"Chapter 10 complete".

3. **Verify**: type-check + affected vitest scope + `git diff --cached --check`.

4. **Gates**: OCR → P4 quick QA → P5 sequential passes → external impl review → commit/merge.

## Explicit non-changes

`BreakthroughRequirementPanel` (post-eligibility dialog), `startTribulation`/grade inputs, save shape, stage data, locales outside the new keys, mortal UI presentation.
