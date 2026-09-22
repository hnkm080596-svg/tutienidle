import { describe, expect, it } from 'vitest'
import { GameManager, INTRO_TOTAL_TICKS } from './GameManager'
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
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { makeTestRng } from '../buff2/testing/BuffTestFixtures'
import { SeededCombatRng } from '../battle/runtime/rng/SeededCombatRng'
import type { CombatRng } from '../battle/contracts/rng'
import type {
  BuffDefinitionId,
  CombatEntityId,
  CombatOperationId,
} from '../battle/contracts/ids'
import type { CombatEvent } from '../battle/contracts/events'
import type { ResolvedCombatOperation } from '../battle/contracts/operations'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import type { TurnBattle } from '../battle/turn/TurnBattleSystem'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

// Canonical-seals/reaction megaplan S4 (plan sec.11) -- the
// PRODUCTION-DATA re-proof matrix. The fixture-level reaction suite
// proves engine semantics; GameManager.ngoDaoReaction.test.ts proves
// the S3 activation wiring. THIS file re-proves the runtime invariants
// end-to-end through the live production composition: real ritual ->
// startBattle -> mintCycleScheduler (gate + CANONICAL_REACTIONS + the
// one dispatcher) -> trace journal. Every assertion reads production
// reaction data or the live scheduler trace -- no fixture doubles.

const LING_BAO_L3 = CAST_LEVELING_THRESHOLDS.linh_bao!.lv3

