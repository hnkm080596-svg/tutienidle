# QA Review: combat speed gauge + round indicator (TurnOrderStrip)

- Date: 2026-09-12
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/composables/useTurnBattleInfo.ts` (roundsElapsed/activeStage views + stateVersion invalidation fix)
  - `game/src/components/game/combat/TurnOrderStrip.vue` (gauge bars + round chip + over-limit styling)
  - `game/src/components/game/combat/TurnOrderStrip.test.ts` (7 new tests)
  - `game/src/core/game/GameManagerTurnBattleOps.ts` (getActiveTurnBattleStage + stale-stage clear)
  - `game/src/core/game/GameManager.ts` (forwarder)
  - `game/src/core/game/GameManager.activeTurnBattleStage.test.ts` (new, 3 tests)
  - `game/src/locales/{vi,en}.json` (turnStrip keys)

## Scope and Risk Map

Presentation reads engine-owned state only (A7): `actionGauge`/`GAUGE_MAX`
for fill, `roundsElapsed` for the round counter, and `perfectClearTurnLimit`
off the stage that launched THIS battle (`activeStageForTurnBattle`, owned by
GameManagerTurnBattleOps — not `ui.selectedStageId`, which the user can point
elsewhere). No gameplay state is written by any changed code path.

## Pre-existing defect found and fixed in scope

While browser-verifying the feature (P14), the strip never rendered in live
combat. Root cause: `isBattleFighting`/`upcomingActors` computed on
`battle.value` only — `battle` resolves to the same TurnBattle object forever
(engine mutates `.state`/`.roundsElapsed` in place), so once evaluated during
'intro' the computeds were never invalidated again. `visible` stayed false
permanently; the strip (and `BattleLogPanel`, same composable) never appeared
in real gameplay — jsdom tests only passed because they mount with a
fighting-state battle already set.

Fix: `stateVersion.value` is now read inside `isBattleFighting` and
`upcomingActors`, matching the pattern `logEntries` already used. Live
evidence below confirms the strip appears at the countdown→fighting flip.

## Invariant ledger

- Round chip shows CURRENT round = `roundsElapsed + 1` (1-based), matching
  the PC predicate `roundsElapsed < perfectClearTurnLimit` at victory:
  "finish before the displayed round completes". `is-over` when
  `roundsElapsed >= limit` — the window is already gone at equality.
- `activeStageForTurnBattle` cleared on `!isStageStarting` battle starts —
  a stale limit cannot leak into tribulation/devtools battles.
- Gauge fill = `actionGauge / GAUGE_MAX` clamped [0,1]; `is-ready` at 100%.
- Dead party members keep the chip but hide the gauge bar.

## Live browser evidence (worktree dev server, :5199)

- Character created as guest, stage `mortal_dong_1` (Động 1) started.
- Probed component instance: `activeStage.id === 'mortal_dong_1'`,
  `roundsElapsed` tracked engine 0→1→2, `isBattleFighting` flipped false→true
  at t≈6.5s post-start (countdown→fighting).
- Screenshot: strip renders "GaugeCheck 116/116" party chip with gauge bar,
  round chip "Hiệp 1/20", "Lượt tới" list with per-actor gauge bars and
  "▶ Dã Trư" current-actor highlight.

## Verification

- `npm run type-check`: exit 0.
- `npx vitest run src/components/game/combat src/core/game src/composables
  tests/architecture`: 129 files / 578 tests pass.
- Focused: TurnOrderStrip 11/11, GameManager.activeTurnBattleStage 3/3.

## Gaps / notes

- `is-over` styling and `is-ready` fill were verified by unit tests (jsdom),
  not by a live over-limit screenshot — catching a 15-round overrun live was
  impractical; the predicates are single-branch and covered.
- `turnStrip.upcoming` was a pre-existing missing i18n key (rendered the raw
  key in production); fixed incidentally by the new locale block.
- Gauge re-reads once per world tick (stateVersion cadence) — sub-second
  smoothness is intentionally out of scope; consistent with `logEntries`.
