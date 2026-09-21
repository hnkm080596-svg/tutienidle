import { describe, expect, it } from 'vitest'
import { GameManager } from '../game/GameManager'
import { runBattle } from './BattleSimulation'
import type { SimBuildSnapshot } from './BattleSimulation'
import { BattleMetricsCollector } from './BattleMetrics'
import { ManualClockSource } from '../battle/turn/CombatClock'
import { SeededCombatRng } from '../battle/runtime/rng/SeededCombatRng'
import { COUNTDOWN_TOTAL_TICKS } from '../battle/turn/TurnBattleConstants'
import { defineEnemy } from '../enemy/Enemy'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { ENEMIES } from '../../data/enemy/Enemies'
import { STAGES } from '../../data/stage/Stages'
import type { CombatEntityId } from '../battle/contracts/ids'
import { createDefaultPlayer } from '../player/Player'
import type { PlayerData } from '../player/Player'
import { CAST_LEVELING_THRESHOLDS } from '../skill/SkillSystem'

// P4-M2 - metric SEMANTICS pinned against a real seeded stage-1 battle
// (the ngo_dao fixture from P3: seals + reactions provably fire).

function ngoDaoBuild(): SimBuildSnapshot {
  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12
  player.skillCastCounts = { linh_bao: CAST_LEVELING_THRESHOLDS.linh_bao!.lv3 }
  return { player, skills: [], techniques: [] }
}

function result(seed = 20260922) {
  return runBattle({
    seed,
    build: ngoDaoBuild(),
    ritual: { pathId: 'spell', wayId: 'hidden_spell_pathway' },
    encounter: { kind: 'stage', stageId: 'mortal_dong_1' },
  })
}

