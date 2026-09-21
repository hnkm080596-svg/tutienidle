import { describe, expect, it } from 'vitest'
import { MAX_THE } from '../combat/CombatTypes'
import { GameManager } from '../game/GameManager'
import { createDefaultPlayer, resolvePlayerFinalStats, type PlayerData } from '../player/Player'
import {
  collectActiveWayStatModifiers,
  hasPathCapability,
  PHAP_TU_ATTUNEMENT_MAX_MP_PER_POINT,
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
  isPhapTuNgoDao,
  isPhapTuNguHanh,
  PHAP_TU_AN_BASIC_ID,
  PHAP_TU_AN_PASSIVE_ID,
  PHAP_TU_AN_SPECIAL_ID,
} from './PhapTuPath'
import { getRouteStatModifiers, resolveMaxThe } from './PhapTuRoutes'

// Cultivation Path Framework (M4+M7, spec 2026-09-16, audit R6) — way
// identity drives ALL way-specific behavior. Every ngu_hanh-only
// mechanism (element/route/The machinery) must gate on the WAY, never
// the bare 'phap_tu' path id, so the ngo_dao way cannot reach them.
// Post-M7 there is exactly one persisted shape: ('phap_tu','ngo_dao').

function nguHanh(overrides: Partial<PlayerData> = {}): PlayerData {
  const player = createDefaultPlayer()
  player.cultivationPath = 'phap_tu'
  player.cultivationWay = 'ngu_hanh'
  return Object.assign(player, overrides)
}

/** The single persisted shape: base path id + the way. */
function ngoDao(overrides: Partial<PlayerData> = {}): PlayerData {
  const player = createDefaultPlayer()
  player.cultivationPath = 'phap_tu'
  player.cultivationWay = 'ngo_dao'
  return Object.assign(player, overrides)
}

const NGO_DAO_SHAPES = { collapsed: ngoDao } as const

/** Dirty ngo_dao state — an element/route pair that could only leak in
 * through corruption (ngo_dao owns no phapTu commitment). */
function dirtyNgoDao(make: (overrides?: Partial<PlayerData>) => PlayerData): PlayerData {
  return make({ phapTu: { element: 'fire', route: 'dot' } })
}

