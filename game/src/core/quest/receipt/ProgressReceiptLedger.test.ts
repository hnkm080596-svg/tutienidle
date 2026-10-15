import { describe, expect, it } from 'vitest'
import { ProgressReceiptLedger, type ProgressReceipt } from './ProgressReceiptLedger'

const identity = { playerId: 'player-A', runId: 'run-A', enabledAtMs: 100 }

function material(eventId: string, sourceId: string, units = 3): ProgressReceipt {
  return {
    version: 1, playerId: identity.playerId, runId: identity.runId, eventId,
    producer: 'inventory', sourceId, committedAtMs: 120, units,
    payload: { kind: 'material_delivered', materialId: 'wood', delivered: units },
  }
}

describe('ProgressReceiptLedger durable delivery', () => {
  it('multicasts a receipt to different objectives and consumers exactly once', () => {
    const ledger = new ProgressReceiptLedger(identity)
    const receipt = material('event-1', 'delivery-1')
    expect(ledger.record(receipt, 'quest:1', 'acquire:wood')).toBe('applied')
    expect(ledger.record(receipt, 'quest:1', 'acquire:wood')).toBe('duplicate')
    expect(ledger.record(receipt, 'quest:1', 'acquire:other')).toBe('applied')
    expect(ledger.record(receipt, 'achievement:1', 'counter:wood')).toBe('applied')
    expect(ledger.snapshot().entries).toHaveLength(1)
    expect(ledger.snapshot().revision).toBe(3)

    const restored = new ProgressReceiptLedger(identity)
    expect(restored.restore(JSON.parse(JSON.stringify(ledger.snapshot())))).toBe(true)
    expect(restored.record(receipt, 'quest:1', 'acquire:wood')).toBe('duplicate')
    expect(restored.record(receipt, 'achievement:1', 'counter:wood')).toBe('duplicate')
    expect(restored.record(receipt, 'quest:later', 'new-leaf')).toBe('applied')
  })

  it('rejects source and event collisions without consuming the new objective', () => {
    const ledger = new ProgressReceiptLedger(identity)
    const original = material('event-1', 'delivery-1')
    expect(ledger.record(original, 'quest', 'first')).toBe('applied')
    expect(ledger.record({ ...original, units: 9, payload: { ...original.payload, delivered: 9 } }, 'quest', 'second')).toBe('collision')
    expect(ledger.record(material('event-2', 'delivery-1'), 'quest', 'second')).toBe('collision')
    expect(ledger.record({ ...original, producer: 'inventory', committedAtMs: 121 }, 'quest', 'second')).toBe('collision')
    expect(ledger.record(original, 'quest', 'second')).toBe('applied')
    const otherKind = {
      ...original, producer: 'realm',
      payload: { kind: 'realm_reached', realmId: 'qi_refining' }, units: 1,
    }
    expect(ledger.record(otherKind, 'quest', 'second')).toBe('collision')
  })

  it('accepts all declared producer-owned receipt kinds and rejects unknown fields', () => {
    const cases = [
      { producer: 'inventory', payload: { kind: 'material_delivered', materialId: 'wood', delivered: 1 } },
      { producer: 'production', payload: { kind: 'production_batch_claimed', batchId: 'batch', siteKind: 'mine' } },
      { producer: 'battle', payload: { kind: 'enemy_defeated', battleId: 'battle', enemyId: 'wolf', zoneId: 'mountain' } },
      { producer: 'battle', payload: { kind: 'battle_victory', battleId: 'battle', formationAtBattleStart: false } },
      { producer: 'battle', payload: { kind: 'stage_clear', stageId: 'stage', battleId: 'battle', formationAtBattleStart: true } },
      { producer: 'realm', payload: { kind: 'realm_reached', realmId: 'foundation' } },
      { producer: 'realm', payload: { kind: 'element_attained', elementId: 'fire' } },
      { producer: 'technique', payload: { kind: 'technique_rank_reached', techniqueId: 't1', rank: 1 } },
      { producer: 'skill', payload: { kind: 'skill_node_progress_committed', nodeId: 'n1', level: 1 } },
      { producer: 'body', payload: { kind: 'body_refinement_committed', realmAtCommit: 'foundation' } },
      { producer: 'cultivation', payload: { kind: 'cultivation_session_committed', sessionId: 'session' } },
      { producer: 'equipment', payload: { kind: 'equipment_equipped', instanceId: 'sword' } },
      { producer: 'equipment', payload: { kind: 'equipment_enhanced', instanceId: 'sword', enhancementId: 'enhance' } },
      { producer: 'alchemy', payload: { kind: 'alchemy_crafted', craftId: 'craft', recipeId: 'recipe' } },
      { producer: 'pill', payload: { kind: 'pill_used', pillId: 'pill' } },
      { producer: 'companion', payload: { kind: 'companion_entitled', companionId: 'c1' } },
      { producer: 'formation', payload: { kind: 'formation_companion_assigned', companionId: 'c1' } },
      { producer: 'quest', payload: { kind: 'daily_quest_claimed', claimId: 'd1', utcDayBucket: 0 } },
      { producer: 'quest', payload: { kind: 'weekly_quest_claimed', claimId: 'w1', utcWeekBucket: 0 } },
      { producer: 'quest', payload: { kind: 'quest_claimed', questId: 'q1', claimId: 'claim' } },
    ]
    const ledger = new ProgressReceiptLedger(identity)
    cases.forEach((item, index) => {
      const base = { version: 1, playerId: identity.playerId, runId: identity.runId,
        eventId: `event-${index}`, sourceId: `source-${index}`,
        producer: item.producer, committedAtMs: 120, units: 1, payload: item.payload }
      expect(ledger.record({ ...base, unexpected: 'forged' }, 'quest', `leaf-${index}`)).toBe('invalid')
      expect(ledger.record({ ...base, payload: { ...base.payload, unexpected: 'forged' } }, 'quest', `leaf-${index}`)).toBe('invalid')
      expect(ledger.record(base, 'quest', `leaf-${index}`)).toBe('applied')
    })
    expect(ledger.snapshot().revision).toBe(cases.length)
    const restored = new ProgressReceiptLedger(identity)
    expect(restored.restore(JSON.parse(JSON.stringify(ledger.snapshot())))).toBe(true)
    cases.forEach((item, index) => {
      expect(restored.record({ version: 1, playerId: identity.playerId, runId: identity.runId, eventId: `event-${index}`,
        sourceId: `source-${index}`, producer: item.producer, committedAtMs: 120,
        units: 1, payload: item.payload }, 'quest', `leaf-${index}`)).toBe('duplicate')
    })
  })

  it('rejects invalid counts, payload mismatch, false authority and stale run/player/time', () => {
    const ledger = new ProgressReceiptLedger(identity)
    const base = material('event-1', 'delivery-1')
    const invalid = [
      { ...base, units: 0 },
      { ...base, units: Number.NaN },
      { ...base, units: Number.POSITIVE_INFINITY },
      { ...base, units: 1.2 },
      { ...base, units: Number.MAX_SAFE_INTEGER + 1 },
      { ...base, payload: { ...base.payload, delivered: 0 } },
      { ...base, payload: { kind: 'enemy_defeated', enemyId: 'wolf', battleId: 'battle-1' } },
      { ...base, producer: 'ui' },
      { ...base, eventId: '' },
      { ...base, sourceId: '' },
      { ...base, committedAtMs: Number.NaN },
      { ...base, committedAtMs: 99 },
      { ...base, playerId: 'someone-else' },
      { ...base, runId: 'previous-run' },
    ]
    for (const candidate of invalid) {
      expect(ledger.record(candidate, 'quest', 'leaf')).not.toBe('applied')
      expect(ledger.snapshot().entries).toHaveLength(0)
    }
    expect(ledger.record(base, '', 'leaf')).toBe('invalid')
    expect(ledger.record(base, 'quest', '')).toBe('invalid')
    expect(ledger.record(base, 'quest', 'leaf')).toBe('applied')
  })

  it('validates per-kind payload, known producer, and battle-start formation witness', () => {
    const ledger = new ProgressReceiptLedger(identity)
    const battle: ProgressReceipt = {
      version: 1, playerId: 'player-A', runId: 'run-A', eventId: 'win-1',
      producer: 'battle', sourceId: 'battle-1', committedAtMs: 120, units: 1,
      payload: { kind: 'battle_victory', battleId: 'battle-1', formationAtBattleStart: true },
    }
    expect(ledger.record({ ...battle, payload: { ...battle.payload, formationAtBattleStart: 'true' } }, 'quest', 'win')).toBe('invalid')
    expect(ledger.record({ ...battle, producer: 'quest' }, 'quest', 'win')).toBe('invalid')
    expect(ledger.record(battle, 'quest', 'win')).toBe('applied')
  })

  it('restores atomically, prevents rollback and detaches snapshots', () => {
    const ledger = new ProgressReceiptLedger(identity)
    const receipt = material('event-1', 'delivery-1')
    expect(ledger.record(receipt, 'quest', 'leaf')).toBe('applied')
    const snapshot = ledger.snapshot()
    const before = JSON.stringify(snapshot)
    snapshot.entries[0]!.allocations[0]!.objectiveId = 'tampered'
    expect(ledger.snapshot().entries[0]!.allocations[0]!.objectiveId).toBe('leaf')
    const fresh = new ProgressReceiptLedger(identity)
    expect(fresh.restore(ledger.snapshot())).toBe(true)
    const next = fresh.snapshot()
    expect(fresh.record(receipt, 'achievement', 'wood')).toBe('applied')
    expect(fresh.restore(next)).toBe(false)
    expect(fresh.snapshot().revision).toBe(2)
    expect(fresh.restore({ ...fresh.snapshot(), revision: 999 })).toBe(false)
    expect(fresh.restore({ ...fresh.snapshot(), entries: [{ ...fresh.snapshot().entries[0], receipt: { ...receipt, sourceId: 'forged' } }] })).toBe(false)
    expect(fresh.snapshot().revision).toBe(2)
    expect(before).toContain('delivery-1')
    expect(fresh.restore(JSON.parse(JSON.stringify(fresh.snapshot())))).toBe(true)
    expect(fresh.snapshot().revision).toBe(2)
    expect(fresh.record(material('event-2', 'delivery-1'), 'quest', 'other')).toBe('collision')
  })

  it('canonicalizes reordered JSON keys and detaches caller-owned receipt data', () => {
    const ledger = new ProgressReceiptLedger(identity)
    const receipt = { ...material('event-1', 'source-1'), payload: { kind: 'material_delivered', materialId: 'wood', delivered: 3 } }
    expect(ledger.record(receipt, 'quest', 'leaf')).toBe('applied')
    receipt.payload.materialId = 'changed'
    expect(ledger.snapshot().entries[0]!.receipt.payload).toEqual({ kind: 'material_delivered', materialId: 'wood', delivered: 3 })
    const reordered = {
      payload: { delivered: 3, materialId: 'wood', kind: 'material_delivered' },
      producer: 'inventory', units: 3, committedAtMs: 120, sourceId: 'source-1',
      runId: 'run-A', playerId: 'player-A', eventId: 'event-1', version: 1,
    }
    expect(ledger.record(reordered, 'quest', 'leaf')).toBe('duplicate')
    expect(ledger.record(reordered, 'achievement', 'counter')).toBe('applied')
    const snapshot = ledger.snapshot()
    const reopened = new ProgressReceiptLedger(identity)
    expect(reopened.restore(snapshot)).toBe(true)
    snapshot.entries[0]!.allocations[0]!.consumerId = 'changed'
    expect(reopened.record(reordered, 'quest', 'leaf')).toBe('duplicate')
  })

  it('rejects hostile/malformed serialized ledgers and duplicate indices without partial writes', () => {
    const ledger = new ProgressReceiptLedger(identity)
    const receipt = material('event-1', 'delivery-1')
    expect(ledger.record(receipt, 'quest', 'leaf')).toBe('applied')
    const good = ledger.snapshot()
    const candidates: unknown[] = [
      null, [], 'string', {}, { ...good, runId: 'wrong' },
      { ...good, entries: [...good.entries, ...good.entries], revision: 2 },
      { ...good, entries: [{ ...good.entries[0], allocations: [...good.entries[0]!.allocations, ...good.entries[0]!.allocations] }], revision: 2 },
      { ...good, entries: [{ ...good.entries[0], receipt: { ...receipt, units: 0 } }] },
      { ...good, entries: [{ ...good.entries[0], receipt: { ...receipt, eventId: '__proto__', sourceId: '__proto__' } }] },
    ]
    for (const candidate of candidates) {
      expect(ledger.restore(candidate)).toBe(false)
      expect(ledger.snapshot()).toEqual(good)
    }
  })

  it('survives deterministic offline replay sequences with reordered deliveries', () => {
    for (let seed = 1; seed <= 100; seed++) {
      let ledger = new ProgressReceiptLedger(identity)
      let value = seed
      const rand = () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value }
      const receipts = Array.from({ length: 20 }, (_, i) => material('event-' + i, 'delivery-' + i, 1))
      const expected = new Set<string>()
      for (let step = 0; step < 100; step++) {
        const index = rand() % receipts.length
        const consumer = 'quest:' + (rand() % 5)
        const leaf = 'leaf:' + (rand() % 4)
        const key = index + '/' + consumer + '/' + leaf
        expect(ledger.record(receipts[index]!, consumer, leaf)).toBe(expected.has(key) ? 'duplicate' : 'applied')
        expected.add(key)
        if (step % 17 === 0) {
          const reopened = new ProgressReceiptLedger(identity)
          expect(reopened.restore(JSON.parse(JSON.stringify(ledger.snapshot())))).toBe(true)
          expect(reopened.snapshot()).toEqual(ledger.snapshot())
          ledger = reopened
        }
      }
      expect(ledger.snapshot().revision).toBe(expected.size)
    }
  })
})
