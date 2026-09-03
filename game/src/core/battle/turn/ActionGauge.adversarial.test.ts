import { describe, expect, it } from 'vitest'
import { GAUGE_MAX, refundGauge, type GaugeActor } from './ActionGauge'

// QA adversarial probe (2026-09-04 quick review) — attack operator: value
// mutation (số âm) trên primitive công khai chưa có caller. Invariant:
// actionGauge luôn nằm trong khoảng 0..GAUGE_MAX (spec §3) — không bao giờ
// âm, kể cả khi caller truyền amount âm.
describe('ActionGauge adversarial: refundGauge', () => {
  it('amount âm không được đẩy gauge xuống dưới 0 (invariant 0..GAUGE_MAX)', () => {
    const actor: GaugeActor = { id: 'a', speed: 0, actionGauge: GAUGE_MAX - 100, alive: true }
    refundGauge(actor, -9999)
    expect(actor.actionGauge).toBeGreaterThanOrEqual(0)
    expect(actor.actionGauge).toBeLessThanOrEqual(GAUGE_MAX)
  })
})
