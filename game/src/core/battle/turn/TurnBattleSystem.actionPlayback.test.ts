import { describe, expect, it, vi } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import type { CombatVfxPresetId } from '../CombatAction'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { TurnBuffPool } from './TurnBuffPool'

// Action Playback Task 3 — equivalence tests cho split
// resolveActorTurn() → declareActorAction() / applyActionImpact() /
// completeAction(). Mọi test pin hành vi PHẢI GIỮ NGUYÊN của wrapper cũ.

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0 }

  return {
    id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
    currentWard: 0, timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
  } as CombatEntity
}

function makeParticipant(
  id: string,
  entity: CombatEntity,
  speed: number,
  priority: number,
): TurnBattleParticipant {
  return {
    id, entity, speed, priority, actionGauge: 0, alive: entity.alive,
    buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0,
    basic: { id: `${id}_basic`, cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } },
  }
}

function battleFixture() {
  const player = createCombatant({
    id: 'player',
    type: 'player',
    row: 4,
    stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, attack: 999 },
  })
  const enemyEntity = createCombatant({
    id: 'enemy',
    currentHp: 1_000_000,
    maxHp: 1_000_000,
    stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, attack: 0 },
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

    const actor = system.peekNextActor(battle)

    expect(actor).not.toBeNull()

    const declared = system.declareActorAction(battle, actor!)

    expect(declared.skillId).toBe('player_basic')
    expect(enemyEntity.currentHp).toBe(1_000_000)
  })

  it('applyActionImpact áp đúng damage của declared action', () => {
    const { battle, enemyEntity } = battleFixture()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    const actor = system.peekNextActor(battle)!
    const declared = system.declareActorAction(battle, actor)

    const hpBefore = enemyEntity.currentHp

    const { targetIds } = system.applyActionImpact(battle, declared)

    expect(targetIds).toEqual(['enemy'])
    expect(enemyEntity.currentHp).toBeLessThan(hpBefore)
  })

  it('completeAction chạy gauge consume + battle log + turn counter', () => {
    const { battle } = battleFixture()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    const actor = system.peekNextActor(battle)!
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
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1,
      maxHp: 1,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, attack: 0 },
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

    const actor = system.peekNextActor(battle)!
    const declared = system.declareActorAction(battle, actor)

    // Target chết NGAY TRƯỚC impact (ví dụ DoT/respawn giữa chừng).
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
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, attack: 999 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 1, dexterity: 0, criticalRate: 0, speed: 100, attack: 0 },
    })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 100, 0)],
      enemies: [makeParticipant('enemy', enemyEntity, 100, 1)],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const actor = system.peekNextActor(battle)!
    const declared = system.declareActorAction(battle, actor)

    // Miss deterministic: đè rollHit qua prototype của CombatSystem —
    // private method nhưng runtime JS không khóa; truy cập qua prototype
    // instance lấy từ constructor mới tương đương (cùng class).
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

      expect(hitRolled).toBe(true) // rollHit thật sự được gọi — mock đúng chỗ

      // Miss → 0 damage nhưng battle vẫn tiến hành (turn elapsed, state
      // fighting — playback không kẹt vì một đòn miss).
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

    const actor = system.peekNextActor(battle)!
    const declared = system.declareActorAction(battle, actor)
    const { targetIds } = system.applyActionImpact(battle, declared)

    // Battle reset giữa chừng (stage restart) — log/turns reset về 0.
    battle.totalTurnsElapsed = 0
    battle.log = []

    expect(() => system.completeAction(battle, actor, declared, targetIds)).not.toThrow()
  })
})
