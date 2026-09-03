// Turn-Based Combat Foundation (2026-09-03 spec, Phần 3) — thanh hành
// động ATB: mỗi entity tích luỹ actionGauge theo speed mỗi "step" (đơn vị
// logic rời rạc, KHÔNG phải giây thực). Ai đạt GAUGE_MAX trước hành động
// trước — xem TurnQueue.ts cho vòng lặp tìm actor kế tiếp.

export const GAUGE_MAX = 1000

export interface GaugeActor {
  id: string
  speed: number
  actionGauge: number
  alive: boolean
}

export function advanceGauge(actor: GaugeActor, stepRate: number): void {
  actor.actionGauge += actor.speed * stepRate
}

export function isGaugeReady(actor: GaugeActor): boolean {
  return actor.actionGauge >= GAUGE_MAX
}

/**
 * Tiêu hao gauge sau khi hành động. fractionConsumed=1 (mặc định) = reset
 * hoàn toàn (lượt thường). fractionConsumed<1 = hành động "rẻ" (spec: chỉ
 * tốn nửa gauge), actor còn lại gần lượt kế hơn.
 */
export function consumeGaugeAfterAction(actor: GaugeActor, fractionConsumed = 1): void {
  const clamped = Math.min(1, Math.max(0, fractionConsumed))

  if (clamped >= 1) {
    actor.actionGauge = 0
    return
  }

  actor.actionGauge = Math.max(0, actor.actionGauge - GAUGE_MAX * clamped)
}

/** Hồi gauge tức thời (vd buff "+300 gauge khi kill") — clamp trong 0..GAUGE_MAX. */
export function refundGauge(actor: GaugeActor, amount: number): void {
  actor.actionGauge = Math.min(GAUGE_MAX, Math.max(0, actor.actionGauge + amount))
}
