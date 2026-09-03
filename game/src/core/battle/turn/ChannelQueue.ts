// Turn-Based Combat Foundation (spec Phần 3) — thay thế Cast Time thời
// gian thực: entity chọn skill có chargeSteps thì KHÔNG resolve ngay,
// bị khoá khỏi vòng đua gauge (integration layer loại actorId này khỏi
// resolveNextTurn) cho đến khi đủ remainingTurns lượt của NGƯỜI KHÁC đã
// trôi qua. Không cho phép hành động sớm hoặc bị bỏ qua giữa chừng.

export interface ChargingAction {
  actorId: string
  remainingTurns: number
}

export function beginCharge(actorId: string, chargeSteps: number): ChargingAction {
  return { actorId, remainingTurns: Math.max(1, chargeSteps) }
}

export function isCharging(charges: ChargingAction[], actorId: string): boolean {
  return charges.some((charge) => charge.actorId === actorId)
}

export interface ChargeTickResult {
  resolved: string[]
  remaining: ChargingAction[]
}

export function tickChargesOnTurnResolved(charges: ChargingAction[]): ChargeTickResult {
  const resolved: string[] = []
  const remaining: ChargingAction[] = []

  for (const charge of charges) {
    const remainingTurns = charge.remainingTurns - 1

    if (remainingTurns <= 0) {
      resolved.push(charge.actorId)
    } else {
      remaining.push({ actorId: charge.actorId, remainingTurns })
    }
  }

  return { resolved, remaining }
}
