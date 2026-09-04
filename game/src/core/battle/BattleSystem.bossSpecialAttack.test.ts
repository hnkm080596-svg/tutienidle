import { describe, expect, it } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { EventBus } from '../events/EventBus'
import { ActionImpactSystem } from './ActionImpactSystem'
import { createBaseStats } from '../stats/StatBlock'
import { HERO_LANE_INDEX } from './BattleLane'
import type { CombatEntity } from '../combat/CombatEntity'
import type { EnemySpecialAttack } from '../enemy/Enemy'

// Combat Balance Pass (2026-08-29) — Task 6 (plan §3.6): boss khai báo
// action đặc biệt data-driven thay basic attack cứng. Mỗi attack MỚI thứ
// everyNth dùng damageMultiplier/presetId riêng (qua pipeline damage
// thường), đếm attack runtime trên battleEnemy.
function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = {
    ...createBaseStats(),
    attack: 50,
    evasionRate: 0,
    dexterity: 0,
    speed: 5,
    attackRange: 16,
  }

  return {
    id: 'id',
    name: 'name',
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    timeSinceLastHitTaken: Infinity,
    currentWard: 0,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  }
}

const BOSS_SPECIAL: EnemySpecialAttack = { everyNth: 3, damageMultiplier: 3, presetId: 'boss_ground_slam' }

function setup(hasSpecial: boolean) {
  const eventBus = new EventBus()
  const skillManager = new SkillManager()
  const skillSystem = new SkillSystem(skillManager)
  const system = new BattleSystem(
    new CombatSystem(eventBus),
    skillManager,
    skillSystem,
    new SkillEffectSystem(),
    new BuffRegistry(),
    eventBus,
    new ActionImpactSystem({ eventBus, rollCritical: () => false }),
  )

  const impacts: { actionId?: string; presetId?: string }[] = []

  eventBus.on('action_impact', (event: { actionId?: string; presetId?: string }) =>
    impacts.push(event),
  )

  const player = createCombatant({ id: 'player', type: 'player', currentHp: 10000000, maxHp: 10000000 })
  const boss = createCombatant({ id: 'boss', currentHp: 1000000, maxHp: 1000000 })

  if (hasSpecial) {
    boss.specialAttacks = [BOSS_SPECIAL]
  }

  system.start(player, boss)
  system.update(3)
  boss.x = 2
  boss.row = HERO_LANE_INDEX

  return { system, impacts, player, boss }
}

describe('BattleSystem — boss special attack (Task 6, plan §3.6)', () => {
  it('mỗi attack thứ 3 dùng special preset thay vì basic', () => {
    const { system, impacts } = setup(true)

    // attackSpeed 5 → attackInterval ngắn; tick nhiều lần để boss đánh.
    // Đếm qua action_impact: actionId 'boss:special' mỗi 3 đòn.
    for (let i = 0; i < 60; i++) {
      system.update(0.1)
    }

    const specials = impacts.filter(impact => impact.actionId === 'boss:special')
    const basics = impacts.filter(impact => impact.actionId === 'boss:basic')

    expect(specials.length).toBeGreaterThan(0)
    expect(basics.length).toBeGreaterThan(0)

    // Mọi special đều dùng preset đặc biệt.
    for (const special of specials) {
      expect(special.presetId).toBe('boss_ground_slam')
    }

    // Với everyNth=3: special ≈ 1/3 tổng đòn (tick đủ dài để không
    // lệch do đếm — assert tương đối lỏng: special < basics).
    expect(specials.length).toBeLessThan(basics.length)
  })

  it('quái KHÔNG có specialAttack — chỉ basic (không regression)', () => {
    const { system, impacts } = setup(false)

    for (let i = 0; i < 60; i++) {
      system.update(0.1)
    }

    expect(impacts.filter(impact => impact.actionId === 'boss:special')).toHaveLength(0)
    expect(impacts.filter(impact => impact.actionId === 'boss:basic').length).toBeGreaterThan(0)
  })
})
