// The Tu Reimagined — cultivation-path framework M5+M7: Thể Tu
// way-normalisation spec contract tests. Post-M7 cultivationPath is the
// BASE id ('body') and cultivationWay the discriminator — there is
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
import { collectHiddenBodyMechanicModifiers } from './TheTuAnMechanicModifiers'
import { collectBodyKitModifiers } from './TheTuKitModifiers'
import {
  isBodyPathway,
  isHiddenBodyPathway,
  BODY_PATHWAY,
  HIDDEN_BODY_PATHWAY,
  hiddenBodyReactiveModifiers,
  bodyEnduranceModifiers,
} from './TheTuPath'

const TOT10 = { strength: 10, dexterity: 10, intelligence: 10, attunement: 0, vitality: 10 }

const NODE_REGISTRY = { getAll: () => [...THE_TU_NODES, ...THE_TU_AN_NODES] }

function nodeById(id: string) {
  const node = NODE_REGISTRY.getAll().find((candidate) => candidate.id === id)
  expect(node, `node ${id} registered`).toBeDefined()
  return node!
}

function bodyPlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  const player = createDefaultPlayer()
  player.cultivationPath = 'body'
  player.cultivationWay = 'body_pathway'
  player.realmId = 'qi_refining'
  player.skillInsight = 99
  Object.assign(player, overrides)
  return player
}

/** The single persisted shape post-M7: BASE path id + the way. */
function ungThePlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  const player = createDefaultPlayer()
  player.cultivationPath = 'body'
  player.cultivationWay = 'hidden_body_pathway'
  player.realmId = 'qi_refining'
  player.skillInsight = 99
  Object.assign(player, overrides)
  return player
}

const UNG_THE_SHAPES = [['(body, ung_the)', ungThePlayer]] as const

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
    rewards: { techniqueMastery: 0, spiritStone: 0 },
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
    [{ cultivationPath: 'body', cultivationWay: 'body_pathway' }, true],
    [{ cultivationPath: 'body', cultivationWay: 'hidden_body_pathway' }, false],
    [{ cultivationPath: 'body' }, false],
    [{ cultivationPath: 'spell', cultivationWay: 'sword_pathway' }, false],
    [{}, false],
    [undefined, false],
  ])('isBodyPathway(%o) → %s', (slice, expected) => {
    expect(isBodyPathway(slice as PlayerData | undefined)).toBe(expected)
  })

  it.each([
    [{ cultivationPath: 'body', cultivationWay: 'hidden_body_pathway' }, true],
    [{ cultivationPath: 'body', cultivationWay: 'body_pathway' }, false],
    [{ cultivationPath: 'body' }, false],
    [{ cultivationPath: 'spell', cultivationWay: 'hidden_body_pathway' }, false],
    [{}, false],
    [undefined, false],
  ])('isHiddenBodyPathway(%o) → %s', (slice, expected) => {
    expect(isHiddenBodyPathway(slice as PlayerData | undefined)).toBe(expected)
  })

  it('corrupt pair (body, <foreign way>) fails closed on BOTH predicates', () => {
    for (const corrupt of [
      { cultivationPath: 'body', cultivationWay: 'hidden_spell_pathway' },
      { cultivationPath: 'body', cultivationWay: 'hidden_sword_pathway' },
    ] as const) {
      expect(isBodyPathway(corrupt as PlayerData)).toBe(false)
      expect(isHiddenBodyPathway(corrupt as PlayerData)).toBe(false)
    }
  })
})

