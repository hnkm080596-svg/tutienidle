# QA Quick — Sudden Death counts ATB rounds (fix/sudden-death-rounds)

Date: 2026-09-14 · Scope: `TurnBattleSystem.suddenDeathDamageMultiplier` + 2 call sites, tests
Verdict: **PASS WITH EVIDENCE**

## Defect (user report)

"Sát thương tăng bất thường; đáng lẽ chỉ tăng sau một số lượt nhất định."

- Authored contract (roadmap 9.5, commit e0c5c456): "từ lượt 11: dmg +30%/lượt cộng dồn".
- Implementation read `battle.totalTurnsElapsed` — a raw **actor-action** counter incremented once per `declareActorAction`.
- Post-D2 (f18db20d) the project's turn-budget unit is `roundsElapsed` (perfect-clear migrated then). Sudden Death was never migrated.
- Symptom: in a 1v3 stage the action counter passes 10 within ~3 rounds → escalation starts ~4x early and compounds ~+0.3 x actors per round (≈+120%/round in 1v3 instead of +30%). Matches the report exactly.

## Fix

- `suddenDeathDamageMultiplier(roundsElapsed)` — escalate once >=10 rounds complete: `1 + 0.3 * (roundsElapsed - 9)` (round-11 actions land x1.3; slope unchanged).
- Declare site (normal action) and charge-resolve site (apply time) both read `battle.roundsElapsed ?? 0` — same temporal semantics as before (declare-time vs resolve-time, Defect Task 8 preserved).
- Known boundary note: the actor whose action closes a round sees the post-increment count — escalation can begin on the closing action of round 10 (one action early, at most one per round). Accepted as noise vs the multiplicative defect.

## Evidence

- `TurnBattleSystem.test.ts` — sudden-death describe rewritten to the rounds contract: grace (round 10) x1, 10 rounds done -> x1.3, 14 rounds -> x2.5; **new regression**: 1v3 battle with `totalTurnsElapsed=14` but `roundsElapsed=2` stays x1.
- `TurnBattleSystem.party.test.ts` — "TOÀN BỘ party chết" needed loop 60->200: it had silently depended on the buggy action-ramp to kill the 1M-HP member (test intent = defeat detection, unchanged).
- `npx vitest run src/core/battle/turn/` — 361/361 green. `vue-tsc --build` clean.

## Boss enrage migration (same defect class — user authorized)

`isTurnTriggerReady` now receives `battle.roundsElapsed` (was
`totalTurnsElapsed`) — the same counter drift: authored `afterTurns: 60`
enrages fired at ~round 60/N participants. The check runs inside the
boss's own declare after the round-close block, so `afterTurns: N` fires
on the boss action that closes round N. `afterTurns: 1` 1v1 behavior is
identical to before (boss's first action closes round 1).

- `BossTurnTriggers.ts` — param renamed `roundsElapsed` + contract comment.
- New regression: mid-round with action counter past threshold does not
  fire; boss fires on closing round 2.
- The 60-round enrage test loop 650 -> 800 (a round only closes when the
  slow boss acts — ~10 steps/round here).
- Balance effect: enrages now fire at true round 60 regardless of
  participant count — much later than the buggy ~round 15-20 in
  multi-add fights. User authorized this migration explicitly.

## Invariants checked

- A3/state: `roundsElapsed`/`actedThisRound` owners unchanged (added 2026-09-12 with their own suite); fix only reads them. `?? 0` keeps legacy save battles in grace.
- A9: single formula, both damage paths consume the same owner.
- Scope: `baTheTriggeredAtTurn` (immunity window, action-granular by design) intentionally left on the action counter — its unit is the actor's own action cadence, not a battle budget.

## Notes / follow-ups

- E2E/balance feel on real stages: not covered here (unit-level only); recommend a quick B-stage run to sanity-check pacing before milestone.
