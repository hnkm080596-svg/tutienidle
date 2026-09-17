import { describe, expect, it, vi } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { EventBus } from '../events/EventBus'
import { GameManager } from './GameManager'
import { StageWaveSystem } from './StageWaveSystem'
import { StageManager } from '../stage/StageManager'
import { StageSystem } from '../stage/StageSystem'
import { EnemySystem } from '../enemy/EnemySystem'
import { EnemyManager } from '../enemy/EnemyManager'
import { HiddenBeastSystem } from './HiddenBeastSystem'
import { TemplateRegistry } from './TemplateRegistry'
import { createDefaultPlayer, playerToCombatEntity } from '../player/Player'
import { asBaseStats } from '../stats/StatBlock'
import { defineEnemy, type Enemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'
import type { CultivationPathRuntime } from '../player/CultivationPathRuntime'

// Mission C audit (round: lease/ownership review) - the stage slot is a
// capability and the launch is a transaction:
//
//   C1  an exception after acquire (enemy pick OR launch chain) must roll
//       the lease back - a thrown start can never leave the global slot
//       occupied (the same soft-lock family Mission B removed).
//   C2  a refused startStage must be a no-op on the RUNNING battle: the
//       cycle RNG is minted as a candidate and committed only when the
//       new cycle actually begins inside beginBattleCycle.
//   C4  ownership is object-identity, not occupancy.
//   C5  the observational API (getActive) must not expose the release
//       capability - a snapshot can never free somebody else's slot.
//   C6  a launch that throws after the cycle's commit section must not
//       leave the PREVIOUS battle standing as a zombie: the failure
//       contract is "destroyed outright + clean idle".
//   C7  a refused startStage must not even MINT a stream - deterministic
//       factories observe identical sequences with or without refusals.
//   C8  stopRepeat clears the stage run's player context - the idle
//       auto-farm pick channel must never roll hidden beast on a stale
//       PlayerData reference.

const DUMMY = defineEnemy({
  id: 'lease_dummy', name: 'Lease Dummy', level: 1, realmId: 'mortal', lane: 'ground',
  statsInput: { maxHp: 10, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
  rewards: { techniqueInsight: 0, spiritStone: 0 },
})

const FRAGILE_DUMMY = defineEnemy({
  id: 'lease_fragile', name: 'Fragile Dummy', level: 1, realmId: 'mortal', lane: 'ground',
  statsInput: { maxHp: 1, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
  rewards: { techniqueInsight: 0, spiritStone: 0 },
})

function stageFixture(id: string, enemyId: string): Stage {
  return {
    id, name: id, description: '', floor: 1,
    enemyPool: [{ enemyId, weight: 1 }],
    totalEnemyCount: 1, waves: [1],
    spawnIntervalSeconds: 0,
  }
}

function setup(...enemies: ReturnType<typeof defineEnemy>[]) {
  const gameManager = new GameManager()
  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)
  const player = createDefaultPlayer()
  player.baseStats = asBaseStats({ ...player.baseStats, might: 100, speed: 100 })
  gameManager.catalogOps.registerEnemyTemplates([...enemies])
  gameManager.setActivePlayer(player)
  return { gameManager, combatSource, player }
}

/** StageWaveSystem unit harness - same dep shape as bossRepeatCycle tests. */
function waveHarness(...stages: Stage[]) {
  const enemyTemplates = new TemplateRegistry<Enemy>()
  enemyTemplates.register(DUMMY.id, DUMMY)
  const stageTemplates = new TemplateRegistry<Stage>()
  for (const stage of stages) {
    stageTemplates.register(stage.id, stage)
  }
  const stageManager = new StageManager()
  const hiddenBeast = new HiddenBeastSystem({ getEnemyTemplate: () => undefined })

  const stageWaves = new StageWaveSystem({
    eventBus: new EventBus(),
    enemySystem: new EnemySystem(new EnemyManager()),
    stageManager,
    stageSystem: new StageSystem(),
    stageTemplates,
    enemyTemplates,
    isStageUnlocked: () => true,
    launchBattle: () => {},
    hiddenBeast,
  })

  return { stageWaves, stageManager, hiddenBeast }
}

describe('C1 - stage launch is a transaction (lease rolls back on throw)', () => {
  it('launch-chain throw releases the lease and a retry can start cleanly', () => {
    const { gameManager, player } = setup(DUMMY)
    const stage = stageFixture('throw_stage', DUMMY.id)
    gameManager.catalogOps.registerStages([stage])

    // Path-runtime resolution (Ngo Dao missing-skill class) throws inside
    // the launch chain - after acquire, before commit.
    gameManager.turnBattleOps.setPathRuntimeResolver(() => {
      throw new Error('path runtime boom')
    })

    expect(() => gameManager.turnBattleOps.startStage(player, stage, false)).toThrow('path runtime boom')
    expect(gameManager.stageManager.getActive()).toBeNull()

    // The slot is free: a fixed retry starts instead of soft-locking.
    gameManager.turnBattleOps.setPathRuntimeResolver(undefined)
    expect(gameManager.turnBattleOps.startStage(player, stage, false)).toBe(true)
  })

  it('enemy-pick throw (broken authored stage data) releases the lease', () => {
    const { gameManager, player } = setup(DUMMY)
    // authored-broken stage: empty pool -> weightedRandom throws.
    const broken = stageFixture('broken_stage', DUMMY.id)
    broken.enemyPool = []
    gameManager.catalogOps.registerStages([broken])

    expect(() => gameManager.turnBattleOps.startStage(player, broken, false)).toThrow()
    expect(gameManager.stageManager.getActive()).toBeNull()
  })
})

describe('C2/C7 - refused startStage is a no-op on the running battle AND the RNG factory', () => {
  it('occupied-slot refusal never installs AND never mints a cycle RNG', () => {
    const { gameManager, player } = setup(DUMMY)
    const stageA = stageFixture('rng_stage_a', DUMMY.id)
    const stageB = stageFixture('rng_stage_b', DUMMY.id)
    gameManager.catalogOps.registerStages([stageA, stageB])

    const streams: Array<() => number> = []
    gameManager.turnBattleOps.setBattleRngFactory(() => {
      const stream = vi.fn(() => 0.5)
      streams.push(stream)
      return stream
    })
    const setSource = vi.spyOn(gameManager.combatSystem, 'setRandomSource')

    expect(gameManager.turnBattleOps.startStage(player, stageA, false)).toBe(true)
    const liveStream = streams.at(-1)!
    const installsAfterA = setSource.mock.calls.length

    // Refused: stage B cannot acquire the slot stage A holds.
    expect(gameManager.turnBattleOps.startStage(player, stageB, false)).toBe(false)

    // The running battle's RNG authority is untouched - no install, same
    // stream still live.
    expect(setSource.mock.calls.length).toBe(installsAfterA)
    expect(setSource.mock.calls.at(-1)?.[0]).toBe(liveStream)
    // C7: the refusal did not even MINT a candidate - the factory stream
    // sequence is identical to a run with no failed start.
    expect(streams).toHaveLength(1)
    expect(gameManager.stageManager.getActive()?.stageId).toBe(stageA.id)
  })
})

describe('C4/C5 - slot ownership is a capability, not an observable object', () => {
  it('a stale stopRepeat cannot release a foreign lease (wave unit level)', () => {
    const stageA = stageFixture('owner_stage_a', DUMMY.id)
    const stageB = stageFixture('owner_stage_b', DUMMY.id)
    const { stageWaves, stageManager } = waveHarness(stageA, stageB)
    const player = createDefaultPlayer()

    expect(stageWaves.start(player, stageA, false)).toBe(true)
    stageWaves.stopRepeat() // the wave run released its own lease

    const foreign = stageManager.acquire(stageB)!
    // A second, stale stopRepeat fires while a foreign owner holds the
    // slot - the wave run holds no token, so nothing can be released.
    stageWaves.stopRepeat()

    expect(stageManager.owns(foreign)).toBe(true)
    expect(stageManager.getActive()?.stageId).toBe(stageB.id)
  })

  it('holdsActiveStageLease reports only the wave run\'s own lease - never a foreign hold', () => {
    const stageA = stageFixture('repeat_own_a', DUMMY.id)
    const stageB = stageFixture('repeat_own_b', DUMMY.id)
    const { stageWaves, stageManager } = waveHarness(stageA, stageB)
    const player = createDefaultPlayer()

    expect(stageWaves.holdsActiveStageLease()).toBe(false)
    expect(stageWaves.start(player, stageA, true)).toBe(true)
    expect(stageWaves.holdsActiveStageLease()).toBe(true)

    stageWaves.stopRepeat()
    expect(stageWaves.holdsActiveStageLease()).toBe(false)

    // A foreign owner occupying the slot is never "our" lease - the
    // repeat gate asks "do I still hold MY lease", not "is the slot held".
    stageManager.acquire(stageB)
    expect(stageWaves.holdsActiveStageLease()).toBe(false)
  })

  it('getProgress reports only while this run owns the lease', () => {
    const stageA = stageFixture('progress_a', DUMMY.id)
    const stageB = stageFixture('progress_b', DUMMY.id)
    const { stageWaves, stageManager } = waveHarness(stageA, stageB)
    const player = createDefaultPlayer()

    stageWaves.start(player, stageA, false)
    expect(stageWaves.getProgress()?.total).toBe(1)

    stageWaves.stopRepeat()
    expect(stageWaves.getProgress()).toBeNull()

    // A foreign hold is not this stage run - no progress leak.
    stageManager.acquire(stageB)
    expect(stageWaves.getProgress()).toBeNull()
  })

  it('a repeat victory restart still works through the ownership gate (control case)', () => {
    const { gameManager, combatSource, player } = setup(FRAGILE_DUMMY)
    const stageA = stageFixture('repeat_ctrl_a', FRAGILE_DUMMY.id)
    gameManager.catalogOps.registerStages([stageA])

    expect(gameManager.turnBattleOps.startStage(player, stageA, true)).toBe(true)
    const generation = gameManager.turnBattleOps.getBattleGeneration()

    // Victory -> repeat -> fresh cycle all run inside one clock step, so
    // the transient 'victory' state is never visible at poll boundaries -
    // the observable signal of a fired repeat is the next cycle minted.
    for (let i = 0; i < 4_000 && gameManager.turnBattleOps.getBattleGeneration() === generation; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    expect(gameManager.turnBattleOps.getBattleGeneration()).toBeGreaterThan(generation)
    // The wave run still owns its own lease for the repeated stage.
    expect(gameManager.stageManager.getActive()?.stageId).toBe(stageA.id)
    expect(gameManager.getTurnBattle()?.state).not.toBe('defeat')
  })
})

describe('C6 - a thrown launch destroys the previous battle (no zombie)', () => {
  it('throw in the commit section: prior battle destroyed, ops clean idle, retry works', () => {
    const { gameManager, player } = setup(DUMMY)
    const stageB = stageFixture('destroy_b', DUMMY.id)
    gameManager.catalogOps.registerStages([stageB])

    // Battle A live through the non-stage entry (no lease involved).
    gameManager.startBattle(playerToCombatEntity(player, player.baseStats), DUMMY)
    expect(gameManager.getTurnBattle()?.state).toBe('intro')
    const battleEnds: string[] = []
    gameManager.eventBus.on('battle_end', (event: { state: string }) => {
      battleEnds.push(event.state)
    })

    // Path runtime throws inside the launch chain - after the new
    // cycle's commit section already reset the pending/token/queue,
    // installed its RNG and ran the per-cycle service resets.
    gameManager.turnBattleOps.setPathRuntimeResolver(() => {
      throw new Error('path runtime boom')
    })

    expect(() => gameManager.turnBattleOps.startStage(player, stageB, false)).toThrow('path runtime boom')

    // Destructive failure contract: battle A is definitively destroyed -
    // not a 'fighting' corpse with torn-down machinery.
    expect(gameManager.getTurnBattle()).toBeNull()
    expect(gameManager.stageManager.getActive()).toBeNull()
    // Its terminal was published exactly once (abandon semantics) so
    // presentation consumers leave the battle surface.
    expect(battleEnds).toEqual(['defeat'])

    // Known-idle: a fixed retry runs the canonical cycle immediately.
    gameManager.turnBattleOps.setPathRuntimeResolver(undefined)
    expect(gameManager.turnBattleOps.startStage(player, stageB, false)).toBe(true)
    expect(gameManager.getTurnBattle()?.state).toBe('intro')
  })

  it('throw inside battle assembly after the bootstrap spawn: no enemy leak survives teardown', () => {
    const { gameManager, player } = setup(DUMMY)
    const stageB = stageFixture('destroy_spawn_b', DUMMY.id)
    gameManager.catalogOps.registerStages([stageB])

    // The stub runtime resolves maxThe (first call site) then throws on
    // resolveBasic - inside buildTurnBattle, AFTER enemySystem.spawn
    // already registered the bootstrap enemy.
    gameManager.turnBattleOps.setPathRuntimeResolver(() => ({
      resolveMaxThe: () => 100,
      resolveBasic: () => {
        throw new Error('path runtime boom')
      },
    }) as unknown as CultivationPathRuntime)

    expect(() => gameManager.turnBattleOps.startStage(player, stageB, false)).toThrow('path runtime boom')

    expect(gameManager.getTurnBattle()).toBeNull()
    expect(gameManager.stageManager.getActive()).toBeNull()
    // The half-spawned bootstrap enemy is cleared with the failed cycle.
    expect(gameManager.enemyManager.getAll()).toHaveLength(0)
  })

  it('throw inside a repeat restart: lease released, no zombie battle, slot not soft-locked', () => {
    const { gameManager, combatSource, player } = setup(FRAGILE_DUMMY)
    const stageA = stageFixture('repeat_destroy_a', FRAGILE_DUMMY.id)
    gameManager.catalogOps.registerStages([stageA])

    expect(gameManager.turnBattleOps.startStage(player, stageA, true)).toBe(true)

    const battleEnds: string[] = []
    gameManager.eventBus.on('battle_end', (event: { state: string }) => {
      battleEnds.push(event.state)
    })

    // Install the failure AFTER the first cycle is live: the resolver only
    // runs during cycle construction, so the repeat restart's
    // beginBattleCycle hits it - a path the wave system's launch
    // transaction does NOT wrap (no acquire happens on repeat).
    gameManager.turnBattleOps.setPathRuntimeResolver(() => {
      throw new Error('repeat construction boom')
    })

    // Victory -> repeat -> beginBattleCycle throws inside the clock step.
    let thrown: unknown = null
    try {
      for (let i = 0; i < 4_000; i++) {
        combatSource.advance(COMBAT_STEP_SECONDS)
      }
    } catch (error) {
      thrown = error
    }
    expect((thrown as Error)?.message).toBe('repeat construction boom')

    // Destructive contract: battle destroyed, and the wave lease freed -
    // otherwise the slot stays occupied forever with no live battle.
    expect(gameManager.getTurnBattle()).toBeNull()
    expect(gameManager.stageManager.getActive()).toBeNull()
    // The won battle's terminal was already published - teardown must NOT
    // re-mark it defeat or emit a second battle_end.
    expect(battleEnds).toEqual(['victory'])

    // The slot is usable again immediately.
    gameManager.turnBattleOps.setPathRuntimeResolver(undefined)
    expect(gameManager.turnBattleOps.startStage(player, stageA, false)).toBe(true)
    expect(gameManager.getTurnBattle()?.state).toBe('intro')
  })

  it('a failed begin banks the previous battle\'s real stacks, not post-reset zeros (C11)', () => {
    const { gameManager, player } = setup(DUMMY)
    player.selectedTalentIds = ['pha_giap']
    player.realmId = 'qi_refining'
    gameManager.progressionOps.syncTalentCombatPassive(player)

    gameManager.startBattleWithPlayer(player, DUMMY)
    // Battle A accumulated 4 stacks on its bound passive.
    gameManager.skillManager.get('talent_passive_pha_giap')!.passiveModifiers![0]!.stacks = 4

    gameManager.turnBattleOps.setPathRuntimeResolver(() => {
      throw new Error('path runtime boom')
    })

    // The new cycle's resetStacks() zeroes the live stacks BEFORE the
    // throw - the failure contract must still bank what battle A
    // actually held, i.e. a pre-commit snapshot.
    expect(() => gameManager.startBattleWithPlayer(player, DUMMY)).toThrow('path runtime boom')

    // Abandon semantics: floor(4 * 0.5) = 2 - not the post-reset 0.
    expect(player.phaGiapCarryStacks).toBe(2)
    expect(player.phaGiapCarryRealmId).toBe('qi_refining')
  })

  it('throw AFTER the new battle assignment: the destroyed previous battle still gets its one defeat terminal (C12)', () => {
    const { gameManager, player } = setup(DUMMY)

    gameManager.startBattleWithPlayer(player, DUMMY)
    expect(gameManager.getTurnBattle()?.state).toBe('intro')

    const battleEnds: string[] = []
    gameManager.eventBus.on('battle_end', (event: { state: string }) => {
      battleEnds.push(event.state)
    })

    // The stub runtime clears every pre-assignment path-runtime call
    // (resolveMaxThe / resolveBasic / resolveStatDomains /
    // resolveSpecialUltimate) then throws inside buildSurviveSources -
    // the first throw-prone site AFTER `this.turnBattle` was reassigned
    // to the half-built new battle.
    gameManager.turnBattleOps.setPathRuntimeResolver(() => ({
      resolveMaxThe: () => 100,
      resolveBasic: () => undefined,
      resolveStatDomains: () => undefined,
      resolveSpecialUltimate: () => undefined,
      buildSurviveSources: () => {
        throw new Error('survive wiring boom')
      },
    }) as unknown as CultivationPathRuntime)

    expect(() => gameManager.startBattleWithPlayer(player, DUMMY)).toThrow('survive wiring boom')

    // Battle A was live and presentation-known: its destruction must
    // publish exactly one defeat terminal - losing the reference when B
    // took over must not silently eat it. The half-built new battle
    // drops silently - it never began.
    expect(battleEnds).toEqual(['defeat'])
    expect(gameManager.getTurnBattle()).toBeNull()

    // Known-idle: a fixed retry runs the canonical cycle immediately.
    gameManager.turnBattleOps.setPathRuntimeResolver(undefined)
    expect(() => gameManager.startBattleWithPlayer(player, DUMMY)).not.toThrow()
  })
})

describe('C8 - stopRepeat clears the stage run\'s player context', () => {
  it('idle picks after stopRepeat never roll hidden beast on a stale player', () => {
    const stageA = stageFixture('context_a', DUMMY.id)
    const { stageWaves, hiddenBeast } = waveHarness(stageA)
    const player = createDefaultPlayer()
    const spy = vi.spyOn(hiddenBeast, 'maybeReplaceSpawn')

    stageWaves.start(player, stageA, false)
    // The live stage pick consulted hidden beast with the stage's player.
    expect(spy).toHaveBeenCalled()

    stageWaves.stopRepeat()
    spy.mockClear()

    // The same pick channel the idle auto-farm uses must not see a stale
    // PlayerData reference after the stage hold ended.
    stageWaves.pickEnemyForTurnSpawn(stageA, false, { allowTags: false })
    expect(spy).not.toHaveBeenCalled()
  })
})
