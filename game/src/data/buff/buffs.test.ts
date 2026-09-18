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
function capOf(def: BuffDefinition, type: string) {
  return (def.capabilities ?? []).find((c) => c.type === type)
}
const REFRESH = { onReapplyStacks: 'keep', onReapplyDuration: 'refresh' } as const
const ADD = { onReapplyStacks: 'add', onReapplyDuration: 'refresh' } as const

describe('buffs.ts — ported definitions match original values (buff2 shape)', () => {
  it('bong (dot) — stacking add max 5, coefficient 0.15/tầng fire', () => {
    const bong = byId('bong')

    expect(bong.stacking).toMatchObject({ ...ADD, maxStacks: 5 })
    expect(bong.lifetime.duration).toBe(4)
    expect(dotOf(bong)).toMatchObject({ coefficient: 0.15, element: 'fire', damageProfile: 'legacy_dot' })
  })

  describe('buff mới chuỗi Thuần (spec §7)', () => {
    it('thanh_tuyen — buff 6 holder-turns refresh, manaRegenPerTurn +8 flat + +10% (phap_tu domain)', () => {
      const b = byId('thanh_tuyen')

      expect(b.polarity).toBe('buff')
      expect(b.lifetime).toMatchObject({ clock: 'holder_turns', duration: 6 })
      expect(b.stacking).toMatchObject(REFRESH)
      expect(b.statModifiers).toContainEqual({ stat: 'manaRegenPerTurn', flat: 8, domain: 'phap_tu' })
      expect(b.statModifiers).toContainEqual({ stat: 'manaRegenPerTurn', percent: 0.1, domain: 'phap_tu' })
    })

    it('bang_giap — buff 6 holder-turns refresh, wardMax +50 + wardRegenPerTurn +5', () => {
      const b = byId('bang_giap')

      expect(b.lifetime.duration).toBe(6)
      expect(b.statModifiers).toContainEqual({ stat: 'wardMax', flat: 50 })
      expect(b.statModifiers).toContainEqual({ stat: 'wardRegenPerTurn', flat: 5 })
    })

    it('hoi_luu — buff 4 holder-turns refresh, leechPercent +0.20', () => {
      const b = byId('hoi_luu')

      expect(b.lifetime.duration).toBe(4)
      expect(b.statModifiers).toContainEqual({ stat: 'leechPercent', flat: 0.2 })
    })

    it('cau_mang_can — ailment root 4 holder-turns refresh (bản dài của troi_chan)', () => {
      const b = byId('cau_mang_can')

      expect(b.polarity).toBe('debuff')
      expect(b.lifetime.duration).toBe(4)
      expect(b.stacking).toMatchObject(REFRESH)
      expect(b.controls).toContainEqual({ type: 'root' })
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

    it('thanh_luy — buff 8 holder-turns stack max 8, defense +6%/tầng', () => {
      const b = byId('thanh_luy')

      expect(b.lifetime.duration).toBe(8)
      expect(b.stacking).toMatchObject({ ...ADD, maxStacks: 8 })
      expect(b.statModifiers).toContainEqual({ stat: 'defense', percent: 0.06 })
    })

    // Engine áp/gỡ THEO ID qua theManBuffId() — id phải khớp chính xác `the_man_<element>`.
    it('the_man_<el> ×5 — permanent, effects theo bảng §4', () => {
      const expected: Record<string, { stat: string; flat?: number; percent?: number; domain?: 'phap_tu' }[]> = {
        the_man_fire: [{ stat: 'ailmentPotencyPercent', percent: 0.15 }],
        the_man_water: [{ stat: 'manaRegenPerTurn', flat: 6, domain: 'phap_tu' }],
        the_man_wood: [{ stat: 'ailmentDurationPercent', percent: 0.2 }],
        the_man_metal: [{ stat: 'criticalRate', percent: 0.08 }],
        the_man_earth: [{ stat: 'defense', percent: 0.1 }],
      }

      for (const [id, modifiers] of Object.entries(expected)) {
        const b = byId(id)

        expect(b, `thiếu buff ${id}`).toBeDefined()
        expect(b.polarity).toBe('buff')
        expect(b.lifetime.clock).toBe('permanent')
        expect(b.stacking).toMatchObject(REFRESH)
        expect(b.statModifiers).toEqual(modifiers)
      }
    })

    it('ngung_lo/khai_son giữ nguyên', () => {
      expect(byId('ngung_lo').statModifiers).toContainEqual({ stat: 'manaRegenPerTurn', flat: 5, domain: 'phap_tu' })
      expect(byId('khai_son').statModifiers).toContainEqual({ stat: 'defense', percent: 0.08 })
    })

    it('dia_tru_bich — wardMax +100 + wardRegenPerTurn +8, no retaliate stat', () => {
      const b = byId('dia_tru_bich')

      expect(b.statModifiers).toContainEqual({ stat: 'wardMax', flat: 100 })
      expect(b.statModifiers).toContainEqual({ stat: 'wardRegenPerTurn', flat: 8 })
      expect(b.statModifiers!.some((m) => m.stat === 'wardBreakDamagePercent')).toBe(false)
    })

    it('dia_tru_thu — wardMax +40 + wardBreakDamagePercent +0.25', () => {
      const b = byId('dia_tru_thu')

      expect(b.statModifiers).toContainEqual({ stat: 'wardMax', flat: 40 })
      expect(b.statModifiers).toContainEqual({ stat: 'wardBreakDamagePercent', flat: 0.25 })
    })

    it('all 63 definitions (6 inline + 22 legacy + 1 Kiem Pho + 14 thuan-he + 5 talent + 3 boss + 12 the_tu) are present', () => {
      expect(buffs).toHaveLength(63)
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

  it('thach_hoa — carries BOTH its statModifier AND on_hit_proc grant in one definition', () => {
    const thachHoa = byId('thach_hoa')

    expect(thachHoa.statModifiers).toContainEqual({ stat: 'evasionRate', percent: -0.3 })
    expect(capOf(thachHoa, 'on_hit_proc')!.payload).toMatchObject({ chance: 0.5, appliesBuffId: 'choang' })
  })

  it('van_kiem_vu — armor ignore rides the periodic tags', () => {
    const dot = dotOf(byId('van_kiem_vu'))

    expect(dot).toMatchObject({ coefficient: 2, element: 'metal' })
    expect(dot.tags).toContain('armor_ignore_by_realm')
  })

  // stat-system-reimagined Task 4 (D18): Doc Can's heal half is a
  // 'dot_recovery' capability on the buff (damage-side consumption).
  it('doc_the — permanent + stack max 5 + ailmentPotency + dot_recovery grant', () => {
    const docThe = byId('doc_the')

    expect(docThe.lifetime.clock).toBe('permanent')
    expect(docThe.stacking).toMatchObject({ ...ADD, maxStacks: 5 })
    expect(docThe.statModifiers).toContainEqual({ stat: 'ailmentPotencyPercent', percent: 0.05 })
    expect(capOf(docThe, 'dot_recovery')!.payload).toMatchObject({ element: 'wood', healPercent: 0.02 })
    expect(docThe.statModifiers).toHaveLength(1)
    expect(docThe.capabilities).toHaveLength(1)
  })
})
