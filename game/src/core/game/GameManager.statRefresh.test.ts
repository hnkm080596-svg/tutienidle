import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createDefaultPlayer, resolvePlayerFinalStats, type PlayerData } from '../player/Player'
import { asBaseStats } from '../stats/StatBlock'
import type { Stage } from '../stage/Stage'
import type { BuffDefinitionId, CombatEntityId, CombatOperationId } from '../battle/contracts/ids'
import { PASSIVE_SKILLS } from '../../data/skill/PassiveSkills'

// ARCH-002 (M7) — regression coverage for the stat-refresh / battle-reset
// repair, driven through the real GameManager entry paths (no internal
// helpers): passive stacks must be live in the current battle, must not leak
// into the next battle's resolved base, and buff apply/remove/expire must be
// effective before the next dependent read — including CC'd/charging actors.
//
// Audit anchors (docs/qa/2026-09-14-audit-combat-review.md):
//  - C01: tat_phong 3 kills -> +6% speed live; next battle baseStats stayed
//    stale at the buffed value (snapshot leaked resolved stacks).
//  - C03: kim_giap on thiet_y_tang — defense sat in the pool without
//    reaching entity.stats before the counter read them.

function makeEnemy(id = 'sr_enemy'): ReturnType<typeof defineEnemy> {
  return defineEnemy({
    id,
    name: 'SR Enemy',
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
    },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

function makeOneEnemyStage(stageId: string, enemyId: string): Stage {
  return {
    id: stageId,
    name: stageId,
    description: '',
    floor: 1,
    enemyPool: [{ enemyId, weight: 1 }],
    totalEnemyCount: 1,
    waves: [1],
    spawnIntervalSeconds: 0,
  }
}

function advanceUntilFighting(manager: GameManager, clock: ManualClockSource) {
  for (let i = 0; i < 80 && manager.getTurnBattle()!.state !== 'fighting'; i++) {
    clock.advance(COMBAT_STEP_SECONDS)
  }
  expect(manager.getTurnBattle()!.state).toBe('fighting')
}

function makePlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  const player = createDefaultPlayer()
  player.baseStats = asBaseStats({
    ...player.baseStats,
    might: 100,
    speed: 100,
    maxHp: 1_000_000,
  })
  Object.assign(player, overrides)
  return player
}

// Applies a registered def through the battle's buff authority -- the same
// scheduler-backed lane production uses (authored op + settle while
// quiescent). Tests needing an explicit lifetime pass durationOverride.
function applyBattleBuff(
  manager: GameManager,
  definitionId: string,
  targetId: string,
  durationOverride?: number,
): void {
  const scheduler = manager.turnBattleOps.getTurnBattleSystem().combatScheduler
  if (scheduler === undefined) {
    throw new Error('no combat scheduler on the live battle')
  }
  const root = `test.apply.${definitionId}`
  scheduler.enqueueAuthored([
    {
      type: 'apply_buff',
      operationId: `op.${root}` as CombatOperationId,
      payload: {
        definitionId: definitionId as BuffDefinitionId,
        targetId: targetId as CombatEntityId,
        stacks: 1,
        baseChance: 1,
        durationOverride,
        reactionEligibility: 'eligible',
      },
      origin: {
        kind: 'proc',
        originId: 'test.apply',
        sourceId: targetId as CombatEntityId,
        rootActionId: root,
      },
    },
  ])
  scheduler.run()
}

describe('ARCH-002 M7 — passive stacks are live in-fight and reset before the next snapshot', () => {
  it('tat_phong: 3 kills raise effective speed ~6% mid-battle AND match the menu view', () => {
    const manager = new GameManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)

    const player = makePlayer({ selectedTalentIds: ['tat_phong'] })
    manager.setActivePlayer(player)
    manager.progressionOps.syncTalentCombatPassive(player)

    // New entry contract: no caller-side stats — ops resolves the base
    // internally after the passive reset.
    manager.startBattleWithPlayer(player, makeEnemy())
    advanceUntilFighting(manager, clock)

    const participant = manager.getTurnBattle()!.players[0]!
    const entrySpeed = participant.entity.baseStats.speed

    // The passive snapshot must be clean at entry (stacks were reset before
    // the resolved base was taken).
    expect(participant.entity.stats.speed).toBeCloseTo(entrySpeed, 6)

    // 3 kills -> tat_phong stacks to 3 (+2% speed each).
    for (let i = 0; i < 3; i++) {
      manager.eventBus.emit('kill', { type: 'kill', sourceId: 'player', targetId: 'e' })
    }

    // One pacing step folds the live stacks into entity.stats.
    clock.advance(COMBAT_STEP_SECONDS)

    expect(participant.entity.stats.speed).toBeCloseTo(entrySpeed * 1.06, 4)

    // Parity with the menu view: the store-visible resolved value (same
    // modifier union, single aggregation) agrees with the battle read.
    const menuEquivalent = resolvePlayerFinalStats(
      player,
      manager.effectOps.getAggregatedModifiers(player),
    )
    expect(participant.entity.stats.speed).toBeCloseTo(menuEquivalent.speed, 4)
  })

  it('tat_phong: the NEXT battle resolves a clean base — no stack leakage into baseStats', () => {
    const manager = new GameManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)

    const player = makePlayer({ selectedTalentIds: ['tat_phong'] })
    manager.setActivePlayer(player)
    manager.progressionOps.syncTalentCombatPassive(player)

    manager.startBattleWithPlayer(player, makeEnemy('sr_enemy_a'))
    advanceUntilFighting(manager, clock)

    const firstBaseSpeed = manager.getTurnBattle()!.players[0]!.entity.baseStats.speed

    for (let i = 0; i < 3; i++) {
      manager.eventBus.emit('kill', { type: 'kill', sourceId: 'player', targetId: 'e' })
    }
    clock.advance(COMBAT_STEP_SECONDS)
    expect(manager.getTurnBattle()!.players[0]!.entity.stats.speed).toBeGreaterThan(firstBaseSpeed)

    // Second battle: baseStats must equal the clean resolved speed again —
    // the previous battle's stacks were reset before this snapshot, and the
    // live channel is the only way they can re-enter.
    manager.startBattleWithPlayer(player, makeEnemy('sr_enemy_b'))

    const second = manager.getTurnBattle()!.players[0]!
    expect(second.entity.baseStats.speed).toBeCloseTo(firstBaseSpeed, 6)
    expect(second.entity.stats.speed).toBeCloseTo(firstBaseSpeed, 6)

    const tatPhong = manager.skillManager.get('talent_passive_tat_phong')!
    expect(tatPhong.passiveModifiers![0]!.stacks ?? 0).toBe(0)
  })
})

