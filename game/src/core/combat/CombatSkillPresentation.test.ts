import { describe, expect, it } from 'vitest'
import { buildTurnSkillPresentation, type TurnSkillPresentationEntry } from './CombatSkillPresentation'
import type { TurnBattle, TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import { TurnBuffPool } from '../battle/turn/TurnBuffPool'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'

// Slice 7 plan Task 4 — rewrite CombatSkillPresentation against the REAL
// TurnBattle shape (the old real-time implementation was dead code since
// the Slice 6 cutover: it read fields that never existed on
// TurnBattleParticipant and drove the 6 pre-existing test failures).

function entity(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, criticalRate: 0 }

  return {
    id: 'p', name: 'p', type: 'player', baseStats: stats, stats,
    currentHp: 100, maxHp: 100, currentMp: 50, maxMp: 50,
    currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
    currentWard: 0, timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 4, alive: true,
    ...overrides,
  } as CombatEntity
}

function battle(overrides: {
  basicCooldown?: number
  specialCooldown?: number
  ultimateCooldown?: number
  mp?: number
  noUltimate?: boolean
  noBasic?: boolean
} = {}): TurnBattle {
  const playerEntity = entity({ currentMp: overrides.mp ?? 50 })

  const player: TurnBattleParticipant = {
    id: 'player',
    entity: playerEntity,
    speed: 100,
    priority: 0,
    actionGauge: 0,
    alive: true,
    buffs: new TurnBuffPool(),
    consecutiveHardCcTurns: 0,
  }

  if (!overrides.noBasic) {
    player.basic = {
      id: 'fixture_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    }
  }

  player.special = {
    skill: {
      id: 'fixture_special',
      cooldownTurns: 4,
      resourceType: 'mana',
      resourceCost: 10,
      damage: { kind: 'physical', multiplier: 2 },
      targeting: { shape: 'single' },
    },
    remainingCooldownTurns: overrides.specialCooldown ?? 0,
  }

  if (!overrides.noUltimate) {
    player.ultimate = {
      skill: {
        id: 'fixture_ultimate',
        cooldownTurns: 6,
        resourceType: 'mana',
        resourceCost: 30,
        damage: { kind: 'physical', multiplier: 5 },
        targeting: { shape: 'single' },
      },
      remainingCooldownTurns: overrides.ultimateCooldown ?? 0,
    }
  }

  return {
    players: [player],
    enemies: [],
    state: 'fighting',
  }
}

describe('buildTurnSkillPresentation (Slice 7 Task 4)', () => {
  it('basic luôn ready khi là lượt player paused (no cooldown/resource)', () => {
    const result = buildTurnSkillPresentation(battle(), true)

    expect(result.basic.state).toBe('ready')
  })

  it('special/ultimate báo cooldown với remainingCooldownTurns là số LƯỢT nguyên, không phải giây', () => {
    const result = buildTurnSkillPresentation(
      battle({ specialCooldown: 3, ultimateCooldown: 5 }),
      true,
    )

    expect(result.special.state).toBe('cooldown')
    expect(result.special.cooldownRemaining).toBe(3)
    expect(result.ultimate.state).toBe('cooldown')
    expect(result.ultimate.cooldownRemaining).toBe(5)
  })

  it('special/ultimate báo blocked_resource khi không đủ resource', () => {
    const result = buildTurnSkillPresentation(battle({ mp: 5 }), true)

    expect(result.special.state).toBe('blocked_resource')
    expect(result.ultimate.state).toBe('blocked_resource')
  })

  it('slot participant không có → empty', () => {
    const result = buildTurnSkillPresentation(battle({ noUltimate: true }), true)

    expect(result.ultimate.state).toBe('empty')
    expect(result.ultimate.skillId).toBe('')
  })

  it('không có basic slot nào → empty', () => {
    const result = buildTurnSkillPresentation(battle({ noBasic: true }), true)

    expect(result.basic.state).toBe('empty')
  })

  it('mọi slot usable báo not_your_turn khi KHÔNG phải lượt player paused', () => {
    const result = buildTurnSkillPresentation(battle(), false)

    expect(result.basic.state).toBe('not_your_turn')
    expect(result.special.state).toBe('not_your_turn')
    expect(result.ultimate.state).toBe('not_your_turn')
  })

  it('cooldown vẫn hiển thị khi not your turn (state ưu tiên cooldown, không sẵn sàng)', () => {
    const result = buildTurnSkillPresentation(battle({ specialCooldown: 2 }), false)

    expect(result.special.state).toBe('not_your_turn')
    expect(result.special.cooldownRemaining).toBe(2)
  })
})
