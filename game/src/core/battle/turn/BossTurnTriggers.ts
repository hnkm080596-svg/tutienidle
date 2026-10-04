// Turn-Based Combat Foundation (spec Phan 5) - thay enrage.afterSeconds
// cu: dem theo TONG SO LUOT da troi qua tu dau tran (khong phai luot
// rieng cua boss), khop cadence "danh het wave moi spawn wave moi".
// D2 revision contract (2026-09-12): "luot" = ATB round (roundsElapsed -
// one boundary per all-alive-participants-acted), the same unit
// perfectClearTurnLimit and Sudden Death use. The caller passes
// battle.roundsElapsed; the raw totalTurnsElapsed actor-action counter
// made triggers fire participant-count times early in multi-enemy
// stages.
export interface TurnTriggerCondition {
  afterTurns: number
}

export function isTurnTriggerReady(
  condition: TurnTriggerCondition,
  roundsElapsed: number,
): boolean {
  return roundsElapsed >= condition.afterTurns
}
