import { describe, expect, it } from 'vitest'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { freshSwordPathState, type OrbId } from './KiemTuState'
import {
  initKiemPhoBattle,
  recordCastAndMatch,
} from './KiemPhoSystem'
import { buildKiemPhoProvider } from './KiemPhoProvider'
import {
  collectKiemPhoComboModifiers,
  collectKiemPhoSkillDefinitionModifiers,
  applySkillDefinitionModifiers,
} from './KiemPhoNodeModifiers'
import { adaptTurnSkillDefinition } from '../skilldef/LegacySkillAdapter'
import { KIEM_PHO_COMBOS } from '../../data/skill/KiemPhoCombos'
import { KIEM_PHO_ORBS } from '../../data/skill/KiemPhoOrbs'
import { KIEM_PHO_BUFFS } from '../../data/buff/KiemPhoBuffs'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { COMBAT_VFX_PRESETS } from '../../data/vfx/CombatVfxPresets'
import { EventBus } from '../events/EventBus'
import { CombatSystem } from '../combat/CombatSystem'
import {
  TurnBattleSystem,
  type TurnBattle,
  type TurnBattleParticipant,
} from '../battle/turn/TurnBattleSystem'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { DynamicBasicCastContext } from '../battle/turn/TurnSkillAction'
import {
  makeTestBuffRegistry,
  makeTurnRuntime,
} from '../battle/turn/testing/TurnRuntimeFixtures'

// KIEM PHO BETA (docs/specs/kiem-pho-beta-spec.md sec.8) - the design
// doc's 18-invariant pin suite for the beta window: six locked combos
// riding canonical Buff System lanes, the finishing-orb ordering pin,
// and the 8-node tree's skill-scoped seams (design sec.16.A: nodes
// modify the SKILL, never the character).

const REGISTRY = makeTestBuffRegistry(KIEM_PHO_BUFFS)

function hienPlayer(
  preset: OrbId[],
  realmId = 'foundation_establishment',
  nodeLevels: Record<string, number> = {},
): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = realmId
  player.cultivationPath = 'sword'
  player.cultivationWay = 'sword_pathway'
  player.swordPath = { ...freshSwordPathState(), preset }
  player.nodeLevels = { ...player.nodeLevels, ...nodeLevels }
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

function makeEntity(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, ...overrides.stats })
  return {
    id,
    name: id,
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: 1_000_000,
    maxHp: 1_000_000,
    currentMp: stats.maxMp,
    currentThe: 0,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  } as CombatEntity
}

