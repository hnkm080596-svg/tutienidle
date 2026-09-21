import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { PHAP_TU_AN_NODES } from '../../data/progression/PhapTuAnNodes'
import { CAST_LEVELING_THRESHOLDS } from '../skill/SkillSystem'
import { defineEnemy } from '../enemy/Enemy'
import {
  COMPANIONS,
  type CompanionDefinition,
  type CompanionInstance,
} from '../../data/companion/Companions'
import {
  REACTION_STATUS_BUFFS,
  VAN_PHAP_THAN_HOA_ID,
} from '../../data/buff/ReactionStatusBuffs'
import type { CombatEntityId } from '../battle/contracts/ids'
import type { ReactionVfxResolvedEvent } from '../battle/BattleEvents'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { createDefaultCapabilityValidators } from '../battle/runtime/capability/DefaultCapabilityValidators'
import { makeBuffSystemWorld, TEST_ENTITIES } from '../buff2/testing/BuffTestFixtures'
import type { ApplyBuffRequest } from '../battle/contracts/operations'

// Canonical-seals/reaction megaplan S3 (plan sec.9.4-9.6) -- the
// production ACTIVATION proof. mintCycleScheduler now composes the
// live-grant gate + CANONICAL_REACTIONS registry + one dispatcher;
// applyEntryBuffs grants van_phap_than_hoa party-wide through the Ngo
// Dao gate only. These tests drive the REAL production path
// (ritual -> startBattle -> runtime) -- the fixture-level reaction
// suite covers engine semantics; this file covers the wiring.

const LING_BAO_L3 = CAST_LEVELING_THRESHOLDS.linh_bao!.lv3

const TEST_COMPANION: CompanionDefinition = {
  id: 'test_companion_aura',
  name: 'Aura Test Companion',
  grade: 'hoang',
  growthRate: 0.05,
  unlockThresholds: {},
  baseStats: { maxHp: 1000, might: 10, speed: 100 },
  basic: {
    id: 'test_companion_aura_basic',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
  },
  constellationPerks: [],
}

function pushCompanionDefinition(): void {
  if (!COMPANIONS.some((candidate) => candidate.id === TEST_COMPANION.id)) {
    ;(COMPANIONS as unknown as CompanionDefinition[]).push(TEST_COMPANION)
  }
}

function popCompanionDefinition(): void {
  const index = COMPANIONS.findIndex((candidate) => candidate.id === TEST_COMPANION.id)
  if (index >= 0) {
    ;(COMPANIONS as unknown as CompanionDefinition[]).splice(index, 1)
  }
}

