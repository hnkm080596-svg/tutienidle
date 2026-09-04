import { describe, expect, it } from 'vitest'
import {
  buildTurnSkillPresentation,
  type TurnSkillPresentationInput,
} from './CombatSkillPresentation'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'

// Slice 7 (Completion Task 10) — deriveState() turn-based: union mới
// 'ready' | 'not_your_turn' | 'cooldown' | 'blocked_resource' | 'locked' | 'empty'
// (bỏ cadence/casting/out_of_range — real-time concepts). Cooldown hiển thị
// theo LƯỢT (remainingCooldownTurns), không phải giây.

function mkEntity(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), attack: 10 }

  return {
    id: 'p', name: 'p', type: 'player', baseStats: stats, stats,
    currentHp: 100, maxHp: 100, currentMp: 50, maxMp: 50,
    currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
    currentWard: 0, timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 4, alive: true,
    ...overrides,
  } as CombatEntity
}

function skill(id: string, opts: Partial<TurnSkillDefinition> = {}): TurnSkillDefinition {
  return {
    id,
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
    ...opts,
  }
}

function input(overrides: Partial<TurnSkillPresentationInput> = {}): TurnSkillPresentationInput {
  return {
    entity: mkEntity(),
    basic: skill('basic'),
    special: skill('special', { cooldownTurns: 4, resourceType: 'mana', resourceCost: 10 }),
    ultimate: skill('ultimate', { cooldownTurns: 6, resourceType: 'mana', resourceCost: 30 }),
    specialRemainingCooldownTurns: 0,
    ultimateRemainingCooldownTurns: 0,
    isPlayersPausedTurn: false,
    ...overrides,
  }
}

describe('buildTurnSkillPresentation — turn-based states', () => {
  it('không phải lượt player paused → mọi slot usable là not_your_turn', () => {
    const entries = buildTurnSkillPresentation(input())

    expect(entries.map((e) => e.state)).toEqual([
      'not_your_turn',
      'not_your_turn',
      'not_your_turn',
    ])
  })

  it('đúng lượt paused + basic luôn ready (no cooldown/cost)', () => {
    const entries = buildTurnSkillPresentation(input({ isPlayersPausedTurn: true }))

    expect(entries[0]!.state).toBe('ready')
  })

  it('đúng lượt + special trên cooldown → cooldown với remainingTurns/totalTurns', () => {
    const entries = buildTurnSkillPresentation(
      input({ isPlayersPausedTurn: true, specialRemainingCooldownTurns: 2 }),
    )

    expect(entries[1]!.state).toBe('cooldown')
    expect(entries[1]!.cooldownRemaining).toBe(2)
    expect(entries[1]!.cooldownTotal).toBe(4)
  })

  it('đúng lượt + đủ cooldown nhưng không đủ resource → blocked_resource', () => {
    const entity = mkEntity()
    entity.currentMp = 5

    const entries = buildTurnSkillPresentation(
      input({ entity, isPlayersPausedTurn: true }),
    )

    expect(entries[1]!.state).toBe('blocked_resource')
    expect(entries[2]!.state).toBe('blocked_resource')
  })

  it('slot chưa gán skill → empty; locked giữ nguyên ngữ nghĩa', () => {
    const entries = buildTurnSkillPresentation(
      input({ special: undefined, ultimate: undefined, isPlayersPausedTurn: true }),
    )

    expect(entries[1]!.state).toBe('empty')
    expect(entries[2]!.state).toBe('empty')
  })

  it('map 3 slot theo đúng vai trò basic/special/ultimate', () => {
    const entries = buildTurnSkillPresentation(input({ isPlayersPausedTurn: true }))

    expect(entries.map((e) => e.role)).toEqual(['basic', 'special', 'ultimate'])
    expect(entries.map((e) => e.skillId)).toEqual(['basic', 'special', 'ultimate'])
  })
})
