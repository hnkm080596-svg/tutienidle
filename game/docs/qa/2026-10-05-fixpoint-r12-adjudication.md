# Fixpoint r12 adjudication — codex aggregate @f04b6fe2

Auditor wave r12 reports: `2026-10-05-fixpoint-r12-{cor,aut,int}.md`.

## Medium findings — all fixed

| ID | Finding | Disposition |
|----|---------|-------------|
| AUT-1 | `buildings[].lastCollectedAt` zero defenses: crafted-future freezes income | FIXED — `BuildingManager.restore` clamps future stamps to now |
| AUT-2 | weighted-draw NaN fail-open in `DropRoll.weightedRandom` + `TalentEntitlement` inline draw | FIXED — non-finite total now throws in both (same pattern as r11 `drawFromPool`) |
| AUT-3 | cultivation window end unbounded under cold-boot (crafted-future lastSavedAt -> future payable window) | FIXED — `stores/player.ts` clamps window start AND end at now; splitter sorts bounds so start must clamp too |
| COR-1 | elapsed <= 60s restore skips settle but re-arms lease -> stale `lastCheckedMs` mints gap at LIVE rate | FIXED — armed-farm re-anchor `settle(0)` widened from live-replacement-only to every armed-farm restore that skips the settle |
| COR-2 | forged-future `lastSavedAt` voids `appliedAtMs <= lastSavedAt` coherence -> ~30d buffs | FIXED — restore bounds `appliedAtMs <= now` and `expiresAtMs <= appliedAtMs + TU_LINH_TRAN_DURATION_MS` (longest authored window) |

## Low findings

| ID | Finding | Disposition |
|----|---------|-------------|
| INT-1 | `DecomposeSystem.settleOffline` fast-forward unbounded (crafted-future offlineSinceMs + crafted-old nextCycleAt -> billions of no-op iterations at boot; dormant under scope lock) | FIXED — loop bound `min(windowStartMs, nowMs)`; future deadlines stay pending |
| INT-2 | `lastSavedAt`-as-validator-truth: 5 coherence checks (`appliedAtMs <= lastSavedAt` etc.) void when the marker is forged | RECORDED — root issue is server-authority scope (out of beta scope per r11 AUT-2 ruling); the reachable edges were closed by the clamp fixes above |
| INT-3 | missing assembled restore->throw->retry test | DEFERRED (Low) — unit pins cover each new clamp; assembled replay coverage exists in autoFarmRestore suite |

## Regression drive-through

- `SaveSystem.conformance.test.ts` — updated `stripVolatile` to mask `autoFarmStage.lastCheckedMs` (legitimately volatile post-COR-1).
- `EarlyGameSession` canonical loop — pre-existing break from stage-wall retune (dong_9 budget): inserted the missing `growth_cycle` (runs 16) between dong_8/dong_9 per the loop's own wall-budget pattern. Green.

## Pins added

- `GameManager.autoFarmRestore.test.ts` — stale anchor + sub-60s restore re-anchors at resume (r12-COR-1)
- `player.restoreFromSave.test.ts` — forged 30d buff clamp, forged future `appliedAtMs` clamp, crafted-future `lastSavedAt` cold-boot mints nothing (r12-COR-2 / r12-AUT-3)
- `BuildingSystem.test.ts` — future `lastCollectedAt` clamps on restore, honest past survives (r12-AUT-1)

## Verification

type-check clean; scoped vitest 127+55 tests green; affected suite (`src/core`, `src/stores`, `src/services`) green — 5993 tests, 1 failure fixed via canonical-loop budget pin above.
