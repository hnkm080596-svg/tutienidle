import { describe, expect, it } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { AilmentRegistry } from '../ailment/AilmentRegistry'
import { EventBus } from '../events/EventBus'
import { MissileSystem } from '../combat/missile/MissileSystem'
import { MissileManager } from '../combat/missile/MissileManager'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Buff } from '../buff/Buff'

function createBattleSystem() {
  const eventBus = new EventBus()
  const skillManager = new SkillManager()

  return new BattleSystem(
    new CombatSystem(eventBus),
    skillManager,
    new SkillSystem(skillManager),
    new SkillEffectSystem(),
    new BuffRegistry(),
    new AilmentRegistry(),
    eventBus,
    new MissileSystem(new MissileManager(), eventBus),
  )
}

// attack=0 ở cả 2 phía — Boss Mechanics test chỉ quan tâm HP threshold/
// elapsed time TỰ TAY set, không muốn missile auto-attack (nondeterministic
// do accuracy/crit roll) làm currentHp trôi lệch giữa các assertion.
function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = { ...createBaseStats(), attack: 0 }

  return {
    id: 'id',
    name: 'name',
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentRage: 0,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    lane: 'ground',
    alive: true,
    ...overrides,
  }
}

function createTestBuff(id: string): Buff {
  return {
    id,
    name: id,
    category: 'buff',
    stacks: 1,
    stackMode: 'stack',
    modifiers: [],
  }
}

describe('BattleSystem — Boss Mechanics (Combat Rework Phase 4)', () => {
  it('archetypeOverride: HP tụt qua ngưỡng phase thì đổi archetype quái NGAY trong tick đó', () => {
    const system = createBattleSystem()
    const player = createCombatant({ id: 'player', type: 'player', x: 0 })

    const boss = createCombatant({
      id: 'boss',
      archetype: 'melee',
      currentHp: 40,
      maxHp: 100,
      tribulationPhases: [
        { hpThresholdPercent: 0.5, buff: createTestBuff('phase_1'), archetypeOverride: 'caster' },
      ],
    })

    system.start(player, boss)

    system.update(0.016)

    expect(system.getBattle()!.enemies[0]!.entity.archetype).toBe('caster')
  })

  it('archetypeOverride: CHƯA qua ngưỡng thì giữ nguyên archetype gốc', () => {
    const system = createBattleSystem()
    const player = createCombatant({ id: 'player', type: 'player', x: 0 })

    const boss = createCombatant({
      id: 'boss',
      archetype: 'melee',
      currentHp: 80,
      maxHp: 100,
      tribulationPhases: [
        { hpThresholdPercent: 0.5, buff: createTestBuff('phase_1'), archetypeOverride: 'caster' },
      ],
    })

    system.start(player, boss)

    system.update(0.016)

    expect(system.getBattle()!.enemies[0]!.entity.archetype).toBe('melee')
  })

  it('summonEnemyIds: qua ngưỡng phase thì đẩy id vào Battle.pendingSummons đúng 1 lần', () => {
    const system = createBattleSystem()
    const player = createCombatant({ id: 'player', type: 'player', x: 0 })

    const boss = createCombatant({
      id: 'boss',
      currentHp: 40,
      maxHp: 100,
      tribulationPhases: [
        { hpThresholdPercent: 0.5, buff: createTestBuff('phase_1'), summonEnemyIds: ['add_wolf', 'add_wolf'] },
      ],
    })

    system.start(player, boss)

    system.update(0.016)
    system.update(0.016)

    expect(system.getBattle()!.pendingSummons).toEqual(['add_wolf', 'add_wolf'])
  })

  it('Enrage: chưa đủ afterSeconds thì chưa áp buff', () => {
    const system = createBattleSystem()
    const player = createCombatant({ id: 'player', type: 'player', x: 0 })

    const boss = createCombatant({
      id: 'boss',
      enrage: { afterSeconds: 1, buff: createTestBuff('enrage_buff') },
    })

    system.start(player, boss)

    system.update(0.5)

    const battleEnemy = system.getBattle()!.enemies[0]!

    expect(battleEnemy.enrageApplied).toBeFalsy()
    expect(battleEnemy.buffs.get('enrage_buff')).toBeUndefined()
  })

  it('Enrage: đủ afterSeconds thì áp buff đúng 1 lần, không áp lại tick sau', () => {
    const system = createBattleSystem()
    const player = createCombatant({ id: 'player', type: 'player', x: 0 })

    const boss = createCombatant({
      id: 'boss',
      enrage: { afterSeconds: 1, buff: createTestBuff('enrage_buff') },
    })

    system.start(player, boss)

    system.update(0.6)
    system.update(0.6)

    const battleEnemy = system.getBattle()!.enemies[0]!

    expect(battleEnemy.enrageApplied).toBe(true)
    expect(battleEnemy.buffs.get('enrage_buff')?.stacks).toBe(1)

    system.update(0.6)

    // Không stack thêm — apply() lần 2 sẽ handleExistingBuff('stack')
    // cộng thêm stacks nếu lỡ bị gọi lại, enrageApplied phải chặn hẳn.
    expect(battleEnemy.buffs.get('enrage_buff')?.stacks).toBe(1)
  })
})
