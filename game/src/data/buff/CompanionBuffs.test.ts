import { describe, expect, it } from 'vitest'
import { COMPANION_BUFFS } from './CompanionBuffs'
import { buffs } from './buffs'
import { BUFF_REGISTRY } from './BuffRegistry'
import type { BuffDefinition } from '@/core/buff2/BuffDefinition'

// P7-M-G (beta companion roster) — the four support buffs behind
// than_nong (healer) and khai_minh (buffer). Friendly party buffs pin
// non-stacking keep/refresh semantics; the ward marker mirrors
// son_nhac_ho_the's replace-instance contract so a recast replaces the
// marker and refreshes the ward pool atomically.

const byId = (id: string): BuffDefinition =>
  COMPANION_BUFFS.find((definition) => definition.id === id)!

describe('COMPANION_BUFFS shape', () => {
  it('contains exactly the four authored defs, all registered in the LIVE aggregate + battle registry', () => {
    expect(COMPANION_BUFFS.map((definition) => definition.id)).toEqual([
      'than_nong_hoi_phuc',
      'than_nong_than_dang_hoi_phuc',
      'khai_minh_ho_ve',
      'khai_minh_thanh_ho',
    ])

    for (const definition of COMPANION_BUFFS) {
      expect(buffs).toContain(definition)
      expect(() => BUFF_REGISTRY.get(definition.id), definition.id).not.toThrow()
    }
  })

  it('friendly buffs are unresistable: no application block and fixed duration scaling', () => {
    for (const definition of COMPANION_BUFFS) {
      // A friendly buff must never be resisted or shortened by the
      // holder's own ailment stats (The Tu precedent).
      expect(definition.application, `${definition.id}.application`).toBeUndefined()
      expect(definition.lifetime.scaling, `${definition.id}.lifetime.scaling`).toBe('fixed')
      expect(definition.dispellable, `${definition.id}.dispellable`).toBe(false)
    }
  })

  it('heal-over-time defs ride hpRegenPerTurn with keep/refresh non-stacking', () => {
    for (const id of ['than_nong_hoi_phuc', 'than_nong_than_dang_hoi_phuc']) {
      const definition = byId(id)

      expect(definition.kind).toBe('buff')
      expect(definition.instanceScope).toBe('per_source')
      expect(definition.stacking).toEqual({
        maxStacks: 1,
        onReapplyStacks: 'keep',
        onReapplyDuration: 'refresh',
      })
      expect(definition.lifetime.clock).toBe('holder_turns')
      expect(definition.statModifiers!.some((modifier) => modifier.stat === 'hpRegenPerTurn')).toBe(true)
    }
  })

  it('the ultimate heal also cleanses control on apply', () => {
    expect(byId('than_nong_than_dang_hoi_phuc').clearsCcOnApply).toBe(true)
    expect(byId('than_nong_hoi_phuc').clearsCcOnApply).toBeUndefined()
  })

  it('khai_minh_ho_ve grants might% + defense% to the party', () => {
    const definition = byId('khai_minh_ho_ve')

    expect(definition.statModifiers).toContainEqual({ stat: 'might', percent: 0.12 })
    expect(definition.statModifiers).toContainEqual({ stat: 'defense', percent: 0.12 })
  })

  it('khai_minh_thanh_ho is a per_target/latest marker carrying grantsExternalWard (son_nhac_ho_the contract)', () => {
    const definition = byId('khai_minh_thanh_ho')

    expect(definition.kind).toBe('marker')
    expect(definition.instanceScope).toBe('per_target')
    expect(definition.sourceOwnership).toBe('latest')
    expect(definition.stacking).toEqual({
      maxStacks: 1,
      onReapplyStacks: 'replace',
      onReapplyDuration: 'refresh',
      replaceInstanceOnReapply: true,
    })
    expect(
      definition.capabilities!.some(
        (capability) =>
          capability.type === 'marker' &&
          (capability.payload as { grantsExternalWard?: boolean }).grantsExternalWard === true,
      ),
    ).toBe(true)
  })
})