const TEST_COMPANION: CompanionDefinition = {
  id: 'test_companion_reproof',
  name: 'Reproof Companion',
  grade: 'hoang',
  growthRate: 0.05,
  unlockThresholds: {},
  baseStats: { maxHp: 1000, might: 10, speed: 100 },
  basic: {
    id: 'test_companion_reproof_basic',
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

function spawnDummy(maxHp = 1_000_000) {
  return defineEnemy({
    id: 'reproof_dummy',
    name: 'Reproof Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp,
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

function makeNgoDaoManager(withCompanion = false) {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_AN_NODES)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)
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
        instanceId: 'reproof_companion_instance',
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
  return { gameManager, player, combatSource }
}

/** Advance intro + countdown until the battle reaches 'fighting'. */
function fightingBattle(gameManager: GameManager, combatSource: ManualClockSource): TurnBattle {
  for (
    let i = 0;
    i < INTRO_TOTAL_TICKS + 600 && gameManager.getTurnBattle()?.state !== 'fighting';
    i++
  ) {
    combatSource.advance(COMBAT_STEP_SECONDS)
  }
  const battle = gameManager.getTurnBattle()!
  expect(battle.state).toBe('fighting')
  return battle
}

function system(gameManager: GameManager) {
  return gameManager.turnBattleOps.getTurnBattleSystem()
}

function trace(gameManager: GameManager) {
  return system(gameManager).combatScheduler!.trace
}

function committedEvents(gameManager: GameManager) {
  return trace(gameManager).events.filter(
    (e): e is Extract<CombatEvent, { type: 'elemental_application_committed' }> =>
      e.type === 'elemental_application_committed',
  )
}

function resolvedEvents(gameManager: GameManager) {
  return trace(gameManager).events.filter(
    (e): e is Extract<CombatEvent, { type: 'reaction_resolved' }> =>
      e.type === 'reaction_resolved',
  )
}

function buffInstances(gameManager: GameManager, entityId: CombatEntityId, definitionId: string) {
  return gameManager
    .getBattleBuffs(entityId)
    .filter((instance) => instance.definitionId === definitionId)
}

function buffIds(gameManager: GameManager, entityId: CombatEntityId): string[] {
  return gameManager.getBattleBuffs(entityId).map((instance) => instance.definitionId)
}

function applyBuffs(
  gameManager: GameManager,
  battle: TurnBattle,
  entries: readonly {
    definitionId: string
    sourceId: CombatEntityId
    targetId: CombatEntityId
    durationOverride?: number
  }[],
  // Post-entry applies must mint their own rootActionId namespace --
  // the default 'battle.entry.<turn>' scheme re-reserves operationIds
  // already used by an earlier grant inside the same turn.
  rootActionId?: string,
): void {
  system(gameManager).applyBuildBuffs(battle, entries, rootActionId)
}

/** Mint an authored apply_buff op through the REAL ops lane -- used to
    seed seal boards with 'suppressed' eligibility, which the public
    build-grant seam cannot express. */
function sealOp(
  definitionId: string,
  sourceId: CombatEntityId,
  targetId: CombatEntityId,
  eligibility: 'eligible' | 'suppressed',
  rootActionId: string,
  label: string,
): ResolvedCombatOperation {
  return {
    type: 'apply_buff',
    operationId: `buff.${rootActionId}.${label}` as CombatOperationId,
    payload: {
      definitionId: definitionId as BuffDefinitionId,
      targetId,
      stacks: 1,
      baseChance: 1,
      reactionEligibility: eligibility,
    },
    origin: {
      kind: 'skill',
      originId: 'reproof_seed',
      sourceId,
      rootActionId,
    },
  }
}

function enqueueOps(gameManager: GameManager, ops: ResolvedCombatOperation[]): void {
  const scheduler = system(gameManager).combatScheduler!
  scheduler.enqueueAuthored(ops)
  scheduler.runIfQuiescent()
}

describe('S4 -- all ten canonical relations resolve through production data', () => {
  const PAIRS: readonly {
    seals: readonly [string, string]
    reactionId: string
    relation: 'sinh' | 'khac'
    /** Sinh keeps the child on the board (stacks 1 + ceil(P/2)); khac
        consumes both. `payoff` = the status the reaction must land. */
    kept?: string
    payoff?: string
    payoffAbsent?: string
  }[] = [
    { seals: ['doc_can', 'hoa_an'], reactionId: 'duong_viem', relation: 'sinh', kept: 'hoa_an' },
    { seals: ['hoa_an', 'tran_an'], reactionId: 'luyen_tho', relation: 'sinh', kept: 'tran_an' },
    { seals: ['tran_an', 'liet_thuong'], reactionId: 'duong_kim', relation: 'sinh', kept: 'liet_thuong' },
    { seals: ['liet_thuong', 'han_tuc'], reactionId: 'tu_thuy', relation: 'sinh', kept: 'han_tuc' },
    { seals: ['han_tuc', 'doc_can'], reactionId: 'nhuan_moc', relation: 'sinh', kept: 'doc_can' },
    { seals: ['han_tuc', 'hoa_an'], reactionId: 'tuc_viem', relation: 'khac' },
    { seals: ['hoa_an', 'liet_thuong'], reactionId: 'dung_kim', relation: 'khac', payoff: 'defense_break' },
    { seals: ['liet_thuong', 'doc_can'], reactionId: 'doan_moc', relation: 'khac', payoff: 'reaction_bleed' },
    { seals: ['doc_can', 'tran_an'], reactionId: 'xuyen_tho', relation: 'khac', payoff: 'defense_erosion' },
    // A = 1 < the authored `when: attacker >= 3` gate -> cam_cong must
    // NOT land even though the reaction resolves.
    { seals: ['tran_an', 'han_tuc'], reactionId: 'tran_thuy', relation: 'khac', payoffAbsent: 'cam_cong' },
  ]

  for (const pair of PAIRS) {
    it(`${pair.reactionId} (${pair.relation}): ${pair.seals.join(' + ')}`, () => {
      const { gameManager, player } = makeNgoDaoManager()
      gameManager.startBattleWithPlayer(player, spawnDummy())
      const battle = gameManager.getTurnBattle()!
      const anId = battle.players[0]!.entity.id
      const enemyId = battle.enemies[0]!.entity.id

      applyBuffs(gameManager, battle, [
        { definitionId: pair.seals[0], sourceId: anId, targetId: enemyId },
        { definitionId: pair.seals[1], sourceId: anId, targetId: enemyId },
      ])

      const resolved = resolvedEvents(gameManager)
      expect(resolved).toHaveLength(1)
      expect(resolved[0]!.reactionId).toBe(pair.reactionId)
      expect(resolved[0]!.relation).toBe(pair.relation)
      expect(resolved[0]!.sourceId).toBe(anId)
      expect(resolved[0]!.targetId).toBe(enemyId)

      // Causality: the resolved event hangs off the SECOND seal's
      // committed event (the first commit found no pair).
      const commits = committedEvents(gameManager)
      const secondCommit = commits.filter((e) => e.definitionId === pair.seals[1])[0]
      expect(resolved[0]!.causationEventId).toBe(secondCommit!.eventId)
      expect(resolved[0]!.rootActionId).toBe(secondCommit!.origin.rootActionId)

      const ids = buffIds(gameManager, enemyId)
      if (pair.relation === 'sinh') {
        // Parent fully consumed; child kept + ceil(P/2) converted stacks.
        expect(resolved[0]!.consumed).toEqual([{ buffId: pair.seals[0], stacks: 1 }])
        expect(ids).toContain(pair.kept!)
        expect(ids).not.toContain(pair.seals[0])
        expect(buffInstances(gameManager, enemyId, pair.kept!)[0]!.stacks).toBe(2)
      } else {
        expect(new Set(resolved[0]!.consumed.map((c) => c.buffId))).toEqual(
          new Set([pair.seals[0], pair.seals[1]]),
        )
        expect(ids).not.toContain(pair.seals[0])
        expect(ids).not.toContain(pair.seals[1])
      }
      if (pair.payoff !== undefined) {
        expect(ids).toContain(pair.payoff)
      }
      if (pair.payoffAbsent !== undefined) {
        expect(ids).not.toContain(pair.payoffAbsent)
      }
    })
  }

  it('duong_kim binds the additive elemental_penetration modifier to the kept child instance', () => {
    const { gameManager, player } = makeNgoDaoManager()
    gameManager.startBattleWithPlayer(player, spawnDummy())
    const battle = gameManager.getTurnBattle()!
    const anId = battle.players[0]!.entity.id
    const enemyId = battle.enemies[0]!.entity.id

    applyBuffs(gameManager, battle, [
      { definitionId: 'tran_an', sourceId: anId, targetId: enemyId },
      { definitionId: 'liet_thuong', sourceId: anId, targetId: enemyId },
    ])

    const child = buffInstances(gameManager, enemyId, 'liet_thuong')[0]!
    const penetration = child.modifiers.find((m) => m.id === 'duong_kim')
    expect(penetration).toBeDefined()
    expect(penetration!.channel).toBe('elemental_penetration')
    expect(penetration!.operation).toBe('add')
    // 4 * P = 4 additive penetration points at one parent stack.
    expect(penetration!.value).toBe(4)
  })
})

describe('S4 -- application trigger boundaries', () => {
  it('a capped reapply commits nothing and triggers nothing; the later pair consumes the full stack', () => {
    const { gameManager, player } = makeNgoDaoManager()
    gameManager.startBattleWithPlayer(player, spawnDummy())
    const battle = gameManager.getTurnBattle()!
    const anId = battle.players[0]!.entity.id
    const enemyId = battle.enemies[0]!.entity.id

    // Five applies in one root -- five eligible commits (stacks 1..5).
    applyBuffs(
      gameManager,
      battle,
      Array.from({ length: 5 }, () => ({
        definitionId: 'doc_can',
        sourceId: anId,
        targetId: enemyId,
      })),
    )
    expect(
      committedEvents(gameManager).filter((e) => e.definitionId === 'doc_can'),
    ).toHaveLength(5)

    // The sixth apply is a no-change refresh at maxStacks:
    // addedStacks === 0 -> NO committed event (the event exists only
    // when addedStacks > 0), so nothing can ever trigger off it.
    applyBuffs(
      gameManager,
      battle,
      [{ definitionId: 'doc_can', sourceId: anId, targetId: enemyId }],
      'reproof.cap.refresh',
    )
    expect(
      committedEvents(gameManager).filter((e) => e.definitionId === 'doc_can'),
    ).toHaveLength(5)
    expect(resolvedEvents(gameManager)).toHaveLength(0)

    // Completing the pair consumes ALL FIVE parent stacks -- the
    // resolved event's pre-consume snapshot proves whole-stack consume.
    applyBuffs(
      gameManager,
      battle,
      [{ definitionId: 'hoa_an', sourceId: anId, targetId: enemyId }],
      'reproof.cap.pair',
    )
    const resolved = resolvedEvents(gameManager)
    expect(resolved).toHaveLength(1)
    expect(resolved[0]!.reactionId).toBe('duong_viem')
    expect(resolved[0]!.consumed).toEqual([{ buffId: 'doc_can', stacks: 5 }])
    // Child kept at 1 + ceil(5/2) = 4 stacks.
    expect(buffInstances(gameManager, enemyId, 'hoa_an')[0]!.stacks).toBe(4)
  })

  it('periodic holder_turn_end ticks emit periodic events but never reaction events', () => {
    const { gameManager, player, combatSource } = makeNgoDaoManager()
    gameManager.startBattleWithPlayer(player, spawnDummy())
    const battle = fightingBattle(gameManager, combatSource)
    const anId = battle.players[0]!.entity.id
    const enemy = battle.enemies[0]!
    const enemyId = enemy.entity.id

    applyBuffs(gameManager, battle, [
      { definitionId: 'hoa_an', sourceId: anId, targetId: enemyId },
      { definitionId: 'hoa_an', sourceId: anId, targetId: enemyId },
    ])
    const committedBefore = committedEvents(gameManager).length
    const hpBefore = enemy.entity.currentHp

    // The enemy's own turn end ticks its held hoa_an.dot.
    system(gameManager).resolveActorTurn(battle, enemy)

    const periodicRequests = trace(gameManager).events.filter(
      (e) => e.type === 'periodic_requests_committed',
    )
    const periodicSettled = trace(gameManager).events.filter(
      (e) => e.type === 'periodic_operation_settled',
    )
    expect(periodicRequests.length).toBeGreaterThan(0)
    expect(periodicSettled.length).toBeGreaterThan(0)
    expect(enemy.entity.currentHp).toBeLessThan(hpBefore)

    // Periodic settlement produced zero new commits and zero reactions.
    expect(committedEvents(gameManager)).toHaveLength(committedBefore)
    expect(resolvedEvents(gameManager)).toHaveLength(0)
    expect(buffInstances(gameManager, enemyId, 'hoa_an')[0]!.stacks).toBe(2)
  })

  it('reaction payoff applications are non-recursive (suppressed lane, zero extra commits)', () => {
    const { gameManager, player } = makeNgoDaoManager()
    gameManager.startBattleWithPlayer(player, spawnDummy())
    const battle = gameManager.getTurnBattle()!
    const anId = battle.players[0]!.entity.id
    const enemyId = battle.enemies[0]!.entity.id

    applyBuffs(gameManager, battle, [
      { definitionId: 'hoa_an', sourceId: anId, targetId: enemyId },
      { definitionId: 'liet_thuong', sourceId: anId, targetId: enemyId },
    ])

    // dung_kim: damage + suppressed apply of defense_break. Exactly two
    // commits (the seals); the payoff apply emits no third.
    const commits = committedEvents(gameManager)
    expect(commits).toHaveLength(2)
    expect(commits.every((e) => e.reactionEligibility === 'eligible')).toBe(true)
    expect(resolvedEvents(gameManager)).toHaveLength(1)
    expect(buffIds(gameManager, enemyId)).toContain('defense_break')

    // The payoff apply_buff op ran with suppressed eligibility through
    // the reaction origin -- structural non-recursion.
    const payoffOp = trace(gameManager).records.find(
      (r) =>
        r.operation.type === 'apply_buff' &&
        r.operation.origin.kind === 'reaction',
    )!
    expect(payoffOp.operation.type === 'apply_buff' && payoffOp.operation.payload.reactionEligibility).toBe(
      'suppressed',
    )
    expect(payoffOp.result.status).toBe('resolved')
  })

  it('one application resolving multiple candidate pairs picks the authored selectionTiePriority', () => {
    const { gameManager, player } = makeNgoDaoManager()
    gameManager.startBattleWithPlayer(player, spawnDummy())
    const battle = gameManager.getTurnBattle()!
    const anId = battle.players[0]!.entity.id
    const enemyId = battle.enemies[0]!.entity.id

    // Seed {liet_thuong, tran_an} with SUPPRESSED eligibility -- both
    // join the elemental board silently (any eligible second seal would
    // already have fired; two distinct seals always pair).
    const root = `reproof.tie.${battle.totalTurnsElapsed}`
    enqueueOps(gameManager, [
      sealOp('liet_thuong', anId, enemyId, 'suppressed', root, 'seed.0'),
      sealOp('tran_an', anId, enemyId, 'suppressed', root, 'seed.1'),
    ])
    expect(resolvedEvents(gameManager)).toHaveLength(0)

    // The eligible doc_can commit completes TWO pairs on this board:
    // doan_moc (metal khac wood, priority 80) and xuyen_tho (wood khac
    // earth, priority 90). Authored order wins: doan_moc only.
    applyBuffs(gameManager, battle, [
      { definitionId: 'doc_can', sourceId: anId, targetId: enemyId },
    ])

    const resolved = resolvedEvents(gameManager)
    expect(resolved).toHaveLength(1)
    expect(resolved[0]!.reactionId).toBe('doan_moc')
    expect(new Set(resolved[0]!.consumed.map((c) => c.buffId))).toEqual(
      new Set(['liet_thuong', 'doc_can']),
    )

    const ids = buffIds(gameManager, enemyId)
    expect(ids).toContain('tran_an') // the losing candidate's defender survives
    expect(ids).toContain('reaction_bleed')
    expect(ids).not.toContain('defense_erosion')
  })
})

describe('S4 -- repeat/multicast executions settle sequentially', () => {
  /** Between committed[i] and committed[i+1] every event caused by
      committed[i] (its resolved) must already be in the journal --
      one application's settlement completes before the next subcast
      applies. */
  function assertSequentialSettlement(gameManager: GameManager): void {
    const events = trace(gameManager).events
    const commits = events
      .map((e, index) => ({ e, index }))
      .filter(
        (entry): entry is {
          e: Extract<CombatEvent, { type: 'elemental_application_committed' }>
          index: number
        } => entry.e.type === 'elemental_application_committed',
      )
    const resolved = events
      .map((e, index) => ({ e, index }))
      .filter(
        (entry): entry is {
          e: Extract<CombatEvent, { type: 'reaction_resolved' }>
          index: number
        } => entry.e.type === 'reaction_resolved',
      )
    for (let i = 0; i < commits.length; i++) {
      const nextCommitIndex = commits[i + 1]?.index ?? Number.MAX_SAFE_INTEGER
      for (const r of resolved) {
        if (r.e.causationEventId === commits[i]!.e.eventId) {
          expect(r.index).toBeLessThan(nextCommitIndex)
        }
      }
    }
  }

  function drainQueuedExecutions(gameManager: GameManager, battle: TurnBattle): void {
    for (let guard = 0; guard < 16 && (battle.queuedExecutions?.length ?? 0) > 0; guard++) {
      system(gameManager).resolveNextStep(battle)
    }
    expect(battle.queuedExecutions?.length ?? 0).toBe(0)
  }

  it('da_phap_lien_tuyen repeat executions: each seal application settles before the next', () => {
    const rng = makeTestRng() // default 0: composite pick = pool[0] (wood), all rolls land
    const { gameManager, player, combatSource } = makeNgoDaoManager()
    gameManager.turnBattleOps.setBattleRngFactory(() => rng)
    gameManager.startBattleWithPlayer(player, spawnDummy())
    const battle = fightingBattle(gameManager, combatSource)
    const an = battle.players[0]!
    const anId = an.entity.id
    const enemyId = battle.enemies[0]!.entity.id

    // Pre-seed the earth seal: every doc_chuong pick then completes
    // xuyen_tho exactly once.
    applyBuffs(gameManager, battle, [
      { definitionId: 'tran_an', sourceId: anId, targetId: enemyId },
    ])

    // The special: 1 original + repeatCasts(2) queued executions.
    system(gameManager).resolveActorTurn(battle, an, 'special')
    drainQueuedExecutions(gameManager, battle)

    const commits = committedEvents(gameManager)
    // tran_an seed + 3 executions x doc_can (pool[0] = wood at roll 0).
    expect(commits).toHaveLength(4)
    expect(commits.filter((e) => e.definitionId === 'doc_can')).toHaveLength(3)

    const resolved = resolvedEvents(gameManager)
    expect(resolved).toHaveLength(1)
    expect(resolved[0]!.reactionId).toBe('xuyen_tho')

    assertSequentialSettlement(gameManager)

    // Trace provenance: cast-applied commits carry castId/subcastIndex;
    // reaction ops carry origin.kind 'reaction' + reactionId +
    // causationEventId.
    const castCommits = commits.filter((e) => e.definitionId === 'doc_can')
    for (const c of castCommits) {
      expect(c.origin.castId).toBeTruthy()
      expect(c.origin.subcastIndex).toBeDefined()
    }
    const reactionOps = trace(gameManager).records.filter(
      (r) => r.operation.origin.kind === 'reaction',
    )
    expect(reactionOps.length).toBeGreaterThan(0)
    for (const r of reactionOps) {
      expect(r.operation.origin.reactionId).toBe('xuyen_tho')
      expect(r.operation.origin.causationEventId).toBe(resolved[0]!.causationEventId)
    }
    // Batch ordering: consume ops first, then authored payoff steps in
    // authored order (damage -> apply_status -> deferred modifier...
    // xuyen_tho authors damage -> apply_status -> heal_from_damage).
    const types = reactionOps.map((r) => r.operation.type)
    expect(types).toEqual([
      'consume_buff_stacks',
      'consume_buff_stacks',
      'deal_damage',
      'apply_buff',
      'heal',
    ])
  })

  it('ngo_dao_hon_don multicast chain: each chained execution settles before the next', () => {
    const rng = makeTestRng() // 0 < 0.25 -> every multicast roll chains to the cap
    const { gameManager, player, combatSource } = makeNgoDaoManager()
    gameManager.turnBattleOps.setBattleRngFactory(() => rng)
    gameManager.startBattleWithPlayer(player, spawnDummy())
    const battle = fightingBattle(gameManager, combatSource)
    const an = battle.players[0]!
    const anId = an.entity.id
    const enemyId = battle.enemies[0]!.entity.id

    applyBuffs(gameManager, battle, [
      { definitionId: 'tran_an', sourceId: anId, targetId: enemyId },
    ])

    system(gameManager).resolveActorTurn(battle, an, 'basic')
    drainQueuedExecutions(gameManager, battle)

    // 1 original + multicast chain to min(maxExtraCasts, MAX_MULTICAST)
    // = 3 extra executions -> 4 doc_can commits + 1 tran_an seed.
    const commits = committedEvents(gameManager)
    expect(commits.filter((e) => e.definitionId === 'doc_can')).toHaveLength(4)
    const resolved = resolvedEvents(gameManager)
    expect(resolved).toHaveLength(1)
    expect(resolved[0]!.reactionId).toBe('xuyen_tho')

    assertSequentialSettlement(gameManager)
  })
})

describe('S4 -- death during reaction settlement', () => {
  it('a reaction killing the target safely partial-settles the remaining payoff ops', () => {
    const { gameManager, player } = makeNgoDaoManager()
    gameManager.startBattleWithPlayer(player, spawnDummy(1))
    const battle = gameManager.getTurnBattle()!
    const anId = battle.players[0]!.entity.id
    const enemy = battle.enemies[0]!
    const enemyId = enemy.entity.id

    // doan_moc's authored damage resolves through the attacker's
    // metal channel: elementalBasePower x 0.15*(A+D) mitigated by the
    // target's metalResistance. A lethal blow on a 1-hp target only
    // needs positive power: pre-stack BOTH seals to 5 with suppressed
    // applies (they join the elemental board without triggering), pin
    // metalPower so the resolved amount is source-driven, then let
    // one eligible liet_thuong commit fire at A=5, D=5.
    const an = battle.players[0]!
    an.entity.stats.metalPower = 100
    enqueueOps(gameManager, [
      ...Array.from({ length: 5 }, (_, i) =>
        sealOp('doc_can', anId, enemyId, 'suppressed', 'reproof.death.seed', `doc.${i}`),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        sealOp('liet_thuong', anId, enemyId, 'suppressed', 'reproof.death.seed', `kim.${i}`),
      ),
    ])
    applyBuffs(
      gameManager,
      battle,
      [{ definitionId: 'liet_thuong', sourceId: anId, targetId: enemyId }],
      'reproof.death.trigger',
    )

    // doan_moc's reaction damage killed the 1-hp target.
    expect(enemy.entity.alive).toBe(false)
    expect(resolvedEvents(gameManager)).toHaveLength(1)
    expect(resolvedEvents(gameManager)[0]!.reactionId).toBe('doan_moc')

    // Both seals consumed; the bleed never landed (dead target); the
    // deferred modifier skipped on the unresolved dependency.
    const ids = buffIds(gameManager, enemyId)
    expect(ids).not.toContain('liet_thuong')
    expect(ids).not.toContain('doc_can')
    expect(ids).not.toContain('reaction_bleed')

    const skipped = trace(gameManager).skippedResults
    expect(skipped).toContainEqual(
      expect.objectContaining({
        type: 'apply_buff',
        status: 'skipped',
        reason: 'invalid_target_state',
      }),
    )
    expect(skipped).toContainEqual(
      expect.objectContaining({
        type: 'add_buff_modifier',
        status: 'skipped',
        reason: 'dependency_not_resolved',
      }),
    )
    // No structural fault, no thrown error -- safe partial settlement.
    expect(trace(gameManager).faults).toHaveLength(0)
  })
})

describe('S4 -- resisted production payoff', () => {
  it('a resisted payoff apply leaves board consume intact, records buff_application_failed, and skips the deferred modifier', () => {
    const rng = makeTestRng()
    const { gameManager, player } = makeNgoDaoManager()
    gameManager.turnBattleOps.setBattleRngFactory(() => rng)
    gameManager.startBattleWithPlayer(player, spawnDummy())
    const battle = gameManager.getTurnBattle()!
    const anId = battle.players[0]!.entity.id
    const enemy = battle.enemies[0]!
    const enemyId = enemy.entity.id

    // Phase A (resist 0): doan_moc lands bleed 1+floor(2/2)=2 stacks +
    // the doan_moc potency modifier bound to the exact new instance.
    applyBuffs(gameManager, battle, [
      { definitionId: 'liet_thuong', sourceId: anId, targetId: enemyId },
      { definitionId: 'liet_thuong', sourceId: anId, targetId: enemyId },
      { definitionId: 'doc_can', sourceId: anId, targetId: enemyId },
    ])
    const bleed = buffInstances(gameManager, enemyId, 'reaction_bleed')[0]!
    expect(bleed.stacks).toBe(2)
    expect(bleed.modifiers.map((m) => m.id)).toContain('doan_moc')

    // Phase B: cap-level ailment resistance (0.75 -> chance 0.25).
    // Queue: two seal applies land (0 < 0.25), the payoff roll fails.
    enemy.entity.stats.ailmentResistPercent = 0.75
    rng.queue(0, 0, 0.999)
    applyBuffs(
      gameManager,
      battle,
      [
        { definitionId: 'liet_thuong', sourceId: anId, targetId: enemyId },
        { definitionId: 'doc_can', sourceId: anId, targetId: enemyId },
      ],
      'reproof.resisted.reapply',
    )

    // The second doan_moc still resolved: damage dealt, board consumed,
    // but the payoff application was resisted -- and the stale-instance
    // trap is closed: the deferred modifier skipped, the LIVE bleed is
    // byte-identical (stacks, remaining, modifier count).
    const resolved = resolvedEvents(gameManager)
    expect(resolved).toHaveLength(2)
    expect(resolved[1]!.reactionId).toBe('doan_moc')

    const failures = trace(gameManager).events.filter(
      (e): e is Extract<CombatEvent, { type: 'buff_application_failed' }> =>
        e.type === 'buff_application_failed',
    )
    expect(failures.map((e) => e.definitionId)).toContain('reaction_bleed')
    expect(trace(gameManager).skippedResults).toContainEqual(
      expect.objectContaining({
        type: 'add_buff_modifier',
        status: 'skipped',
        reason: 'application_roll_failed',
      }),
    )

    const after = buffInstances(gameManager, enemyId, 'reaction_bleed')[0]!
    expect(after.instanceId).toBe(bleed.instanceId)
    expect(after.stacks).toBe(2)
    expect(after.modifiers).toHaveLength(1)
    const ids = buffIds(gameManager, enemyId)
    expect(ids).not.toContain('liet_thuong')
    expect(ids).not.toContain('doc_can')
  })
})

describe('S4 -- khac reaction damage resolves through the elemental channel', () => {
  /** doan_moc through production data; returns the settled hpDamage of
      the reaction's deal_damage op. Attacker element = metal
      (liet_thuong), authored coefficient 0.15*(A+D). */
  function driveDoanMoc(metalResistance: number, fireResistance: number): number {
    const { gameManager, player } = makeNgoDaoManager()
    gameManager.startBattleWithPlayer(player, spawnDummy())
    const battle = gameManager.getTurnBattle()!
    const an = battle.players[0]!
    const enemy = battle.enemies[0]!
    const enemyId = enemy.entity.id

    // Pin the channel: power = might 0 + metalPower 100 = 100;
    // coefficient 0.15*(1+1) = 0.3 -> pre-mitigation 30.
    an.entity.stats.might = 0
    an.entity.stats.metalPower = 100
    enemy.entity.stats.metalResistance = metalResistance
    enemy.entity.stats.fireResistance = fireResistance

    applyBuffs(gameManager, battle, [
      { definitionId: 'liet_thuong', sourceId: an.entity.id, targetId: enemyId },
      { definitionId: 'doc_can', sourceId: an.entity.id, targetId: enemyId },
    ])

    const op = trace(gameManager).records.find(
      (r) => r.operation.type === 'deal_damage' && r.operation.origin.kind === 'reaction',
    )!
    expect(op.result.status).toBe('resolved')
    const damage = op.result.type === 'deal_damage' ? op.result.damage : undefined
    return damage!.hpDamage
  }

  it('the target matching-resistance channel mitigates the reaction burst (0 vs 40 -> different damage)', () => {
    // net 0 -> 30; net 40 -> mitigation 0.4 -> 18. The old flat model
    // would have dealt 0.3 to both.
    expect(driveDoanMoc(0, 0)).toBe(30)
    expect(driveDoanMoc(40, 0)).toBe(18)
  })

  it('the ATTACKER element selects which resistance channel the target contributes (metal vs fire)', () => {
    // Walled fire does nothing for a metal-attacker burst -- the op
    // reads metalResistance only.
    expect(driveDoanMoc(0, 80)).toBe(30)
    expect(driveDoanMoc(40, 80)).toBe(18)
  })
})

describe('S4 -- cam_cong production duration translation', () => {
  const HEAL_SKILL: TurnSkillDefinition = {
    id: 'reproof_heal',
    cooldownTurns: 0,
    targeting: { shape: 'single' },
    targetScope: 'self',
    actionTags: ['heal'],
  }

  /** Drive a REAL tran_thuy through production data: seed the pair
      with suppressed applies so the completing eligible commit fires
      at the authored A/D counts -- A = 4 (3 seeded + 1 eligible
      tran_an) >= the authored `when: attacker >= 3` gate; D =
      `defenderStacks` han_tuc. The reaction's own apply_status mints
      cam_cong -- no manual buff authoring. */
  function driveTranThuy(
    gameManager: GameManager,
    battle: TurnBattle,
    anId: CombatEntityId,
    enemyId: CombatEntityId,
    defenderStacks: number,
  ): void {
    enqueueOps(gameManager, [
      ...Array.from({ length: 3 }, (_, i) =>
        sealOp('tran_an', anId, enemyId, 'suppressed', 'reproof.camcong.seed', `att.${i}`),
      ),
      ...Array.from({ length: defenderStacks }, (_, i) =>
        sealOp('han_tuc', anId, enemyId, 'suppressed', 'reproof.camcong.seed', `def.${i}`),
      ),
    ])
    applyBuffs(
      gameManager,
      battle,
      [{ definitionId: 'tran_an', sourceId: anId, targetId: enemyId }],
      'reproof.camcong.trigger',
    )
  }

  it('tran_thuy at defender D<=3 mints cam_cong on engine clock 2 -- the next enemy attack is blocked exactly once', () => {
    const { gameManager, player } = makeNgoDaoManager()
    gameManager.startBattleWithPlayer(player, spawnDummy())
    const battle = gameManager.getTurnBattle()!
    const anId = battle.players[0]!.entity.id
    const enemy = battle.enemies[0]!
    const enemyId = enemy.entity.id

    driveTranThuy(gameManager, battle, anId, enemyId, 3)

    const resolved = resolvedEvents(gameManager)
    expect(resolved).toHaveLength(1)
    expect(resolved[0]!.reactionId).toBe('tran_thuy')
    // The holder's own declare runs holder_turn_end BEFORE selection:
    // authored N blocked turns translate to engine clock N+1 = 2.
    const camCong = buffInstances(gameManager, enemyId, 'cam_cong')[0]!
    expect(camCong.remaining).toBe(2)

    // Declare 1 (2 -> 1 survives): the attack basic is forbidden, so
    // the forced declare falls back onto the heal-tagged special --
    // attack blocked AND utility stays legal in one shot.
    enemy.special = { skill: HEAL_SKILL, remainingCooldownTurns: 0 }
    const suppressed = system(gameManager).declareActorAction(battle, enemy, 'basic')
    expect(suppressed.skillId).toBe('reproof_heal')
    expect(suppressed.ccBlocked).toBe(false)

    // Declare 2 (1 -> 0 expires): the attack basic is selectable again
    // -- exactly one enemy attack was suppressed.
    const released = system(gameManager).declareActorAction(battle, enemy, 'basic')
    expect(released.skillId).toBe('generic_physical')
    expect(buffIds(gameManager, enemyId)).not.toContain('cam_cong')
  })

  it('tran_thuy at defender D>=4 mints cam_cong on engine clock 3 -- the next two enemy attacks are blocked', () => {
    const { gameManager, player } = makeNgoDaoManager()
    gameManager.startBattleWithPlayer(player, spawnDummy())
    const battle = gameManager.getTurnBattle()!
    const anId = battle.players[0]!.entity.id
    const enemy = battle.enemies[0]!
    const enemyId = enemy.entity.id

    driveTranThuy(gameManager, battle, anId, enemyId, 4)

    const resolved = resolvedEvents(gameManager)
    expect(resolved).toHaveLength(1)
    expect(resolved[0]!.reactionId).toBe('tran_thuy')
    const camCong = buffInstances(gameManager, enemyId, 'cam_cong')[0]!
    expect(camCong.remaining).toBe(3)

    // Declare 1 (3 -> 2 survives): attack forbidden, no fallback
    // available -> empty declare (restriction, not hard control).
    const first = system(gameManager).declareActorAction(battle, enemy, 'basic')
    expect(first.action).toBeNull()
    expect(first.ccBlocked).toBe(false)

    // Declare 2 (2 -> 1 survives): still active -- the attack is
    // forbidden again, and the heal fallback stays legal.
    enemy.special = { skill: HEAL_SKILL, remainingCooldownTurns: 0 }
    const second = system(gameManager).declareActorAction(battle, enemy, 'basic')
    expect(second.skillId).toBe('reproof_heal')

    // Declare 3 (1 -> 0 expires): the attack basic is selectable --
    // exactly two enemy attacks were suppressed.
    const third = system(gameManager).declareActorAction(battle, enemy, 'basic')
    expect(third.skillId).toBe('generic_physical')
    expect(buffIds(gameManager, enemyId)).not.toContain('cam_cong')
  })
})

describe('S4 -- deterministic replay', () => {
  /** One scripted battle: seal pair + forced special + queue drain.
      Returns the reaction-relevant projection for cross-run compare. */
  function driveSeededBattle(seed: number) {
    const seeded = new SeededCombatRng(seed)
    let rolls = 0
    const counting: CombatRng = {
      roll() {
        rolls += 1
        return seeded.roll()
      },
      rollChance(chance: number) {
        rolls += 1
        return seeded.rollChance(chance)
      },
    }
    const { gameManager, player, combatSource } = makeNgoDaoManager()
    gameManager.turnBattleOps.setBattleRngFactory(() => counting)
    gameManager.startBattleWithPlayer(player, spawnDummy())
    const battle = fightingBattle(gameManager, combatSource)
    const an = battle.players[0]!
    const anId = an.entity.id
    const enemyId = battle.enemies[0]!.entity.id

    applyBuffs(gameManager, battle, [
      { definitionId: 'doc_can', sourceId: anId, targetId: enemyId },
      { definitionId: 'tran_an', sourceId: anId, targetId: enemyId },
    ])
    system(gameManager).resolveActorTurn(battle, an, 'special')
    for (let guard = 0; guard < 16 && (battle.queuedExecutions?.length ?? 0) > 0; guard++) {
      system(gameManager).resolveNextStep(battle)
    }

    return {
      rolls,
      commits: committedEvents(gameManager).map((e) => ({
        definitionId: e.definitionId,
        element: e.element,
        stacksAfter: e.stacksAfter,
        addedStacks: e.addedStacks,
      })),
      resolved: resolvedEvents(gameManager).map((e) => ({
        reactionId: e.reactionId,
        relation: e.relation,
        consumed: e.consumed.map((c) => ({ buffId: c.buffId, stacks: c.stacks })),
      })),
      buffs: buffIds(gameManager, enemyId).sort(),
    }
  }

  it('the same seed produces identical production reaction outcomes', () => {
    const a = driveSeededBattle(11)
    const b = driveSeededBattle(11)
    expect(a).toEqual(b)
  })

  it('different seeds consume the same stream shape while varying outcomes', () => {
    const a = driveSeededBattle(11)
    const b = driveSeededBattle(23)
    // Stream parity: identical command sequence consumes the same
    // number of rolls regardless of seed.
    expect(b.rolls).toBe(a.rolls)
    // The streams themselves differ -- the composite picks ride the
    // session rng, so the applied seal ids diverge for these seeds.
    expect(b.commits.map((c) => c.definitionId)).not.toEqual(
      a.commits.map((c) => c.definitionId),
    )
  })
})

describe('S4 -- capability isolation', () => {
  it('an ordinary visible spell battle: seals commit but the gate suppresses every reaction', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 12
    gameManager.setActivePlayer(player)
    // The REAL spell_pathway ritual: grants the element kit (the strict
    // authored-basic gate requires it) and leaves no aura -- the
    // visible path never carries van_phap_than_hoa.
    expect(
      gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player),
    ).toBe(true)
    gameManager.startBattleWithPlayer(player, spawnDummy())

    const battle = gameManager.getTurnBattle()!
    const playerId = battle.players[0]!.entity.id
    const enemyId = battle.enemies[0]!.entity.id

    applyBuffs(gameManager, battle, [
      { definitionId: 'doc_can', sourceId: playerId, targetId: enemyId },
      { definitionId: 'tran_an', sourceId: playerId, targetId: enemyId },
    ])

    // The eligible applications still committed (emission is
    // eligibility-driven); the live-grant gate suppressed every batch.
    expect(committedEvents(gameManager)).toHaveLength(2)
    expect(resolvedEvents(gameManager)).toHaveLength(0)
    const ids = buffIds(gameManager, enemyId)
    expect(ids).toContain('doc_can')
    expect(ids).toContain('tran_an')
    expect(ids).not.toContain('defense_erosion')
  })
})

describe('S4 -- detonate all-source consume', () => {
  it('detonate consumes every source\'s DoT board and re-seeds suppressed -- a live pair can coexist untriggered', () => {
    const { gameManager, player, combatSource } = makeNgoDaoManager(true)
    gameManager.startBattleWithPlayer(player, spawnDummy())
    const battle = fightingBattle(gameManager, combatSource)
    const an = battle.players[0]!
    const anId = an.entity.id
    const companionId = battle.players[1]!.entity.id
    const enemy = battle.enemies[0]!
    const enemyId = enemy.entity.id

    // Two source-isolated boards on one target.
    applyBuffs(gameManager, battle, [
      { definitionId: 'doc_can', sourceId: companionId, targetId: enemyId },
      { definitionId: 'hoa_an', sourceId: anId, targetId: enemyId },
    ])

    // Empowered detonate payload on the ult slot.
    const DETONATE_ROOT: TurnSkillDefinition = {
      id: 'reproof_detonate_root',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      empowerment: {
        theThreshold: 100,
        empowered: {
          id: 'reproof_detonate_payload',
          cooldownTurns: 0,
          consumesAllThe: true,
          detonateDoT: { amp: 1.5 },
          damage: { kind: 'physical', multiplier: 0 },
          targeting: { shape: 'single' },
          appliesAilments: [{ buffDefinitionId: 'hoa_an', chance: 1 }],
        },
      },
    }
    an.ultimate = { skill: DETONATE_ROOT, remainingCooldownTurns: 0 }
    an.entity.currentThe = 100
    const hpBefore = enemy.entity.currentHp

    system(gameManager).resolveActorTurn(battle, an, 'ultimate')

    // All-source consume: the companion's doc_can AND the an's hoa_an
    // boards both paid out (hp dropped below the hit + burst total).
    expect(enemy.entity.currentHp).toBeLessThan(hpBefore)

    // The re-seeded instances sit on the SAME board (an-source) -- a
    // live duong_viem pair -- but re-seed is 'suppressed': no commit,
    // zero reactions anywhere in the trace.
    expect(resolvedEvents(gameManager)).toHaveLength(0)
    const reseededDoc = buffInstances(gameManager, enemyId, 'doc_can')
    const reseededHoa = buffInstances(gameManager, enemyId, 'hoa_an')
    expect(reseededDoc).toHaveLength(1)
    expect(reseededHoa).toHaveLength(1)
    expect(reseededDoc[0]!.stacks).toBe(1)
    expect(reseededDoc[0]!.sourceId).toBe(anId)
    expect(reseededHoa[0]!.sourceId).toBe(anId)
  })
})

describe('S4 -- persistence boundary', () => {
  it('battle seals never enter the persistent buff pool the save serializes', () => {
    const { gameManager, player } = makeNgoDaoManager()
    gameManager.startBattleWithPlayer(player, spawnDummy())
    const battle = gameManager.getTurnBattle()!
    const anId = battle.players[0]!.entity.id
    const enemyId = battle.enemies[0]!.entity.id

    applyBuffs(gameManager, battle, [
      { definitionId: 'doc_can', sourceId: anId, targetId: enemyId },
      { definitionId: 'tran_an', sourceId: anId, targetId: enemyId },
    ])
    expect(resolvedEvents(gameManager)).toHaveLength(1)

    // The persistent lane is the save-visible buff authority; battle
    // runtime instances never cross into it.
    for (const entityId of [anId, enemyId]) {
      expect(gameManager.persistentBuffs.query.getForTarget(entityId)).toHaveLength(0)
    }
  })
})
