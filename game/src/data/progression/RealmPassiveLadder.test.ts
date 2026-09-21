import { describe, expect, it } from 'vitest'
import {
  CANONICAL_REALM_PASSIVE_LADDER,
  composeRealmRewards,
} from './RealmPassiveLadder'

// P7-M2 - the realm-entry passive ladder is authored ONCE here and
// composed into each way's realmRewards at module init; runtime resolves
// the way record only (no fallback authority).
describe('realm passive ladder composition (P7-M2)', () => {
  it('composeRealmRewards() fills every canonical realm with its canonical passive', () => {
    const table = composeRealmRewards()

    expect(Object.keys(table).sort()).toEqual(
      Object.keys(CANONICAL_REALM_PASSIVE_LADDER).sort(),
    )
    for (const [realmId, passiveSkillId] of Object.entries(CANONICAL_REALM_PASSIVE_LADDER)) {
      expect(table[realmId]?.passiveSkillId).toBe(passiveSkillId)
    }
  })

  it('a way-level passiveSkillId replaces the canonical pick for that realm only', () => {
    const table = composeRealmRewards({
      qi_refining: { passiveSkillId: 'passive_custom' },
    })

    expect(table.qi_refining?.passiveSkillId).toBe('passive_custom')
    expect(table.foundation_establishment?.passiveSkillId).toBe(
      CANONICAL_REALM_PASSIVE_LADDER.foundation_establishment,
    )
  })

  it('passiveSkillId: null suppresses the canonical grant for that realm only', () => {
    const table = composeRealmRewards({
      qi_refining: { passiveSkillId: null },
    })

    expect(table.qi_refining?.passiveSkillId).toBeNull()
    expect(table.foundation_establishment?.passiveSkillId).toBe(
      CANONICAL_REALM_PASSIVE_LADDER.foundation_establishment,
    )
  })

  it('technique/artifact overrides merge into the record without touching the passive', () => {
    const table = composeRealmRewards({
      foundation_establishment: {
        techniqueId: 'dai_ngu_hanh_quyet_truc_co',
        artifactId: 'ngu_hanh_chau',
      },
    })

    expect(table.foundation_establishment).toEqual({
      techniqueId: 'dai_ngu_hanh_quyet_truc_co',
      artifactId: 'ngu_hanh_chau',
      passiveSkillId: CANONICAL_REALM_PASSIVE_LADDER.foundation_establishment,
    })
  })

  it('non-ladder realms in overrides pass through verbatim', () => {
    const table = composeRealmRewards({
      some_future_realm: { techniqueId: 't1' },
    })

    expect(table.some_future_realm).toEqual({ techniqueId: 't1' })
    expect(table.qi_refining?.passiveSkillId).toBe(
      CANONICAL_REALM_PASSIVE_LADDER.qi_refining,
    )
  })
})
