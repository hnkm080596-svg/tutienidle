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
import { SKILLS } from '../../data/skill/Skills'
import type { CombatEntity } from '../combat/CombatEntity'

function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  // dexterity:0 — calculateStats() tự cộng THÊM evasionRate dẫn xuất
  // từ dexterity (xem StatCalculator.ts's deriveAttributeModifiers(),
  // ATTRIBUTE_EVASION_PER_POINT) LÊN TRÊN baseStats.evasionRate=0, nên
  // nếu không zero luôn dexterity thì hit chance thực tế chỉ ~91% (do
  // dexterity mặc định=10 trong createBaseStats()) chứ không phải
  // 100% như evasionRate:0 tưởng chừng đảm bảo — khiến test flaky vì
  // rollHit() vẫn có thể miss ngẫu nhiên.
  const stats = { ...createBaseStats(), attack: 0, evasionRate: 0, dexterity: 0 }

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
    lane: 2,
    alive: true,
    ...overrides,
  }
}

describe('BattleSystem — Kiếm Tu Ngự Kiếm Thuật Pierce (Combat Rework Phase 5)', () => {
  it('phi kiếm xuyên qua mục tiêu gần rồi trúng tiếp mục tiêu xa hơn cùng hàng', () => {
    const eventBus = new EventBus()
    const skillManager = new SkillManager()

    const system = new BattleSystem(
      new CombatSystem(eventBus),
      skillManager,
      new SkillSystem(skillManager),
      new SkillEffectSystem(),
      new BuffRegistry(),
      new AilmentRegistry(),
      eventBus,
      new MissileSystem(new MissileManager(), eventBus),
    )

    // Skill THẬT từ data file (không mock lại effect) — chứng minh
    // đúng data đang ship trong game, không phải 1 fixture riêng.
    const nguKiemThuat = SKILLS.find(skill => skill.id === 'ngu_kiem_thuat')

    if (!nguKiemThuat) {
      throw new Error('data/skill/Skills.ts thiếu ngu_kiem_thuat — kiểm tra lại id')
    }

    skillManager.add({ ...nguKiemThuat, unlocked: true, equipped: true, remainingCooldown: 0 })

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const nearEnemy = createCombatant({ id: 'near', x: 100 })
    const farEnemy = createCombatant({ id: 'far', x: 200 })

    const hitTargetIds: string[] = []

    eventBus.on<{ targetId: string }>('hit', event => hitTargetIds.push(event.targetId))

    system.start(player, nearEnemy)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay
    // Quái thứ 2 vào trận GIỮA CHỪNG (wave), cùng cách spawn thật trong
    // game (GameManager.updateStageProgress()) thay vì hardcode battle.enemies.
    system.spawnEnemyInto(system.getBattle()!, farEnemy)

    // start()/spawnEnemyInto() LUÔN đặt lại x = HERO_HOME_X/ENEMY_SPAWN_X
    // (đúng thiết kế thật — quái vào trận từ đúng 1 điểm cố định), đè
    // lên x=100/200 đã khai ở trên. Set lại TRỰC TIẾP sau khi spawn để
    // có 2 quái cách nhau thật, mô phỏng lúc quái 'far' đã tiến vào gần
    // hơn — nearEnemy/farEnemy vẫn là tham chiếu SỐNG vào entity trong
    // battle.enemies (BattleSystem không clone entity truyền vào).
    nearEnemy.x = 100
    farEnemy.x = 200

    // realmIndex=0 -> hitCountByRealm bắn đúng 1 missile — đơn giản
    // hoá việc đếm hit, chỉ cần theo dõi ĐÚNG 1 phi kiếm xuyên 2 quái.
    // 80 tick x 0.01s = 0.8s: đủ bay 100+100 world unit ở speed 500
    // (0.4s), còn dư margin, vẫn dưới mốc cooldown/attackSpeed 1.0s
    // nên KHÔNG bắn phát 2 chồng lên phép đếm hit.
    for (let i = 0; i < 80; i++) {
      system.update(0.01)
    }

    // Quái cũng tự phản công player trong cùng khoảng thời gian này
    // (background noise, không phải điều test này quan tâm) — lọc
    // riêng hit lên 2 quái để xác nhận ĐÚNG thứ tự xuyên near -> far.
    const enemyHits = hitTargetIds.filter(id => id === 'near' || id === 'far')

    expect(enemyHits).toEqual(['near', 'far'])
  })
})