function phapTuManager() {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
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
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

describe('way predicates — isPhapTuNguHanh / isPhapTuNgoDao', () => {
  it('isPhapTuNguHanh requires the phap_tu path AND the ngu_hanh way together', () => {
    expect(isPhapTuNguHanh(nguHanh())).toBe(true)
    expect(isPhapTuNguHanh(ngoDao())).toBe(false)
    expect(isPhapTuNguHanh(ngoDao())).toBe(false)
    expect(isPhapTuNguHanh(createDefaultPlayer())).toBe(false)
    expect(isPhapTuNguHanh(null)).toBe(false)

    // Legacy-shaped (path only, no way) fails closed — the authority
    // writes both fields inside the ritual transaction.
    const legacy = createDefaultPlayer()
    legacy.cultivationPath = 'phap_tu'
    expect(isPhapTuNguHanh(legacy)).toBe(false)
  })

  it('isPhapTuNgoDao requires the strict (phap_tu, ngo_dao) pair', () => {
    expect(isPhapTuNgoDao(ngoDao())).toBe(true)
    expect(isPhapTuNgoDao(nguHanh())).toBe(false)
    expect(isPhapTuNgoDao(createDefaultPlayer())).toBe(false)

    // Way-less and foreign-way pairs fail closed.
    const wayless = ngoDao()
    delete wayless.cultivationWay
    expect(isPhapTuNgoDao(wayless)).toBe(false)
    expect(isPhapTuNgoDao(ngoDao({ cultivationWay: 'ung_the' }))).toBe(false)
  })
})

describe('selectPhapTuElement — ngu_hanh way gate', () => {
  it('commits element+route atomically for ngu_hanh; rejects BOTH ngo_dao shapes with zero mutation', () => {
    const gameManager = phapTuManager()

    const ngu = nguHanh()
    expect(gameManager.progressionOps.selectPhapTuElement('fire', 'dot', ngu)).toBe(true)
    expect(ngu.phapTu).toEqual({ element: 'fire', route: 'dot' })
    expect(ngu.nodeLevels['hoa_linh_ngo']).toBe(1)

    // The collapsed shape is the real R6 leak: a bare 'phap_tu' path
    // check would let a ngo_dao player commit an element.
    for (const ngo of [ngoDao(), ngoDao()]) {
      expect(gameManager.progressionOps.selectPhapTuElement('fire', 'dot', ngo)).toBe(false)
      expect(ngo.phapTu).toEqual({ element: null, route: null })
      expect(ngo.nodeLevels['hoa_linh_ngo']).toBeUndefined()
    }
  })

  it('getPhapTuElement surfaces the committed element for ngu_hanh only', () => {
    const gameManager = phapTuManager()

    const ngu = nguHanh({ phapTu: { element: 'water', route: 'no' } })
    gameManager.setActivePlayer(ngu)
    expect(gameManager.progressionOps.getPhapTuElement()).toBe('water')

    // Leaked element state on the hidden way must not surface.
    for (const ngo of [dirtyNgoDao(ngoDao), dirtyNgoDao(ngoDao)]) {
      gameManager.setActivePlayer(ngo)
      expect(gameManager.progressionOps.getPhapTuElement()).toBeUndefined()
    }
  })
})

describe('switchRoute / previewRouteSwitch — ngu_hanh way gate', () => {
  const registry = {
    nodes: [
      { id: 'dot_spec_1', name: 'dot_spec_1', type: 'minor', insightCost: 2, routeTag: 'dot', effect: {} } as ProgressionNode,
      { id: 'no_spec_1', name: 'no_spec_1', type: 'minor', insightCost: 2, routeTag: 'no', effect: {} } as ProgressionNode,
    ],
    getAll() {
      return this.nodes
    },
  }

  it('domain: ngu_hanh switches and refunds; ngo_dao (both shapes) is rejected without mutation', () => {
    const ngu = nguHanh({ phapTu: { element: 'fire', route: 'dot' }, skillInsight: 100 })
    purchaseNode(ngu, registry.nodes[0]!)

    const refund = switchRoute(ngu, registry, 'no')
    expect(refund).toBeGreaterThan(0)
    expect(ngu.phapTu.route).toBe('no')

    for (const make of Object.values(NGO_DAO_SHAPES)) {
      const ngo = dirtyNgoDao(make)
      ngo.nodeLevels = { dot_spec_1: 1 }
      const insightBefore = ngo.skillInsight

      expect(switchRoute(ngo, registry, 'no')).toBe(0)
      expect(ngo.phapTu.route).toBe('dot')
      expect(ngo.nodeLevels['dot_spec_1']).toBe(1)
      expect(ngo.skillInsight).toBe(insightBefore)
      expect(previewRouteSwitch(ngo, registry)).toEqual({ refund: 0, forfeited: 0, resetNodeCount: 0 })
    }
  })

  it('ops: progressionOps.switchRoute rejects ngo_dao even with committed-looking phapTu state', () => {
    const gameManager = phapTuManager()

    const ngu = nguHanh()
    gameManager.setActivePlayer(ngu)
    expect(gameManager.progressionOps.selectPhapTuElement('fire', 'dot', ngu)).toBe(true)
    expect(gameManager.progressionOps.switchRoute('no', ngu)).toBe(true)
    expect(ngu.phapTu.route).toBe('no')

    for (const make of Object.values(NGO_DAO_SHAPES)) {
      const ngo = dirtyNgoDao(make)
      gameManager.setActivePlayer(ngo)
      expect(gameManager.progressionOps.switchRoute('no', ngo)).toBe(false)
      expect(ngo.phapTu).toEqual({ element: 'fire', route: 'dot' })
    }
  })
})

describe('route stats + The cap — ngu_hanh way gate', () => {
  it('getRouteStatModifiers emits for ngu_hanh only — dirty ngo_dao state cannot inject universal stats', () => {
    const ngu = nguHanh({ phapTu: { element: 'fire', route: 'dot' } })
    expect(getRouteStatModifiers(ngu)).toHaveLength(2)

    for (const ngo of [dirtyNgoDao(ngoDao), dirtyNgoDao(ngoDao)]) {
      expect(getRouteStatModifiers(ngo)).toEqual([])
    }
  })

  it('resolveMaxThe counts truong_the for ngu_hanh only — ngo_dao owns no The pool', () => {
    const registry = { getAll: () => PHAP_TU_NODES }
    const committed = { element: 'fire' as const, route: 'no' as const }

    const ngu = nguHanh({ phapTu: committed, nodeLevels: { truong_the_fire: 2 } })
    expect(resolveMaxThe(registry, ngu)).toBe(MAX_THE + 2 * TRUONG_THE_CAP_PER_LEVEL)

    for (const make of Object.values(NGO_DAO_SHAPES)) {
      const ngo = make({ phapTu: committed, nodeLevels: { truong_the_fire: 2 } })
      expect(resolveMaxThe(registry, ngo)).toBe(MAX_THE)
    }
  })
})

describe('the bar bridge — ngu_hanh way gate', () => {
  function fightingBattle(): TurnBattle {
    return {
      state: 'fighting',
      players: [{ entity: { currentThe: 40, maxThe: MAX_THE } }],
      enemies: [],
    } as unknown as TurnBattle
  }

  function barPlayer(overrides: Record<string, unknown> = {}): TheBarPlayerState {
    return {
      cultivationPath: 'phap_tu',
      cultivationWay: 'ngu_hanh',
      phapTu: { element: 'fire', route: 'dot' },
      nodeLevels: {},
      ...overrides,
    } as TheBarPlayerState
  }

  it('ngu_hanh + committed element + fighting -> snapshot; ngo_dao (both shapes) -> null', () => {
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
      { cultivationPath: 'phap_tu', cultivationWay: 'ngo_dao' },
      { cultivationPath: 'the_tu', cultivationWay: 'ung_the' },
    ]) {
      barState = barPlayer(shape)
      const reader = makeTheBarReader(gameManager, () => barState)
      expect(reader(), JSON.stringify(shape)).toBeNull()
    }
  })
})

