import { describe, expect, it } from 'vitest'
import {
  BACH_UNG,
  BAT_TU_BA_THE,
  CUONG_QUYEN,
  LOAN_DAU,
  PHAN_CHINH,
  PHAN_KICH,
  SON_NHAC,
  THAM_THE,
  THE_TU_KIT_BY_ROOT,
  TRAN_AP,
  TRO_KICH,
  TU_THE,
  buildTheTuAnKit,
  buildTheTuKit,
} from './TheTuSkills'
import { BUFF_REGISTRY } from '../buff/BuffRegistry'
import { BASIC_ATTACKS_BY_BUILD, GENERIC_PHYSICAL_BASIC } from './TurnBasicAttacks'
import { TURN_SKILL_DISPLAY_META } from './TurnSkillDisplayMeta'
import { createDefaultPlayer } from '../../core/player/Player'
import type { ProgressionNode } from '../../core/progression/ProgressionNode'
import { collectTheTuKitModifiers } from '../../core/the-tu/TheTuKitModifiers'

// The Tu Reimagined (spec 2026-09-15 section 5, plan Task 6) — the two
// Hien kits are native TurnSkillDefinitions resolved by owned root;
// node bonuses reach them ONLY through collectTheTuKitModifiers applied
// to participant-local def clones (registry defs never mutate).

describe('the_tu kit data', () => {
  it('cuong_quyen — physical basic carrying the missing-HP scalar fields', () => {
    expect(CUONG_QUYEN.id).toBe('cuong_quyen')
    expect(CUONG_QUYEN.cooldownTurns).toBe(0)
    expect(CUONG_QUYEN.damage?.kind).toBe('physical')
    expect(CUONG_QUYEN.damage?.multiplier).toBe(1)
    expect(CUONG_QUYEN.damage?.missingHpBonusPerMissingPercent).toBe(0.02)
    expect(CUONG_QUYEN.damage?.missingHpBonusCap).toBe(2.0)
  })

  it('loan_dau — physical x2 special, cooldown 4, same scalar, NO self-cost', () => {
    expect(LOAN_DAU.damage?.multiplier).toBe(2)
    expect(LOAN_DAU.damage?.missingHpBonusPerMissingPercent).toBe(0.02)
    expect(LOAN_DAU.damage?.missingHpBonusCap).toBe(2.0)
    expect(LOAN_DAU.cooldownTurns).toBe(4)
    expect(LOAN_DAU.resourceType === undefined || LOAN_DAU.resourceType === 'none').toBe(true)
    expect(LOAN_DAU.resourceCost ?? 0).toBe(0)
  })

  it('bat_tu_ba_the — ultimate cd 8, self-applies the bat_tu_ba_the buff', () => {
    expect(BAT_TU_BA_THE.cooldownTurns).toBe(8)
    expect(BAT_TU_BA_THE.targetScope).toBe('self')
    expect(BAT_TU_BA_THE.appliesBuffs).toContainEqual({
      definitionId: 'bat_tu_ba_the',
      target: 'self',
    })
  })

  it('tran_ap — physical x0.8 all-lanes AoE basic', () => {
    expect(TRAN_AP.damage?.multiplier).toBe(0.8)
    expect(TRAN_AP.targeting.shape).toBe('all_lanes')
  })

  it('phan_chinh — emblemOnly special, never selectable, grants phan_chinh buff at build', () => {
    expect(PHAN_CHINH.emblemOnly).toBe(true)
    expect(PHAN_CHINH.grantsBuffsAtBuild?.map((def) => def.id)).toEqual(['phan_chinh'])
  })

  it('son_nhac — ultimate cd 6 applying self DR + ally ward markers + taunt', () => {
    expect(SON_NHAC.cooldownTurns).toBe(6)

    const ids = SON_NHAC.appliesBuffs?.map((application) => `${application.definitionId}:${application.target}`)

    expect(ids).toEqual([
      'son_nhac:self',
      'son_nhac_ho_the:allies_except_self',
      'khiem_khich:all_enemies',
    ])

    const wardGrant = SON_NHAC.appliesBuffs?.find((application) => application.definitionId === 'son_nhac_ho_the')
    expect(wardGrant?.externalWardGrant?.sourceMaxHpRatio).toBeGreaterThan(0)
  })

  it('THE_TU_KIT_BY_ROOT maps each root to its three slots', () => {
    expect(THE_TU_KIT_BY_ROOT.cuong_chien).toEqual({
      basic: CUONG_QUYEN,
      special: LOAN_DAU,
      ultimate: BAT_TU_BA_THE,
    })
    expect(THE_TU_KIT_BY_ROOT.tran_the).toEqual({
      basic: TRAN_AP,
      special: PHAN_CHINH,
      ultimate: SON_NHAC,
    })
  })

  it('BASIC_ATTACKS_BY_BUILD.the_tu stays the generic pre-root fallback (INV-3)', () => {
    expect(BASIC_ATTACKS_BY_BUILD['the_tu']).toBe(GENERIC_PHYSICAL_BASIC)
  })

  it('every kit id has display metadata', () => {
    for (const id of ['cuong_quyen', 'loan_dau', 'bat_tu_ba_the', 'tran_ap', 'phan_chinh', 'son_nhac']) {
      expect(TURN_SKILL_DISPLAY_META[id], `missing display meta for ${id}`).toBeDefined()
    }
  })

  it('every appliesBuffs definitionId resolves in BUFF_REGISTRY', () => {
    for (const skill of [BAT_TU_BA_THE, SON_NHAC]) {
      for (const application of skill.appliesBuffs ?? []) {
        expect(() => BUFF_REGISTRY.get(application.definitionId)).not.toThrow()
      }
    }
  })
})

