import { describe, expect, it } from 'vitest'
import { buildKiemPhoProvider, reachableKiemPhoComboIds } from './KiemPhoProvider'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import type { OrbId } from './KiemTuState'
import type { KiemPhoComboModifier } from './KiemPhoSystem'
import type { DynamicBasicCastContext } from '../battle/turn/TurnSkillAction'

// Kiem Tu Reimagined Task 6 — hien provider contract: preset cursor,
// manual pick without cursor advance, combo fire through
// onCastResolved, battle-boundary reset (auto-repeat safety).

function hienPlayer(preset: OrbId[], realmId = 'qi_refining'): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = realmId
  player.cultivationPath = 'sword'
  player.cultivationWay = 'sword_pathway'
  player.swordPath = { preset, kiemY: 0, kiemDaoCount: 1, kiemDaoBase: 1 }
  return player
}

function castCtx(resolvedSkillId: string): DynamicBasicCastContext {
  return {
    battle: { players: [], enemies: [], state: 'fighting' },
    actor: {} as DynamicBasicCastContext['actor'],
    resolvedSkillId,
    landedTargetIds: [],
    resolveBuff: () => {},
  }
}

describe('KiemPhoProvider', () => {
  it('resolveBasic cycles the preset in order', () => {
    const provider = buildKiemPhoProvider(hienPlayer(['orb_dam', 'orb_chem']), [])
    const participant = {} as Parameters<typeof provider.resolveBasic>[0]

    expect(provider.resolveBasic(participant).id).toBe('orb_dam')
    expect(provider.resolveBasic(participant).id).toBe('orb_chem')
    expect(provider.resolveBasic(participant).id).toBe('orb_dam')
  })

  it('combo fires on the third orb_dam and returns the tam_thich extra def', () => {
    const provider = buildKiemPhoProvider(hienPlayer(['orb_dam']), [])

    expect(provider.onCastResolved!(castCtx('orb_dam'))).toEqual([])
    expect(provider.onCastResolved!(castCtx('orb_dam'))).toEqual([])

    const extras = provider.onCastResolved!(castCtx('orb_dam'))
    expect(extras).toHaveLength(1)
    expect(extras[0]!.id).toBe('tam_thich')
    expect(extras[0]!.presetId).toBe('kiem_combo_tam_thich')
    expect(extras[0]!.damage?.multiplier).toBe(2.5)

    // Log cleared — a 4th cast starts fresh.
    expect(provider.onCastResolved!(castCtx('orb_dam'))).toEqual([])
  })

  it('combo extra def carries EVERY granted buff (multi-capstone composition)', () => {
    const buffMod = (orb: OrbId, count: number, definitionId: string): KiemPhoComboModifier => ({
      nodeId: `test_${definitionId}`,
      priority: 0,
      matches: combo => combo.pattern.filter(o => o === orb).length >= count,
      apply: combo => ({
        ...combo,
        pattern: [...combo.pattern],
        appliesBuffs: [...(combo.appliesBuffs ?? []), { definitionId, target: 'target' }],
      }),
    })
    // golden_core unlocks len-4 matching; preset [C,B,D,C] fires
    // 'tram_phach_thich_tram' which matches both capstone predicates.
    const provider = buildKiemPhoProvider(
      hienPlayer(['orb_chem', 'orb_bo', 'orb_dam', 'orb_chem'], 'golden_core'),
      [buffMod('orb_chem', 2, 'kiem_thuong'), buffMod('orb_bo', 1, 'suy_nhuoc')],
    )
    provider.onCastResolved!(castCtx('orb_chem'))
    provider.onCastResolved!(castCtx('orb_bo'))
    provider.onCastResolved!(castCtx('orb_dam'))
    const extras = provider.onCastResolved!(castCtx('orb_chem'))
    expect(extras).toHaveLength(1)
    expect(extras[0]!.presetId).toBe('kiem_combo_tram_phach_thich_tram')
    expect((extras[0]!.appliesBuffs ?? []).map(b => b.definitionId).sort()).toEqual([
      'kiem_thuong',
      'suy_nhuoc',
    ])
  })

  it('resolveManualPick validates realm unlock and does NOT advance the cursor', () => {
    const player = hienPlayer(['orb_dam'], 'foundation_establishment')
    const provider = buildKiemPhoProvider(player, [])
    const participant = {} as Parameters<typeof provider.resolveBasic>[0]

    expect(provider.resolveManualPick!('orb_bo')).toBeNull()          // realm 3 orb at realm 2
    expect(provider.resolveManualPick!('orb_chem')?.id).toBe('orb_chem')
    expect(provider.resolveBasic(participant).id).toBe('orb_dam')      // cursor still 0
  })

  it('manual picks land in the log and can complete a combo', () => {
    const provider = buildKiemPhoProvider(hienPlayer(['orb_chem']), [])

    // Two auto casts of orb_dam would not be in this preset — simulate
    // two manual orb_dam picks resolving, then a third.
    provider.resolveManualPick!('orb_dam')
    provider.onCastResolved!(castCtx('orb_dam'))
    provider.onCastResolved!(castCtx('orb_dam'))
    const extras = provider.onCastResolved!(castCtx('orb_dam'))
    expect(extras[0]?.id).toBe('tam_thich')
  })

  it('resetForBattle restores cursor and log (auto-repeat safe)', () => {
    const provider = buildKiemPhoProvider(hienPlayer(['orb_chem']), [])
    const participant = {} as Parameters<typeof provider.resolveBasic>[0]

    provider.resolveBasic(participant) // cursor -> 1... preset len 1 so wraps to 0
    provider.onCastResolved!(castCtx('orb_dam'))
    provider.onCastResolved!(castCtx('orb_dam'))

    provider.resetForBattle!()

    // Log cleared: three more orb_dam casts needed for another fire.
    provider.onCastResolved!(castCtx('orb_dam'))
    expect(provider.onCastResolved!(castCtx('orb_dam'))).toEqual([])
  })

  it('onCastResolved ignores non-orb resolved ids', () => {
    const provider = buildKiemPhoProvider(hienPlayer(['orb_dam']), [])
    expect(provider.onCastResolved!(castCtx('ngu_kiem_thuat'))).toEqual([])
    expect(provider.onCastResolved!(castCtx('orb_dam'))).toEqual([]) // log has 1, not 2
  })

  it('reachableKiemPhoComboIds filters patterns to realm-unlocked orbs', () => {
    // qi_refining unlocks orb_dam only -> tam_thich [D,D,D] is the sole
    // reachable combo; every pattern needing chem/bo/hat/quet is out.
    expect(reachableKiemPhoComboIds('qi_refining')).toEqual(['tam_thich'])

    // foundation_establishment adds orb_chem -> pure C and C/D mixed
    // patterns become reachable, B/H/Q patterns stay out.
    const fe = reachableKiemPhoComboIds('foundation_establishment')
    expect(fe).toContain('tam_tram')
    expect(fe).toContain('nhi_thich_nhat_tram')
    expect(fe).toContain('tram_thich_tram')
    expect(fe).not.toContain('tam_phach')
    expect(fe).not.toContain('nhi_lieu_nhat_thich')
  })
})
