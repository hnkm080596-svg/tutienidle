import { describe, expect, it } from 'vitest'
import { MAX_THE } from '../combat/CombatTypes'
import { GameManager } from '../game/GameManager'
import { createDefaultPlayer, resolvePlayerFinalStats, type PlayerData } from '../player/Player'
import { collectActiveWayStatModifiers } from '../player/CultivationPathSystem'
import {
  aggregateNodeStatModifiers,
  canPurchaseNode,
  purchaseNode,
} from '../progression/NodeSystem'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { defineEnemy } from '../enemy/Enemy'
import {
  isHiddenSpellPathway,
  isSpellPathway,
  resolveMaxThe,
  SPELL_PATH_MAX_THE,
  HIDDEN_SPELL_BASIC_ID,
  HIDDEN_SPELL_PASSIVE_ID,
  HIDDEN_SPELL_SPECIAL_ID,
} from './PhapTuPath'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

// Cultivation Path Framework (M4+M7, spec 2026-09-16, audit R6) -- way
// identity drives ALL way-specific behavior. Every spell_pathway-only
// mechanism (element/The machinery) must gate on the WAY, never
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

/** Dirty ngo_dao state -- an element commit that could only leak in
 * through corruption (ngo_dao owns no spellPath commitment). */
function dirtyNgoDao(make: (overrides?: Partial<PlayerData>) => PlayerData): PlayerData {
  return make({ spellPath: { element: 'fire' } })
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

    // Legacy-shaped (path only, no way) fails closed -- the authority
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
  it('commits the element for spell_pathway; rejects the ngo_dao shape with zero mutation', () => {
    const gameManager = spellPathManager()

    const ngu = nguHanh()
    expect(gameManager.progressionOps.selectSpellPathElement('fire', ngu)).toBe(true)
    expect(ngu.spellPath).toEqual({ element: 'fire' })
    expect(ngu.nodeLevels['hoa_linh_ngo']).toBe(1)

    // The collapsed shape is the real R6 leak: a bare 'spell' path
    // check would let a ngo_dao player commit an element.
    for (const ngo of [ngoDao(), ngoDao()]) {
      expect(gameManager.progressionOps.selectSpellPathElement('fire', ngo)).toBe(false)
      expect(ngo.spellPath).toEqual({ element: null })
      expect(ngo.nodeLevels['hoa_linh_ngo']).toBeUndefined()
    }
  })

  it('getSpellPathElement surfaces the committed element for spell_pathway only', () => {
    const gameManager = spellPathManager()

    const ngu = nguHanh({ spellPath: { element: 'water' } })
    gameManager.setActivePlayer(ngu)
    expect(gameManager.progressionOps.getSpellPathElement()).toBe('water')

    // Leaked element state on the hidden way must not surface.
    for (const ngo of [dirtyNgoDao(ngoDao), dirtyNgoDao(ngoDao)]) {
      gameManager.setActivePlayer(ngo)
      expect(gameManager.progressionOps.getSpellPathElement()).toBeUndefined()
    }
  })
})

describe('The cap — spell_pathway way gate', () => {
  it('resolveMaxThe is a flat 5 for spell_pathway, MAX_THE elsewhere — ngo_dao owns no The pool', () => {
    const committed = { element: 'fire' as const }

    expect(resolveMaxThe(nguHanh({ spellPath: committed }))).toBe(SPELL_PATH_MAX_THE)
    expect(SPELL_PATH_MAX_THE).toBe(5)

    for (const make of Object.values(NGO_DAO_SHAPES)) {
      expect(resolveMaxThe(make({ spellPath: committed }))).toBe(MAX_THE)
    }

    expect(resolveMaxThe(createDefaultPlayer())).toBe(MAX_THE)
  })
})

// The bar-bridge leg moved out of this file: the presentation bridge
// owns its own test (src/presentation/bridges/theBarBridge.test.ts) and
// this surface does not depend on the bridge module.

describe('PHAP_TU_NODES — requiredWay spell_pathway export stamp', () => {
  it('every node carries requiredCultivationPath spell + requiredWay spell_pathway', () => {
    for (const node of PHAP_TU_NODES) {
      expect(node.requiredCultivationPath, node.id).toBe('spell')

      // Three-path design (2026-09-25, sec.4-b): realm-reward grant
      // nodes are exempt from the way requirement (they are grant-only,
      // never purchasable) — the data slice owns their exact fields.
      if (!node.rewardOnly) {
        expect(node.requiredWay, node.id).toBe('spell_pathway')
      }
    }
  })

  it('ngo_dao cannot purchase element nodes; spell_pathway can; mortal cannot', () => {
    const root = PHAP_TU_NODES.find((node) => node.id === 'hoa_linh_ngo')!
    const growth = PHAP_TU_NODES.find((node) => node.id === 'fire_ailment_mastery')!

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
      expect(ngo.nodeLevels['fire_ailment_mastery']).toBeUndefined()
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
        node.elementTag === 'fire',
    )!
    const registry = { getAll: () => PHAP_TU_NODES }

    const ngu = nguHanh({ spellPath: { element: 'fire' }, nodeLevels: { [statNode.id]: 2 } })
    expect(aggregateNodeStatModifiers(registry, ngu).length).toBeGreaterThan(0)

    for (const make of Object.values(NGO_DAO_SHAPES)) {
      const ngo = make({ spellPath: { element: 'fire' }, nodeLevels: { [statNode.id]: 2 } })
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

    // M7: the LEGACY_PATH_TO_WAY lenient fallback is gone -- the attunement
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
    const player = NGO_DAO_SHAPES.collapsed({ spellPath: { element: 'fire' } })
    gameManager.setActivePlayer(player)
    learnAnKit(gameManager, player)

    gameManager.startBattleWithPlayer(player, dummyEnemy())

    const participant = gameManager.getTurnBattle()!.players[0]!
    expect(participant.basic?.id).toBe(HIDDEN_SPELL_BASIC_ID)
    expect(participant.basic?.compositePicks?.pool).toHaveLength(5)
    expect(participant.special?.skill.id).toBe(HIDDEN_SPELL_SPECIAL_ID)
    // The An kit carries no The loop -- no theGain/empowerment fields
    // on the basic (F11: the hidden way never gains The).
    expect(participant.basic?.theGainOnLandedCast).toBeUndefined()
    expect(participant.basic?.empowerment).toBeUndefined()
  })

  it('a missing required kit skill throws at battle build', () => {
    const gameManager = spellPathManager()
    const player = NGO_DAO_SHAPES.collapsed()
    gameManager.setActivePlayer(player)

    // No kit skills learned -- assertNgoDaoKitLearned must fail loudly.
    expect(() => gameManager.startBattleWithPlayer(player, dummyEnemy())).toThrow()
  })

  it('spell_pathway resolves the committed element kit with The gains', () => {
    const gameManager = spellPathManager()
    const player = nguHanh()
    gameManager.setActivePlayer(player)
    expect(gameManager.progressionOps.selectSpellPathElement('fire', player)).toBe(true)

    gameManager.startBattleWithPlayer(player, dummyEnemy())

    const participant = gameManager.getTurnBattle()!.players[0]!
    expect(participant.basic?.id).toBe('hoa_cau_thuat')
    // Phap Tu Reimagined: +1 The on landed cast; the Phap The element
    // rider rides the empowerment channel at the flat cap of 5.
    expect(participant.basic?.theGainOnLandedCast).toBe(1)
    expect(participant.basic?.empowerment?.theThreshold).toBe(SPELL_PATH_MAX_THE)
    expect(participant.entity.maxThe).toBe(SPELL_PATH_MAX_THE)
  })
})
