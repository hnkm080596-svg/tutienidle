// Turn-Based Combat Foundation (spec Phan 5) - thay MOI regen/decay
// resource theo deltaSeconds (Ngu Hanh The, Kiem The/Kiem Y, Kim The
// decay...): ap dung dung 1 lan tai thoi diem entity bat dau luot cua
// chinh no, khong co clock thu hai song song voi ActionGauge.
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
