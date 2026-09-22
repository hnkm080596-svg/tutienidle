import { describe, expect, it } from 'vitest'
import { MAX_THE } from '../combat/CombatTypes'
import { GameManager } from '../game/GameManager'
import { createDefaultPlayer, resolvePlayerFinalStats, type PlayerData } from '../player/Player'
import {
  collectActiveWayStatModifiers,
  hasPathCapability,
  SPELL_ATTUNEMENT_MAX_MP_PER_POINT,
} from '../player/CultivationPathSystem'
import type { PathCapability } from '../player/CultivationPathKit'
import {
  aggregateNodeStatModifiers,
  canPurchaseNode,
  previewRouteSwitch,
  purchaseNode,
  switchRoute,
} from '../progression/NodeSystem'
import type { ProgressionNode } from '../progression/ProgressionNode'
import type { TurnBattle } from '../battle/turn/TurnBattleSystem'
import { makeTheBarReader, type TheBarPlayerState } from '@/presentation/bridges/theBarBridge'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { TRUONG_THE_CAP_PER_LEVEL } from '../../data/progression/PhapTuNodes.builders'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { defineEnemy } from '../enemy/Enemy'
import {
  isHiddenSpellPathway,
  isSpellPathway,
  HIDDEN_SPELL_BASIC_ID,
  HIDDEN_SPELL_PASSIVE_ID,
  HIDDEN_SPELL_SPECIAL_ID,
} from './PhapTuPath'
import { getRouteStatModifiers, resolveMaxThe } from './PhapTuRoutes'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

// Cultivation Path Framework (M4+M7, spec 2026-09-16, audit R6) — way
// identity drives ALL way-specific behavior. Every spell_pathway-only
// mechanism (element/route/The machinery) must gate on the WAY, never
// the bare 'spell' path id, so the ngo_dao way cannot reach them.
// Post-M7 there is exactly one persisted shape: ('spell','hidden_spell_pathway').

function nguHanh(overrides: Partial<PlayerData> = {}): PlayerData {
  const player = createDefaultPlayer()
  player.cultivationPath = 'spell'
  player.cultivationWay = 'spell_pathway'
  return Object.assign(player, overrides)
}

/** The single persisted shape: base path id + the way. */
function ngoDao(overrides: Partial<PlayerData> = {}): PlayerData {
  const player = createDefaultPlayer()
  player.cultivationPath = 'spell'
  player.cultivationWay = 'hidden_spell_pathway'
  return Object.assign(player, overrides)
}

const NGO_DAO_SHAPES = { collapsed: ngoDao } as const

/** Dirty ngo_dao state — an element/route pair that could only leak in
 * through corruption (ngo_dao owns no spellPath commitment). */
function dirtyNgoDao(make: (overrides?: Partial<PlayerData>) => PlayerData): PlayerData {
  return make({ spellPath: { element: 'fire', route: 'dot' } })
}

function spellPathManager() {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
  return gameManager
}