describe('ARCH-002 M7 — buff apply is effective before the next dependent read', () => {
  it('thiet_y_tang kim_giap: defense is live on the SAME step the buff lands', () => {
    const manager = new GameManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)

    const player = makePlayer()
    player.companions = [
      {
        instanceId: 'monk_instance',
        definitionId: 'thiet_y_tang',
        realmId: 'mortal',
        realmLevel: 14,
        exp: 0,
        constellationRank: 0,
      },
    ]
    player.formationLoadout = {
      formationId: 'test_formation',
      assignments: [
        { row: 0, column: 0, combatantId: 'player' },
        { row: 1, column: 1, combatantId: 'thiet_y_tang' },
      ],
    }
    manager.setActivePlayer(player)

    manager.startBattleWithPlayer(player, makeEnemy())
    advanceUntilFighting(manager, clock)

    const monk = manager.getTurnBattle()!.players.find((p) => p.id === 'thiet_y_tang')!
    expect(monk).toBeDefined()

    const baseDefense = monk.entity.baseStats.defense

    // Advance until the monk's special lands (kim_giap, self). Assert the
    // stats read is updated immediately — before any further step runs —
    // so a counter/hit between now and the monk's next turn sees it.
    let applied = false
    for (let i = 0; i < 400 && !applied; i++) {
      clock.advance(COMBAT_STEP_SECONDS)
      applied = manager
        .getBattleBuffs(monk.entity.id)
        .some((i) => i.definitionId === 'kim_giap')
    }

    expect(applied).toBe(true)
    expect(monk.entity.stats.defense).toBeCloseTo(baseDefense * 1.15, 5)
  })

  it('duration-1 buff is folded before the holder next declares, then drops on expiry', () => {
    const manager = new GameManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)

    const player = makePlayer()
    manager.setActivePlayer(player)

    manager.startBattleWithPlayer(player, makeEnemy())
    advanceUntilFighting(manager, clock)

    const participant = manager.getTurnBattle()!.players[0]!
    const baseSpeed = participant.entity.baseStats.speed

    // sat_na = registered +20% speed buff, duration forced to 1 holder turn.
    applyBattleBuff(manager, 'sat_na', participant.entity.id, 1)

    // One pacing step: the buff is live even though the holder has not
    // taken a turn yet.
    clock.advance(COMBAT_STEP_SECONDS)
    expect(participant.entity.stats.speed).toBeCloseTo(baseSpeed * 1.2, 4)

    // Advance until the holder's declare expires it — effective stats drop
    // back to base on the same step, never past the expiry boundary.
    let restored = false
    for (let i = 0; i < 400 && !restored; i++) {
      clock.advance(COMBAT_STEP_SECONDS)
      restored =
        manager.getBattleBuffs(participant.entity.id).every((i) => i.definitionId !== 'sat_na') &&
        Math.abs(participant.entity.stats.speed - baseSpeed) < 1e-6
    }

    expect(restored).toBe(true)
  })

  it('a stunned actor still receives effective-stat refreshes while CC-locked', () => {
    const manager = new GameManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)

    const player = makePlayer()
    manager.setActivePlayer(player)

    manager.startBattleWithPlayer(player, makeEnemy())
    advanceUntilFighting(manager, clock)

    const participant = manager.getTurnBattle()!.players[0]!
    const baseSpeed = participant.entity.baseStats.speed

    // choang = registered stun (duration forced to 5 holder turns);
    // sat_na = registered +20% speed buff.
    applyBattleBuff(manager, 'choang', participant.entity.id, 5)
    applyBattleBuff(manager, 'sat_na', participant.entity.id)

    // The next pacing step folds the haste in even though the holder is
    // stunned — CC must not freeze the stat view.
    clock.advance(COMBAT_STEP_SECONDS)
    expect(participant.entity.stats.speed).toBeCloseTo(baseSpeed * 1.2, 4)

    // Advance through the stunned declare — the refresh at declare is
    // unconditional, so the buff stays live while ccBlocked resolves.
    clock.advance(COMBAT_STEP_SECONDS)
    expect(participant.entity.stats.speed).toBeCloseTo(baseSpeed * 1.2, 4)
  })
})