function makeBetaBattle(provider: TurnBattleParticipant['dynamicBasic']) {
  const eventBus = new EventBus()
  const combat = new CombatSystem(eventBus)

  const attacker = makeEntity('attacker', {
    stats: createBaseStats({ might: 100, accuracyRating: 9999 }),
  })
  const defender = makeEntity('defender', {
    stats: createBaseStats({ evasionRate: 0, maxHp: 1_000_000 }),
  })

  const attackerP: TurnBattleParticipant = {
    id: 'attacker',
    entity: attacker,
    speed: attacker.stats.speed,
    priority: 0,
    actionGauge: 0,
    alive: attacker.alive,
    consecutiveHardCcTurns: 0,
    basic: {
      id: 'fallback_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    },
    dynamicBasic: provider,
  }
  const defenderP: TurnBattleParticipant = {
    id: 'defender',
    entity: defender,
    speed: defender.stats.speed,
    priority: 1,
    actionGauge: 0,
    alive: defender.alive,
    consecutiveHardCcTurns: 0,
  }

  const runtime = makeTurnRuntime({
    registry: REGISTRY,
    participants: () => [attackerP, defenderP],
    combatSystem: combat,
  })
  const system = new TurnBattleSystem(combat, 10, REGISTRY, undefined, runtime)
  const battle: TurnBattle = { players: [attackerP], enemies: [defenderP], state: 'fighting' }

  return { system, battle, attackerP, defenderP, eventBus, runtime }
}

function cast(
  system: TurnBattleSystem,
  battle: TurnBattle,
  actor: TurnBattleParticipant,
) {
  return system.applyActionImpact(battle, system.declareActorAction(battle, actor))
}

function kiemThuong(
  runtime: ReturnType<typeof makeTurnRuntime>,
  participant: TurnBattleParticipant,
) {
  return runtime.buffs
    .getForTarget(participant.entity.id)
    .filter((instance) => instance.definitionId === 'kiem_thuong')
}

function providers(
  player: PlayerData,
) {
  return {
    comboModifiers: collectKiemPhoComboModifiers(player, KIEM_TU_NODES),
    skillModifiers: collectKiemPhoSkillDefinitionModifiers(player, KIEM_TU_NODES),
  }
}

function buildFor(player: PlayerData) {
  const { comboModifiers, skillModifiers } = providers(player)
  return buildKiemPhoProvider(player, comboModifiers, skillModifiers)
}

describe('KIEM PHO BETA - locked combo set', () => {
  it('exactly the six beta combos carry authored semantics; D-C-C and C-D-D are NOT combos', () => {
    const byId = new Map(KIEM_PHO_COMBOS.map(c => [c.id, c]))

    expect(byId.get('nhat_tuyen')?.pattern).toEqual(['orb_dam', 'orb_dam', 'orb_dam'])
    expect(byId.get('liet_ngan')?.pattern).toEqual(['orb_chem', 'orb_chem', 'orb_chem'])
    expect(byId.get('khai_ngan')?.pattern).toEqual(['orb_dam', 'orb_dam', 'orb_chem'])
    expect(byId.get('thau_ngan')?.pattern).toEqual(['orb_chem', 'orb_chem', 'orb_dam'])
    expect(byId.get('hoi_tuyen')?.pattern).toEqual(['orb_dam', 'orb_chem', 'orb_dam'])
    expect(byId.get('diep_ngan')?.pattern).toEqual(['orb_chem', 'orb_dam', 'orb_chem'])

    // Design sec.4: the two reversed triples must NOT be combos.
    const DCC = ['orb_dam', 'orb_chem', 'orb_chem']
    const CDD = ['orb_chem', 'orb_dam', 'orb_dam']
    for (const combo of KIEM_PHO_COMBOS) {
      expect(combo.pattern).not.toEqual(DCC)
      expect(combo.pattern).not.toEqual(CDD)
    }

    const state = initKiemPhoBattle(hienPlayer(['orb_dam', 'orb_chem']))
    expect(recordCastAndMatch(state, 'orb_dam', KIEM_PHO_COMBOS)).toBeNull()
    expect(recordCastAndMatch(state, 'orb_chem', KIEM_PHO_COMBOS)).toBeNull()
    expect(recordCastAndMatch(state, 'orb_chem', KIEM_PHO_COMBOS)).toBeNull()

    const state2 = initKiemPhoBattle(hienPlayer(['orb_dam', 'orb_chem']))
    recordCastAndMatch(state2, 'orb_chem', KIEM_PHO_COMBOS)
    recordCastAndMatch(state2, 'orb_dam', KIEM_PHO_COMBOS)
    expect(recordCastAndMatch(state2, 'orb_dam', KIEM_PHO_COMBOS)).toBeNull()
  })

  it('the six beta patterns each fire their authored combo at cast 3', () => {
    const betaIds = ['nhat_tuyen', 'liet_ngan', 'khai_ngan', 'thau_ngan', 'hoi_tuyen', 'diep_ngan']
    for (const id of betaIds) {
      const combo = KIEM_PHO_COMBOS.find(c => c.id === id)!
      const state = initKiemPhoBattle(hienPlayer(['orb_dam']))
      expect(recordCastAndMatch(state, combo.pattern[0]!, KIEM_PHO_COMBOS)).toBeNull()
      expect(recordCastAndMatch(state, combo.pattern[1]!, KIEM_PHO_COMBOS)).toBeNull()
      expect(
        recordCastAndMatch(state, combo.pattern[2]!, KIEM_PHO_COMBOS)?.id,
        `${id} did not fire on its completing cast`,
      ).toBe(id)
    }
  })

  it('every one of the 37 authored patterns produces at least one combo fire by its final cast', () => {
    // Reachability pin (design sec.14#17): a pattern prefix may
    // legitimately complete a shorter combo mid-sequence (the tail
    // matcher clears the log then) - the dead-content invariant is
    // that every authored sequence yields SOME fire, and when nothing
    // preempts it, the completing cast fires the authored combo.
    for (const combo of KIEM_PHO_COMBOS) {
      const state = initKiemPhoBattle(hienPlayer(['orb_dam'], 'mahayana'))
      const fires: string[] = []
      for (const orb of combo.pattern) {
        const matched = recordCastAndMatch(state, orb, KIEM_PHO_COMBOS)
        if (matched) fires.push(matched.id)
      }
      expect(fires.length, `${combo.id} produced no fire`).toBeGreaterThan(0)
      if (fires.length === 1 && combo.pattern.length === 3) {
        // Len-3 is the minimum match length - nothing can preempt an
        // authored len-3 pattern, so the only fire must be its own.
        expect(fires[0]).toBe(combo.id)
      }
    }
  })
})

describe('KIEM PHO BETA - combo semantics (design sec.7/8)', () => {
  it('liet_ngan [C,C,C] tops the same-source wound to the canonical cap', () => {
    const player = hienPlayer(['orb_chem'])
    const provider = buildFor(player)
    const { system, battle, attackerP, defenderP, runtime } = makeBetaBattle(provider)

    cast(system, battle, attackerP)
    cast(system, battle, attackerP)
    const result = cast(system, battle, attackerP)

    expect(result.extraImpacts[0]?.presetId).toBe('kiem_combo_liet_ngan')
    // 3 finishing applies + add_stacks -> clamps at maxStacks 3.
    expect(kiemThuong(runtime, defenderP).reduce((s, i) => s + i.stacks, 0)).toBe(3)
  })

  it('khai_ngan [D,D,C] adds exactly +1 stack on the finishing wound (typical 2)', () => {
    const player = hienPlayer(['orb_dam', 'orb_dam', 'orb_chem'])
    const provider = buildFor(player)
    const { system, battle, attackerP, defenderP, runtime } = makeBetaBattle(provider)

    cast(system, battle, attackerP)
    cast(system, battle, attackerP)
    const result = cast(system, battle, attackerP)

    expect(result.extraImpacts[0]?.presetId).toBe('kiem_combo_khai_ngan')
    expect(kiemThuong(runtime, defenderP).reduce((s, i) => s + i.stacks, 0)).toBe(2)
  })

  it('thau_ngan [C,C,D] reads live same-source stacks and never consumes', () => {
    const player = hienPlayer(['orb_chem', 'orb_chem', 'orb_dam'])
    const provider = buildFor(player)
    const { system, battle, attackerP, defenderP, runtime } = makeBetaBattle(provider)

    cast(system, battle, attackerP)
    cast(system, battle, attackerP)
    const result = cast(system, battle, attackerP)

    expect(result.extraImpacts[0]?.presetId).toBe('kiem_combo_thau_ngan')
    // Two Chem applies = 2 live stacks, all still present AFTER the hit.
    expect(kiemThuong(runtime, defenderP).reduce((s, i) => s + i.stacks, 0)).toBe(2)

    // Def-level seam pin: the provider's extra carries
    // scalesWithAilmentStacks, which adapts to scaleBuff on the
    // direct hit - per live stack on the caster's OWN instance
    // (scope 'own'), never a stack-count write.
    const provider2 = buildKiemPhoProvider(hienPlayer(['orb_chem', 'orb_chem', 'orb_dam']), [])
    provider2.onCastResolved!(castCtx('orb_chem'))
    provider2.onCastResolved!(castCtx('orb_chem'))
    const extra = provider2.onCastResolved!(castCtx('orb_dam'))[0]!
    const { root } = adaptTurnSkillDefinition(extra)
    const hit = root.operations.find(op => op.type === 'deal_damage')!
    expect(hit.type === 'deal_damage' && hit.scaleBuff).toEqual({
      definitionId: 'kiem_thuong',
      damagePerStack: 0.5,
      scope: 'own',
    })
  })

  it('diep_ngan [C,D,C] fires one manual kiem_thuong periodic tick through the canonical system', () => {
    const player = hienPlayer(['orb_chem', 'orb_dam', 'orb_chem'])
    const provider = buildFor(player)
    const { system, battle, attackerP, defenderP, eventBus, runtime } = makeBetaBattle(provider)

    let damages = 0
    eventBus.on('damage', () => {
      damages += 1
    })

    cast(system, battle, attackerP)
    const damagesBeforeCombo = damages
    cast(system, battle, attackerP)

    expect(kiemThuong(runtime, defenderP).reduce((s, i) => s + i.stacks, 0)).toBe(1)
    expect(damages - damagesBeforeCombo).toBe(1) // ordinary orb hit only

    const comboTurn = damages
    const result = cast(system, battle, attackerP)
    expect(result.extraImpacts[0]?.presetId).toBe('kiem_combo_diep_ngan')
    // Orb hit + combo direct + one manual dot tick = 3 damage events.
    expect(damages - comboTurn).toBe(3)
    expect(kiemThuong(runtime, defenderP).reduce((s, i) => s + i.stacks, 0)).toBe(2)
  })

  it('combo extra targets the completing action\'s landed target (design sec.14#15)', () => {
    const player = hienPlayer(['orb_dam'])
    const provider = buildFor(player)
    const { system, battle, attackerP, defenderP } = makeBetaBattle(provider)

    cast(system, battle, attackerP)
    cast(system, battle, attackerP)
    const result = cast(system, battle, attackerP)

    expect(result.extraImpacts).toHaveLength(1)
    expect(result.extraImpacts[0]!.targetIds).toContain(defenderP.id)
    expect(result.extraImpacts[0]!.landedTargetIds).toContain(defenderP.id)
  })
})

describe('KIEM PHO BETA - node seams (design sec.10-12)', () => {
  it('Can folds per-level damage into ONLY its own orb def (thich_can -> orb_dam, design sec.14#2)', () => {
    const player = hienPlayer(['orb_dam', 'orb_chem'], 'foundation_establishment', { thich_can: 5 })
    const { skillModifiers } = providers(player)
    expect(skillModifiers).toHaveLength(1)
    expect(skillModifiers[0]).toMatchObject({ nodeId: 'thich_can', skillId: 'orb_dam', level: 5 })

    const provider = buildFor(player)
    const participant = {} as Parameters<typeof provider.resolveBasic>[0]

    const damDef = provider.resolveBasic(participant)
    const chemDef = provider.resolveBasic(participant)
    expect(damDef.damage!.multiplier).toBeCloseTo(1 * (1 + 0.08 * 5), 6)
    expect(chemDef.damage!.multiplier).toBe(1.2) // untouched
  })

  it('Nhat Diem pierces 30% armor on ITS hit only - never on the combo extra (design sec.14#4)', () => {
    const player = hienPlayer(['orb_dam'], 'qi_refining', {
      thich_can: 1,
      nhat_diem: 1,
    })
    const provider = buildFor(player)
    const participant = {} as Parameters<typeof provider.resolveBasic>[0]

    const damDef = provider.resolveBasic(participant)
    expect(damDef.armorPolicy?.pierceFractionOnFail).toBeCloseTo(0.3, 6)
    expect(damDef.armorPolicy?.bypassChance).toBeUndefined()

    provider.onCastResolved!(castCtx('orb_dam'))
    provider.onCastResolved!(castCtx('orb_dam'))
    const extra = provider.onCastResolved!(castCtx('orb_dam'))[0]!
    expect(extra.id).toBe('nhat_tuyen')
    expect(extra.armorPolicy).toBeUndefined()
  })

  it('Thuong Tham hangs a keyed periodic_damage modifier on the finishing wound, gated on apply', () => {
    const player = hienPlayer(['orb_chem'], 'foundation_establishment', {
      tram_can: 1,
      thuong_tham: 1,
    })
    const { skillModifiers } = providers(player)
    expect(skillModifiers.map(m => m.nodeId).sort()).toEqual(['thuong_tham', 'tram_can'])
    const thamMod = skillModifiers.find(m => m.nodeId === 'thuong_tham')!
    expect(thamMod.addAilmentInteractions).toHaveLength(1)

    const chemDef = applySkillDefinitionModifiers(
      KIEM_PHO_ORBS.orb_chem,
      skillModifiers.filter(m => m.nodeId === 'thuong_tham'),
    )
    expect(chemDef).not.toBe(KIEM_PHO_ORBS.orb_chem)
    expect(chemDef.ailmentInteractions).toEqual([
      {
        kind: 'add_modifier',
        buffId: 'kiem_thuong',
        modifier: {
          id: 'thuong_tham',
          channel: 'periodic_damage',
          operation: 'multiply',
          value: 1.25,
          reapply: 'max',
          priority: 0,
          lifetime: { type: 'buff_lifetime' },
        },
      },
    ])

    // The adapted op is result-gated: it binds the instance the SAME
    // hit just applied - a resisted Chem must not mutate a stale wound.
    const { root } = adaptTurnSkillDefinition(chemDef)
    const hit = root.operations.find(op => op.type === 'deal_damage')!
    const landed = hit.type === 'deal_damage' ? (hit.onLanded ?? []) : []
    const modifierOp = landed.find(op => op.type === 'add_buff_modifier')!
    expect(modifierOp).toBeDefined()
    expect(modifierOp.type === 'add_buff_modifier' && modifierOp.gateOnApplyResult).toBe(true)

    const { system, battle, attackerP, defenderP, runtime } = makeBetaBattle(buildFor(player))
    cast(system, battle, attackerP)
    const wound = kiemThuong(runtime, defenderP)[0]
    expect(wound).toBeDefined()
    expect(wound!.stacks).toBe(1)
  })

  it('Kiem Ket + Lien Thuc append after the authored interaction (pre-sort reduce order; the phase sort itself is pinned in GameManager.kiemTuTree.test.ts)', () => {
    const player = hienPlayer(['orb_chem'], 'foundation_establishment', {
      tram_can: 1,
      luu_ngan: 1,
      thuong_tham: 1,
      lien_tram: 1,
    })
    const { comboModifiers } = providers(player)
    const diepNgan = KIEM_PHO_COMBOS.find(c => c.id === 'diep_ngan')!
    const derived = comboModifiers.reduce(
      (acc, m) => (m.matches(acc) ? m.apply(acc) : acc),
      diepNgan,
    )
    expect(derived.ailmentInteractions!.map(i => i.kind)).toEqual([
      'trigger_periodic', // authored
      'extend_duration', // luu_ngan
      'trigger_periodic', // lien_tram
    ])
    // canonical entry untouched
    expect(diepNgan.ailmentInteractions).toHaveLength(1)
  })

  it('Luu Ngan extends only Chem-completing combos; Lien Tram only >=2-Chem combos (predicate = the contract)', () => {
    const player = hienPlayer(['orb_chem'], 'foundation_establishment', {
      tram_can: 1,
      luu_ngan: 1,
      thuong_tham: 1,
      lien_tram: 1,
    })
    const { comboModifiers } = providers(player)
    const luuNgan = comboModifiers.find(m => m.nodeId === 'luu_ngan')!
    const lienTram = comboModifiers.find(m => m.nodeId === 'lien_tram')!

    const expectMatch = (id: string, luu: boolean, lien: boolean) => {
      const combo = KIEM_PHO_COMBOS.find(c => c.id === id)!
      expect(luuNgan.matches(combo), `luu_ngan vs ${id}`).toBe(luu)
      expect(lienTram.matches(combo), `lien_tram vs ${id}`).toBe(lien)
    }

    expectMatch('liet_ngan', true, true)   // [C,C,C]
    expectMatch('khai_ngan', true, false)  // [D,D,C]
    expectMatch('thau_ngan', false, true)  // [C,C,D]
    expectMatch('diep_ngan', true, true)   // [C,D,C]
    expectMatch('nhat_tuyen', false, false)// [D,D,D]
    expectMatch('hoi_tuyen', false, false) // [D,C,D]
  })

  it('Quy Tuyen +20% on Dam-completing combos; Lien Thich +25% on >=2-Dam combos', () => {
    const player = hienPlayer(['orb_dam'], 'qi_refining', {
      thich_can: 1,
      quy_tuyen: 1,
      lien_thich: 1,
    })
    const { comboModifiers } = providers(player)
    const quyTuyen = comboModifiers.find(m => m.nodeId === 'quy_tuyen')!
    const lienThich = comboModifiers.find(m => m.nodeId === 'lien_thich')!

    const expectMatch = (id: string, quy: boolean, lien: boolean) => {
      const combo = KIEM_PHO_COMBOS.find(c => c.id === id)!
      expect(quyTuyen.matches(combo), `quy_tuyen vs ${id}`).toBe(quy)
      expect(lienThich.matches(combo), `lien_thich vs ${id}`).toBe(lien)
    }

    expectMatch('nhat_tuyen', true, true)  // [D,D,D]
    expectMatch('khai_ngan', false, true)  // [D,D,C]
    expectMatch('hoi_tuyen', true, true)   // [D,C,D]
    expectMatch('thau_ngan', true, false)  // [C,C,D]
    expectMatch('liet_ngan', false, false) // [C,C,C]
    expectMatch('diep_ngan', false, false) // [C,D,C]

    const nhatTuyen = KIEM_PHO_COMBOS.find(c => c.id === 'nhat_tuyen')!
    const boosted = comboModifiers.reduce(
      (acc, m) => (m.matches(acc) ? m.apply(acc) : acc),
      nhatTuyen,
    )
    // 3.0 x 1.2 (quy) x 1.25 (lien) - both multiply, order-free.
    expect(boosted.damage!.multiplier).toBeCloseTo(3.0 * 1.2 * 1.25, 6)
    expect(nhatTuyen.damage!.multiplier).toBe(3.0) // canonical untouched
  })

  it('Lien Tram fires an extra manual tick on Chem-heavy combos (liet_ngan: authored + appended)', () => {
    const player = hienPlayer(['orb_chem'], 'foundation_establishment', {
      tram_can: 1,
      luu_ngan: 1,
      thuong_tham: 1,
      lien_tram: 1,
    })
    const provider = buildFor(player)
    const { system, battle, attackerP, eventBus } = makeBetaBattle(provider)

    let damages = 0
    eventBus.on('damage', () => {
      damages += 1
    })

    cast(system, battle, attackerP)
    cast(system, battle, attackerP)
    const before = damages
    const result = cast(system, battle, attackerP)

    expect(result.extraImpacts[0]?.presetId).toBe('kiem_combo_liet_ngan')
    // Orb hit + combo direct + lien_tram's manual tick = 3 damage events.
    expect(damages - before).toBe(3)
  })

  it('Luu Ngan\'s extend lands on the live wound (remainingTurns +1)', () => {
    const player = hienPlayer(['orb_dam', 'orb_dam', 'orb_chem'], 'foundation_establishment', {
      tram_can: 1,
      luu_ngan: 1,
    })
    const provider = buildFor(player)
    const { system, battle, attackerP, defenderP, runtime } = makeBetaBattle(provider)

    cast(system, battle, attackerP)
    cast(system, battle, attackerP)
    cast(system, battle, attackerP)

    const wound = kiemThuong(runtime, defenderP)[0]!
    // Base duration 4 holder turns +1 from luu_ngan's extend.
    expect(wound.remaining).toBe(5)
  })
})

describe('KIEM PHO BETA - VFX identity (design sec.3/13)', () => {
  it('the two beta orbs carry geometrically distinct stroke signatures', () => {
    expect(COMBAT_VFX_PRESETS.kiem_orb_dam.signature).toEqual(['point', 'line', 'converge'])
    expect(COMBAT_VFX_PRESETS.kiem_orb_chem.signature).toEqual(['crescent', 'arc', 'scar'])
    expect(KIEM_PHO_ORBS.orb_dam.presetId).toBe('kiem_orb_dam')
    expect(KIEM_PHO_ORBS.orb_chem.presetId).toBe('kiem_orb_chem')
  })
})