describe('PHAP_TU_NODES — requiredWay ngu_hanh export stamp', () => {
  it('every node carries requiredCultivationPath phap_tu + requiredWay ngu_hanh', () => {
    for (const node of PHAP_TU_NODES) {
      expect(node.requiredCultivationPath, node.id).toBe('phap_tu')
      expect(node.requiredWay, node.id).toBe('ngu_hanh')
    }
  })

  it('ngo_dao cannot purchase element nodes; ngu_hanh can; mortal cannot', () => {
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

    const ngu = nguHanh({ phapTu: { element: 'fire', route: 'dot' }, nodeLevels: { [statNode.id]: 2 } })
    expect(aggregateNodeStatModifiers(registry, ngu).length).toBeGreaterThan(0)

    for (const make of Object.values(NGO_DAO_SHAPES)) {
      const ngo = make({ phapTu: { element: 'fire', route: 'dot' }, nodeLevels: { [statNode.id]: 2 } })
      expect(aggregateNodeStatModifiers(registry, ngo), `${ngo.cultivationPath}/${ngo.cultivationWay}`).toEqual([])
    }
  })
})

describe('way stat facet — shared phap_tu domain emission', () => {
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
      expect(modifier.domain).toBe('phap_tu')
    }

    expect(collectActiveWayStatModifiers(ngoDao(), totals)).toEqual(nguMods)
    expect(collectActiveWayStatModifiers(ngoDao(), totals)).toEqual(nguMods)
  })

  it('resolvePlayerFinalStats yields identical MP for ngu_hanh and ngo_dao', () => {
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

  it('way-less phap_tu player (path only, no way) emits NOTHING — M7 fail-closed', () => {
    const wayLess = createDefaultPlayer()
    wayLess.cultivationPath = 'phap_tu'
    wayLess.baseStats.attunement = 10

    // M7: the LEGACY_PATH_TO_WAY lenient fallback is gone — the attunement
    // facet cannot resolve a way, so no phap_tu emission occurs.
    expect(resolvePlayerFinalStats(wayLess, []).maxMp).toBe(0)
  })

  it('non-phap players emit nothing through the facet channel', () => {
    const mortal = createDefaultPlayer()
    mortal.baseStats.attunement = 10

    const kiem = createDefaultPlayer()
    kiem.cultivationPath = 'kiem_tu'
    kiem.cultivationWay = 'hien'
    kiem.baseStats.attunement = 10

    expect(collectActiveWayStatModifiers(mortal, { strength: 0, dexterity: 0, vitality: 0, intelligence: 0, attunement: 10 })).toEqual([])
    expect(collectActiveWayStatModifiers(kiem, { strength: 0, dexterity: 0, vitality: 0, intelligence: 0, attunement: 10 })).toEqual([])
    expect(resolvePlayerFinalStats(mortal, []).maxMp).toBe(0)
    expect(resolvePlayerFinalStats(kiem, []).maxMp).toBe(0)
  })
})

