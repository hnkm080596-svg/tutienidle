import { describe, expect, it, vi } from 'vitest'
import type { Skill } from './Skill'
import { SkillManager } from './SkillManager'
import { SkillSystem } from './SkillSystem'
import { GameManager } from '../game/GameManager'
import { createDefaultPlayer } from '../player/Player'
import { SKILLS } from '@/data/skill/Skills'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'
import { skillCoreNodeId } from '../progression/SkillCoreLevel'

// 9.5 #9 — cast counting revived on the turn engine: the engine reports
// each committed cast via onSkillCast, GameManagerTurnBattleOps filters
// to the primary player and forwards here. recordCast() is the single
// writer of the cast-count mirror (player.skillCastCounts via
// castCountSink) that gates NodeSystem `skillCastCount` prerequisites,
// the bat_kiem route lock and Huy Kiem cast-leveling. M-QI-05 - the
// sink also carries the cast-channel TARGET level; the canonical
// nodeLevels[core_<id>] write + notification are the sink owner's job
// (SkillSystem holds no writable level - Skill.level stays frozen).

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
    ...overrides,
  }
}

describe('SkillSystem.recordCast — turn-engine cast counting', () => {
  it('mỗi cast +1 totalExperience cho skill ĐÃ HỌC và bắn sink (id, total, targetLevel)', () => {
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
    expect(sink).toHaveBeenLastCalledWith('test_skill', 2, undefined)
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

  it('tram target-level: Lv2 tại 1000, Lv3 tại 10000, không bao giờ Lv4 (Skill.level frozen)', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    const sink = vi.fn()
    system.setCastCountSink(sink)
    system.learn(SKILLS.find((skill) => skill.id === 'tram')!)
    const skill = manager.get('tram')!

    for (let cast = 0; cast < 999; cast++) system.recordCast('tram')
    expect(sink).toHaveBeenLastCalledWith('tram', 999, 1)

    system.recordCast('tram')
    expect(sink).toHaveBeenLastCalledWith('tram', 1000, 2)

    for (let cast = 1000; cast < 10000; cast++) system.recordCast('tram')
    expect(sink).toHaveBeenLastCalledWith('tram', 10000, 3)
    expect(skill.totalExperience).toBe(10000)

    for (let cast = 0; cast < 5000; cast++) system.recordCast('tram')
    expect(sink).toHaveBeenLastCalledWith('tram', 15000, 3)
    expect(skill.totalExperience).toBe(15000)

    // Authored level is frozen data - cast progress lives in the sink.
    expect(skill.level).toBe(1)
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

  it('skill KHÔNG cast-channel gửi targetLevel undefined (Insight channel owns levels)', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    const sink = vi.fn()
    system.setCastCountSink(sink)
    system.learn(activeSkill('hoa_cau_thuat'))
    const skill = manager.get('hoa_cau_thuat')!

    for (let cast = 0; cast < 10001; cast++) system.recordCast('hoa_cau_thuat')

    expect(sink).toHaveBeenLastCalledWith('hoa_cau_thuat', 10001, undefined)
    expect(skill.totalExperience).toBe(10001)
  })

  // Phap Tu Reimagined Task 2 — linh_bao/huy_quyen join tram in the
  // CAST_LEVELING_THRESHOLDS table (same Lv2@1000/Lv3@10000 curve).
  // linh_bao Lv3 is the phap_tu_an ritual gate, so cast leveling must
  // be exact.
  it.each(['linh_bao', 'huy_quyen'])(
    '%s targets Lv2 at 1000, Lv3 at 10000 casts',
    (id) => {
      const manager = new SkillManager()
      const system = new SkillSystem(manager)
      const sink = vi.fn()
      system.setCastCountSink(sink)
      system.learn(SKILLS.find((skill) => skill.id === id)!)
      const skill = manager.get(id)!

      for (let i = 0; i < 999; i++) system.recordCast(id)
      expect(sink).toHaveBeenLastCalledWith(id, 999, 1)

      system.recordCast(id)
      expect(sink).toHaveBeenLastCalledWith(id, 1000, 2)

      for (let i = 1000; i < 10000; i++) system.recordCast(id)
      expect(sink).toHaveBeenLastCalledWith(id, 10000, 3)
      expect(skill.totalExperience).toBe(10000)
    },
  )
})

describe('cast channel → canonical core level (GameManager sink)', () => {
  function setup() {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    const player = createDefaultPlayer()
    gameManager.setActivePlayer(player)
    return { gameManager, player }
  }

  it('tram casts advance nodeLevels[core_tram] and notify once per level', () => {
    const { gameManager, player } = setup()

    expect(gameManager.progressionOps.learnSkill('tram', player)).toBe(true)

    for (let cast = 0; cast < 999; cast++) gameManager.skillSystem.recordCast('tram')

    expect(player.nodeLevels[skillCoreNodeId('tram')]).toBe(1)
    expect(gameManager.drainNotifications().filter((event) => event.kind === 'upgrade')).toHaveLength(0)

    gameManager.skillSystem.recordCast('tram') // cast 1000 -> Lv2

    expect(player.skillCastCounts?.['tram']).toBe(1000)
    expect(player.nodeLevels[skillCoreNodeId('tram')]).toBe(2)
    expect(gameManager.drainNotifications().filter((event) => event.kind === 'upgrade')).toHaveLength(1)

    // Reaching an already-reached target level emits nothing.
    gameManager.skillSystem.recordCast('tram')
    expect(gameManager.drainNotifications().filter((event) => event.kind === 'upgrade')).toHaveLength(0)
  })

  it.each(['tram', 'linh_bao', 'huy_quyen'])(
    'levelUpSkill rejects cast-channel core %s (Insight is not its channel)',
    (id) => {
      const { gameManager, player } = setup()
      player.skillInsight = 999

      expect(gameManager.progressionOps.learnSkill(id, player)).toBe(true)
      expect(gameManager.progressionOps.levelUpSkill(id, player)).toBe(false)
      expect(player.nodeLevels[skillCoreNodeId(id)]).toBe(1)
      expect(player.skillInsight).toBe(999)
      expect(gameManager.progressionOps.getSkillCoreUpgradeCost(id, player)).toBeUndefined()
    },
  )
})