function spawnDummy() {
  return defineEnemy({
    id: 'ngo_dao_reaction_dummy',
    name: 'Reaction Dummy',
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

/** Ritual-granted Ngo Dao player; the real grant chain teaches
    van_phap_tuy_tam/da_phap_lien_tuyen + ngo_dao_hon_don. */
function makeNgoDaoManager(withCompanion = false) {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_AN_NODES)
  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12
  gameManager.setActivePlayer(player)
  player.skillCastCounts = { linh_bao: LING_BAO_L3 }
  expect(
    gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'hidden_spell_pathway', player),
  ).toBe(true)

  if (withCompanion) {
    pushCompanionDefinition()
    player.companions = [
      {
        instanceId: 'aura_test_instance',
        definitionId: TEST_COMPANION.id,
        realmId: 'mortal',
        realmLevel: 1,
        exp: 0,
        constellationRank: 0,
      } satisfies CompanionInstance,
    ]
    player.formationLoadout = {
      formationId: 'test_formation',
      assignments: [
        { row: 0, column: 0, combatantId: 'player' },
        { row: 1, column: 1, combatantId: TEST_COMPANION.id },
      ],
    }
  }
  return { gameManager, player }
}

function auraInstances(gameManager: GameManager, entityId: CombatEntityId) {
  return gameManager
    .getBattleBuffs(entityId)
    .filter((instance) => instance.definitionId === VAN_PHAP_THAN_HOA_ID)
}

function buffIds(gameManager: GameManager, entityId: CombatEntityId): string[] {
  return gameManager
    .getBattleBuffs(entityId)
    .map((instance) => instance.definitionId)
}

describe('S3 -- van_phap_than_hoa entry grant', () => {
  it('grants the aura to the An and every living allied participant at entry -- never enemies', () => {
    const { gameManager, player } = makeNgoDaoManager(true)
    gameManager.startBattleWithPlayer(player, spawnDummy())

    const battle = gameManager.getTurnBattle()!
    const an = battle.players[0]!
    const companion = battle.players[1]!
    const enemy = battle.enemies[0]!

    // The An's own instance -- per_source, sourced by the An entity.
    const anAura = auraInstances(gameManager, an.entity.id)
    expect(anAura).toHaveLength(1)
    expect(anAura[0]!.sourceId).toBe(an.entity.id)
    expect(anAura[0]!.stacks).toBe(1)

    // The companion's instance -- same source, different holder.
    const companionAura = auraInstances(gameManager, companion.entity.id)
    expect(companionAura).toHaveLength(1)
    expect(companionAura[0]!.sourceId).toBe(an.entity.id)
    expect(companionAura[0]!.targetId).toBe(companion.entity.id)

    expect(auraInstances(gameManager, enemy.entity.id)).toHaveLength(0)
  })

  it('a non-Ngo-Dao player enters with no aura anywhere', () => {
    const { gameManager, player } = makeNgoDaoManager(true)
    // Undo the ritual choice -- same party shape, no way.
    player.cultivationPath = undefined
    player.cultivationWay = undefined
    gameManager.startBattleWithPlayer(player, spawnDummy())

    const battle = gameManager.getTurnBattle()!
    for (const participant of [...battle.players, ...battle.enemies]) {
      expect(auraInstances(gameManager, participant.entity.id)).toHaveLength(0)
    }
  })
})

describe('S3 -- live-grant reaction switch', () => {
  it('an eligible seal application reacts: doc_can + tran_an fires xuyen_tho (proc origin -- origin-agnostic gate)', () => {
    const { gameManager, player } = makeNgoDaoManager()
    gameManager.startBattleWithPlayer(player, spawnDummy())

    const anId = gameManager.getTurnBattle()!.players[0]!.entity.id

    // applyBuffToPlayer mints origin kind 'proc' with
    // reactionEligibility 'eligible' -- the gate is origin-agnostic by
    // contract (sec.9.3): eligibility + capability, never the origin.
    gameManager.turnBattleOps.applyBuffToPlayer('doc_can')
    gameManager.turnBattleOps.applyBuffToPlayer('tran_an')

    const ids = buffIds(gameManager, anId)
    // Xuyen Tho (wood overcomes earth) consumed both boards and landed
    // its payoff status -- stacks = attacker (wood) stacks = 1.
    expect(ids).toContain('defense_erosion')
    expect(ids).not.toContain('doc_can')
    expect(ids).not.toContain('tran_an')
  })

  it('without the aura the same eligible applications produce no reaction payoff', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 12
    gameManager.setActivePlayer(player)
    gameManager.startBattleWithPlayer(player, spawnDummy())

    const anId = gameManager.getTurnBattle()!.players[0]!.entity.id
    gameManager.turnBattleOps.applyBuffToPlayer('doc_can')
    gameManager.turnBattleOps.applyBuffToPlayer('tran_an')

    const ids = buffIds(gameManager, anId)
    expect(ids).toContain('doc_can')
    expect(ids).toContain('tran_an')
    expect(ids).not.toContain('defense_erosion')
  })

  it('a companion holding the aura reacts from its own seal applications', () => {
    const { gameManager, player } = makeNgoDaoManager(true)
    gameManager.startBattleWithPlayer(player, spawnDummy())

    const battle = gameManager.getTurnBattle()!
    const companionId = battle.players[1]!.entity.id
    const enemyId = battle.enemies[0]!.entity.id

    gameManager.turnBattleOps.getTurnBattleSystem().applyBuildBuffs(battle, [
      { definitionId: 'doc_can', sourceId: companionId, targetId: enemyId },
      { definitionId: 'tran_an', sourceId: companionId, targetId: enemyId },
    ])

    expect(buffIds(gameManager, enemyId)).toContain('defense_erosion')
  })

  it('reaction boards are source+target isolated: mixed-source seals never combine', () => {
    const { gameManager, player } = makeNgoDaoManager(true)
    gameManager.startBattleWithPlayer(player, spawnDummy())

    const battle = gameManager.getTurnBattle()!
    const anId = battle.players[0]!.entity.id
    const companionId = battle.players[1]!.entity.id
    const enemyId = battle.enemies[0]!.entity.id

    // Wood from the companion + earth from the An on one target: two
    // DIFFERENT boards (source differs) -- no reaction.
    gameManager.turnBattleOps.getTurnBattleSystem().applyBuildBuffs(battle, [
      { definitionId: 'doc_can', sourceId: companionId, targetId: enemyId },
      { definitionId: 'tran_an', sourceId: anId, targetId: enemyId },
    ])
    expect(buffIds(gameManager, enemyId)).not.toContain('defense_erosion')

    // Completing the companion's own board fires Xuyen Tho; the An's
    // earth board is untouched.
    gameManager.turnBattleOps.getTurnBattleSystem().applyBuildBuffs(battle, [
      { definitionId: 'tran_an', sourceId: companionId, targetId: enemyId },
    ])
    const ids = buffIds(gameManager, enemyId)
    expect(ids).toContain('defense_erosion')
    expect(ids).toContain('tran_an') // the An's board -- never consumed
  })
})

