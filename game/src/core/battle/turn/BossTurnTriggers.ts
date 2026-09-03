// Turn-Based Combat Foundation (spec Phần 5) — thay enrage.afterSeconds
// cũ: đếm theo TỔNG SỐ LƯỢT đã trôi qua từ đầu trận (không phải lượt
// riêng của boss), khớp cadence "đánh hết wave mới spawn wave mới".
export interface TurnTriggerCondition {
  afterTurns: number
}

export function isTurnTriggerReady(
  condition: TurnTriggerCondition,
  totalTurnsElapsed: number,
): boolean {
  return totalTurnsElapsed >= condition.afterTurns
}