function dummyEnemy() {
  return defineEnemy({
    id: 'way_audit_dummy',
    name: 'Way Audit Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 1_000_000,
      might: 0,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
      evasionRate: 0,
    },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
}

describe('way predicates — isSpellPathway / isHiddenSpellPathway', () => {
  it('isSpellPathway requires the spell path AND the spell_pathway way together', () => {
    expect(isSpellPathway(nguHanh())).toBe(true)
    expect(isSpellPathway(ngoDao())).toBe(false)
    expect(isSpellPathway(ngoDao())).toBe(false)
    expect(isSpellPathway(createDefaultPlayer())).toBe(false)
    expect(isSpellPathway(null)).toBe(false)

    // Legacy-shaped (path only, no way) fails closed — the authority
    // writes both fields inside the ritual transaction.
    const legacy = createDefaultPlayer()
    legacy.cultivationPath = 'spell'
    expect(isSpellPathway(legacy)).toBe(false)
  })

  it('isHiddenSpellPathway requires the strict (spell, ngo_dao) pair', () => {
    expect(isHiddenSpellPathway(ngoDao())).toBe(true)
    expect(isHiddenSpellPathway(nguHanh())).toBe(false)
    expect(isHiddenSpellPathway(createDefaultPlayer())).toBe(false)

    // Way-less and foreign-way pairs fail closed.
    const wayless = ngoDao()
    delete wayless.cultivationWay
    expect(isHiddenSpellPathway(wayless)).toBe(false)
    expect(isHiddenSpellPathway(ngoDao({ cultivationWay: 'hidden_body_pathway' }))).toBe(false)
  })
})

describe('selectSpellPathElement — spell_pathway way gate', () => {
  it('commits element+route atomically for spell_pathway; rejects BOTH ngo_dao shapes with zero mutation', () => {
    const gameManager = spellPathManager()

    const ngu = nguHanh()
    expect(gameManager.progressionOps.selectSpellPathElement('fire', 'dot', ngu)).toBe(true)
    expect(ngu.spellPath).toEqual({ element: 'fire', route: 'dot' })
    expect(ngu.nodeLevels['hoa_linh_ngo']).toBe(1)

    // The collapsed shape is the real R6 leak: a bare 'spell' path
    // check would let a ngo_dao player commit an element.
    for (const ngo of [ngoDao(), ngoDao()]) {
      expect(gameManager.progressionOps.selectSpellPathElement('fire', 'dot', ngo)).toBe(false)
      expect(ngo.spellPath).toEqual({ element: null, route: null })
      expect(ngo.nodeLevels['hoa_linh_ngo']).toBeUndefined()
    }
  })

  it('getSpellPathElement surfaces the committed element for spell_pathway only', () => {
    const gameManager = spellPathManager()

    const ngu = nguHanh({ spellPath: { element: 'water', route: 'no' } })
    gameManager.setActivePlayer(ngu)
    expect(gameManager.progressionOps.getSpellPathElement()).toBe('water')

    // Leaked element state on the hidden way must not surface.
    for (const ngo of [dirtyNgoDao(ngoDao), dirtyNgoDao(ngoDao)]) {
      gameManager.setActivePlayer(ngo)
      expect(gameManager.progressionOps.getSpellPathElement()).toBeUndefined()
    }
  })
})

describe('switchRoute / previewRouteSwitch — spell_pathway way gate', () => {
  const registry = {
    nodes: [
      { id: 'dot_spec_1', name: 'dot_spec_1', type: 'minor', insightCost: 2, routeTag: 'dot', effect: {} } as ProgressionNode,
      { id: 'no_spec_1', name: 'no_spec_1', type: 'minor', insightCost: 2, routeTag: 'no', effect: {} } as ProgressionNode,
    ],
    getAll() {
      return this.nodes
    },
  }

  it('domain: spell_pathway switches and refunds; ngo_dao (both shapes) is rejected without mutation', () => {
    const ngu = nguHanh({ spellPath: { element: 'fire', route: 'dot' }, skillInsight: 100 })
    purchaseNode(ngu, registry.nodes[0]!)

    const refund = switchRoute(ngu, registry, 'no')
    expect(refund).toBeGreaterThan(0)
    expect(ngu.spellPath.route).toBe('no')

    for (const make of Object.values(NGO_DAO_SHAPES)) {
      const ngo = dirtyNgoDao(make)
      ngo.nodeLevels = { dot_spec_1: 1 }
      const insightBefore = ngo.skillInsight

      expect(switchRoute(ngo, registry, 'no')).toBe(0)
      expect(ngo.spellPath.route).toBe('dot')
      expect(ngo.nodeLevels['dot_spec_1']).toBe(1)
      expect(ngo.skillInsight).toBe(insightBefore)
      expect(previewRouteSwitch(ngo, registry)).toEqual({ refund: 0, forfeited: 0, resetNodeCount: 0 })
    }
  })

  it('ops: progressionOps.switchRoute rejects ngo_dao even with committed-looking spellPath state', () => {
    const gameManager = spellPathManager()

    const ngu = nguHanh()
    gameManager.setActivePlayer(ngu)
    expect(gameManager.progressionOps.selectSpellPathElement('fire', 'dot', ngu)).toBe(true)
    expect(gameManager.progressionOps.switchRoute('no', ngu)).toBe(true)
    expect(ngu.spellPath.route).toBe('no')

    for (const make of Object.values(NGO_DAO_SHAPES)) {
      const ngo = dirtyNgoDao(make)
      gameManager.setActivePlayer(ngo)
      expect(gameManager.progressionOps.switchRoute('no', ngo)).toBe(false)
      expect(ngo.spellPath).toEqual({ element: 'fire', route: 'dot' })
    }
  })
})

describe('route stats + The cap — spell_pathway way gate', () => {
  it('getRouteStatModifiers emits for spell_pathway only — dirty ngo_dao state cannot inject universal stats', () => {
    const ngu = nguHanh({ spellPath: { element: 'fire', route: 'dot' } })
    expect(getRouteStatModifiers(ngu)).toHaveLength(2)

    for (const ngo of [dirtyNgoDao(ngoDao), dirtyNgoDao(ngoDao)]) {
      expect(getRouteStatModifiers(ngo)).toEqual([])
    }
  })

  it('resolveMaxThe counts truong_the for spell_pathway only — ngo_dao owns no The pool', () => {
    const registry = { getAll: () => PHAP_TU_NODES }
    const committed = { element: 'fire' as const, route: 'no' as const }

    const ngu = nguHanh({ spellPath: committed, nodeLevels: { truong_the_fire: 2 } })
    expect(resolveMaxThe(registry, ngu)).toBe(MAX_THE + 2 * TRUONG_THE_CAP_PER_LEVEL)

    for (const make of Object.values(NGO_DAO_SHAPES)) {
      const ngo = make({ spellPath: committed, nodeLevels: { truong_the_fire: 2 } })
      expect(resolveMaxThe(registry, ngo)).toBe(MAX_THE)
    }
  })
})

describe('the bar bridge — spell_pathway way gate', () => {
  function fightingBattle(): TurnBattle {
    return {
      state: 'fighting',
      players: [{ entity: { currentThe: 40, maxThe: MAX_THE } }],
      enemies: [],
    } as unknown as TurnBattle
  }

  function barPlayer(overrides: Record<string, unknown> = {}): TheBarPlayerState {
    return {
      cultivationPath: 'spell',
      cultivationWay: 'spell_pathway',
      spellPath: { element: 'fire', route: 'dot' },
      nodeLevels: {},
      ...overrides,
    } as TheBarPlayerState
  }

  it('spell_pathway + committed element + fighting -> snapshot; ngo_dao (both shapes) -> null', () => {
    // P1 - the bridge consults the bound capability facade; bind the real
    // resolver to the same player the reader sees.
    let barState = barPlayer()
    const gameManager = {
      getTurnBattle: () => fightingBattle(),
      hasPathCapability: (cap: PathCapability) =>
        hasPathCapability(barState, cap, { hasSkill: () => false }),
    } as unknown as GameManager

    const nguReader = makeTheBarReader(gameManager, () => barPlayer())
    expect(nguReader()?.current).toBe(40)

    for (const shape of [
      { cultivationPath: 'spell', cultivationWay: 'hidden_spell_pathway' },
      { cultivationPath: 'body', cultivationWay: 'hidden_body_pathway' },
    ]) {
      barState = barPlayer(shape)
      const reader = makeTheBarReader(gameManager, () => barState)
      expect(reader(), JSON.stringify(shape)).toBeNull()
    }
  })
})

describe('PHAP_TU_NODES — requiredWay spell_pathway export stamp', () => {
  it('every node carries requiredCultivationPath spell + requiredWay spell_pathway', () => {
    for (const node of PHAP_TU_NODES) {
      expect(node.requiredCultivationPath, node.id).toBe('spell')
      expect(node.requiredWay, node.id).toBe('spell_pathway')
    }
  })

  it('ngo_dao cannot purchase element nodes; spell_pathway can; mortal cannot', () => {
    const root = PHAP_TU_NODES.find((node) => node.id === 'hoa_linh_ngo')!
    const growth = PHAP_TU_NODES.find((node) => node.id === 'fire_dot_chance')!

    const ngu = nguHanh({ skillInsight: 100 })
    expect(canPurchaseNode(ngu, root)).toBe(true)
    expect(purchaseNode(ngu, root)).toBe(true)

    for (const make of Object.values(NGO_DAO_SHAPES)) {
      const ngo = make({ skillInsight: 100 })
      expect(canPurchaseNode(ngo, root), `${ngo.cultivationPath}/${ngo.cultivationWay}`).toBe(false)
      expect(purchaseNode(ngo, root)).toBe(false)
      expect(canPurchaseNode(ngo, growth)).toBe(false)
      expect(purchaseNode(ngo, growth)).toBe(false)
      expect(ngo.nodeLevels['hoa_linh_ngo']).toBeUndefined()
      expect(ngo.nodeLevels['fire_dot_chance']).toBeUndefined()
    }

    const mortal = createDefaultPlayer()
    mortal.skillInsight = 100
    expect(canPurchaseNode(mortal, root)).toBe(false)
    expect(purchaseNode(mortal, root)).toBe(false)
  })

  it('injected element-node levels aggregate NOTHING for ngo_dao', () => {
    const statNode = PHAP_TU_NODES.find(
      (node) =>
        (node.effect.statModifiers?.length ?? 0) > 0 &&
        node.elementTag === 'fire' &&
        node.routeTag === 'dot',
    )!
    const registry = { getAll: () => PHAP_TU_NODES }

    const ngu = nguHanh({ spellPath: { element: 'fire', route: 'dot' }, nodeLevels: { [statNode.id]: 2 } })
    expect(aggregateNodeStatModifiers(registry, ngu).length).toBeGreaterThan(0)

    for (const make of Object.values(NGO_DAO_SHAPES)) {
      const ngo = make({ spellPath: { element: 'fire', route: 'dot' }, nodeLevels: { [statNode.id]: 2 } })
      expect(aggregateNodeStatModifiers(registry, ngo), `${ngo.cultivationPath}/${ngo.cultivationWay}`).toEqual([])
    }
  })
})

describe('way stat facet — shared spell domain emission', () => {
  it('collectActiveWayStatModifiers emits the identical attunement->MP pair for BOTH phap ways', () => {
    const totals = {
      strength: 0,
      dexterity: 0,
      vitality: 0,
      intelligence: 0,
      attunement: 10,
    }

    const nguMods = collectActiveWayStatModifiers(nguHanh(), totals)
    expect(nguMods.length).toBeGreaterThan(0)
    for (const modifier of nguMods) {
      expect(modifier.domain).toBe('spell')
    }

    expect(collectActiveWayStatModifiers(ngoDao(), totals)).toEqual(nguMods)
    expect(collectActiveWayStatModifiers(ngoDao(), totals)).toEqual(nguMods)
  })

  it('resolvePlayerFinalStats yields identical MP for spell_pathway and ngo_dao', () => {
    const ngu = nguHanh()
    ngu.baseStats.attunement = 10
    const ngo = ngoDao()
    ngo.baseStats.attunement = 10

    const nguStats = resolvePlayerFinalStats(ngu, [])
    const ngoStats = resolvePlayerFinalStats(ngo, [])

    expect(nguStats.maxMp).toBeGreaterThan(0)
    expect(ngoStats.maxMp).toBeCloseTo(nguStats.maxMp, 6)
    expect(ngoStats.manaRegenPerTurn).toBeCloseTo(nguStats.manaRegenPerTurn, 6)
  })

  it('way-less spell player (path only, no way) emits NOTHING — M7 fail-closed', () => {
    const wayLess = createDefaultPlayer()
    wayLess.cultivationPath = 'spell'
    wayLess.baseStats.attunement = 10

    // M7: the LEGACY_PATH_TO_WAY lenient fallback is gone — the attunement
    // facet cannot resolve a way, so no spell emission occurs.
    expect(resolvePlayerFinalStats(wayLess, []).maxMp).toBe(0)
  })

  it('non-phap players emit nothing through the facet channel', () => {
    const mortal = createDefaultPlayer()
    mortal.baseStats.attunement = 10

    const kiem = createDefaultPlayer()
    kiem.cultivationPath = 'sword'
    kiem.cultivationWay = 'sword_pathway'
    kiem.baseStats.attunement = 10

    expect(collectActiveWayStatModifiers(mortal, { strength: 0, dexterity: 0, vitality: 0, intelligence: 0, attunement: 10 })).toEqual([])
    expect(collectActiveWayStatModifiers(kiem, { strength: 0, dexterity: 0, vitality: 0, intelligence: 0, attunement: 10 })).toEqual([])
    expect(resolvePlayerFinalStats(mortal, []).maxMp).toBe(0)
    expect(resolvePlayerFinalStats(kiem, []).maxMp).toBe(0)
  })
})

describe('battle build — the way drives the kit branch', () => {
  function learnAnKit(gameManager: GameManager, player: PlayerData) {
    for (const skillId of [HIDDEN_SPELL_BASIC_ID, HIDDEN_SPELL_SPECIAL_ID, HIDDEN_SPELL_PASSIVE_ID]) {
      expect(gameManager.progressionOps.learnSkill(skillId, player)).toBe(true)
    }
  }

  it('ngo_dao resolves the An kit basic/special even with leaked element state', () => {
    const gameManager = spellPathManager()
    const player = NGO_DAO_SHAPES.collapsed({ spellPath: { element: 'fire', route: 'no' } })
    gameManager.setActivePlayer(player)
    learnAnKit(gameManager, player)

    gameManager.startBattleWithPlayer(player, dummyEnemy())

    const participant = gameManager.getTurnBattle()!.players[0]!
    expect(participant.basic?.id).toBe(HIDDEN_SPELL_BASIC_ID)
    expect(participant.basic?.compositePicks?.pool).toHaveLength(5)
    expect(participant.special?.skill.id).toBe(HIDDEN_SPELL_SPECIAL_ID)
    // The An kit carries no The loop — no theGain fields on the basic.
    expect(participant.basic?.theGainOnLandedCast).toBeUndefined()
    expect(participant.basic?.theGainOnCrit).toBeUndefined()
  })

  it('a missing required kit skill throws at battle build', () => {
    const gameManager = spellPathManager()
    const player = NGO_DAO_SHAPES.collapsed()
    gameManager.setActivePlayer(player)

    // No kit skills learned — assertNgoDaoKitLearned must fail loudly.
    expect(() => gameManager.startBattleWithPlayer(player, dummyEnemy())).toThrow()
  })

  it('spell_pathway resolves the committed element kit with The gains', () => {
    const gameManager = spellPathManager()
    const player = nguHanh()
    gameManager.setActivePlayer(player)
    expect(gameManager.progressionOps.selectSpellPathElement('fire', 'no', player)).toBe(true)

    gameManager.startBattleWithPlayer(player, dummyEnemy())

    const participant = gameManager.getTurnBattle()!.players[0]!
    expect(participant.basic?.id).toBe('hoa_cau_thuat')
    expect(participant.basic?.theGainOnLandedCast).toBe(5)
  })
})