describe('ARCH-002 M7 review R1 — live maxHp moves the real heal ceiling', () => {
  it('a live maxHp modifier raises entity.maxHp mid-battle (no free heal) and expiry clamps currentHp', () => {
    const manager = new GameManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)

    // hpRegen 0 keeps currentHp deterministic — no regen tick could heal
    // into the grown headroom between refresh and assertion.
    const player = makePlayer()
    player.baseStats = asBaseStats({ ...player.baseStats, hpRegenPerTurn: 0, vitality: 0 })
    manager.setActivePlayer(player)

    manager.startBattleWithPlayer(player, makeEnemy())
    advanceUntilFighting(manager, clock)

    const entity = manager.getTurnBattle()!.players[0]!.entity
    const baseCeiling = entity.maxHp
    expect(entity.currentHp).toBeCloseTo(baseCeiling, 4)

    // Mid-battle +50% maxHp through the timed-effects live channel — the
    // same union the engine's liveStatModifiers provider serves.
    player.persistentTimedEffects.push({
      id: 'test_live_maxhp',
      sourceItemId: 'test',
      appliedAtMs: Date.now(),
      expiresAtMs: Date.now() + 60_000,
      modifiers: [
        { id: 'test_live_maxhp', sourceId: 'test', sourceType: 'pill', stat: 'maxHp', percent: 0.5 },
      ],
    })
    clock.advance(COMBAT_STEP_SECONDS)

    // The REAL vitals ceiling (entity.maxHp — heal clamp, regen gate,
    // entity_vitals_changed.maxHp) moved with the effective stat on the
    // same step — and growth granted no free HP.
    expect(entity.maxHp).toBeCloseTo(baseCeiling * 1.5, 4)
    expect(entity.currentHp).toBeCloseTo(baseCeiling, 4)

    // The heal clamp honors the grown ceiling: a heal larger than the old
    // cap fills currentHp to the new maxHp instead of capping early.
    manager.combatSystem.applyHealing(entity, baseCeiling, 'test_source')
    expect(entity.currentHp).toBeCloseTo(baseCeiling * 1.5, 4)

    // Expiry shrinks the ceiling and clamps currentHp down on the same
    // refresh step.
    player.persistentTimedEffects.length = 0
    clock.advance(COMBAT_STEP_SECONDS)

    expect(entity.maxHp).toBeCloseTo(baseCeiling, 4)
    expect(entity.currentHp).toBeCloseTo(baseCeiling, 4)
  })
})

