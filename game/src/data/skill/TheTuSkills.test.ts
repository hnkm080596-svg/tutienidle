import { describe, expect, it } from 'vitest'
import {
  BACH_UNG,
  BAT_TU_BA_THE,
  CUONG_QUYEN,
  LOAN_DAU,
  LOAN_DAU_PAID_HP_BONUS,
  PHAN_CHAN,
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
import { collectBodyKitModifiers } from '../../core/the-tu/TheTuKitModifiers'
import type { ReactiveTriggerPayload } from '../../core/proc/ProcCapabilities'

// The Tu Reimagined (spec 2026-09-15 section 5, plan Task 6) - the two
// Hien kits are native TurnSkillDefinitions resolved by owned root;
// node bonuses reach them ONLY through collectBodyKitModifiers applied
// to participant-local def clones (registry defs never mutate).

// The Tu beta (the-tu-body-pathway-design) - the two Hien roots resolve
// native TurnSkillDefinition kits; node bonuses reach them ONLY through
// collectBodyKitModifiers applied to participant-local def clones
// (registry defs never mutate). Beta window: roots grant the Basic;
// the Truc Co major grants the Special; NO Ultimate slot exists.

describe('body kit data', () => {
  it('cuong_quyen — high-Might single-target basic; NO HP cost, NO missing-HP scaling at LQ', () => {
    expect(CUONG_QUYEN.id).toBe('cuong_quyen')
    expect(CUONG_QUYEN.cooldownTurns).toBe(0)
    expect(CUONG_QUYEN.damage?.kind).toBe('physical')
    expect(CUONG_QUYEN.damage?.multiplier).toBeGreaterThan(1)
    // Beta authority: missing-HP scaling arrives ONLY with the Truc Co
    // special (Huyet Cuong bake) - never on the authored basic.
    expect(CUONG_QUYEN.damage?.missingHpBonusPerMissingPercent).toBeUndefined()
    expect(CUONG_QUYEN.damage?.missingHpBonusCap).toBeUndefined()
    expect('sacrificeMaxHpRatio' in CUONG_QUYEN).toBe(false)
  })

  it('loan_dau — sacrifice-then-multi-hit special: %Max HP paid first, actual-paid payoff, ordered hits', () => {
    expect(LOAN_DAU.sacrificeMaxHpRatio).toBeGreaterThan(0)
    expect(LOAN_DAU.sacrificeMaxHpRatio).toBeLessThan(1)
    expect(LOAN_DAU.damageBonusPerPaidHpPoint).toBeGreaterThan(0)
    expect(LOAN_DAU.instances?.count).toBeGreaterThan(1)
    expect(LOAN_DAU.targeting.shape).toBe('single')
    expect(LOAN_DAU.cooldownTurns).toBeGreaterThan(0)
    // Legacy-authored defs carry no missing-HP scalar; Huyet Cuong is
    // kit-local (baked onto clones by buildTheTuKit when owned).
    expect(LOAN_DAU.damage?.missingHpBonusPerMissingPercent).toBeUndefined()
  })

  it('bat_tu_ba_the — parked post-beta ultimate def (authored, never granted in beta)', () => {
    expect(BAT_TU_BA_THE.cooldownTurns).toBe(8)
    expect(BAT_TU_BA_THE.targetScope).toBe('self')
    expect(BAT_TU_BA_THE.appliesBuffs).toContainEqual({
      definitionId: 'bat_tu_ba_the',
      target: 'self',
    })
  })

  it('tran_ap — physical all-lanes AoE basic scaling from caster Max HP', () => {
    expect(TRAN_AP.targeting.shape).toBe('all_lanes')
    expect(TRAN_AP.damage?.kind).toBe('physical')
    expect(TRAN_AP.damage?.sourceMaxHpRatio).toBeGreaterThan(0)
  })

  it('phan_chan — castable no-damage special: taunt + Chấn Ấn on all enemies, reflect passive at build', () => {
    expect(PHAN_CHAN.emblemOnly).toBeUndefined()
    expect(PHAN_CHAN.damage).toBeUndefined()
    expect(PHAN_CHAN.appliesBuffs?.map((a) => `${a.definitionId}:${a.target}`)).toEqual([
      'khiem_khich:all_enemies',
      'chan_an:all_enemies',
    ])
    expect(PHAN_CHAN.grantsBuffsAtBuild?.map((def) => def.id)).toEqual(['phan_chan'])
  })

  it('son_nhac — parked post-beta ultimate def (authored, never granted in beta)', () => {
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

  it('THE_TU_KIT_BY_ROOT maps each root to basic+special authored defs (beta slots)', () => {
    expect(THE_TU_KIT_BY_ROOT.cuong_chien).toEqual({
      basic: CUONG_QUYEN,
      special: LOAN_DAU,
    })
    expect(THE_TU_KIT_BY_ROOT.tran_the).toEqual({
      basic: TRAN_AP,
      special: PHAN_CHAN,
    })
  })

  it('no-root body_pathway resolves the generic melee fallback directly (INV-3, M7)', () => {
    // The generic body row was dead content (kit resolution + the
    // `?? GENERIC_PHYSICAL_BASIC` fallback own the behavior); the map
    // no longer carries it.
    expect(BASIC_ATTACKS_BY_BUILD['body']).toBeUndefined()
    expect(GENERIC_PHYSICAL_BASIC.id).toBe('generic_physical')
  })

  it('every kit id has display metadata', () => {
    for (const id of ['cuong_quyen', 'loan_dau', 'bat_tu_ba_the', 'tran_ap', 'phan_chan', 'son_nhac']) {
      expect(TURN_SKILL_DISPLAY_META[id], `missing display meta for ${id}`).toBeDefined()
    }
  })

  it('every appliesBuffs definitionId resolves in BUFF_REGISTRY', () => {
    for (const skill of [BAT_TU_BA_THE, PHAN_CHAN, SON_NHAC]) {
      for (const application of skill.appliesBuffs ?? []) {
        expect(() => BUFF_REGISTRY.get(application.definitionId)).not.toThrow()
      }
    }
  })
})

describe('buildTheTuKit — beta slot gates + node modifiers reach def clones only', () => {
  function registryWith(nodes: ProgressionNode[]) {
    return { getAll: () => nodes }
  }

  function makeNode(id: string, bodyKitModifiers: NonNullable<ProgressionNode['effect']['bodyKitModifiers']>, maxLevel = 1): ProgressionNode {
    return { id, name: id, type: 'minor', insightCost: 1, maxLevel, effect: { bodyKitModifiers } }
  }

  it('collectBodyKitModifiers sums channel values across owned node levels', () => {
    const registry = registryWith([
      makeNode('tt_cq_1', { cuongQuyenCoefficientBonus: 0.1 }, 3),
      makeNode('tt_pierce_1', { cuongQuyenArmorPierce: 0.15 }),
      makeNode('tt_marked_1', { reflectMarkedRatioBonus: 0.02 }),
    ])
    const player = createDefaultPlayer()
    player.nodeLevels = { tt_cq_1: 2, tt_pierce_1: 1, tt_marked_1: 1 }

    const mods = collectBodyKitModifiers(registry, player)

    expect(mods.cuongQuyenCoefficientBonus).toBeCloseTo(0.2)
    expect(mods.cuongQuyenArmorPierce).toBeCloseTo(0.15)
    expect(mods.reflectMarkedRatioBonus).toBeCloseTo(0.02)
    expect(mods.tranApMaxHpRatioBonus).toBe(0)
  })

  it('unowned nodes contribute nothing', () => {
    const registry = registryWith([makeNode('tt_cq_1', { cuongQuyenCoefficientBonus: 0.1 })])
    const player = createDefaultPlayer()

    const mods = collectBodyKitModifiers(registry, player)

    expect(mods.cuongQuyenCoefficientBonus).toBe(0)
  })

  it('owned.special=false -> special slot is empty and no Huyết Cuồng bake (Luyện Khí window)', () => {
    const kit = buildTheTuKit('cuong_chien', collectBodyKitModifiers({ getAll: () => [] }, createDefaultPlayer()))

    expect(kit.basic.id).toBe('cuong_quyen')
    expect(kit.special).toBeUndefined()
    expect(kit.ultimate).toBeUndefined()
    expect(kit.basic.damage?.missingHpBonusPerMissingPercent).toBeUndefined()
  })

  it('owned.special=true -> Loạn Đấu granted AND Huyết Cuồng bakes kit-local missing-HP onto both defs', () => {
    const kit = buildTheTuKit('cuong_chien', collectBodyKitModifiers({ getAll: () => [] }, createDefaultPlayer()), {
      special: true,
    })

    expect(kit.special?.id).toBe('loan_dau')
    for (const def of [kit.basic, kit.special!]) {
      expect(def.damage?.missingHpBonusPerMissingPercent).toBeGreaterThan(0)
      expect(def.damage?.missingHpBonusCap).toBeGreaterThan(0)
    }
    // Registry defs are untouched (clone-only adjustment).
    expect(CUONG_QUYEN.damage?.missingHpBonusPerMissingPercent).toBeUndefined()
    expect(LOAN_DAU.damage?.missingHpBonusPerMissingPercent).toBeUndefined()
  })

  it('cuong_chien clone: Trọng Quyền + Phá Kình + Huyết Sát channels reach only the clones', () => {
    const player = createDefaultPlayer()
    player.nodeLevels = { tt_cq_1: 1, tt_pierce_1: 1, tt_hs_1: 1 }

    const mods = collectBodyKitModifiers(
      registryWith([
        makeNode('tt_cq_1', { cuongQuyenCoefficientBonus: 0.1 }),
        makeNode('tt_pierce_1', { cuongQuyenArmorPierce: 0.15 }),
        makeNode('tt_hs_1', { loanDauPaidHpBonus: 0.002 }),
      ]),
      player,
    )

    const kit = buildTheTuKit('cuong_chien', mods, { special: true })

    expect(kit.basic.damage?.multiplier).toBeCloseTo((CUONG_QUYEN.damage?.multiplier ?? 0) + 0.1)
    expect(kit.basic.instances?.each?.armorPierce?.pierceFraction).toBeCloseTo(0.15)
    expect(kit.special?.damageBonusPerPaidHpPoint).toBeCloseTo(
      (LOAN_DAU.damageBonusPerPaidHpPoint ?? 0) + 0.002,
    )
    // Registry def untouched - the clone absorbed the node bonus alone.
    expect(LOAN_DAU.damageBonusPerPaidHpPoint).toBe(LOAN_DAU_PAID_HP_BONUS)
  })

  it('tran_the clone: Trọng Thế raises sourceMaxHpRatio; Trấn Kình adds the weaken application; reflect ratios reach the phan_chan clone', () => {
    const player = createDefaultPlayer()
    player.nodeLevels = { tt_the_1: 1, tt_kinh_1: 1, tt_cot_1: 1, tt_an_1: 1 }

    const mods = collectBodyKitModifiers(
      registryWith([
        makeNode('tt_the_1', { tranApMaxHpRatioBonus: 0.06 }),
        makeNode('tt_kinh_1', { tranKinhStacksBonus: 1 }),
        makeNode('tt_cot_1', { reflectMaxHpRatioBonus: 0.01 }),
        makeNode('tt_an_1', { reflectMarkedRatioBonus: 0.02 }),
      ]),
      player,
    )

    const kit = buildTheTuKit('tran_the', mods, { special: true })

    expect(kit.basic.damage?.sourceMaxHpRatio).toBeCloseTo(
      (TRAN_AP.damage?.sourceMaxHpRatio ?? 0) + 0.06,
    )
    const kinhApp = kit.basic.appliesAilments?.find((a) => a.buffDefinitionId === 'tran_kinh')
    expect(kinhApp?.chance).toBe(1)
    expect(kinhApp?.stacks).toBe(2)

    const passiveBuff = kit.special?.grantsBuffsAtBuild?.find((def) => def.id === 'phan_chan')
    const reflectPayloadOf = (def: { capabilities?: readonly { type: string; payload: unknown }[] } | undefined) =>
      def?.capabilities
        ?.map((cap) => cap.payload as ReactiveTriggerPayload)
        .find((payload) => payload?.trigger === 'onImpactLanded' && payload.reflectsDamage !== undefined)
    const base = reflectPayloadOf(BUFF_REGISTRY.get('phan_chan'))?.reflectsDamage

    expect(reflectPayloadOf(passiveBuff)?.reflectsDamage?.maxHpRatio).toBeCloseTo(
      (base?.maxHpRatio ?? 0) + 0.01,
    )
    expect(reflectPayloadOf(passiveBuff)?.reflectsDamage?.markedMaxHpRatio).toBeCloseTo(
      (base?.markedMaxHpRatio ?? 0) + 0.02,
    )

    // The embedded passive buff is a CLONE - mutating it must not touch the registry.
    passiveBuff!.capabilities = []
    expect(BUFF_REGISTRY.get('phan_chan').capabilities?.length).toBeGreaterThan(0)
    // And the authored tran_ap never carries the node rider.
    expect(TRAN_AP.appliesAilments ?? []).toHaveLength(0)
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

    // Clones - mutating the kit's marker must not touch the registry def.
    const marker = kit.basic.grantsBuffsAtBuild!.find((def) => def.id === 'ho_mon')!
    marker.capabilities = []
    expect(BUFF_REGISTRY.get('ho_mon').capabilities?.length).toBeGreaterThan(0)
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