describe('buildTheTuKit — node modifiers reach def clones only', () => {
  function registryWith(nodes: ProgressionNode[]) {
    return { getAll: () => nodes }
  }

  function makeNode(id: string, theTuKitModifiers: NonNullable<ProgressionNode['effect']['theTuKitModifiers']>, maxLevel = 1): ProgressionNode {
    return { id, name: id, type: 'minor', insightCost: 1, maxLevel, effect: { theTuKitModifiers } }
  }

  it('collectTheTuKitModifiers sums channel values across owned node levels', () => {
    const registry = registryWith([
      makeNode('tt_scalar_1', { missingHpBonusBonus: 0.005 }, 3),
      makeNode('tt_battu_1', { batTuDurationBonus: 1 }),
      makeNode('tt_taunt_1', { tauntTurnsBonus: 1 }),
    ])
    const player = createDefaultPlayer()
    player.nodeLevels = { tt_scalar_1: 2, tt_battu_1: 1, tt_taunt_1: 1 }

    const mods = collectTheTuKitModifiers(registry, player)

    expect(mods.missingHpBonusBonus).toBeCloseTo(0.01)
    expect(mods.batTuDurationBonus).toBe(1)
    expect(mods.tauntTurnsBonus).toBe(1)
    expect(mods.sonNhacWardRatioBonus).toBe(0)
  })

  it('unowned nodes contribute nothing', () => {
    const registry = registryWith([makeNode('tt_scalar_1', { missingHpBonusBonus: 0.005 })])
    const player = createDefaultPlayer()

    const mods = collectTheTuKitModifiers(registry, player)

    expect(mods.missingHpBonusBonus).toBe(0)
  })

  it('cuong_chien clone: scalar node raises missingHpBonusPerMissingPercent; duration node raises the buff durationOverride', () => {
    const mods = collectTheTuKitModifiers(
      registryWith([
        makeNode('tt_scalar_1', { missingHpBonusBonus: 0.01 }),
        makeNode('tt_battu_1', { batTuDurationBonus: 1 }),
      ]),
      (() => {
        const player = createDefaultPlayer()
        player.nodeLevels = { tt_scalar_1: 1, tt_battu_1: 1 }
        return player
      })(),
    )

    const kit = buildTheTuKit('cuong_chien', mods)

    expect(kit.basic.damage?.missingHpBonusPerMissingPercent).toBeCloseTo(0.03)
    expect(kit.special?.damage?.missingHpBonusPerMissingPercent).toBeCloseTo(0.03)
    expect(kit.ultimate?.appliesBuffs?.[0]?.durationOverride).toBe(4)

    // Registry defs are untouched (clone-only adjustment).
    expect(CUONG_QUYEN.damage?.missingHpBonusPerMissingPercent).toBe(0.02)
    expect(BAT_TU_BA_THE.appliesBuffs?.[0]?.durationOverride).toBeUndefined()
  })

  it('tran_the clone: reflect ratios reach the emblem buff def; ward ratio and taunt turns reach SON_NHAC applications', () => {
    const player = createDefaultPlayer()
    player.nodeLevels = { tt_reflect: 1, tt_ward: 1, tt_taunt: 1 }

    const mods = collectTheTuKitModifiers(
      registryWith([
        makeNode('tt_reflect', { reflectMaxHpRatioBonus: 0.01, reflectTakenRatioBonus: 0.05 }),
        makeNode('tt_ward', { sonNhacWardRatioBonus: 0.1 }),
        makeNode('tt_taunt', { tauntTurnsBonus: 1 }),
      ]),
      player,
    )

    const kit = buildTheTuKit('tran_the', mods)
    const emblemBuff = kit.special?.grantsBuffsAtBuild?.find((def) => def.id === 'phan_chinh')
    const reflect = emblemBuff?.effects.find(
      (effect) => effect.type === 'reactiveTrigger' && effect.reflectsDamage !== undefined,
    )

    expect(reflect?.type === 'reactiveTrigger' && reflect.reflectsDamage?.takenRatio).toBeCloseTo(
      (BUFF_REGISTRY.get('phan_chinh').effects.find(
        (effect) => effect.type === 'reactiveTrigger' && effect.reflectsDamage !== undefined,
      ) as { reflectsDamage: { takenRatio: number } }).reflectsDamage.takenRatio + 0.05,
    )

    const wardApp = kit.ultimate?.appliesBuffs?.find((application) => application.definitionId === 'son_nhac_ho_the')
    const baseRatio = SON_NHAC.appliesBuffs?.find(
      (application) => application.definitionId === 'son_nhac_ho_the',
    )?.externalWardGrant?.sourceMaxHpRatio
    expect(wardApp?.externalWardGrant?.sourceMaxHpRatio).toBeCloseTo((baseRatio ?? 0) + 0.1)

    const tauntApp = kit.ultimate?.appliesBuffs?.find((application) => application.definitionId === 'khiem_khich')
    expect(tauntApp?.durationOverride).toBe(BUFF_REGISTRY.get('khiem_khich').duration + 1)

    // The embedded emblem buff is a CLONE — mutating it must not touch the registry.
    emblemBuff!.effects = []
    expect(BUFF_REGISTRY.get('phan_chinh').effects.length).toBeGreaterThan(0)
  })
})

