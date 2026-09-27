import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { PHAP_TU_AN_NODES } from '../../data/progression/PhapTuAnNodes'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'
import { CAST_LEVELING_THRESHOLDS } from '../skill/SkillSystem'
import { defineEnemy } from '../enemy/Enemy'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import type { CombatExecutionRecord } from '../battle/contracts/trace'
import type { CombatEntityId } from '../battle/contracts/ids'

// Sound System W6 -- proc-execution drain tests. The drain scans
// scheduler.trace.records with a cursor (procExecutionCursor) reset by
// battle identity; proc.reflect.* -> proc_reflect, proc.onhit.* ->
// proc_on_hit, every other op ignored. Tests drive the REAL drain through
// a ManualClockSource battle and inject synthetic execution records —
// the trace getter returns the live array, so pushes are observable.
// Spec sec. "Cursor contract": exactly-once per record, reset on new
// battle identity.

const LING_BAO_L3 = CAST_LEVELING_THRESHOLDS.linh_bao!.lv3

function spawnDummy() {
  return defineEnemy({
    id: 'w6_drain_dummy',
    name: 'Drain Dummy',
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

interface DrainFixture {
  gameManager: GameManager
  combatSource: ManualClockSource
}

function makeManager(): DrainFixture & { player: ReturnType<typeof createDefaultPlayer> } {
  const gameManager = new GameManager()
  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_AN_NODES)

  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12
  player.skillCastCounts = { linh_bao: LING_BAO_L3 }
  gameManager.setActivePlayer(player)
  expect(
    gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'hidden_spell_pathway', player),
  ).toBe(true)

  return { gameManager, combatSource, player }
}

function reachFighting({ gameManager, combatSource }: DrainFixture): void {
  for (
    let i = 0;
    i < 600 && gameManager.getTurnBattle()?.state !== 'fighting';
    i++
  ) {
    combatSource.advance(COMBAT_STEP_SECONDS)
  }
  expect(gameManager.getTurnBattle()?.state).toBe('fighting')
}

/** Reach the live trace record list (records is readonly-typed but
    returns the live array — the drain scans exactly this list). */
function traceRecords(gameManager: GameManager): CombatExecutionRecord[] {
  const ops = gameManager.turnBattleOps as unknown as {
    turnRuntime?: { scheduler: { trace: { records: CombatExecutionRecord[] } } }
  }
  return ops.turnRuntime!.scheduler.trace.records
}

let seq = 0

function procRecord(
  originId: string,
  sourceId: string,
  payload: Record<string, unknown>,
  kind: 'proc' | 'skill' = 'proc',
): CombatExecutionRecord {
  seq += 1
  return {
    combatSequence: seq,
    operation: {
      operationId: `op.w6.${seq}`,
      type: kind === 'proc' && originId.startsWith('proc.onhit.') ? 'apply_buff' : 'deal_damage',
      origin: { kind, originId, sourceId: sourceId as CombatEntityId, rootActionId: 'proc.w6' },
      payload,
    },
    result: {},
  } as unknown as CombatExecutionRecord
}

describe('W6 proc drain — trace.records cursor', () => {
  it('proc_reflect emits once with verbatim payload fields; a second step never re-emits', () => {
    const { gameManager, combatSource, player } = makeManager()
    const seen: { type: string; holderId: string; attackerId: string; coefficient: number }[] = []
    gameManager.eventBus.on<typeof seen[number]>('proc_reflect', (e) => seen.push(e))

    gameManager.startBattleWithPlayer(player, spawnDummy())
    reachFighting({ gameManager, combatSource })

    traceRecords(gameManager).push(
      procRecord('proc.reflect.cap_the', 'defender', { targetId: 'attacker', coefficient: 0.3 }),
      procRecord('proc.reflect.cap_the_2', 'defender', { targetId: 'attacker', coefficient: 0.5 }),
    )

    combatSource.advance(COMBAT_STEP_SECONDS)

    expect(seen).toHaveLength(2)
    expect(seen[0]).toEqual({ type: 'proc_reflect', holderId: 'defender', attackerId: 'attacker', coefficient: 0.3 })
    expect(seen[1]).toEqual({ type: 'proc_reflect', holderId: 'defender', attackerId: 'attacker', coefficient: 0.5 })

    // Cursor continuity: the same records are never re-emitted.
    combatSource.advance(COMBAT_STEP_SECONDS)
    expect(seen).toHaveLength(2)

    // A third record appended later drains on the next step only.
    traceRecords(gameManager).push(
      procRecord('proc.reflect.cap_the_3', 'defender', { targetId: 'attacker', coefficient: 0.7 }),
    )
    combatSource.advance(COMBAT_STEP_SECONDS)
    expect(seen).toHaveLength(3)
    expect(seen[2]!.coefficient).toBe(0.7)
  })

  it('proc.onhit.* emits proc_on_hit { attackerId, targetId, buffId }', () => {
    const { gameManager, combatSource, player } = makeManager()
    const seen: { type: string; attackerId: string; targetId: string; buffId: string }[] = []
    gameManager.eventBus.on<typeof seen[number]>('proc_on_hit', (e) => seen.push(e))

    gameManager.startBattleWithPlayer(player, spawnDummy())
    reachFighting({ gameManager, combatSource })

    traceRecords(gameManager).push(
      procRecord('proc.onhit.inst_1.cap_doc', 'attacker', {
        targetId: 'victim',
        definitionId: 'doc_can',
      }),
    )

    combatSource.advance(COMBAT_STEP_SECONDS)

    expect(seen).toEqual([
      { type: 'proc_on_hit', attackerId: 'attacker', targetId: 'victim', buffId: 'doc_can' },
    ])
  })

  it('non-proc ops and unmatched proc prefixes stay silent', () => {
    const { gameManager, combatSource, player } = makeManager()
    const reflects: unknown[] = []
    const onHits: unknown[] = []
    gameManager.eventBus.on('proc_reflect', (e) => reflects.push(e))
    gameManager.eventBus.on('proc_on_hit', (e) => onHits.push(e))

    gameManager.startBattleWithPlayer(player, spawnDummy())
    reachFighting({ gameManager, combatSource })

    traceRecords(gameManager).push(
      procRecord('skill.linh_bao.1', 'attacker', { targetId: 'victim' }, 'skill'),
      procRecord('proc.reactive.cap_x', 'holder', { targetId: 'victim' }),
      procRecord('proc.other.y', 'holder', { targetId: 'victim' }),
    )

    combatSource.advance(COMBAT_STEP_SECONDS)

    expect(reflects).toHaveLength(0)
    expect(onHits).toHaveLength(0)
  })

  it('new-battle identity resets the cursor (a fresh trace at index 0 drains)', () => {
    const { gameManager, combatSource, player } = makeManager()
    const seen: unknown[] = []
    gameManager.eventBus.on('proc_reflect', (e) => seen.push(e))

    gameManager.startBattleWithPlayer(player, spawnDummy())
    reachFighting({ gameManager, combatSource })
    traceRecords(gameManager).push(
      procRecord('proc.reflect.battle1', 'defender', { targetId: 'attacker', coefficient: 0.1 }),
    )
    combatSource.advance(COMBAT_STEP_SECONDS)
    expect(seen).toHaveLength(1)

    expect(gameManager.abandonBattle()).toBe(true)
    gameManager.startBattleWithPlayer(player, spawnDummy())
    reachFighting({ gameManager, combatSource })

    // Battle 2's trace is a fresh array: if the cursor carried over,
    // this index-0-adjacent record would be skipped silently.
    traceRecords(gameManager).push(
      procRecord('proc.reflect.battle2', 'defender', { targetId: 'attacker', coefficient: 0.2 }),
    )
    combatSource.advance(COMBAT_STEP_SECONDS)

    expect(seen).toHaveLength(2)
    expect(seen[1]).toMatchObject({ coefficient: 0.2 })
  })
})
