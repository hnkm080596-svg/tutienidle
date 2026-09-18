// The Tu Reimagined — cultivation-path framework M5+M7: Thể Tu
// way-normalisation spec contract tests. Post-M7 cultivationPath is the
// BASE id ('the_tu') and cultivationWay the discriminator — there is
// exactly one persisted shape. EVERY Thể Tu way-specific gate (kit
// build, Bất Tử Ba Thể survival, path stat emission, node-tree access,
// the Thế resource bar / stat domain) resolves on the WAY —
// cultivationPath + cultivationWay — never on the raw path id.
//
// Mirrors core/phap-tu/PhapTuPath.way.test.ts: fail-closed behaviour on
// corrupt (path, way) pairs.
//
// The Hiện dual-root mutex (cuong_chien XOR tran_the) stays NodeSystem-owned
// — these tests only verify it still operates under the way stamp.

import { describe, expect, it } from 'vitest'

import { INTRO_TOTAL_TICKS, COUNTDOWN_TOTAL_TICKS, GameManager } from '../game/GameManager'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import type { TurnBattle } from '../battle/turn/TurnBattleSystem'
import { MAX_THE } from '../combat/CombatTypes'
import { defineEnemy } from '../enemy/Enemy'
import { getActiveWayDefinition } from '../player/CultivationPathKit'
import {
  collectActiveWayStatModifiers,
  resolveActiveWayStatDomains,
} from '../player/CultivationPathSystem'
import { createDefaultPlayer, resolvePlayerFinalStats } from '../player/Player'
import type { PlayerData } from '../player/Player'
import {
  aggregateNodeStatModifiers,
  purchaseNode,
} from '../progression/NodeSystem'
import { asBaseStats } from '../stats/StatBlock'
import { THE_TU_AN_NODES } from '../../data/progression/TheTuAnNodes'
import { THE_TU_NODES } from '../../data/progression/TheTuNodes'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { SKILLS } from '../../data/skill/Skills'
import { buildTheTuAnKit, buildTheTuKit } from '../../data/skill/TheTuSkills'
import { collectTheTuAnMechanicModifiers } from './TheTuAnMechanicModifiers'
import { collectTheTuKitModifiers } from './TheTuKitModifiers'
import {
  isTheTuHien,
  isTheTuUngThe,
  THE_TU_HIEN_WAY,
  THE_TU_UNG_THE_WAY,
  theTuAnReactiveModifiers,
  theTuEnduranceModifiers,
} from './TheTuPath'

const TOT10 = { strength: 10, dexterity: 10, intelligence: 10, attunement: 0, vitality: 10 }

const NODE_REGISTRY = { getAll: () => [...THE_TU_NODES, ...THE_TU_AN_NODES] }

function nodeById(id: string) {
  const node = NODE_REGISTRY.getAll().find((candidate) => candidate.id === id)
  expect(node, `node ${id} registered`).toBeDefined()
  return node!
}

function theTuPlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  const player = createDefaultPlayer()
  player.cultivationPath = 'the_tu'
  player.cultivationWay = 'hien'
  player.realmId = 'qi_refining'
  player.skillInsight = 99
  Object.assign(player, overrides)
  return player
}

/** The single persisted shape post-M7: BASE path id + the way. */
function ungThePlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  const player = createDefaultPlayer()
  player.cultivationPath = 'the_tu'
  player.cultivationWay = 'ung_the'
  player.realmId = 'qi_refining'
  player.skillInsight = 99
  Object.assign(player, overrides)
  return player
}

const UNG_THE_SHAPES = [['(the_tu, ung_the)', ungThePlayer]] as const

const TANKY_DUMMY = {
  maxHp: 100_000,
  might: 0,
  attackSpeed: 1,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
}

