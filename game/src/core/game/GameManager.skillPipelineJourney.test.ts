import { describe, expect, it, vi } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { PHAP_TU_AN_NODES } from '../../data/progression/PhapTuAnNodes'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { CAST_LEVELING_THRESHOLDS } from '../skill/SkillSystem'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { UNROUTED_CAST_WARNING } from '../battle/turn/TurnBattleSystem'
import { defineEnemy } from '../enemy/Enemy'
import { SeededCombatRng } from '../battle/runtime/rng/SeededCombatRng'
import type { CompanionInstance } from '../../data/companion/Companions'
import type { Stage } from '../stage/Stage'

// M7.5 -- real production journeys. These tests drive the FULL production
// composition (GameManager -> beginBattleCycle -> mintCycleScheduler ->
// TurnBattleSystem with the plan runtime) on REAL authored content lifted
// through the strict Skill -> TurnSkillDefinition converter. Every cast
// therefore travels TurnSkillDefinition -> SkillDefinition -> SkillResolver
// -> SkillExecutor -> CombatScheduler -> authority adapters -- the canonical
// pipeline, not the engine-unit (runtime === undefined) test lane.
//
// Journey 1 (spell_pathway wood): doc_chuong -> trung_doc -> periodic DoT ->
// death -> victory. doc_chuong deals ZERO direct damage by authored
// contract, so every point of enemy HP loss is the buff-periodic lane --
// clean attribution of the apply -> lifecycle -> damage -> death chain.
//
// Journey 2 (ngo_dao via the real ritual): da_phap_lien_tuyen composite +
// repeatCasts, van_phap_tuy_tam composite + multicast -- one commit per
// cast (no duplicate cast count, no cooldown recommit, no phantom action).

const LING_BAO_L3 = CAST_LEVELING_THRESHOLDS.linh_bao!.lv3

const UNSUPPORTED_PATTERNS = [
  // The loud no-op report's stable machine-readable code -- the real
  // emission TurnBattleSystem.reportUnroutedCast warns with (the
  // TurnBattleSystem.skillPlan.test.ts closure-def fixture proves a
  // genuine unrouted cast emits this exact token, so an absent match
  // here is positive evidence, not a stale oracle).
  UNROUTED_CAST_WARNING,
  'did not route',
  'adapter-unsupported semantics',
  'resolves to a no-op on the plan lane',
  'unsupported authored semantics',
  'rejected by strict converter',
  'executes partially',
]

function makeManager(seed: number) {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_AN_NODES)
  gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12
  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)
  gameManager.setBattleRngFactory(() => new SeededCombatRng(seed))
  gameManager.setActivePlayer(player)
  return { gameManager, player, combatSource }
}

