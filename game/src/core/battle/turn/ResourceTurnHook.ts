// Turn-Based Combat Foundation (spec Phần 5) — thay MỌI regen/decay
// resource theo deltaSeconds (Ngũ Hành Thế, Kiếm Thế/Kiếm Ý, Kim Thế
// decay...): áp dụng đúng 1 lần tại thời điểm entity bắt đầu lượt của
// chính nó, không có clock thứ hai song song với ActionGauge.
export interface TurnResourceDelta {
  stat: string
  amount: number
  min?: number
  max?: number
}

export function applyTurnStartDeltas(
  current: Record<string, number>,
  deltas: TurnResourceDelta[],
): Record<string, number> {
  const next = { ...current }

  for (const delta of deltas) {
    const min = delta.min ?? -Infinity
    const max = delta.max ?? Infinity
    const amount = Number.isFinite(delta.amount) ? delta.amount : 0
    const value = (next[delta.stat] ?? 0) + amount

    next[delta.stat] = Math.min(max, Math.max(min, value))
  }

  return next
}