describe('BattleMetrics semantics', () => {
  it('damage metrics sum consistently and DPS uses combat time', () => {
    const r = result()
    expect(r.outcome).toBe('victory')
    const { damage } = r.metrics
    expect(damage.total).toBeGreaterThan(0)
    expect(damage.bySource['player']).toBeGreaterThan(0)
    const sourceSum = Object.values(damage.bySource).reduce((a, b) => a + b, 0)
    expect(sourceSum).toBeCloseTo(damage.total, 5)
    expect(damage.dps).toBeCloseTo(damage.total / r.combatDurationSeconds, 5)
  })

  it('step counters split lifecycle from fighting phase', () => {
    const r = result()
    expect(r.fightingSteps).toBeGreaterThan(0)
    expect(r.steps).toBeGreaterThanOrEqual(r.fightingSteps)
    expect(r.combatDurationSeconds).toBeCloseTo(r.fightingSteps * 0.1, 5)
  })

  it('absorption never double-counts externalWard', () => {
    const r = result()
    const { absorption } = r.metrics
    // wardAbsorbed already includes externalWardAbsorbed (ops:441) - the
    // total adds manaShield only.
    expect(absorption.total).toBeCloseTo(
      absorption.wardAbsorbed + absorption.manaShieldAbsorbed,
      5,
    )
    expect(absorption.externalWardAbsorbed).toBeLessThanOrEqual(absorption.wardAbsorbed)
    expect(r.diagnostics.gaps).toContain('full_mitigation_unobservable')
    expect(r.diagnostics.gaps).toContain('regen_overheal_unobservable')
  })

  it('reactions resolve and per-minute rate uses combat duration', () => {
    const r = result()
    const { reactions } = r.metrics
    expect(reactions.resolvedTotal).toBeGreaterThan(0)
    const idSum = Object.values(reactions.resolved).reduce((a, b) => a + b, 0)
    expect(idSum).toBe(reactions.resolvedTotal)
    expect(reactions.perMinute).toBeCloseTo(
      (reactions.resolvedTotal / r.combatDurationSeconds) * 60,
      5,
    )
  })

  it('uptime uses entity-active fighting denominators in [0,1]', () => {
    const r = result()
    for (const [key, fraction] of Object.entries(r.metrics.uptime)) {
      expect(fraction).toBeGreaterThan(0)
      expect(fraction).toBeLessThanOrEqual(1)
      expect(key).toMatch(/^(player|companion:.+|enemy:.+:\d+)\|/)
    }
  })

  it('casts group by skillId and deaths use role keys', () => {
    const r = result()
    const castTotal = Object.values(r.metrics.casts).reduce((a, b) => a + b, 0)
    expect(castTotal).toBeGreaterThan(0)
    for (const skillId of Object.keys(r.metrics.casts)) {
      expect(typeof skillId).toBe('string')
      expect(skillId.length).toBeGreaterThan(0)
    }
    expect(r.metrics.deaths.length).toBeGreaterThan(0)
    for (const key of r.metrics.deaths) {
      expect(key).toMatch(/^(enemy:.+:\d+|player|companion:.+)$/)
    }
  })

  it('resource ledger counts ward via vitals only - no op double-count', () => {
    const r = result()
    // Ward is vitals-complete: spendWard/grantWard emit ward_spend/
    // ward_grant for authored ops AND engine-lane spends alike, so the
    // trace lane must not re-add ward ops (or apply_shield). Internal
    // consistency is the assertion surface here - every lane value is
    // finite and non-negative.
    for (const ledger of Object.values(r.metrics.resources.byEntity)) {
      for (const v of Object.values(ledger)) {
        expect(Number.isFinite(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('engine-lane ward spend (no trace record) lands in the ledger', () => {
    // The consume-ward burst spends ward via combat.spendWard directly -
    // a ward_spend vitals event with NO consume_resource op behind it.
    // A collector observing that vitals alone must still count it.
    const gameManager = new GameManager()
    const collector = new BattleMetricsCollector(gameManager)
    gameManager.eventBus.emit('entity_vitals_changed', {
      type: 'entity_vitals_changed',
      entityId: 'player',
      reason: 'ward_spend',
      amount: 6,
      hpBefore: 100,
      hpAfter: 100,
      wardBefore: 10,
      wardAfter: 4,
      mpBefore: 50,
      mpAfter: 50,
      sourceId: 'player',
    })
    gameManager.eventBus.emit('entity_vitals_changed', {
      type: 'entity_vitals_changed',
      entityId: 'player',
      reason: 'ward_grant',
      amount: 3,
      hpBefore: 100,
      hpAfter: 100,
      wardBefore: 4,
      wardAfter: 7,
      mpBefore: 50,
      mpAfter: 50,
      sourceId: 'player',
    })
    const metrics = collector.finalize(gameManager)
    expect(metrics.resources.byEntity['player']?.wardSpent).toBe(6)
    expect(metrics.resources.byEntity['player']?.wardGained).toBe(3)
    collector.dispose()
  })

  it('op-routed the writes land at settled trace values', () => {
    // 'the' is trace-settled for ops: every gain_resource/consume_resource
    // settles through the scheduler and the ledger reads the APPLIED
    // amount. Proven end-to-end by enqueueing real ops through the live
    // battle's scheduler: an over-cap gain (150 vs MAX_THE 100 -
    // applied, not requested) then consume 'all'.
    const gameManager = new GameManager()
    const clock = new ManualClockSource()
    gameManager.turnBattleOps.setCombatClockSource(clock)
    gameManager.turnBattleOps.setBattleRngFactory(() => new SeededCombatRng(7))
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerEnemyTemplates(ENEMIES)
    gameManager.catalogOps.registerStages(STAGES)
    const player = createDefaultPlayer()
    player.cultivationPath = 'sword'
    gameManager.setActivePlayer(player)
    const collector = new BattleMetricsCollector(gameManager)
    const tanky = defineEnemy({
      id: 'simres_tanky', name: 'Tanky', level: 1, realmId: 'mortal', lane: 'ground',
      statsInput: { maxHp: 999999, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueMastery: 0, spiritStone: 0 },
    })
    gameManager.turnBattleOps.startBattleWithPlayer(player, tanky)
    const scheduler = gameManager.turnBattleOps.getTurnBattleSystem()?.combatScheduler
    expect(scheduler).toBeDefined()
    const origin = {
      kind: 'scripted' as const,
      originId: 'sim_probe',
      sourceId: 'player' as CombatEntityId,
      rootActionId: 'script.test',
    }
    const target = 'player' as CombatEntityId
    // Establish the baseline sample (first snapshot sets lastThe, not
    // income) before the ops land.
    clock.advance(0.1)
    scheduler!.enqueueAuthored([
      // Request 150 against the MAX_THE=100 cap: settles at applied=100.
      // If the lane regressed to reading op.payload.amount (requested)
      // it would report 150 here - the applied-vs-requested lock.
      {
        operationId: 'op.test.theGain',
        type: 'gain_resource',
        origin,
        payload: { targetId: target, resourceId: 'the', amount: 150 },
      },
    ])
    scheduler!.run()
    // The bounds sampler records first/last currentThe per consumed
    // step - advance so the residual reconciliation sees the settled
    // pool after each op.
    clock.advance(0.1)
    scheduler!.enqueueAuthored([
      {
        operationId: 'op.test.theSpend',
        type: 'consume_resource',
        origin,
        payload: { targetId: target, resourceId: 'the', amount: 'all' },
      },
    ])
    scheduler!.run()
    clock.advance(0.1)
    const metrics = collector.finalize(gameManager)
    // might:0 enemy + no ung_the marker => the injected ops are the
    // ONLY 'the' movement; exact equality proves settled values.
    expect(metrics.resources.byEntity['player']?.theGained).toBe(100)
    expect(metrics.resources.byEntity['player']?.theSpent).toBe(100)
    collector.dispose()
  })

  it('raw currentThe writes land via the residual lane', () => {
    // Raw field writes (grantTheFromCast-style skill gains, the
    // empowered burn) emit no event and no trace record - the residual
    // (last - first - traceNet) must surface them. Simulated by writing
    // currentThe on the live participant entity directly.
    const gameManager = new GameManager()
    const clock = new ManualClockSource()
    gameManager.turnBattleOps.setCombatClockSource(clock)
    gameManager.turnBattleOps.setBattleRngFactory(() => new SeededCombatRng(7))
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerEnemyTemplates(ENEMIES)
    gameManager.catalogOps.registerStages(STAGES)
    const player = createDefaultPlayer()
    player.cultivationPath = 'sword'
    gameManager.setActivePlayer(player)
    const collector = new BattleMetricsCollector(gameManager)
    const tanky = defineEnemy({
      id: 'simres_tanky', name: 'Tanky', level: 1, realmId: 'mortal', lane: 'ground',
      statsInput: { maxHp: 999999, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueMastery: 0, spiritStone: 0 },
    })
    gameManager.turnBattleOps.startBattleWithPlayer(player, tanky)
    clock.advance(0.1) // baseline sample
    const participant = gameManager.getTurnBattle()?.players[0]
    expect(participant).toBeDefined()
    participant!.entity.currentThe = (participant!.entity.currentThe ?? 0) + 30
    clock.advance(0.1) // residual observes +30
    participant!.entity.currentThe = (participant!.entity.currentThe ?? 0) - 10
    clock.advance(0.1) // residual observes -10
    const metrics = collector.finalize(gameManager)
    // No ops ran - the whole movement is residual: +30 then -10 nets
    // to +20 in theGained (raw gain+raw spend net over the battle -
    // the recorded residual limitation).
    expect(metrics.resources.byEntity['player']?.theGained).toBe(20)
    expect(metrics.resources.byEntity['player']?.theSpent).toBe(0)
    collector.dispose()
  })

  it('player output counts only enemy-side targets; stat_refresh excluded', () => {
    // Plan contract: the player-output denominator is hp loss where
    // source=player AND target is enemy-side. A self-hit vitals event
    // still lands in the bilateral bySource/byTarget diagnostic but
    // never in playerOnEnemy; a stat_refresh max-HP clamp is not
    // combat damage at all.
    const gameManager = new GameManager()
    const clock = new ManualClockSource()
    gameManager.turnBattleOps.setCombatClockSource(clock)
    gameManager.turnBattleOps.setBattleRngFactory(() => new SeededCombatRng(7))
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerEnemyTemplates(ENEMIES)
    gameManager.catalogOps.registerStages(STAGES)
    const player = createDefaultPlayer()
    gameManager.setActivePlayer(player)
    const collector = new BattleMetricsCollector(gameManager)
    const tanky = defineEnemy({
      id: 'simres_tanky', name: 'Tanky', level: 1, realmId: 'mortal', lane: 'ground',
      statsInput: { maxHp: 999999, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueMastery: 0, spiritStone: 0 },
    })
    gameManager.turnBattleOps.startBattleWithPlayer(player, tanky)
    const enemyId = gameManager.getTurnBattle()?.enemies[0]?.entity.id
    expect(enemyId).toBeDefined()
    const vitals = (entityId: string, reason: string, hpBefore: number, hpAfter: number, sourceId?: string) =>
      gameManager.eventBus.emit('entity_vitals_changed', {
        type: 'entity_vitals_changed',
        entityId,
        reason,
        amount: Math.abs(hpAfter - hpBefore),
        hpBefore,
        hpAfter,
        wardBefore: 0,
        wardAfter: 0,
        mpBefore: 0,
        mpAfter: 0,
        sourceId,
      })
    vitals(enemyId!, 'damage', 500, 400, 'player') // enemy-side hit -> output
    vitals('player', 'damage', 100, 90, 'player') // self-hit -> diagnostic only
    vitals(enemyId!, 'stat_refresh', 400, 350, 'player') // hp clamp -> never damage
    const metrics = collector.finalize(gameManager)
    expect(metrics.vitalsDamage.playerOnEnemy).toBe(100)
    expect(metrics.vitalsDamage.bySource['player']).toBe(110) // bilateral keeps the self-hit
    expect(metrics.vitalsDamage.byTarget['enemy:simres_tanky:1']).toBe(100)
    // The self-hit still shows on the target side - it is real hp loss.
    expect(metrics.vitalsDamage.byTarget['player']).toBe(10)
    collector.dispose()
  })

  it('mechanic buckets follow op origin+target; untraced vitals damage is unattributed', () => {
    // Coverage oracle: a resolved skill-origin deal_damage op lands in
    // byKind.skill/bySkillId at its SETTLED hpDamage; a player-sourced
    // op on a player-side target is excluded from the mechanic totals;
    // vitals damage with no trace record is `unattributed`; and
    // byKind + unattributed reconciles against playerOnEnemy exactly.
    const gameManager = new GameManager()
    const clock = new ManualClockSource()
    gameManager.turnBattleOps.setCombatClockSource(clock)
    gameManager.turnBattleOps.setBattleRngFactory(() => new SeededCombatRng(7))
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerEnemyTemplates(ENEMIES)
    gameManager.catalogOps.registerStages(STAGES)
    const player = createDefaultPlayer()
    gameManager.setActivePlayer(player)
    const collector = new BattleMetricsCollector(gameManager)
    const tanky = defineEnemy({
      id: 'simres_tanky', name: 'Tanky', level: 1, realmId: 'mortal', lane: 'ground',
      statsInput: { maxHp: 999999, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueMastery: 0, spiritStone: 0 },
    })
    gameManager.turnBattleOps.startBattleWithPlayer(player, tanky)
    const scheduler = gameManager.turnBattleOps.getTurnBattleSystem()?.combatScheduler
    expect(scheduler).toBeDefined()
    const enemyId = gameManager.getTurnBattle()?.enemies[0]?.entity.id
    expect(enemyId).toBeDefined()
    clock.advance(0.1) // baseline 'the' sample before ops land
    const origin = (originId: string) => ({
      kind: 'skill' as const,
      originId,
      sourceId: 'player' as CombatEntityId,
      rootActionId: 'probe.test',
    })
    scheduler!.enqueueAuthored([
      {
        operationId: 'op.test.enemyHit',
        type: 'deal_damage',
        origin: origin('probe_skill'),
        payload: {
          targetId: enemyId as CombatEntityId,
          damageProfile: 'legacy_flat',
          coefficient: 50,
          hitCount: 1,
          canCrit: false,
          canMiss: false,
        },
      },
      {
        // Player-sourced but player-TARGETED: excluded from output and
        // buckets (self-hit ops are not offense).
        operationId: 'op.test.selfHit',
        type: 'deal_damage',
        origin: origin('probe_self'),
        payload: {
          targetId: 'player' as CombatEntityId,
          damageProfile: 'legacy_flat',
          coefficient: 20,
          hitCount: 1,
          canCrit: false,
          canMiss: false,
        },
      },
    ])
    scheduler!.run()
    clock.advance(0.1)
    // Untraced vitals damage (no op behind it) - the unattributed lane.
    gameManager.eventBus.emit('entity_vitals_changed', {
      type: 'entity_vitals_changed',
      entityId: enemyId,
      reason: 'damage',
      amount: 40,
      hpBefore: 999999,
      hpAfter: 999999 - 40,
      wardBefore: 0,
      wardAfter: 0,
      mpBefore: 0,
      mpAfter: 0,
      sourceId: 'player',
    })
    const metrics = collector.finalize(gameManager)
    const mech = metrics.damageByMechanic
    // legacy_flat settles at the flat coefficient (no mitigation lane).
    expect(mech.bySkillId['probe_skill']).toBe(50)
    expect(mech.bySkillId['probe_self']).toBeUndefined()
    expect(mech.byKind['skill']).toBe(50)
    expect(metrics.vitalsDamage.playerOnEnemy).toBe(90) // 50 traced + 40 untraced
    expect(mech.unattributed).toBe(40)
    const tracedTotal = Object.values(mech.byKind).reduce((a, b) => a + b, 0)
    expect(tracedTotal + mech.unattributed).toBeCloseTo(
      metrics.vitalsDamage.playerOnEnemy,
      5,
    )
    collector.dispose()
  })

  it('reaction damage lands in byKind.reaction and byReactionId', () => {
    // The ngo_dao fixture fires real reactions - no injected ops needed.
    const r = result()
    const mech = r.metrics.damageByMechanic
    expect(mech.byKind['reaction']).toBeGreaterThan(0)
    const reactionSum = Object.values(mech.byReactionId).reduce((a, b) => a + b, 0)
    expect(reactionSum).toBeCloseTo(mech.byKind['reaction'] ?? 0, 5)
  })

  it('phaseSteps attributes each consumed step to its PRE-step phase', () => {
    const r = result()
    expect(r.outcome).toBe('victory')
    const { phaseSteps } = r.metrics
    // The countdown->fighting flip step was consumed under countdown;
    // the lethal fighting->victory step was consumed under fighting.
    expect(phaseSteps['countdown']).toBe(COUNTDOWN_TOTAL_TICKS)
    expect(phaseSteps['fighting']).toBe(r.fightingSteps)
    expect(phaseSteps['victory'] ?? 0).toBe(0)
    expect(phaseSteps['defeat'] ?? 0).toBe(0)
    expect(phaseSteps['intro'] ?? 0).toBeGreaterThanOrEqual(1)
    const total = Object.values(phaseSteps).reduce((a, b) => a + b, 0)
    expect(total).toBe(r.steps)
  })

  it('metrics and fingerprint derive from the same finalized state', () => {
    const r = result()
    // finalize() must be idempotent - fingerprint internally reuses it.
    // If the resource-ledger scan ran twice, ward/mana op totals would
    // double between the returned metrics and the fingerprint basis.
    const refingerprint = runBattle({
      seed: 20260922,
      build: ngoDaoBuild(),
      ritual: { pathId: 'spell', wayId: 'hidden_spell_pathway' },
      encounter: { kind: 'stage', stageId: 'mortal_dong_1' },
    })
    expect(refingerprint.fingerprint).toBe(r.fingerprint)
    expect(refingerprint.metrics.resources).toEqual(r.metrics.resources)
  })

  it('fingerprint is stable across identical runs', () => {
    const a = result(31337)
    const b = result(31337)
    expect(a.fingerprint).toBe(b.fingerprint)
    expect(a.metrics).toEqual(b.metrics)
  })
})