function makeEnemy(id: string, statsInput: Parameters<typeof defineEnemy>[0]['statsInput']) {
  return defineEnemy({
    id,
    name: id,
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput,
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

function expectNoLoudNoopWarnings(warnSpy: ReturnType<typeof vi.spyOn>) {
  const calls = warnSpy.mock.calls.map((args: unknown[]) => args.map(String).join(' '))
  for (const pattern of UNSUPPORTED_PATTERNS) {
    expect(calls.some((message: string) => message.includes(pattern))).toBe(false)
  }
}

describe('M7.5a -- production journey: authored ailment skill through the canonical pipeline', () => {
  it('doc_chuong applies trung_doc via BuffSystem, periodic ticks settle damage through the scheduler, the enemy dies and the stage reports victory', () => {
    const { gameManager, player, combatSource } = makeManager(7)

    // Real spell_pathway wood kit: basic = authored doc_chuong (0 direct
    // damage, trung_doc chance 1). No special learned -- every player
    // action is a doc_chuong cast, so ALL enemy HP loss is DoT.
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath = { element: 'wood', route: 'dot' }
    player.baseStats = {
      ...player.baseStats,
      might: 1_500,
      attunement: 1_500,
      maxMp: 10_000,
      maxHp: 200_000, // survives the full DoT ramp -- the enemy dies first
    } as typeof player.baseStats

    expect(gameManager.progressionOps.learnSkill('doc_chuong')).toBe(true)

    const enemy = makeEnemy('m75_poison_dummy', {
      maxHp: 30_000,
      might: 120, // real incoming hits -- damage settles on the player too
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
      evasionRate: 0,
    })

    gameManager.catalogOps.registerEnemyTemplates([enemy])
    const stage: Stage = {
      id: 'm75_poison_stage',
      name: 'M7.5 Poison Stage',
      description: '',
      floor: 1,
      enemyPool: [{ enemyId: enemy.id, weight: 1 }],
      totalEnemyCount: 1,
      waves: [1],
      spawnIntervalSeconds: 0,
    }
    gameManager.catalogOps.registerStages([stage])

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(gameManager.turnBattleOps.startStage(player, stage, false)).toBe(true)

    // Sample the apply moment: trung_doc must appear on the enemy through
    // the BuffSystem authority while the battle is still running.
    let sawTrungDoc = false
    let hpWhenDocSeen: number | undefined
    let playerTookDamage = false
    let battle = gameManager.getTurnBattle()

    for (let i = 0; i < 3_000; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
      const current = gameManager.getTurnBattle()
      if (current === null) {
        continue
      }
      battle = current
      if (battle.state === 'victory' || battle.state === 'defeat') {
        break
      }
      if (battle.state !== 'fighting') {
        continue
      }
      const enemyParticipant = battle.enemies[0]
      if (enemyParticipant !== undefined) {
        const buffs = gameManager.getBattleBuffs(enemyParticipant.entity.id)
        if (!sawTrungDoc && buffs.some((buff) => buff.definitionId === 'doc_can')) {
          sawTrungDoc = true
          hpWhenDocSeen = enemyParticipant.entity.currentHp
        }
      }
      if ((battle.players[0]?.entity.currentHp ?? 0) < (battle.players[0]?.entity.maxHp ?? 0)) {
        playerTookDamage = true
      }
    }

    // Battle reached a real result through the wave flow.
    expect(battle?.state).toBe('victory')

    // doc_chuong committed through the canonical cast sink (root id --
    // INV-18/20 cast identity), once per cast with no phantom casts: the
    // authored skill has no repeat/multicast, so cast count == log count.
    const docCasts = player.skillCastCounts?.['doc_chuong'] ?? 0
    expect(docCasts).toBeGreaterThan(0)
    const docLogEntries = (battle?.log ?? []).filter(
      (entry) => entry.actorId === battle?.players[0]?.id && entry.skillId === 'doc_chuong',
    )
    expect(docLogEntries.length).toBe(docCasts)

    // Buff application through the BuffSystem authority.
    expect(sawTrungDoc).toBe(true)

    // Periodic lane: doc_chuong cannot deal direct damage, so enemy HP
    // loss after the apply moment is buff-periodic damage settling
    // through CombatScheduler -> DamageSystem.
    const enemyParticipant = battle!.enemies[0]!
    expect(enemyParticipant.entity.alive).toBe(false)
    expect(enemyParticipant.entity.currentHp).toBeLessThan(hpWhenDocSeen ?? 0)

    // Incoming hits settled through DamageSystem on the player.
    expect(playerTookDamage).toBe(true)

    // No unsupported authored semantics were hit -- nothing silently
    // dropped, nothing fell back off the canonical lane.
    expectNoLoudNoopWarnings(warnSpy)
    warnSpy.mockRestore()
  })
})

describe('M7.5b -- production journey: An kit repeat + multicast with exactly-once commit', () => {
  it('the real ritual-granted kit fires repeat/multicast executions that share one cast commit -- no duplicate cast, cooldown, or phantom action', () => {
    const { gameManager, player, combatSource } = makeManager(11)

    // The REAL ritual path -- grants van_phap_tuy_tam (composite +
    // multicast via the innate dao passive) and da_phap_lien_tuyen
    // (composite + repeatCasts) as authored, converted content.
    player.skillCastCounts = { linh_bao: LING_BAO_L3 }
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'hidden_spell_pathway', player)).toBe(true)

    const enemy = makeEnemy('m75_an_dummy', {
      maxHp: 5_000_000, // survives the whole window -- we want many casts
      might: 0,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
      evasionRate: 0,
    })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    gameManager.startBattleWithPlayer(player, enemy)

    const battle = gameManager.getTurnBattle()!
    const playerId = battle.players[0]!.id
    const specialSlot = battle.players[0]!.special!
    expect(specialSlot.skill.id).toBe('da_phap_lien_tuyen')
    expect(battle.players[0]!.basic?.id).toBe('van_phap_tuy_tam')
    // The ritual resolution stamped the real fields (production adapter
    // chain -- not a test-authored def).
    expect(specialSlot.skill.repeatCasts).toBe(2)
    expect(battle.players[0]!.basic?.multicast?.chance).toBeGreaterThan(0)

    // Per-tick observation: cooldown samples + cast counts.
    let prevSpecialCasts = player.skillCastCounts?.['da_phap_lien_tuyen'] ?? 0
    let prevCooldown = specialSlot.remainingCooldownTurns
    const cooldownRecommits: number[] = []

    for (let i = 0; i < 1_500; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
      const current = gameManager.getTurnBattle()
      if (current === null) {
        continue
      }
      if (current.state === 'victory' || current.state === 'defeat') {
        break
      }
      if (current.state !== 'fighting') {
        continue
      }
      const specialCasts = player.skillCastCounts?.['da_phap_lien_tuyen'] ?? 0
      const cooldown = current.players[0]!.special!.remainingCooldownTurns

      if (specialCasts === prevSpecialCasts && prevCooldown !== undefined && cooldown !== undefined) {
        // Between casts the committed cooldown may only tick down -- a
        // recommit (repeat/multicast repaying the slot) shows as an
        // increase with no new cast.
        if (cooldown > prevCooldown) {
          cooldownRecommits.push(i)
        }
      }
      prevSpecialCasts = specialCasts
      prevCooldown = cooldown

      const basicCasts = player.skillCastCounts?.['van_phap_tuy_tam'] ?? 0
      if (specialCasts >= 3 && basicCasts >= 20) {
        break
      }
    }

    const finalBattle = gameManager.getTurnBattle()!
    const log = (finalBattle.log ?? []).filter((entry) => entry.actorId === playerId)

    const specialCasts = player.skillCastCounts?.['da_phap_lien_tuyen'] ?? 0
    const basicCasts = player.skillCastCounts?.['van_phap_tuy_tam'] ?? 0
    expect(specialCasts).toBeGreaterThanOrEqual(1)
    expect(basicCasts).toBeGreaterThanOrEqual(1)

    // Repeat: every da_phap_lien_tuyen cast produced exactly
    // 1 + repeatCasts executions, each logged under the ROOT id -- and the
    // three executions of one cast are consecutive (queued executions
    // drain before any other actor's turn).
    const specialEntries = log.filter((entry) => entry.skillId === 'da_phap_lien_tuyen')
    expect(specialEntries.length).toBe(3 * specialCasts)
    const specialIndices = log
      .map((entry, index) => (entry.skillId === 'da_phap_lien_tuyen' ? index : -1))
      .filter((index) => index >= 0)
    for (let cast = 0; cast < specialCasts; cast++) {
      const run = specialIndices.slice(cast * 3, cast * 3 + 3)
      expect(run).toEqual([run[0], run[0]! + 1, run[0]! + 2])
    }

    // Multicast: the basic's executions outnumber its casts -- extra
    // executions chained off the multicast roll under the same root id.
    const basicEntries = log.filter((entry) => entry.skillId === 'van_phap_tuy_tam')
    expect(basicEntries.length).toBeGreaterThan(basicCasts)

    // Exactly-once commitment:
    // - cast sink fired once per cast (counts above, not per execution)
    // - cooldown committed once per cast and never re-bumped between casts
    expect(cooldownRecommits).toEqual([])
    // - resource cost: the authored special is resourceType 'none', so
    //   the conserved quantity here is the cooldown + cast identity;
    //   composite/repeat extras never produced phantom casts.
    expect(player.skillCastCounts?.['da_phap_lien_tuyen']).toBe(specialCasts)

    // The picked payloads resolved -- real damage reached the enemy
    // through the pipeline.
    const enemyEntity = finalBattle.enemies[0]!.entity
    expect(enemyEntity.currentHp).toBeLessThan(enemyEntity.maxHp)

    expectNoLoudNoopWarnings(warnSpy)
    warnSpy.mockRestore()
  })
})

describe('M7.5b -- production journey: authored charge skill (van_du_kiem_khach ultimate)', () => {
  it('chargeTurns: 2 initiates once, defers the resolve across charging turns, and the resolving hit lands without recommit', () => {
    const { gameManager, player, combatSource } = makeManager(13)

    // Real companion kit -- Van Du Kiem Khach's ultimate is authored with
    // chargeTurns: 2 (Tuyet Kiem Nhat Thu). The instance must sit at the
    // authored ultimate unlock realm for the slot to resolve.
    const instance: CompanionInstance = {
      instanceId: 'm75_kiem_khach',
      definitionId: 'van_du_kiem_khach',
      realmId: 'foundation_establishment',
      realmLevel: 1,
      exp: 0,
      constellationRank: 0,
    }
    player.formationLoadout = {
      formationId: 'm75_formation',
      assignments: [
        { row: 0, column: 0, combatantId: 'player' },
        { row: 1, column: 1, combatantId: 'van_du_kiem_khach' },
      ],
    }
    player.companions = [instance]

    const enemy = makeEnemy('m75_charge_dummy', {
      maxHp: 5_000_000,
      might: 0,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
      evasionRate: 0,
    })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    gameManager.startBattleWithPlayer(player, enemy)

    const companion = gameManager
      .getTurnBattle()!
      .players.find((participant) => participant.id === 'van_du_kiem_khach')!
    expect(companion.ultimate?.skill.id).toBe('van_du_kiem_khach_ultimate')
    expect(companion.ultimate?.skill.chargeTurns).toBe(2)

    // Per-tick: observe the charge lifecycle on the real participant.
    // Each sample is one companion-relevant tick: the companion's charge
    // state plus the skill ids it logged that tick.
    interface CompanionTick {
      charging: number | undefined
      pending: string | undefined
      skillIds: string[]
      ultCooldown: number | undefined
      enemyHp: number
    }
    const ticks: CompanionTick[] = []
    let cursor = 0
    let normalTurnsAfterResolve = 0

    for (let i = 0; i < 600; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
      const battle = gameManager.getTurnBattle()
      if (battle === null || battle.state !== 'fighting') {
        continue
      }
      const current = battle.players.find((participant) => participant.id === 'van_du_kiem_khach')!
      const log = battle.log ?? []
      const mine = log
        .slice(cursor)
        .filter((entry) => entry.actorId === 'van_du_kiem_khach')
        .map((entry) => entry.skillId)
      cursor = log.length

      const resolved = ticks.some((tick) => tick.pending === 'van_du_kiem_khach_ultimate')
      if (resolved && mine.every((id) => id !== 'van_du_kiem_khach_ultimate')) {
        normalTurnsAfterResolve += mine.length
      }

      ticks.push({
        charging: current.chargingTurnsRemaining,
        pending: current.pendingChargedSkillId,
        skillIds: mine,
        ultCooldown: current.ultimate?.remainingCooldownTurns,
        enemyHp: battle.enemies[0]!.entity.currentHp,
      })

      if (resolved && normalTurnsAfterResolve >= 2) {
        break
      }
    }

    // Charge init: the authored 2-turn charge committed the cooldown once
    // and deferred the payload -- chargingTurnsRemaining counts down 2 -> 1
    // across the companion's own charging turns, then the resolve clears
    // it. (charging persists on the participant between turns, so only
    // ticks where the companion itself logged an entry are actor turns.)
    const actorTicks = ticks.filter((tick) => tick.skillIds.length > 0)
    const chargingSeq = actorTicks
      .filter((tick) => tick.charging !== undefined)
      .map((tick) => tick.charging)
    expect(chargingSeq).toEqual([2, 1])
    const initTick = ticks.find((tick) => tick.charging === 2)!
    expect(initTick.pending).toBe('van_du_kiem_khach_ultimate')
    expect(initTick.ultCooldown).toBe(companion.ultimate!.skill.cooldownTurns)

    // No phantom actions: every companion turn inside the charge window is
    // the pending ultimate -- no basic/special slipped in mid-charge.
    const chargeWindow = ticks.filter(
      (tick) => tick.charging !== undefined || tick.pending === 'van_du_kiem_khach_ultimate',
    )
    expect(chargeWindow.length).toBeGreaterThan(0)
    for (const tick of chargeWindow) {
      for (const skillId of tick.skillIds) {
        expect(skillId).toBe('van_du_kiem_khach_ultimate')
      }
    }

    // The deferred resolve landed the authored hit -- and it did NOT
    // re-initiate a cast: a recommit would be a fresh charge-init and
    // charging would jump back to 2 instead of clearing.
    const resolveIndex = ticks.findIndex(
      (tick, index) =>
        index > 0 &&
        ticks[index - 1]!.pending === 'van_du_kiem_khach_ultimate' &&
        tick.pending === undefined,
    )
    expect(resolveIndex).toBeGreaterThan(0)
    const resolveTick = ticks[resolveIndex]!
    expect(resolveTick.charging).toBeUndefined()
    expect(resolveTick.skillIds).toContain('van_du_kiem_khach_ultimate')
    expect(ticks[resolveIndex - 1]!.enemyHp - resolveTick.enemyHp).toBeGreaterThan(0)

    // Normal actions resumed after the resolve -- the battle didn't freeze
    // on the cleared charge state.
    expect(normalTurnsAfterResolve).toBeGreaterThanOrEqual(2)

    expectNoLoudNoopWarnings(warnSpy)
    warnSpy.mockRestore()
  })
})