describe('ARCH-002 M7 review R1 — tribulation ghost snapshot cannot leak passive stacks', () => {
  it('startTribulation resets leftover passive stacks BEFORE the ghost snapshot', () => {
    const manager = new GameManager()
    const player = makePlayer()
    player.realmId = 'mortal'
    player.realmLevel = 12
    manager.setActivePlayer(player)

    // A maxHp-stacking passive left hot from a finished battle — the old
    // caller-side finalStats mirror would have baked +200% into the ghost.
    manager.skillManager.add({
      id: 'test_maxhp_passive',
      name: 'Test MaxHp Passive',
      description: 'test',
      type: 'passive',
      level: 1,
      maxLevel: 1,
      cooldown: 0,
      target: 'self',
      effects: [],
      unlocked: true,
      equipped: true,
      passiveModifiers: [
        {
          id: 'test_maxhp_passive',
          sourceId: 'test_maxhp_passive',
          sourceType: 'skill',
          stat: 'maxHp',
          percent: 0.5,
          stacks: 4,
          maxStacks: 10,
        },
      ],
    })

    // Sanity: the ambient mirror DOES see the stacks (the leak channel).
    const leaked = manager.resolveAmbientPlayerStats(player)
    const passive = manager.skillManager.get('test_maxhp_passive')!
    expect(passive.passiveModifiers![0]!.stacks).toBe(4)
    expect(leaked.maxHp).toBeGreaterThan(resolvePlayerFinalStats(player, []).maxHp)

    expect(manager.startTribulation(player, 'qi_refining')).toBe(true)

    // Stacks were reset BEFORE the snapshot: ghost maxHp equals the clean
    // ambient resolve, not the stack-inflated mirror.
    expect(passive.passiveModifiers![0]!.stacks ?? 0).toBe(0)
    const clean = manager.resolveAmbientPlayerStats(player)
    expect(manager.tribulationDirector.getState()!.maxHp).toBeCloseTo(clean.maxHp, 4)
    expect(manager.tribulationDirector.getState()!.maxHp).toBeLessThan(leaked.maxHp)
  })
})

describe('ARCH-002 M7 — resolved base provenance', () => {
  it('formation buff (tran_phap_doc_hanh) is folded into entity.stats at battle start', () => {
    const manager = new GameManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)

    const player = makePlayer()
    player.formationLoadout = {
      formationId: 'doc_hanh_tran',
      assignments: [{ row: 1, column: 2, combatantId: 'player' }],
    }
    manager.setActivePlayer(player)

    manager.startBattleWithPlayer(player, makeEnemy())

    const participant = manager.getTurnBattle()!.players[0]!
    // +12% might must be effective immediately at battle start — before the
    // first fighting step — not wait for the player's first declare.
    expect(
      manager
        .getBattleBuffs(participant.entity.id)
        .some((i) => i.definitionId === 'tran_phap_doc_hanh_buff'),
    ).toBe(true)
    expect(participant.entity.stats.might).toBeCloseTo(
      participant.entity.baseStats.might * 1.12,
      4,
    )
  })

  it('stage entry path resolves the base the same way (no caller-side stats)', () => {
    const manager = new GameManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)

    const player = makePlayer({ selectedTalentIds: ['tat_phong'] })
    manager.setActivePlayer(player)
    manager.progressionOps.syncTalentCombatPassive(player)

    const enemy = makeEnemy('sr_stage_dummy')
    const stage = makeOneEnemyStage('sr_stage', 'sr_stage_dummy')
    manager.catalogOps.registerEnemyTemplates([enemy])
    manager.catalogOps.registerStages([stage])

    expect(manager.turnBattleOps.startStage(player, stage, false)).toBe(true)
    advanceUntilFighting(manager, clock)

    const participant = manager.getTurnBattle()!.players[0]!
    const entrySpeed = participant.entity.baseStats.speed

    manager.eventBus.emit('kill', { type: 'kill', sourceId: 'player', targetId: 'e' })
    clock.advance(COMBAT_STEP_SECONDS)

    expect(participant.entity.stats.speed).toBeCloseTo(entrySpeed * 1.02, 4)
  })
})

