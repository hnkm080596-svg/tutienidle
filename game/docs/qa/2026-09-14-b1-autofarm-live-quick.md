# QA Quick — B1: auto-farm Hoàn Mỹ live pass (2026-09-14)

Verdict: **PASS WITH EVIDENCE** — the previously pending live P14 pass is now
done on the main checkout dev server (`localhost:5175`).

## Scope

Roadmap §0.11 B1: `perfectClearTurnLimit` shipped earlier; the pending
item was "verify auto-farm Hoàn Mỹ (unit-verified; live P14 pass still
pending); E2E through actual progression". This pass covers the live
gate end-to-end: stage select mode chip → `startAutoFarm` → wall-clock
cycle rolls → persisted progression.

## Evidence (real Chromium, dev build)

| Step | Result |
| --- | --- |
| Boot → guest auth → create character via UI | Pass — home reached, curtain settled, tutorial dismissed |
| Command wheel → teleport_array → stage select | Pass — `mortal_dong_1` auto-selected, stage detail + mode chips render |
| Start manual battle | Pass — combat scene mounts, top bar `0 / 10 quái`, target panel visible |
| `window.__tutienEnemySpawnDebug.forcePerfectClear('mortal_dong_1', 10)` | Pass — `perfectClearStageIds` + `perfectClearSeconds` written |
| Reload mid-battle | Pass — pagehide autosave flush persisted the perfect-clear state; home restored cleanly |
| Reopen stage select | Pass — `Tự Động Hoàn Mỹ` chip enabled for the cleared stage, selectable |
| Start auto-farm | Pass — `autoFarmStage = {stageId: 'mortal_dong_1', lastCheckedMs}` in save |
| ~22s farming (cycleSeconds = 10/2 = 5s → ~4 cycles) | Pass — `cultivation` 102.08 → 310.89, `skillInsight` 0 → 63, `totalCultivationGained`/`totalSkillInsightGained` grew; rewards roll through `processDefeatedEnemies` (idle channel) with no battle/animation |
| Console / page errors | Zero errors observed during the run |

Screenshots taken during the run confirmed: ink-wash battlefield render,
stage-select mode chip row (Thủ Công / Lặp Lại / Tự Động Tiến Ải / Tự
Động Hoàn Mỹ) with the farm chip active. Scratch script + screenshots
deleted per P14 cleanup.

## What was NOT re-verified here

- A real stage *victory* under `perfectClearTurnLimit` — a fresh mortal
  cannot clear 10 enemies within the round cap; `create-to-combat.spec`
  already proves a real battle reaches a result panel live, and the
  perfect-clear award logic is unit-verified. The dev hook is the
  sanctioned tool for the gate (it exists precisely for this).
- Offline auto-farm settle (`settleAutoFarmOffline`) — unit-covered
  (bounded settlement, 24h cap); not exercised live.

## Notes

- No retreat/abandon control found in the combat UI — leaving a running
  battle required a reload. Not a defect of this change; noting as a
  possible UX gap worth a roadmap note if absent by design.
