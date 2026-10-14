import { describe, expect, it } from 'vitest'
import { AchievementSystem } from './AchievementSystem'

describe('generated achievement lifetime model', () => {
  // This oracle stores identities and amounts independently of SUT helpers.
  it.each(Array.from({ length: 100 }, (_, index) => index + 1))('seed %i: 100 actions with retries, failed claims and JSON reopen', (seed) => {
    let randomState = seed
    const next = () => { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState }
    const playerId = `campaign-${seed}`
    let system = new AchievementSystem(playerId, 0)
    const accepted = new Map<string, number>()
    let expectedTotal = 0
    let claimed = false
    let deliveries = 0
    const trace: string[] = []
    for (let step = 0; step < 100; step++) {
      const command = next() % 5
      trace.push(`${step}:${command}`)
      if (command < 2) {
        const eventId = `receipt-${next() % 25}`
        const amount = 1 + next() % 4
        const receipt = { playerId, eventId, sourceId: 'campaign-fixture', occurredAt: 0, committed: true,
          authority: 'inventory', kind: 'material_delivered', materialId: 'mortal_wood_decade', quantityDelivered: amount } as const
        const fresh = !accepted.has(eventId)
        expect(system.ingest(receipt), trace.join(',')).toBe(fresh)
        if (fresh) { accepted.set(eventId, amount); expectedTotal += amount }
      } else if (command === 2) {
        const fresh = new AchievementSystem(playerId, 0)
        expect(fresh.restore(JSON.parse(JSON.stringify(system.snapshot()))), trace.join(',')).toBe(true)
        system = fresh
      } else {
        const success = command === 4
        const result = system.claim('ach_m01_lam_thu', () => { if (success) deliveries++; return success })
        expect(result, trace.join(',')).toBe(claimed ? 'already-claimed' : expectedTotal < 20 ? 'not-ready' : success ? 'granted' : 'delivery-failed')
        if (!claimed && expectedTotal >= 20 && success) claimed = true
      }
      expect(system.get('ach_m01_lam_thu')?.current, trace.join(',')).toBe(Math.min(expectedTotal, 20))
      expect(system.get('ach_m01_lam_thu')?.claimed, trace.join(',')).toBe(claimed)
      expect(system.snapshot().counters.mortal_wood ?? 0, trace.join(',')).toBe(expectedTotal)
      expect(system.snapshot().receiptIds.length, trace.join(',')).toBe(accepted.size)
      expect(deliveries, trace.join(',')).toBe(claimed ? 1 : 0)
    }
  })
})
