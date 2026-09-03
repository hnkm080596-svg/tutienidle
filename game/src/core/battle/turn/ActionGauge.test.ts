import { describe, expect, it } from 'vitest'
import {
  GAUGE_MAX,
  advanceGauge,
  isGaugeReady,
  consumeGaugeAfterAction,
  refundGauge,
  type GaugeActor,
} from './ActionGauge'

function makeActor(speed: number, actionGauge = 0): GaugeActor {
  return { id: 'a', speed, actionGauge, alive: true }
}

describe('ActionGauge', () => {
  it('advanceGauge: gauge tăng theo speed * stepRate', () => {
    const actor = makeActor(10)
    advanceGauge(actor, 1)
    expect(actor.actionGauge).toBe(10)
    advanceGauge(actor, 2)
    expect(actor.actionGauge).toBe(30)
  })

  it('isGaugeReady: true khi gauge >= GAUGE_MAX', () => {
    const actor = makeActor(0, GAUGE_MAX - 1)
    expect(isGaugeReady(actor)).toBe(false)
    actor.actionGauge = GAUGE_MAX
    expect(isGaugeReady(actor)).toBe(true)
    actor.actionGauge = GAUGE_MAX + 50
    expect(isGaugeReady(actor)).toBe(true)
  })

  it('consumeGaugeAfterAction: mặc định reset toàn bộ (full turn)', () => {
    const actor = makeActor(0, GAUGE_MAX + 50)
    consumeGaugeAfterAction(actor)
    expect(actor.actionGauge).toBe(0)
  })

  it('consumeGaugeAfterAction: fractionConsumed=0.5 chỉ trừ nửa GAUGE_MAX', () => {
    const actor = makeActor(0, GAUGE_MAX)
    consumeGaugeAfterAction(actor, 0.5)
    expect(actor.actionGauge).toBe(GAUGE_MAX * 0.5)
  })

  it('consumeGaugeAfterAction: không âm khi trừ nhiều hơn gauge hiện có', () => {
    const actor = makeActor(0, 100)
    consumeGaugeAfterAction(actor, 1)
    expect(actor.actionGauge).toBe(0)
  })

  it('refundGauge: cộng thêm nhưng clamp ở GAUGE_MAX', () => {
    const actor = makeActor(0, GAUGE_MAX - 100)
    refundGauge(actor, 300)
    expect(actor.actionGauge).toBe(GAUGE_MAX)
  })
})
