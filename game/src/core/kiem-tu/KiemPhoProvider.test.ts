import { describe, expect, it } from 'vitest'
import { buildKiemPhoProvider, reachableKiemPhoComboIds } from './KiemPhoProvider'
import { adaptTurnSkillDefinition } from '../skilldef/LegacySkillAdapter'
import { evaluateScalarExpression, type SkillReadContext } from '../skilldef/ScalarExpression'
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
    const provider = buildKiemPhoProvider(hienPlayer(['orb_dam', 'orb_chem'], 'foundation_establishment'), [])
    const participant = {} as Parameters<typeof provider.resolveBasic>[0]

    expect(provider.resolveBasic(participant)!.id).toBe('orb_dam')
    expect(provider.resolveBasic(participant)!.id).toBe('orb_chem')
    expect(provider.resolveBasic(participant)!.id).toBe('orb_dam')
  })

  it('combo fires on the third orb_dam and returns the nhat_tuyen extra def', () => {
    const provider = buildKiemPhoProvider(hienPlayer(['orb_dam']), [])

    expect(provider.onCastResolved!(castCtx('orb_dam'))).toEqual([])
    expect(provider.onCastResolved!(castCtx('orb_dam'))).toEqual([])

    const extras = provider.onCastResolved!(castCtx('orb_dam'))
    expect(extras).toHaveLength(1)
    expect(extras[0]!.id).toBe('nhat_tuyen')
    expect(extras[0]!.presetId).toBe('kiem_combo_nhat_tuyen')
    expect(extras[0]!.damage?.multiplier).toBe(3.0)
    // Design sec.7: Nhat Tuyen is a pure direct burst - no seal payload.
    expect(extras[0]!.appliesBuffs).toBeUndefined()
    expect(extras[0]!.ailmentInteractions).toBeUndefined()

    // M-QI-05 - the generated extra carries BOTH halves of owner
    // inheritance: progressionOwnerId transports the triggering orb's
    // canonical core level, levelScaling consumes it (+5%/level).
    expect(extras[0]!.progressionOwnerId).toBe('orb_dam')
    expect(extras[0]!.damage?.levelScaling).toBe(0.05)

    // Log cleared — a 4th cast starts fresh.
    expect(provider.onCastResolved!(castCtx('orb_dam'))).toEqual([])
  })

  it('generated combo damage consumes the inherited orb level through the adapter (x1.25 at Lv6)', () => {
    // The runtime resolves skill_level from the OWNER core
    // (progressionOwnerId -> the triggering orb's nodeLevels entry);
    // the adapter turns the stamped levelScaling into the canonical
    // coefficient expression. Evaluating it at skill_level 1 vs 6
    // proves the ratio without any core_<combo> state existing.
    const provider = buildKiemPhoProvider(hienPlayer(['orb_dam']), [])

    provider.onCastResolved!(castCtx('orb_dam'))
    provider.onCastResolved!(castCtx('orb_dam'))
    const extra = provider.onCastResolved!(castCtx('orb_dam'))[0]!

    const ctxAtLevel = (level: number): SkillReadContext => ({
      resolveTarget: () => undefined,
      buffStacks: () => 0,
      buffDuration: () => 0,
      hpPercent: () => 1,
      resourceCurrent: () => 0,
      resourceMax: () => 0,
      resourceSnapshot: () => 0,
      statScalar: () => 0,
      skillLevel: () => level,
      readVar: () => 0,
      alive: () => true,
      critLanded: () => false,
      anyTargetLanded: () => false,
    })

    const { root } = adaptTurnSkillDefinition(extra)
    const hit = root.operations.find((op) => op.type === 'deal_damage')

    if (hit === undefined || hit.type !== 'deal_damage' || hit.coefficient === undefined) {
      throw new Error('expected the combo extra to adapt a deal_damage operation')
    }

    const lv1 = evaluateScalarExpression(hit.coefficient, ctxAtLevel(1))
    const lv6 = evaluateScalarExpression(hit.coefficient, ctxAtLevel(6))

    expect(lv1).toBeCloseTo(3.0, 6)
    expect(lv6 / lv1).toBeCloseTo(1 + 5 * 0.05, 6)
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
    // 'tram_phach_thich_tram' which matches both test predicates.
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
    expect(provider.resolveBasic(participant)!.id).toBe('orb_dam')      // cursor still 0
  })

  it('manual picks land in the log and can complete a combo', () => {
    const provider = buildKiemPhoProvider(hienPlayer(['orb_chem']), [])

    // Two auto casts of orb_dam would not be in this preset — simulate
    // two manual orb_dam picks resolving, then a third.
    provider.resolveManualPick!('orb_dam')
    provider.onCastResolved!(castCtx('orb_dam'))
    provider.onCastResolved!(castCtx('orb_dam'))
    const extras = provider.onCastResolved!(castCtx('orb_dam'))
    expect(extras[0]?.id).toBe('nhat_tuyen')
  })

  it('resetForBattle restores cursor and log (auto-repeat safe)', () => {
    const provider = buildKiemPhoProvider(hienPlayer(['orb_chem']), [])
    const participant = {} as Parameters<typeof provider.resolveBasic>[0]

    provider.resolveBasic(participant)! // cursor -> 1... preset len 1 so wraps to 0
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
    // qi_refining unlocks orb_dam only -> nhat_tuyen [D,D,D] is the sole
    // reachable combo; every pattern needing chem/bo/hat/quet is out.
    expect(reachableKiemPhoComboIds('qi_refining')).toEqual(['nhat_tuyen'])

    // foundation_establishment adds orb_chem -> the other five beta
    // combos become reachable, B/H/Q patterns stay out, and D-C-C /
    // C-D-D are NOT combos (design sec.4).
    const fe = reachableKiemPhoComboIds('foundation_establishment')
    expect([...fe].sort()).toEqual(
      ['diep_ngan', 'hoi_tuyen', 'khai_ngan', 'liet_ngan', 'nhat_tuyen', 'thau_ngan'].sort(),
    )
    expect(fe).not.toContain('tam_phach')
    expect(fe).not.toContain('nhi_lieu_nhat_thich')
  })

  it('reachableKiemPhoComboIds honors the realmComboMax length cap', () => {
    // soul_transformation unlocks every orb but caps combos at len 4, so
    // the len-5 set can never fire there and must not classify as
    // reachable; void_refinement (len 5) opens them again.
    const st = reachableKiemPhoComboIds('soul_transformation')
    expect(st).not.toContain('ngu_hanh_kiem')
    expect(st).toContain('thich_tram_phach_thich')
    expect(reachableKiemPhoComboIds('void_refinement')).toContain('ngu_hanh_kiem')
  })
})
