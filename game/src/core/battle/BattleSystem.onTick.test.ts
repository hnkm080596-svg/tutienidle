import { describe, expect, it } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { AilmentRegistry } from '../ailment/AilmentRegistry'
import { EventBus } from '../events/EventBus'
import { ActionImpactSystem } from './ActionImpactSystem'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

// Task 11 (spec 2026-08-31, Phase 2A) — wires an explicit `onTick` firing
// into resolveChannelTick(), SEPARATE from the onCast firing that already
// happens unconditionally inside resolveSkillEffects() (Phase 1). Harness
// copied verbatim from BattleSystem.reactiveTriggers.test.ts; the channel
// start mechanism (route: 'bat_kiem' + equipped channel skill in the
// loadout, THEN system.start()) is copied from
// BattleSystem.kiemTuResources.test.ts's `route: 'bat_kiem'` tests — that
// is the only real way to make BattleSystem.initChannelState() (called
// from start()) set channelSkillId/tuLucActive; there is no public setter
// for the private channelSkillId field.

function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = { ...createBaseStats(), attack: 0, defense: 0, evasionRate: 0, criticalRate: 0, blockChance: 0, dexterity: 0, attackRange: 0, attackSpeed: 0, movementSpeed: 0 }
  return {
    id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentSwordIntent: 0, currentKiemThe: 0, currentKiemYTemp: 0, currentMomentum: 0,
    currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0, timeSinceLastBleedProc: 0,
    tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0, currentWard: 0,
    timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
  }
}

function makeChannelSkill(): Skill {
  return {
    id: 'test_channel_skill', name: 'Test Channel', description: '', type: 'active',
    level: 1, maxLevel: 1, cooldown: 0, remainingCooldown: 0, cost: 0, target: 'all_enemies',
    effects: [], triggers: [{ trigger: 'onTick', actions: [{ type: 'grantResource', pool: 'kimThe', amount: 1 }] }],
    execution: { kind: 'channel', tickSeconds: 3 },
    // getLoadoutEntries() (SkillManager.ts) only picks up skills that are
    // `equipped` AND have a loadoutSlot/loadoutSlots — without these,
    // initChannelState() never finds this skill and tuLucActive stays
    // false (confirmed by reading SkillManager.getLoadoutEntries()).
    loadoutSlot: 0, loadoutSlots: [0], resourceType: 'none',
    unlocked: true, equipped: true,
  }
}

function setup() {
  const eventBus = new EventBus()
  const skillManager = new SkillManager()
  const skillSystem = new SkillSystem(skillManager)
  const system = new BattleSystem(
    new CombatSystem(eventBus), skillManager, skillSystem, new SkillEffectSystem(),
    new BuffRegistry(), new AilmentRegistry(), eventBus,
    new ActionImpactSystem({ eventBus, rollCritical: () => false }),
    undefined, undefined, undefined,
    // getKiemTuRoute must return 'bat_kiem' — initChannelState() gates
    // channelSkillId/tuLucActive on this route (BattleSystem.ts's
    // initChannelState(), verified by reading it).
    () => 'bat_kiem', () => 0, () => 0,
  )
  return { system, skillManager, eventBus }
}

describe('BattleSystem — onTick trigger wiring', () => {
  it('a channel skill with an onTick-bound action runs it once per tick', () => {
    const { system, skillManager } = setup()
    const skill = makeChannelSkill()
    skillManager.add(skill)

    const player: CombatEntity = { ...createCombatant({ id: 'player', type: 'player' }) }
    const enemy = createCombatant({ id: 'enemy' })
    enemy.stats.maxHp = 100000
    enemy.maxHp = 100000
    enemy.currentHp = 100000

    // start() → initChannelState() sets channelSkillId/tuLucActive from
    // the equipped channel skill above + the 'bat_kiem' route — this is
    // the real, public way a channel begins (no private-field poking).
    system.start(player, enemy)
    system.flushPendingSpawns()

    expect(player.tuLucActive).toBe(true)

    // update()'s 'countdown' branch returns EARLY once it flips battle.state
    // to 'fighting' (BattleSystem.ts's update(), read in full) — a single
    // big update(8) would only drain the countdown and return without ever
    // reaching updateChanneling() in the same call. Two separate update()
    // calls (countdown, then the channel tick) is the real pattern used by
    // BattleSystem.kiemTuResources.test.ts's `tick(3); tick(3)` for the
    // exact same 'route BK: mỗi channel tick' scenario.
    system.update(3) // drains BATTLE_COUNTDOWN_SECONDS, flips to 'fighting'
    system.update(3) // one full channel tick (tickSeconds: 3)

    expect(player.currentKimThe).toBeGreaterThan(0)
  })
})
