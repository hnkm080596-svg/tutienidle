import { describe, expect, it, vi } from 'vitest'
import type { Skill } from './Skill'
import { SkillManager } from './SkillManager'
import { SkillSystem } from './SkillSystem'
import { SKILLS } from '@/data/skill/Skills'

// 9.5 #9 — cast counting revived on the turn engine: the engine reports
// each committed cast via onSkillCast, GameManagerTurnBattleOps filters
// to the primary player and forwards here. recordCast() is the single
// writer of the cast-count mirror (player.skillCastCounts/skillLevels
// via castCountSink) that gates NodeSystem `skillCastCount`
// prerequisites, the bat_kiem route lock and Huy Kiem cast-leveling.

function activeSkill(id: string, overrides: Partial<Skill> = {}): Skill {
  return {
    id,
    name: id,
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 0,
    cost: 0,
    target: 'enemy',
    effects: [],
    unlocked: false,
    equipped: false,
    ...overrides,
  }
}

describe('SkillSystem.recordCast — turn-engine cast counting', () => {
  it('mỗi cast +1 totalExperience cho skill ĐÃ HỌC và bắn sink (id, total, level)', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    const sink = vi.fn()
    system.setCastCountSink(sink)
    system.learn(activeSkill('test_skill'))

    system.recordCast('test_skill')
    system.recordCast('test_skill')

    const skill = manager.get('test_skill')!
    expect(skill.totalExperience).toBe(2)
    expect(sink).toHaveBeenCalledTimes(2)
    expect(sink).toHaveBeenLastCalledWith('test_skill', 2, 1)
  })

  it('skill chưa học / id lạ → no-op hoàn toàn (không throw, sink không bắn)', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    const sink = vi.fn()
    system.setCastCountSink(sink)

    system.recordCast('unknown_skill')
    system.recordCast('generic_physical')

    expect(sink).not.toHaveBeenCalled()
  })

  it('không gắn sink vẫn đếm cast bình thường', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    system.learn(activeSkill('test_skill'))

    system.recordCast('test_skill')

    expect(manager.get('test_skill')!.totalExperience).toBe(1)
  })

  it('tram tự lên level theo cast: Lv2 tại 1000, Lv3 tại 10000, không bao giờ Lv4', () => {
    const manager = new SkillManager()
    const onLevelUp = vi.fn()
    const system = new SkillSystem(manager, onLevelUp)
    system.learn(SKILLS.find((skill) => skill.id === 'tram')!)
    const skill = manager.get('tram')!

    for (let cast = 0; cast < 999; cast++) system.recordCast('tram')
    expect(skill.level).toBe(1)

    system.recordCast('tram')
    expect(skill.level).toBe(2)
    expect(onLevelUp).toHaveBeenCalledWith(skill, 1)

    for (let cast = 1000; cast < 10000; cast++) system.recordCast('tram')
    expect(skill.level).toBe(3)
    expect(skill.totalExperience).toBe(10000)

    for (let cast = 0; cast < 5000; cast++) system.recordCast('tram')
    expect(skill.level).toBe(3)
    expect(skill.totalExperience).toBe(15000)
  })

  it('tram vẫn tích experience theo cast (legacy parity)', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    system.learn(SKILLS.find((skill) => skill.id === 'tram')!)
    const skill = manager.get('tram')!

    system.recordCast('tram')
    system.recordCast('tram')

    expect(skill.experience).toBe(2)
  })

  it('skill KHÔNG phải tram KHÔNG auto-level theo cast (Cảm Ngộ qua upgradeSkill)', () => {
    const manager = new SkillManager()
    const onLevelUp = vi.fn()
    const system = new SkillSystem(manager, onLevelUp)
    system.learn(activeSkill('hoa_cau_thuat'))
    const skill = manager.get('hoa_cau_thuat')!

    for (let cast = 0; cast < 10001; cast++) system.recordCast('hoa_cau_thuat')

    expect(skill.level).toBe(1)
    expect(skill.totalExperience).toBe(10001)
    expect(onLevelUp).not.toHaveBeenCalled()
  })

  // Phap Tu Reimagined Task 2 — linh_bao/huy_quyen join tram in the
  // CAST_LEVELING_THRESHOLDS table (same Lv2@1000/Lv3@10000 curve).
  // linh_bao Lv3 is the phap_tu_an ritual gate, so cast leveling must
  // be exact.
  it.each(['linh_bao', 'huy_quyen'])(
    '%s auto-levels Lv2 at 1000, Lv3 at 10000 casts',
    (id) => {
      const manager = new SkillManager()
      const onLevelUp = vi.fn()
      const system = new SkillSystem(manager, onLevelUp)
      system.learn(SKILLS.find((skill) => skill.id === id)!)
      const skill = manager.get(id)!

      for (let i = 0; i < 999; i++) system.recordCast(id)
      expect(skill.level).toBe(1)

      system.recordCast(id)
      expect(skill.level).toBe(2)
      expect(onLevelUp).toHaveBeenCalledWith(skill, 1)

      for (let i = 1000; i < 10000; i++) system.recordCast(id)
      expect(skill.level).toBe(3)
      expect(skill.totalExperience).toBe(10000)
    },
  )

  it.each(['linh_bao', 'huy_quyen'])(
    'upgradeSkill rejects %s exactly like tram (INV-9: cast-leveled only)',
    (id) => {
      const manager = new SkillManager()
      const system = new SkillSystem(manager)
      system.learn(SKILLS.find((skill) => skill.id === id)!)

      expect(system.getSkillUpgradeInsightCost(id)).toBeUndefined()
      expect(system.upgradeSkill(id, { skillInsight: 999 } as never)).toBe(false)
    },
  )
})
