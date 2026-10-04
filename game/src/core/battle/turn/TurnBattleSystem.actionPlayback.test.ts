import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'

// Action Playback Task 3 - equivalence tests cho split
// resolveActorTurn() -> declareActorAction() / applyActionImpact() /
// completeAction(). Moi test pin hanh vi PHAI GIU NGUYEN cua wrapper cu.

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })

  const entity = {
    id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentWard: 0, turnsSinceLastHitLanded: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
  } as CombatEntity

  // ARCH-002 (M7 R1): refreshParticipantStats re-derives entity.stats from
  // baseStats and reconciles entity.maxHp from stats.maxHp - mirror an
  // injected stats override into the base and carry the declared vitals
  // ceiling into both views or the first refresh reverts/clamps it.
  entity.baseStats = (overrides.baseStats ?? overrides.stats ?? entity.baseStats) as CombatEntity['baseStats']
  const ceiling = Math.max(entity.maxHp, entity.currentHp)
  if (entity.stats.maxHp !== ceiling) {
    entity.stats = { ...entity.stats, maxHp: ceiling }
    entity.baseStats = asBaseStats({ ...entity.baseStats, maxHp: ceiling })
  }
  return entity
}

function makeParticipant(
  id: string,
  entity: CombatEntity,
  speed: number,
  priority: number,
): TurnBattleParticipant {
  return {
    id, entity, speed, priority, actionGauge: 0, alive: entity.alive,
    consecutiveHardCcTurns: 0,
    basic: { id: `${id}_basic`, cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } },
  }
}

function battleFixture() {
  const player = createCombatant({
    id: 'player',
    type: 'player',
    row: 4,
    stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, might: 999 }),
  })
  const enemyEntity = createCombatant({
    id: 'enemy',
    currentHp: 1_000_000,
    maxHp: 1_000_000,
    stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, might: 0 }),
  })

  const battle: TurnBattle = {
    players: [makeParticipant('player', player, 100, 0)],
    enemies: [makeParticipant('enemy', enemyEntity, 100, 1)],
    state: 'fighting',
  }

  return { battle, enemyEntity }
}

describe('TurnBattleSystem — declareActorAction/applyActionImpact/completeAction split', () => {
  it('declareActorAction resolve action/targets nhưng KHÔNG gây damage (HP target unchanged)', () => {
    const { battle, enemyEntity } = battleFixture()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    const actor = system.dequeueNextActorForClaim(battle)

    expect(actor).not.toBeNull()

    const declared = system.declareActorAction(battle, actor!)

    expect(declared.skillId).toBe('player_basic')
    expect(enemyEntity.currentHp).toBe(1_000_000)
  })

  it('applyActionImpact áp đúng damage của declared action', () => {
    const { battle, enemyEntity } = battleFixture()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    const actor = system.dequeueNextActorForClaim(battle)!
    const declared = system.declareActorAction(battle, actor)

    const hpBefore = enemyEntity.currentHp

    const { targetIds } = system.applyActionImpact(battle, declared)

    expect(targetIds).toEqual(['enemy'])
    expect(enemyEntity.currentHp).toBeLessThan(hpBefore)
  })

  it('completeAction chạy gauge consume + battle log + turn counter', () => {
    const { battle } = battleFixture()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    const actor = system.dequeueNextActorForClaim(battle)!
    const declared = system.declareActorAction(battle, actor)
    const { targetIds } = system.applyActionImpact(battle, declared)

    const result = system.completeAction(battle, actor, declared, targetIds)

    expect(result.state).toBe('fighting')
    expect(result.skillId).toBe('player_basic')
    expect(battle.totalTurnsElapsed).toBe(1)
    expect(battle.log).toHaveLength(1)
    expect(battle.log![0]!.actorId).toBe('player')
    expect(actor.actionGauge).toBeLessThan(1000)
  })

  it('resolveActorTurn wrapper vẫn byte-identical (basic attack victory flow)', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      row: 4,
      stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, might: 999 }),
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1,
      maxHp: 1,
      stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, might: 0 }),
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 100, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 100, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const step = system.resolveNextStep(battle)

    expect(step.state).toBe('victory')
    expect(step.actorId).toBe('player')
    expect(step.targetIds).toEqual(['enemy'])
    expect(battle.totalTurnsElapsed).toBe(1)
  })
})

// --- Remediation Task 7: playback edge-case regression (system level) ---

describe('TurnBattleSystem — playback edge cases (Remediation Task 7)', () => {
  it('applyActionImpact trên target ĐÃ CHẾT (giữa impact và complete) → target KHÔNG trong landedTargetIds', () => {
    const { battle, enemyEntity } = battleFixture()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    const actor = system.dequeueNextActorForClaim(battle)!
    const declared = system.declareActorAction(battle, actor)

    // Target chet NGAY TRUOC impact (vi du DoT/respawn giua chung).
    enemyEntity.currentHp = 0
    enemyEntity.alive = false

    const { targetIds } = system.applyActionImpact(battle, declared)

    expect(targetIds).not.toContain('enemy')
  })

  it('miss/dodge: rollHit fail → target vẫn commit turn (dodge là DamageResult 0 damage), battle không kẹt', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      row: 4,
      stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, might: 999 }),
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: createBaseStats({ evasionRate: 1, dexterity: 0, criticalRate: 0, speed: 100, might: 0 }),
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 100, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 100, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const actor = system.dequeueNextActorForClaim(battle)!
    const declared = system.declareActorAction(battle, actor)

    // Miss deterministic: de rollHit qua prototype cua CombatSystem -
    // private method nhung runtime JS khong khoa; truy cap qua prototype
    // instance lay tu constructor moi tuong duong (cung class).
    const probe = new CombatSystem(new EventBus())
    const proto = Object.getPrototypeOf(probe) as unknown as Record<string, unknown>
    const originalRollHit = proto.rollHit as ((source: unknown, target: unknown) => boolean) | undefined
    let hitRolled = false
    proto.rollHit = () => {
      hitRolled = true

      return false // miss
    }

    try {
      const hpBefore = enemyEntity.currentHp
      const { targetIds } = system.applyActionImpact(battle, declared)
      const result = system.completeAction(battle, actor, declared, targetIds)

      expect(hitRolled).toBe(true) // rollHit that su duoc goi - mock dung cho

      // Miss -> 0 damage nhung battle van tien hanh (turn elapsed, state
      // fighting - playback khong ket vi mot don miss).
      expect(enemyEntity.currentHp).toBe(hpBefore)
      expect(result.state).toBe('fighting')
      expect(battle.totalTurnsElapsed).toBe(1)
    } finally {
      if (originalRollHit) {
        proto.rollHit = originalRollHit
      }
    }
  })

  it('completeAction với declared/actor KHÔNG tồn tại trong battle → không crash (defensive)', () => {
    const { battle } = battleFixture()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    const actor = system.dequeueNextActorForClaim(battle)!
    const declared = system.declareActorAction(battle, actor)
    const { targetIds } = system.applyActionImpact(battle, declared)

    // Battle reset giua chung (stage restart) - log/turns reset ve 0.
    battle.totalTurnsElapsed = 0
    battle.log = []

    expect(() => system.completeAction(battle, actor, declared, targetIds)).not.toThrow()
  })
})
