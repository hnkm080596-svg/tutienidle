// T6-54 - damage numbers must render from `entity_vitals_changed`, not the
// dead 'damage' subscription (nothing under src/core/tribulation emits it).
// The conditional is captured in the pure helper `vitalsDamageAmount` so the
// rule is testable without mounting Phaser.
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { EntityVitalsChangedEvent } from '@/core/combat/EntityVitalsSystem'
import { vitalsDamageAmount } from './TribulationScene'

function vitalsEvent(overrides: Partial<EntityVitalsChangedEvent>): EntityVitalsChangedEvent {
  return {
    type: 'entity_vitals_changed',
    entityId: 'player',
    reason: 'heavenly_tribulation',
    hpBefore: 1000,
    hpAfter: 700,
    maxHp: 1000,
    wardBefore: 0,
    wardAfter: 0,
    maxWard: 0,
    mpBefore: 0,
    mpAfter: 0,
    maxMp: 0,
    amount: 300,
    killed: false,
    ...overrides,
  }
}

describe('TribulationScene - vitalsDamageAmount', () => {
  it('returns the hp delta for player damage reasons', () => {
    for (const reason of ['damage', 'dot', 'heavenly_tribulation', 'reaction', 'reflection', 'ward_break'] as const) {
      expect(vitalsDamageAmount(vitalsEvent({ reason }))).toBe(300)
    }
  })

  it('ignores non-player entities', () => {
    expect(vitalsDamageAmount(vitalsEvent({ entityId: 'enemy-1' }))).toBeNull()
  })

  it('ignores non-damage reasons (healing, leech, regen, stat_refresh, ward_spend, survive_lethal)', () => {
    for (const reason of ['healing', 'leech', 'regen', 'stat_refresh', 'ward_spend', 'survive_lethal'] as const) {
      // Even if hp somehow dropped, a non-damage reason must not render "-N".
      expect(vitalsDamageAmount(vitalsEvent({ reason }))).toBeNull()
    }
  })

  it('ignores damage-reason events where hp did not drop', () => {
    expect(vitalsDamageAmount(vitalsEvent({ hpAfter: 1000 }))).toBeNull()
    expect(vitalsDamageAmount(vitalsEvent({ hpBefore: 500, hpAfter: 900 }))).toBeNull()
  })
})