describe('M9 retained M7 debt — live attunement stacks re-derive elemental power (passive_dai_thua_dao_tam)', () => {
  it('10 hit-stacked attunement stacks raise effective firePower/waterPower mid-battle via delta derivation', () => {
    const manager = new GameManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)

    // attunement 100 keeps the derived delta large enough to assert
    // against float noise (default 1 would yield ~0.075 power/stack-step).
    const player = makePlayer()
    player.baseStats = asBaseStats({ ...player.baseStats, attunement: 100 })
    manager.setActivePlayer(player)

    // Learn + equip the REAL passive through the same collection the
    // production learn path fills (realm-gate bypassed — the test targets
    // the stack/live-modifier channel, not the unlock gate).
    const template = PASSIVE_SKILLS.find((skill) => skill.id === 'passive_dai_thua_dao_tam')!
    manager.skillManager.add({ ...structuredClone(template), unlocked: true, equipped: true })

    manager.startBattleWithPlayer(player, makeEnemy())
    advanceUntilFighting(manager, clock)

    const participant = manager.getTurnBattle()!.players[0]!
    const baseAttunement = participant.entity.baseStats.attunement
    const baseFirePower = participant.entity.baseStats.firePower
    const baseWaterPower = participant.entity.baseStats.waterPower

    expect(baseAttunement).toBeCloseTo(100, 4)
    // Resolved base already carries full derivation of its own
    // attunement: (0 + 100*0.5) * (1 + 100*0.001) = 55.
    expect(baseFirePower).toBeCloseTo(55, 4)
    expect(participant.entity.stats.firePower).toBeCloseTo(baseFirePower, 6)

    // 10 landed hits -> 10 stacks of +1.5% attunement each (+15%).
    for (let i = 0; i < 10; i++) {
      manager.eventBus.emit('hit', { type: 'hit', sourceId: 'player', targetId: 'e' })
    }
    clock.advance(COMBAT_STEP_SECONDS)

    const effectiveAttunement = participant.entity.stats.attunement
    expect(effectiveAttunement).toBeCloseTo(baseAttunement * 1.15, 4)

    // ARCH-009-adjacent retained debt: the delta (15 attunement) derives
    // flat +7.5 and tagged +1.5% per element, folded ON TOP of the
    // resolved base — powers move in-battle without re-deriving the base.
    const delta = effectiveAttunement - baseAttunement
    const expectedFire = (baseFirePower + delta * 0.5) * (1 + delta * 0.001)

    expect(participant.entity.stats.firePower).toBeCloseTo(expectedFire, 4)
    expect(participant.entity.stats.firePower).toBeGreaterThan(baseFirePower)
    expect(participant.entity.stats.waterPower).toBeCloseTo(
      (baseWaterPower + delta * 0.5) * (1 + delta * 0.001),
      4,
    )

    // Parity with the menu view (single-pass full derivation): the
    // delta-fold differs only by pool-fold ordering (<2% here).
    const menuEquivalent = resolvePlayerFinalStats(
      player,
      manager.effectOps.getAggregatedModifiers(player),
    )
    expect(participant.entity.stats.firePower / menuEquivalent.firePower).toBeGreaterThan(0.98)

    // Push to the authored stack cap (50 stacks x +1.5% = +75%
    // attunement): the delta-fold divergence stays bounded and
    // one-directional — below the menu single-pass value (~3.3% at
    // attunement 100), never above it.
    for (let i = 10; i < 50; i++) {
      manager.eventBus.emit('hit', { type: 'hit', sourceId: 'player', targetId: 'e' })
    }
    clock.advance(COMBAT_STEP_SECONDS)

    const capDelta = baseAttunement * 0.75
    expect(participant.entity.stats.attunement).toBeCloseTo(baseAttunement + capDelta, 4)
    expect(participant.entity.stats.firePower).toBeCloseTo(
      (baseFirePower + capDelta * 0.5) * (1 + capDelta * 0.001),
      4,
    )

    const menuAtCap = resolvePlayerFinalStats(
      player,
      manager.effectOps.getAggregatedModifiers(player),
    )
    const capRatio = participant.entity.stats.firePower / menuAtCap.firePower
    expect(capRatio).toBeLessThan(1)
    expect(capRatio).toBeGreaterThan(0.96)
  })

  it('a live attunement modifier that nets to zero leaves powers untouched (no spurious derivation)', () => {
    const manager = new GameManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)

    const player = makePlayer()
    manager.setActivePlayer(player)

    manager.startBattleWithPlayer(player, makeEnemy())
    advanceUntilFighting(manager, clock)

    const participant = manager.getTurnBattle()!.players[0]!
    const statsBefore = { ...participant.entity.stats }

    // Non-main-stat live modifier: no main-stat delta -> powers must be
    // bit-identical to the previous effective view.
    player.persistentTimedEffects.push({
      id: 'test_live_attack',
      sourceItemId: 'test',
      appliedAtMs: Date.now(),
      expiresAtMs: Date.now() + 60_000,
      modifiers: [
        { id: 'test_live_attack', sourceId: 'test', sourceType: 'pill', stat: 'might', percent: 0.5 },
      ],
    })
    clock.advance(COMBAT_STEP_SECONDS)

    expect(participant.entity.stats.firePower).toBeCloseTo(statsBefore.firePower, 8)
    expect(participant.entity.stats.might).toBeCloseTo(statsBefore.might * 1.5, 4)
  })
})