describe('S3 -- aura lifecycle (death / revival / re-grant)', () => {
  /** Drives the spec sec.40-41 death boundary: sweepBuffDeaths runs at
      every quiescent point emitAndSettle creates. */
  function sweepDeaths(gameManager: GameManager): void {
    const battle = gameManager.getTurnBattle()!
    const companionId =
      battle.players[1]?.entity.id ?? battle.players[0]!.entity.id
    const enemyId = battle.enemies[0]!.entity.id
    gameManager.turnBattleOps.getTurnBattleSystem().applyBuildBuffs(battle, [
      { definitionId: 'hoa_an', sourceId: companionId, targetId: enemyId },
    ])
  }

  it('hidden mage death removes only its own held aura -- surviving allies keep theirs', () => {
    const { gameManager, player } = makeNgoDaoManager(true)
    gameManager.startBattleWithPlayer(player, spawnDummy())

    const battle = gameManager.getTurnBattle()!
    const anId = battle.players[0]!.entity.id
    const companionId = battle.players[1]!.entity.id

    battle.players[0]!.entity.alive = false
    sweepDeaths(gameManager)

    // Holder death removed the An's own instance unconditionally...
    expect(auraInstances(gameManager, anId)).toHaveLength(0)
    // ...but removeOnSourceDeath:false keeps the companion's
    // source-bound instance alive.
    const companionAura = auraInstances(gameManager, companionId)
    expect(companionAura).toHaveLength(1)
    expect(companionAura[0]!.sourceId).toBe(anId)
  })

  it('ally death removes the ally\'s own aura while the An\'s stays', () => {
    const { gameManager, player } = makeNgoDaoManager(true)
    gameManager.startBattleWithPlayer(player, spawnDummy())

    const battle = gameManager.getTurnBattle()!
    const anId = battle.players[0]!.entity.id
    const companionId = battle.players[1]!.entity.id

    battle.players[1]!.entity.alive = false
    sweepDeaths(gameManager)

    expect(auraInstances(gameManager, companionId)).toHaveLength(0)
    expect(auraInstances(gameManager, anId)).toHaveLength(1)
  })

  it('a revived ally does NOT regain the aura -- the re-grant seam only fires for the source', () => {
    const { gameManager, player } = makeNgoDaoManager(true)
    gameManager.startBattleWithPlayer(player, spawnDummy())

    const battle = gameManager.getTurnBattle()!
    const companionId = battle.players[1]!.entity.id

    battle.players[1]!.entity.alive = false
    sweepDeaths(gameManager)
    expect(auraInstances(gameManager, companionId)).toHaveLength(0)

    battle.players[1]!.entity.alive = true
    gameManager.turnBattleOps.regrantAuraOnSourceRevived(companionId)

    expect(auraInstances(gameManager, companionId)).toHaveLength(0)
  })

  it('An revival re-grants aura only to missing holders -- surviving holders keep their single instance', () => {
    const { gameManager, player } = makeNgoDaoManager(true)
    gameManager.startBattleWithPlayer(player, spawnDummy())

    const battle = gameManager.getTurnBattle()!
    const anId = battle.players[0]!.entity.id
    const companionId = battle.players[1]!.entity.id

    battle.players[0]!.entity.alive = false
    sweepDeaths(gameManager)
    const survivorInstanceId = auraInstances(gameManager, companionId)[0]!.instanceId

    battle.players[0]!.entity.alive = true
    gameManager.turnBattleOps.regrantAuraOnSourceRevived(anId)

    // The An re-gained its own held instance.
    const anAura = auraInstances(gameManager, anId)
    expect(anAura).toHaveLength(1)
    expect(anAura[0]!.sourceId).toBe(anId)

    // The companion's pre-existing instance is UNTOUCHED -- event-
    // idempotent re-grant, no duplicate instance, no replace.
    const companionAura = auraInstances(gameManager, companionId)
    expect(companionAura).toHaveLength(1)
    expect(companionAura[0]!.instanceId).toBe(survivorInstanceId)
  })

  it('the re-grant seam re-checks the Ngo Dao gate -- no grant when the way no longer holds', () => {
    const { gameManager, player } = makeNgoDaoManager()
    gameManager.startBattleWithPlayer(player, spawnDummy())

    const battle = gameManager.getTurnBattle()!
    const anId = battle.players[0]!.entity.id

    // Corrupt-state probe: the way no longer reads ngo_dao at re-grant
    // time -> the seam must refuse, not resurrect a stale capability.
    player.cultivationWay = 'spell_pathway'
    battle.players[0]!.entity.alive = true
    gameManager.turnBattleOps.regrantAuraOnSourceRevived(anId)

    expect(auraInstances(gameManager, anId)).toHaveLength(1) // entry instance, unchanged
    // Remove the entry instance and re-run: nothing re-granted.
    battle.players[0]!.entity.alive = false
    const battleRef = gameManager.getTurnBattle()!
    gameManager.turnBattleOps.getTurnBattleSystem().applyBuildBuffs(battleRef, [
      {
        definitionId: 'hoa_an',
        sourceId: anId,
        targetId: battle.enemies[0]!.entity.id,
      },
    ])
    battle.players[0]!.entity.alive = true
    gameManager.turnBattleOps.regrantAuraOnSourceRevived(anId)
    expect(auraInstances(gameManager, anId)).toHaveLength(0)
  })
})

