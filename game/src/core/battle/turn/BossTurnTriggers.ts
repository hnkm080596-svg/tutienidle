// Turn-Based Combat Foundation (spec Phần 5) — thay enrage.afterSeconds
// cũ: đếm theo TỔNG SỐ LƯỢT đã trôi qua từ đầu trận (không phải lượt
// riêng của boss), khớp cadence "đánh hết wave mới spawn wave mới".
// D2 revision contract (2026-09-12): "lượt" = ATB round (roundsElapsed —
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