describe('Thể Tu way definitions', () => {
  it('hien way emits the endurance facet on the body domain', () => {
    expect(BODY_PATHWAY.id).toBe('body_pathway')
    expect(BODY_PATHWAY.pathId).toBe('body')
    expect(BODY_PATHWAY.stats?.domains).toEqual(['body'])
    expect(BODY_PATHWAY.stats?.collectModifiers(bodyPlayer(), TOT10)).toEqual(
      bodyEnduranceModifiers(TOT10.vitality, 'body:vitality'),
    )
  })

  it('ung_the way declares the Thế economy capability + the hidden_body facet', () => {
    expect(HIDDEN_BODY_PATHWAY.id).toBe('hidden_body_pathway')
    expect(HIDDEN_BODY_PATHWAY.pathId).toBe('body')
    expect(HIDDEN_BODY_PATHWAY.capabilities?.static).toContain('body.essence_economy')
    expect(HIDDEN_BODY_PATHWAY.stats?.domains).toEqual(['hidden_body'])
    expect(HIDDEN_BODY_PATHWAY.stats?.collectModifiers(ungThePlayer(), TOT10)).toEqual(
      hiddenBodyReactiveModifiers(TOT10, 'hidden_body:attributes'),
    )
  })
})

describe('node trees — way stamps + bidirectional isolation', () => {
  it('every THE_TU_NODES node is stamped requiredWay hien on base path body', () => {
    for (const node of THE_TU_NODES) {
      expect(node.requiredCultivationPath, node.id).toBe('body')
      expect(node.requiredWay, node.id).toBe('body_pathway')
    }
  })

  it('every THE_TU_AN_NODES node is stamped requiredWay ung_the on BASE path body', () => {
    for (const node of THE_TU_AN_NODES) {
      expect(node.requiredCultivationPath, node.id).toBe('body')
      expect(node.requiredWay, node.id).toBe('hidden_body_pathway')
    }
  })

  it('hien purchases the Hiện tree; the Ứng Thế tree rejects the way', () => {
    const player = bodyPlayer()

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
    const cuong = bodyPlayer()
    expect(purchaseNode(cuong, nodeById('cuong_chien'))).toBe(true)
    expect(purchaseNode(cuong, nodeById('tran_the'))).toBe(false)

    const tran = bodyPlayer()
    expect(purchaseNode(tran, nodeById('tran_the'))).toBe(true)
    expect(purchaseNode(tran, nodeById('cuong_chien'))).toBe(false)
  })

  it('aggregateNodeStatModifiers ignores the cross-way tree in BOTH directions', () => {
    const hien = bodyPlayer()
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

      expect(collectBodyKitModifiers(NODE_REGISTRY, player).missingHpBonusBonus).toBe(0)
      expect(collectHiddenBodyMechanicModifiers(NODE_REGISTRY, player).maxTheBonus).toBe(0)
    },
  )

  it('hien way-gated collectors ignore leaked Ứng Thế node levels', () => {
    const player = bodyPlayer()
    player.nodeLevels = { ho_mon: 1, minor_ung_the_bi_the: 1 }

    expect(collectHiddenBodyMechanicModifiers(NODE_REGISTRY, player).maxTheBonus).toBe(0)
    expect(collectBodyKitModifiers(NODE_REGISTRY, player).missingHpBonusBonus).toBe(0)
  })
})