describe('battle build — the way drives the kit branch', () => {
  function learnAnKit(gameManager: GameManager) {
    for (const skillId of [PHAP_TU_AN_BASIC_ID, PHAP_TU_AN_SPECIAL_ID, PHAP_TU_AN_PASSIVE_ID]) {
      expect(gameManager.progressionOps.learnSkill(skillId)).toBe(true)
    }
  }

  it('ngo_dao resolves the An kit basic/special even with leaked element state', () => {
    const gameManager = phapTuManager()
    const player = NGO_DAO_SHAPES.collapsed({ phapTu: { element: 'fire', route: 'no' } })
    gameManager.setActivePlayer(player)
    learnAnKit(gameManager)

    gameManager.startBattleWithPlayer(player, dummyEnemy())

    const participant = gameManager.getTurnBattle()!.players[0]!
    expect(participant.basic?.id).toBe(PHAP_TU_AN_BASIC_ID)
    expect(participant.basic?.compositePicks?.pool).toHaveLength(5)
    expect(participant.special?.skill.id).toBe(PHAP_TU_AN_SPECIAL_ID)
    // The An kit carries no The loop — no theGain fields on the basic.
    expect(participant.basic?.theGainOnLandedCast).toBeUndefined()
    expect(participant.basic?.theGainOnCrit).toBeUndefined()
  })

  it('a missing required kit skill throws at battle build', () => {
    const gameManager = phapTuManager()
    const player = NGO_DAO_SHAPES.collapsed()
    gameManager.setActivePlayer(player)

    // No kit skills learned — assertNgoDaoKitLearned must fail loudly.
    expect(() => gameManager.startBattleWithPlayer(player, dummyEnemy())).toThrow()
  })

  it('ngu_hanh resolves the committed element kit with The gains', () => {
    const gameManager = phapTuManager()
    const player = nguHanh()
    gameManager.setActivePlayer(player)
    expect(gameManager.progressionOps.selectPhapTuElement('fire', 'no', player)).toBe(true)

    gameManager.startBattleWithPlayer(player, dummyEnemy())

    const participant = gameManager.getTurnBattle()!.players[0]!
    expect(participant.basic?.id).toBe('hoa_cau_thuat')
    expect(participant.basic?.theGainOnLandedCast).toBe(5)
  })
})
