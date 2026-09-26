import { describe, expect, it } from 'vitest'
import { GAUGE_MAX, refundGauge, type GaugeActor } from './ActionGauge'

// QA adversarial probe (2026-09-04 quick review) — attack operator: value
// mutation (số âm) trên primitive công khai chưa có caller. Contract
// (post-Ứng-Trệ): a non-debtor is never pushed below 0 — debt exists only
// via consume; an existing debtor floor-pins at its own residue so a
// push repays without forgiveness and a pushback cannot invert to haste.
describe('ActionGauge adversarial: refundGauge', () => {
  it('amount âm không đẩy gauge của non-debtor xuống dưới 0', () => {
    const actor: GaugeActor = { id: 'a', speed: 0, actionGauge: GAUGE_MAX - 100, alive: true }
    refundGauge(actor, -9999)
    expect(actor.actionGauge).toBeGreaterThanOrEqual(0)
    expect(actor.actionGauge).toBeLessThanOrEqual(GAUGE_MAX)
  })

  it('push dương trên gauge âm trả nợ đúng authored delta (không tha nợ)', () => {
    const actor: GaugeActor = { id: 'a', speed: 0, actionGauge: -400, alive: true }
    refundGauge(actor, 200)
    expect(actor.actionGauge).toBe(-200)
  })

  it('pushback trên gauge âm không được đảo dấu thành haste hay đào sâu nợ', () => {
    const actor: GaugeActor = { id: 'a', speed: 0, actionGauge: -400, alive: true }
    refundGauge(actor, -30)
    expect(actor.actionGauge).toBe(-400)
  })

  it('push vượt nợ trả hết rồi áp phần dư bình thường (cap GAUGE_MAX)', () => {
    const actor: GaugeActor = { id: 'a', speed: 0, actionGauge: -400, alive: true }
    refundGauge(actor, 500)
    expect(actor.actionGauge).toBe(100)
  })
})