describe('the_tu_an kit data (spec section 6.1)', () => {
  it('tham_the — physical single-target basic; carries NO Thế gain field (income lives on ung_the, single channel)', () => {
    expect(THAM_THE.id).toBe('tham_the')
    expect(THAM_THE.cooldownTurns).toBe(0)
    expect(THAM_THE.damage?.kind).toBe('physical')
    expect(THAM_THE.damage?.multiplier).toBe(1)
    expect(THAM_THE.targeting.shape).toBe('single')
    expect('theGainOnLandedCast' in THAM_THE).toBe(false)
  })

  it('tu_the — special stance cast, applies the tu_the buff to self', () => {
    expect(TU_THE.id).toBe('tu_the')
    expect(TU_THE.targetScope).toBe('self')
    expect(TU_THE.cooldownTurns).toBeGreaterThan(0)
    expect(TU_THE.appliesBuffs).toContainEqual({ definitionId: 'tu_the', target: 'self' })
  })

  it('bach_ung — ultimate window cast, applies the bach_ung buff to self', () => {
    expect(BACH_UNG.id).toBe('bach_ung')
    expect(BACH_UNG.targetScope).toBe('self')
    expect(BACH_UNG.cooldownTurns).toBeGreaterThan(0)
    expect(BACH_UNG.appliesBuffs).toContainEqual({ definitionId: 'bach_ung', target: 'self' })
  })

  it('phan_kich / tro_kich — real damaging payload TurnSkillDefinitions', () => {
    for (const def of [PHAN_KICH, TRO_KICH]) {
      expect(def.damage?.kind, def.id).toBe('physical')
      expect(def.damage?.multiplier, def.id).toBeGreaterThan(0)
      expect(def.targeting.shape, def.id).toBe('single')
    }
  })

  it('buildTheTuAnKit plants ung_the always + one marker per owned root, all participant-local clones', () => {
    const kit = buildTheTuAnKit(['ho_mon', 'phan_mon'])

    expect(kit.basic.id).toBe('tham_the')
    expect(kit.special.id).toBe('tu_the')
    expect(kit.ultimate.id).toBe('bach_ung')
    expect(kit.basic.grantsBuffsAtBuild?.map((def) => def.id)).toEqual(['ung_the', 'ho_mon', 'phan_mon'])

    // Clones — mutating the kit's marker must not touch the registry def.
    const marker = kit.basic.grantsBuffsAtBuild!.find((def) => def.id === 'ho_mon')!
    marker.effects = []
    expect(BUFF_REGISTRY.get('ho_mon').effects.length).toBeGreaterThan(0)
  })

  it('buildTheTuAnKit([]) plants only ung_the — no root, no mechanic marker', () => {
    const kit = buildTheTuAnKit([])

    expect(kit.basic.grantsBuffsAtBuild?.map((def) => def.id)).toEqual(['ung_the'])
  })

  it('kit registry defs are never mutated by the factory', () => {
    buildTheTuAnKit(['tro_mon'])

    expect(THAM_THE.grantsBuffsAtBuild).toBeUndefined()
  })

  it('every an kit/payload id has display metadata', () => {
    for (const id of ['tham_the', 'tu_the', 'bach_ung', 'phan_kich', 'tro_kich']) {
      expect(TURN_SKILL_DISPLAY_META[id], `missing display meta for ${id}`).toBeDefined()
    }
  })

  it('every appliesBuffs definitionId resolves in BUFF_REGISTRY', () => {
    for (const skill of [TU_THE, BACH_UNG]) {
      for (const application of skill.appliesBuffs ?? []) {
        expect(() => BUFF_REGISTRY.get(application.definitionId)).not.toThrow()
      }
    }
  })
})