describe('stat facets — collectActiveWayStatModifiers is the sole channel', () => {
  it('hien emits the endurance threshold on the body domain', () => {
    const mods = collectActiveWayStatModifiers(bodyPlayer(), TOT10)

    expect(mods).toHaveLength(1)
    expect(mods[0]).toMatchObject({ stat: 'enduranceThreshold', domain: 'body' })
  })

  it.each(UNG_THE_SHAPES)(
    '%s emits the three reactive chances on the hidden_body domain',
    (_label, build) => {
      const mods = collectActiveWayStatModifiers(build(), TOT10)

      expect(mods).toHaveLength(3)
      expect(mods.map((m) => m.domain)).toEqual(['hidden_body', 'hidden_body', 'hidden_body'])
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
    expect(resolveActiveWayStatDomains(bodyPlayer())).toEqual(['body'])
    for (const [, build] of UNG_THE_SHAPES) {
      expect(resolveActiveWayStatDomains(build())).toEqual(['hidden_body'])
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
      expect(participant.activeDomains?.has('hidden_body')).toBe(true)
      expect(participant.activeDomains?.has('body')).toBe(false)
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
      expect(participant.activeDomains?.has('hidden_body')).toBe(true)
    },
  )

  it('hien + cuong_chien → cường quyền / loạn đấu / bất tử ba thể on the body domain', () => {
    const { gameManager } = makeManager()
    const player = bodyPlayer()
    player.nodeLevels = { cuong_chien: 1 }

    const battle = startBattle(gameManager, player)
    const participant = battle.players[0]!

    expect(participant.basic?.id).toBe('cuong_quyen')
    expect(participant.special?.skill.id).toBe('loan_dau')
    expect(participant.ultimate?.skill.id).toBe('bat_tu_ba_the')
    expect(participant.reactivePayloads).toBeUndefined()
    expect(participant.activeDomains?.has('body')).toBe(true)
    expect(participant.activeDomains?.has('hidden_body')).toBe(false)
  })

  it('hien leaked ho_mon levels never resolve the Ứng Thế kit', () => {
    const { gameManager } = makeManager()
    const player = bodyPlayer()
    player.nodeLevels = { cuong_chien: 1, ho_mon: 1, phan_mon: 1 }

    const battle = startBattle(gameManager, player)
    const participant = battle.players[0]!

    expect(participant.basic?.id).toBe('cuong_quyen')
    expect(participant.reactivePayloads).toBeUndefined()
    expect(
      gameManager.getBattleBuffs(participant.entity.id).some((i) => i.definitionId === 'ung_the'),
    ).toBe(false)
  })

  it('corrupt pair (body, <foreign way>) fails closed — no way kit resolves', () => {
    const { gameManager } = makeManager()
    const player = ungThePlayer({ cultivationWay: 'hidden_spell_pathway' })
    player.nodeLevels = { cuong_chien: 1, ho_mon: 1 }

    const battle = startBattle(gameManager, player)
    const participant = battle.players[0]!

    expect(participant.basic?.id).toBe('generic_physical')
    expect(participant.reactivePayloads).toBeUndefined()
    expect(
      gameManager.getBattleBuffs(participant.entity.id).some((i) => i.definitionId === 'ung_the'),
    ).toBe(false)
    expect(participant.activeDomains?.has('hidden_body') ?? false).toBe(false)
  })
})

describe('Bất Tử Ba Thể survival — hien-only machinery', () => {
  it('hien survives a lethal hit once via the Cuồng Chiến ultimate', () => {
    const { gameManager, combatSource } = makeManager()
    const player = bodyPlayer()
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
    const hienMods = collectBodyKitModifiers(
      NODE_REGISTRY,
      bodyPlayer({ nodeLevels: { minor_cuong_huyet_no: 1 } }),
    )
    const hienKit = buildTheTuKit('cuong_chien', hienMods)
    expect(hienKit.basic.id).toBe('cuong_quyen')

    const ungTheMods = collectHiddenBodyMechanicModifiers(
      NODE_REGISTRY,
      ungThePlayer({ nodeLevels: { minor_ung_the_bi_the: 1 } }),
    )
    const ungTheKit = buildTheTuAnKit(['ho_mon'], ungTheMods)
    expect(ungTheKit.basic.id).toBe('tham_the')
    expect(ungTheKit.maxThe).toBe(MAX_THE + ungTheMods.maxTheBonus)
  })

  it('getActiveWayDefinition resolves the way object for both persisted eras', () => {
    expect(getActiveWayDefinition(bodyPlayer())?.id).toBe('body_pathway')
    for (const [, build] of UNG_THE_SHAPES) {
      expect(getActiveWayDefinition(build())?.id).toBe('hidden_body_pathway')
      expect(getActiveWayDefinition(build())?.capabilities?.static).toContain('body.essence_economy')
    }
    expect(getActiveWayDefinition(createDefaultPlayer())).toBeUndefined()
  })
})
