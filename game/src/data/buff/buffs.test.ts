import { describe, it, expect } from 'vitest'
import { buffs } from './buffs'
import type { BuffDefinition, PeriodicDamageDefinition } from '@/core/buff2/BuffDefinition'

// M4 — parity test rewritten to the canonical buff2 shape: the same
// numbers, asserted in their new homes (dot.dpsRatio -> periodic
// .coefficient; stackMode -> stacking.onReapplyStacks; duration ->
// lifetime.duration; cc -> controls; proc/trigger/economy effects ->
// capabilities payloads).

function byId(id: string): BuffDefinition {
  return buffs.find((b) => b.id === id)!
}
function dotOf(def: BuffDefinition): PeriodicDamageDefinition {
  return def.periodic!.find((p) => p.type === 'damage') as PeriodicDamageDefinition
}
const REFRESH = { onReapplyStacks: 'keep', onReapplyDuration: 'refresh' } as const
const ADD = { onReapplyStacks: 'add', onReapplyDuration: 'refresh' } as const

describe('buffs.ts — ported definitions match original values (buff2 shape)', () => {
  // canonical-seals S1 -- the five canonical seals replaced the legacy
  // elemental ailments (locked: duration 3, maxStacks 5 add/refresh,
  // per_source, ailment resistance, dispellable).
  it('canonical seals — locked shared shape per element', () => {
    const expected: Record<string, { element: string; coefficient: number }> = {
      hoa_an: { element: 'fire', coefficient: 0.15 },
      doc_can: { element: 'wood', coefficient: 0.2 },
      liet_thuong: { element: 'metal', coefficient: 0.2 },
      han_tuc: { element: 'water', coefficient: 0.25 },
    }
    for (const [id, want] of Object.entries(expected)) {
      const seal = byId(id)
      expect(seal.kind, id).toBe('ailment')
      expect(seal.element, id).toBe(want.element)
      expect(seal.instanceScope, id).toBe('per_source')
      expect(seal.stacking, id).toMatchObject({ ...ADD, maxStacks: 5 })
      expect(seal.lifetime, id).toMatchObject({ clock: 'holder_turns', duration: 3, scaling: 'ailment_scaled' })
      expect(seal.application?.resistance, id).toBe('ailment')
      expect(seal.dispellable, id).toBe(true)
      expect(dotOf(seal), `${id}.dot`).toMatchObject({
        id: `${id}.dot`,
        element: want.element,
        coefficient: want.coefficient,
        damageProfile: 'legacy_dot',
      })
    }
  })

  it('tran_an — PURE stacking setup state: no standalone mechanics', () => {
    const tranAn = byId('tran_an')

    expect(tranAn.element).toBe('earth')
    expect(tranAn.stacking).toMatchObject({ ...ADD, maxStacks: 5 })
    expect(tranAn.lifetime).toMatchObject({ clock: 'holder_turns', duration: 3, scaling: 'ailment_scaled' })
    expect(tranAn.application?.resistance).toBe('ailment')
    expect(tranAn.periodic).toBeUndefined()
    expect(tranAn.statModifiers).toBeUndefined()
    expect(tranAn.capabilities).toBeUndefined()
    expect(tranAn.controls).toBeUndefined()
  })

  describe('buff mới chuỗi Thuần (spec §7)', () => {
    it('thanh_tuyen — buff 6 holder-turns refresh, manaRegenPerTurn +8 flat + +10% (spell domain)', () => {
      const b = byId('thanh_tuyen')

      expect(b.polarity).toBe('buff')
      expect(b.lifetime).toMatchObject({ clock: 'holder_turns', duration: 6 })
      expect(b.stacking).toMatchObject(REFRESH)
      expect(b.statModifiers).toContainEqual({ stat: 'manaRegenPerTurn', flat: 8, domain: 'spell' })
      expect(b.statModifiers).toContainEqual({ stat: 'manaRegenPerTurn', percent: 0.1, domain: 'spell' })
    })

    // Phap Tu Reimagine (2026-09-26): the chain-era defs below are
    // retired with their skills (bang_giap, hoi_luu, cau_mang_can,
    // thanh_luy, dia_tru_bich, dia_tru_thu, the_man_<el> x5).
    it('retired chain-era buffs are gone', () => {
      for (const id of [
        'bang_giap',
        'hoi_luu',
        'cau_mang_can',
        'thanh_luy',
        'dia_tru_bich',
        'dia_tru_thu',
        'the_man_fire',
        'the_man_water',
        'the_man_wood',
        'the_man_metal',
        'the_man_earth',
      ]) {
        expect(buffs.find((b) => b.id === id), `retired ${id} còn sót`).toBeUndefined()
      }
    })

    it('kim_giap — buff 6 holder-turns refresh, defense +15%', () => {
      const b = byId('kim_giap')

      expect(b.statModifiers).toContainEqual({ stat: 'defense', percent: 0.15 })
    })

    it('dia_tru — buff 6 holder-turns refresh, wardMax +60 + wardRegenPerTurn +6', () => {
      const b = byId('dia_tru')

      expect(b.statModifiers).toContainEqual({ stat: 'wardMax', flat: 60 })
      expect(b.statModifiers).toContainEqual({ stat: 'wardRegenPerTurn', flat: 6 })
    })

    it('phap trang windows + markers — 3-turn holder windows, bound markers', () => {
      for (const id of ['tam_muoi', 'van_moc', 'kim_y', 'trong_nhac']) {
        const b = byId(id)

        expect(b, `thiếu window ${id}`).toBeDefined()
        expect(b.kind).toBe('buff')
        expect(b.instanceScope).toBe('per_source')
        expect(b.stacking).toMatchObject(REFRESH)
        expect(b.lifetime).toMatchObject({ clock: 'holder_turns', duration: 3 })
        expect(b.dispellable).toBe(false)
      }

      for (const [id, source] of [
        ['sinh_co', 'van_moc'],
        ['sinh_co_chu', 'van_moc'],
        ['kim_liet', 'kim_y'],
        ['trong_the', 'trong_nhac'],
        ['trong_the_da_bi', 'trong_nhac'],
      ] as const) {
        const b = byId(id)

        expect(b, `thiếu marker ${id}`).toBeDefined()
        expect(b.kind).toBe('marker')
        expect(b.boundToSourceBuffId).toBe(source)
      }

      expect(byId('kim_liet').stacking).toMatchObject({ maxStacks: 3, onReapplyStacks: 'add' })
      expect(byId('trong_the').stacking).toMatchObject({ maxStacks: 3, onReapplyStacks: 'add' })
      expect(byId('sinh_co').capabilities).toContainEqual({
        id: 'sinh_co.growth',
        type: 'periodic_growth',
        payload: { definitionId: 'doc_can', stacks: 1, consume: true },
      })
    })

    it('all 64 definitions (6 inline + 16 legacy + 1 Kiem Pho + 3 thuan-he + 5 talent + 3 boss + 12 the_tu + 5 reaction + 4 companion + 9 trang) are present', () => {
      expect(buffs).toHaveLength(64)
    })
  })

  it('choang (cc) — control stun port nguyên vẹn', () => {
    expect(byId('choang').controls).toContainEqual({ type: 'stun' })
  })

  it('lam_cham — statModifier + convertsToId/convertsAfterContinuousTurns port nguyên vẹn', () => {
    const lamCham = byId('lam_cham')

    expect(lamCham.lifetime.duration).toBe(4)
    expect(lamCham.convertsToId).toBe('dong_bang')
    expect(lamCham.convertsAfterContinuousTurns).toBe(2)
    expect(lamCham.statModifiers).toContainEqual({ stat: 'speed', percent: -0.3 })
  })

  it('van_kiem_vu — armor ignore rides the periodic tags', () => {
    const dot = dotOf(byId('van_kiem_vu'))

    expect(dot).toMatchObject({ coefficient: 2, element: 'metal' })
    expect(dot.tags).toContain('armor_ignore_by_realm')
  })
})
