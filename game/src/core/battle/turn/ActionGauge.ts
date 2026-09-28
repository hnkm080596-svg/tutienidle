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
 * Tieu hao gauge sau khi hanh dong. fractionConsumed=1 (mac dinh) = reset
 * hoan toan (luot thuong). fractionConsumed<1 = hanh dong "re" (spec: chi
 * ton nua gauge), actor con lai gan luot ke hon.
 * Gauge am TON TAI qua consume (Ung Tre debt: hinh phat -400 day gauge
 * xuong am de tri hoan luot ke) - mot consume fraction<1 tru tiep tren
 * dinh so am nhu moi khoan no khac. Consume day du (fraction=1) reset ve
 * 0 nhu moi luot thuong; mot debtor khong the hanh dong tu nhien cho
 * toi khi gauge vuot GAUGE_MAX nen nhanh nay unreachable trong gameplay.
 */
export function consumeGaugeAfterAction(actor: GaugeActor, fractionConsumed = 1): void {
  const clamped = Math.min(1, Math.max(0, fractionConsumed))

  if (clamped >= 1) {
    actor.actionGauge = 0
    return
  }

  actor.actionGauge = actor.actionGauge - GAUGE_MAX * clamped
}

/** Hoi gauge tuc thoi (vd buff "+300 gauge khi kill") - signed amount,
    ceiling GAUGE_MAX; floor = min(0, current): a non-debtor is never
    pushed below 0 (debt comes only from consume), while an Ung Tre
    debtor gets the authored amount applied against the debt - never a
    forgiven remainder or an inverted-sign haste. */
export function refundGauge(actor: GaugeActor, amount: number): void {
  const floor = Math.min(0, actor.actionGauge)
  actor.actionGauge = Math.min(GAUGE_MAX, Math.max(floor, actor.actionGauge + amount))
}

/** Hinh phat no Ung Tre - signed negative amount, no floor: debt is the
    only legal source of negative gauge, so the penalty subtracts raw
    (a clamped refund would eat part of it). */
export function applyDebtPenalty(actor: GaugeActor, amount: number): void {
  actor.actionGauge -= amount
}

/** Pacing reset on a wave lull - idle gauge drops to 0 but an Ung Tre
    debt survives the lull: a pacing reset is not a debt amnesty. */
export function resetGaugeOnWaveLull(actor: GaugeActor): void {
  actor.actionGauge = Math.min(0, actor.actionGauge)
}