describe('S3 -- aura cleanse immunity (production def, real cleanse engine)', () => {
  it('van_phap_than_hoa survives cleanse -- dispellable:false lands in skipped', () => {
    const w = makeBuffSystemWorld({
      capabilityValidators: createDefaultCapabilityValidators(),
    })
    w.registry.register(
      // The PRODUCTION def -- not a fixture double.
      REACTION_STATUS_BUFFS.find(
        (definition) => definition.id === VAN_PHAP_THAN_HOA_ID,
      )!,
    )
    const req: ApplyBuffRequest = {
      definitionId: VAN_PHAP_THAN_HOA_ID,
      sourceId: TEST_ENTITIES.sourceA,
      targetId: TEST_ENTITIES.targetA,
      stacks: 1,
      baseChance: 1,
      reactionEligibility: 'eligible',
      origin: {
        kind: 'skill',
        originId: 't',
        sourceId: TEST_ENTITIES.sourceA,
        rootActionId: 'r.1',
      },
    }
    w.system.apply(req, w.makeCtx())

    const result = w.system.cleanse(
      TEST_ENTITIES.targetA,
      {},
      undefined,
      w.makeCtx(),
    )
    expect(result.cleansed).toHaveLength(0)
    expect(result.skipped).toHaveLength(1)
    expect(w.store.forTarget(TEST_ENTITIES.targetA)).toHaveLength(1)
  })
})

describe('S5.3 -- reaction presentation drain', () => {
  it('reaction_resolved reaches the eventBus exactly once, at the post-step boundary', () => {
    const { gameManager, player } = makeNgoDaoManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)

    const resolved: ReactionVfxResolvedEvent[] = []
    gameManager.eventBus.on<ReactionVfxResolvedEvent>('reaction_resolved', (e) =>
      resolved.push(e),
    )

    gameManager.startBattleWithPlayer(player, spawnDummy())
    for (
      let i = 0;
      i < 600 && gameManager.getTurnBattle()?.state !== 'fighting';
      i++
    ) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }
    const battle = gameManager.getTurnBattle()!
    expect(battle.state).toBe('fighting')
    const anId = battle.players[0]!.entity.id
    const enemyId = battle.enemies[0]!.entity.id

    gameManager.turnBattleOps.getTurnBattleSystem().applyBuildBuffs(battle, [
      { definitionId: 'doc_can', sourceId: anId, targetId: enemyId },
      { definitionId: 'tran_an', sourceId: anId, targetId: enemyId },
    ])

    // The journal already holds reaction_resolved but the bus sees
    // nothing until a step drains the new entries.
    expect(resolved).toHaveLength(0)

    combatSource.advance(COMBAT_STEP_SECONDS)

    expect(resolved).toHaveLength(1)
    expect(resolved[0]).toMatchObject({
      reactionId: 'xuyen_tho',
      relation: 'khac',
      sourceId: anId,
      targetId: enemyId,
    })

    // The cursor advanced: further steps never re-emit the same entry.
    combatSource.advance(COMBAT_STEP_SECONDS)
    expect(resolved).toHaveLength(1)
  })
})