function makeDummy(id: string, statsInput: Partial<typeof TANKY_DUMMY> = {}) {
  return defineEnemy({
    id,
    name: 'Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: { ...TANKY_DUMMY, ...statsInput },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

function makeManager() {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes([...THE_TU_NODES, ...THE_TU_AN_NODES])
  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)
  return { gameManager, combatSource }
}

function advanceUntil(
  combatSource: ManualClockSource,
  predicate: () => boolean,
  cap = 4000,
): boolean {
  for (let i = 0; i < cap; i++) {
    if (predicate()) return true
    combatSource.advance(COMBAT_STEP_SECONDS)
  }
  return predicate()
}

function advanceIntoFighting(combatSource: ManualClockSource, battle: TurnBattle) {
  advanceUntil(
    combatSource,
    () => battle.state === 'fighting',
    INTRO_TOTAL_TICKS + COUNTDOWN_TOTAL_TICKS + 20,
  )
  expect(battle.state).toBe('fighting')
}

function startBattle(gameManager: GameManager, player: PlayerData): TurnBattle {
  gameManager.setActivePlayer(player)
  gameManager.startBattleWithPlayer(player, makeDummy('m5_dummy'))
  const battle = gameManager.getTurnBattle()
  expect(battle).not.toBeNull()
  return battle!
}

describe('Thể Tu way predicates — strict base pairs', () => {
  it.each([
    [{ cultivationPath: 'the_tu', cultivationWay: 'hien' }, true],
    [{ cultivationPath: 'the_tu', cultivationWay: 'ung_the' }, false],
    [{ cultivationPath: 'the_tu' }, false],
    [{ cultivationPath: 'phap_tu', cultivationWay: 'hien' }, false],
    [{}, false],
    [undefined, false],
  ])('isTheTuHien(%o) → %s', (slice, expected) => {
    expect(isTheTuHien(slice as PlayerData | undefined)).toBe(expected)
  })

  it.each([
    [{ cultivationPath: 'the_tu', cultivationWay: 'ung_the' }, true],
    [{ cultivationPath: 'the_tu', cultivationWay: 'hien' }, false],
    [{ cultivationPath: 'the_tu' }, false],
    [{ cultivationPath: 'phap_tu', cultivationWay: 'ung_the' }, false],
    [{}, false],
    [undefined, false],
  ])('isTheTuUngThe(%o) → %s', (slice, expected) => {
    expect(isTheTuUngThe(slice as PlayerData | undefined)).toBe(expected)
  })

  it('corrupt pair (the_tu, <foreign way>) fails closed on BOTH predicates', () => {
    for (const corrupt of [
      { cultivationPath: 'the_tu', cultivationWay: 'ngo_dao' },
      { cultivationPath: 'the_tu', cultivationWay: 'ngu' },
    ] as const) {
      expect(isTheTuHien(corrupt as PlayerData)).toBe(false)
      expect(isTheTuUngThe(corrupt as PlayerData)).toBe(false)
    }
  })
})

describe('Thể Tu way definitions', () => {
  it('hien way emits the endurance facet on the the_tu domain', () => {
    expect(THE_TU_HIEN_WAY.id).toBe('hien')
    expect(THE_TU_HIEN_WAY.pathId).toBe('the_tu')
    expect(THE_TU_HIEN_WAY.stats?.domains).toEqual(['the_tu'])
    expect(THE_TU_HIEN_WAY.stats?.collectModifiers(theTuPlayer(), TOT10)).toEqual(
      theTuEnduranceModifiers(TOT10.vitality, 'the_tu:vitality'),
    )
  })

  it('ung_the way declares the Thế resource + the the_tu_an facet', () => {
    expect(THE_TU_UNG_THE_WAY.id).toBe('ung_the')
    expect(THE_TU_UNG_THE_WAY.pathId).toBe('the_tu')
    expect(THE_TU_UNG_THE_WAY.usesTheResource).toBe(true)
    expect(THE_TU_UNG_THE_WAY.stats?.domains).toEqual(['the_tu_an'])
    expect(THE_TU_UNG_THE_WAY.stats?.collectModifiers(ungThePlayer(), TOT10)).toEqual(
      theTuAnReactiveModifiers(TOT10, 'the_tu_an:attributes'),
    )
  })
})

describe('node trees — way stamps + bidirectional isolation', () => {
  it('every THE_TU_NODES node is stamped requiredWay hien on base path the_tu', () => {
    for (const node of THE_TU_NODES) {
      expect(node.requiredCultivationPath, node.id).toBe('the_tu')
      expect(node.requiredWay, node.id).toBe('hien')
    }
  })

  it('every THE_TU_AN_NODES node is stamped requiredWay ung_the on BASE path the_tu', () => {
    for (const node of THE_TU_AN_NODES) {
      expect(node.requiredCultivationPath, node.id).toBe('the_tu')
      expect(node.requiredWay, node.id).toBe('ung_the')
    }
  })

  it('hien purchases the Hiện tree; the Ứng Thế tree rejects the way', () => {
    const player = theTuPlayer()

    expect(purchaseNode(player, nodeById('cuong_chien'))).toBe(true)
    expect(purchaseNode(player, nodeById('minor_cuong_huyet_no'))).toBe(true)
    expect(purchaseNode(player, nodeById('ho_mon'))).toBe(false)
    expect(purchaseNode(player, nodeById('minor_ung_the_the_chat'))).toBe(false)
  })

  it.each(UNG_THE_SHAPES)(
    '%s purchases the Ứng Thế tree; the Hiện tree rejects the way',
    (_label, build) => {
      const player = build()

      expect(purchaseNode(player, nodeById('ho_mon'))).toBe(true)
      expect(purchaseNode(player, nodeById('phan_mon'))).toBe(true)
      expect(purchaseNode(player, nodeById('minor_ung_the_the_chat'))).toBe(true)
      expect(purchaseNode(player, nodeById('cuong_chien'))).toBe(false)
      expect(purchaseNode(player, nodeById('tran_the'))).toBe(false)
      expect(purchaseNode(player, nodeById('minor_the_can_cot'))).toBe(false)
    },
  )

  it('hien mutex still selects exactly one root — NodeSystem-owned excludesNode unchanged', () => {
    const cuong = theTuPlayer()
    expect(purchaseNode(cuong, nodeById('cuong_chien'))).toBe(true)
    expect(purchaseNode(cuong, nodeById('tran_the'))).toBe(false)

    const tran = theTuPlayer()
    expect(purchaseNode(tran, nodeById('tran_the'))).toBe(true)
    expect(purchaseNode(tran, nodeById('cuong_chien'))).toBe(false)
  })

  it('aggregateNodeStatModifiers ignores the cross-way tree in BOTH directions', () => {
    const hien = theTuPlayer()
    hien.nodeLevels = { minor_ung_the_the_chat: 2 }
    expect(aggregateNodeStatModifiers(NODE_REGISTRY, hien)).toEqual([])

    for (const [, build] of UNG_THE_SHAPES) {
      const ungThe = build()
      ungThe.nodeLevels = { minor_the_can_cot: 2 }
      expect(aggregateNodeStatModifiers(NODE_REGISTRY, ungThe)).toEqual([])
    }
  })

  it.each(UNG_THE_SHAPES)(
    '%s way-gated collectors ignore leaked Hiện node levels',
    (_label, build) => {
      const player = build()
      player.nodeLevels = { cuong_chien: 1, minor_cuong_huyet_no: 1 }

      expect(collectTheTuKitModifiers(NODE_REGISTRY, player).missingHpBonusBonus).toBe(0)
      expect(collectTheTuAnMechanicModifiers(NODE_REGISTRY, player).maxTheBonus).toBe(0)
    },
  )

  it('hien way-gated collectors ignore leaked Ứng Thế node levels', () => {
    const player = theTuPlayer()
    player.nodeLevels = { ho_mon: 1, minor_ung_the_bi_the: 1 }

    expect(collectTheTuAnMechanicModifiers(NODE_REGISTRY, player).maxTheBonus).toBe(0)
    expect(collectTheTuKitModifiers(NODE_REGISTRY, player).missingHpBonusBonus).toBe(0)
  })
})

describe('stat facets — collectActiveWayStatModifiers is the sole channel', () => {
  it('hien emits the endurance threshold on the the_tu domain', () => {
    const mods = collectActiveWayStatModifiers(theTuPlayer(), TOT10)

    expect(mods).toHaveLength(1)
    expect(mods[0]).toMatchObject({ stat: 'enduranceThreshold', domain: 'the_tu' })
  })

  it.each(UNG_THE_SHAPES)(
    '%s emits the three reactive chances on the the_tu_an domain',
    (_label, build) => {
      const mods = collectActiveWayStatModifiers(build(), TOT10)

      expect(mods).toHaveLength(3)
      expect(mods.map((m) => m.domain)).toEqual(['the_tu_an', 'the_tu_an', 'the_tu_an'])
      expect(mods.map((m) => m.stat).sort()).toEqual([
        'counterChance',
        'followUpChance',
        'protectChance',
      ])
    },
  )

  it('a way-less save resolves nothing — corrupt post-M7, emits no reactive chances', () => {
    const legacy = ungThePlayer()
    legacy.baseStats.strength = 100
    legacy.baseStats.dexterity = 100
    legacy.baseStats.intelligence = 100
    legacy.baseStats.vitality = 100
    delete legacy.cultivationWay

    const stats = resolvePlayerFinalStats(legacy, [])
    expect(stats.counterChance).toBe(0)
    expect(stats.protectChance).toBe(0)
    expect(stats.followUpChance).toBe(0)
  })

  it('way-owned stat domains resolve from the way, not the raw path id', () => {
    expect(resolveActiveWayStatDomains(theTuPlayer())).toEqual(['the_tu'])
    for (const [, build] of UNG_THE_SHAPES) {
      expect(resolveActiveWayStatDomains(build())).toEqual(['the_tu_an'])
    }
    expect(resolveActiveWayStatDomains(createDefaultPlayer())).toBeUndefined()
  })
})

describe('battle builds — participant kit is way-resolved', () => {
  it.each(UNG_THE_SHAPES)(
    '%s builds the Ứng Thế kit (tham_the / tu_the / bach_ung + Thế pool)',
    (_label, build) => {
      const { gameManager } = makeManager()
      const player = build()
      // Node-baked cap proves the KIT stamped entity.maxThe (the
      // universal resolvePlayerMaxThe default is just MAX_THE).
      player.nodeLevels = { minor_ung_the_bi_the: 3 }
      const battle = startBattle(gameManager, player)
      const participant = battle.players[0]!

      expect(participant.basic?.id).toBe('tham_the')
      expect(participant.special?.skill.id).toBe('tu_the')
      expect(participant.ultimate?.skill.id).toBe('bach_ung')
      expect(participant.reactivePayloads).toBeDefined()
      expect(participant.entity.maxThe).toBe(MAX_THE + 30)
      expect(participant.activeDomains?.has('the_tu_an')).toBe(true)
      expect(participant.activeDomains?.has('the_tu')).toBe(false)
    },
  )

  it.each(UNG_THE_SHAPES)(
    '%s leaked cuong_chien levels never resolve the Hiện kit',
    (_label, build) => {
      const { gameManager } = makeManager()
      const player = build()
      player.nodeLevels = { cuong_chien: 1, minor_cuong_huyet_no: 1 }

      const battle = startBattle(gameManager, player)
      const participant = battle.players[0]!

      expect(participant.basic?.id).toBe('tham_the')
      expect(participant.ultimate?.skill.id).toBe('bach_ung')
      expect(participant.activeDomains?.has('the_tu_an')).toBe(true)
    },
  )

  it('hien + cuong_chien → cường quyền / loạn đấu / bất tử ba thể on the the_tu domain', () => {
    const { gameManager } = makeManager()
    const player = theTuPlayer()
    player.nodeLevels = { cuong_chien: 1 }

    const battle = startBattle(gameManager, player)
    const participant = battle.players[0]!

    expect(participant.basic?.id).toBe('cuong_quyen')
    expect(participant.special?.skill.id).toBe('loan_dau')
    expect(participant.ultimate?.skill.id).toBe('bat_tu_ba_the')
    expect(participant.reactivePayloads).toBeUndefined()
    expect(participant.activeDomains?.has('the_tu')).toBe(true)
    expect(participant.activeDomains?.has('the_tu_an')).toBe(false)
  })

  it('hien leaked ho_mon levels never resolve the Ứng Thế kit', () => {
    const { gameManager } = makeManager()
    const player = theTuPlayer()
    player.nodeLevels = { cuong_chien: 1, ho_mon: 1, phan_mon: 1 }

    const battle = startBattle(gameManager, player)
    const participant = battle.players[0]!

    expect(participant.basic?.id).toBe('cuong_quyen')
    expect(participant.reactivePayloads).toBeUndefined()
    expect(
      gameManager.getBattleBuffs(participant.entity.id).some((i) => i.definitionId === 'ung_the'),
    ).toBe(false)
  })

  it('corrupt pair (the_tu, <foreign way>) fails closed — no way kit resolves', () => {
    const { gameManager } = makeManager()
    const player = ungThePlayer({ cultivationWay: 'ngo_dao' })
    player.nodeLevels = { cuong_chien: 1, ho_mon: 1 }

    const battle = startBattle(gameManager, player)
    const participant = battle.players[0]!

    expect(participant.basic?.id).toBe('generic_physical')
    expect(participant.reactivePayloads).toBeUndefined()
    expect(
      gameManager.getBattleBuffs(participant.entity.id).some((i) => i.definitionId === 'ung_the'),
    ).toBe(false)
    expect(participant.activeDomains?.has('the_tu_an') ?? false).toBe(false)
  })
})

describe('Bất Tử Ba Thể survival — hien-only machinery', () => {
  it('hien survives a lethal hit once via the Cuồng Chiến ultimate', () => {
    const { gameManager, combatSource } = makeManager()
    const player = theTuPlayer()
    player.nodeLevels = { cuong_chien: 1 }
    player.baseStats = asBaseStats({ ...player.baseStats, speed: 1 })

    const enemy = makeDummy('m5_bat_tu', { might: 9_999_999, attackSpeed: 500 })
    gameManager.setActivePlayer(player)
    gameManager.startBattleWithPlayer(player, enemy)
    const battle = gameManager.getTurnBattle()!
    const participant = battle.players[0]!
    participant.entity.currentHp = 50
    advanceIntoFighting(combatSource, battle)

    expect(
      advanceUntil(combatSource, () =>
        gameManager
          .getBattleBuffs(participant.entity.id)
          .some((i) => i.definitionId === 'bat_tu_ba_the'),
      ),
    ).toBe(true)
    expect(participant.entity.alive).toBe(true)
    expect(participant.entity.currentHp).toBe(1)
  })

  it.each(UNG_THE_SHAPES)(
    '%s never builds the Hiện survival source even with leaked cuong_chien',
    (_label, build) => {
      const { gameManager, combatSource } = makeManager()
      const player = build()
      player.nodeLevels = { cuong_chien: 1, minor_cuong_huyet_no: 1 }
      player.baseStats = asBaseStats({ ...player.baseStats, speed: 1 })

      const enemy = makeDummy('m5_no_bat_tu', { might: 9_999_999, attackSpeed: 500 })
      gameManager.setActivePlayer(player)
      gameManager.startBattleWithPlayer(player, enemy)
      const battle = gameManager.getTurnBattle()!
      const participant = battle.players[0]!
      participant.entity.currentHp = 50
      advanceIntoFighting(combatSource, battle)

      expect(advanceUntil(combatSource, () => !participant.entity.alive)).toBe(true)
      expect(
        gameManager
          .getBattleBuffs(participant.entity.id)
          .filter((i) => i.definitionId === 'bat_tu_ba_the'),
      ).toHaveLength(0)
    },
  )
})

describe('way-authored kits still compose from the node collectors', () => {
  it('buildTheTuKit + buildTheTuAnKit remain data factories — way resolution lives in the GameManager', () => {
    const hienMods = collectTheTuKitModifiers(
      NODE_REGISTRY,
      theTuPlayer({ nodeLevels: { minor_cuong_huyet_no: 1 } }),
    )
    const hienKit = buildTheTuKit('cuong_chien', hienMods)
    expect(hienKit.basic.id).toBe('cuong_quyen')

    const ungTheMods = collectTheTuAnMechanicModifiers(
      NODE_REGISTRY,
      ungThePlayer({ nodeLevels: { minor_ung_the_bi_the: 1 } }),
    )
    const ungTheKit = buildTheTuAnKit(['ho_mon'], ungTheMods)
    expect(ungTheKit.basic.id).toBe('tham_the')
    expect(ungTheKit.maxThe).toBe(MAX_THE + ungTheMods.maxTheBonus)
  })

  it('getActiveWayDefinition resolves the way object for both persisted eras', () => {
    expect(getActiveWayDefinition(theTuPlayer())?.id).toBe('hien')
    for (const [, build] of UNG_THE_SHAPES) {
      expect(getActiveWayDefinition(build())?.id).toBe('ung_the')
      expect(getActiveWayDefinition(build())?.usesTheResource).toBe(true)
    }
    expect(getActiveWayDefinition(createDefaultPlayer())).toBeUndefined()
  })
})
