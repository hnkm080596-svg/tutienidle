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

// Uncommitted audit followup plan, mục "Projectile phải có authority ở
// core" (2026-08-24) — trước đây CombatScene.create() emit
// 'projectile_collision_ready:{enabled:true}' TẮT HẲN
// BattleSystem.resolveMissilesHeadless(), khiến sát thương missile phụ
// thuộc HOÀN TOÀN vào 'projectile_impact' do Phaser tự phát qua
// physics.overlap() mỗi frame render. Không có renderer (Vitest headless,
// scene shutdown giữa trận, FPS thấp, hoặc Electron chạy nền) thì combat
// ĐỨNG YÊN vĩnh viễn — damage không bao giờ tự xảy ra. Bài test cũ ở file
// này (đã bị THAY THẾ) từng khoá đúng hành vi lỗi đó làm "hợp đồng đúng".
// Giờ core LUÔN tự resolve vị trí/retarget/impact, không điều kiện —
// file này khoá lại hợp đồng MỚI: damage tự xảy ra dù không có
// 'projectile_impact' nào từ Phaser, và nếu Phaser CÓ phát (đường tắt
// hiển thị) thì không áp damage 2 lần.
function createBattleSystem(eventBus = new EventBus()) {
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

// evasionRate/dexterity=0 đảm bảo hit chance 100% (né random sẽ làm
// test flaky) — cùng quy ước CombatSystem.manaShield.test.ts.
// movementSpeed=0 để x không trôi ngoài dự đoán trong lúc tick nhiều
// lần (BattleSystem.castTime.test.ts's gotcha). attackRange=500 đủ xa
// — mỗi test tự set lại enemy.x sau start() về trong tầm nhìn
// (SCREEN_VISIBLE_MAX_X, xem BattleLane.ts) để tấn công được NGAY.
function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = {
    ...createBaseStats(),
    evasionRate: 0,
    dexterity: 0,
    attackSpeed: 1,
    attackRange: 500,
    movementSpeed: 0,
    attack: 100,
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

describe('BattleSystem — projectile core authority (uncommitted audit followup plan)', () => {
  it('KHÔNG có renderer/scene nào phát projectile_impact — core vẫn tự resolve damage đúng lúc missile bay tới đích', () => {
    const eventBus = new EventBus()
    const system = createBattleSystem(eventBus)
    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy' })

    // KHÔNG có Phaser thật nào chạy — không ai emit 'projectile_impact'
    // trong suốt test này (mô phỏng test headless/scene shutdown/Electron
    // chạy nền, đúng kịch bản bug thật đã xảy ra).
    system.start(player, enemy)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay

    // start() luôn ghi đè x = ENEMY_SPAWN_X(400) > SCREEN_VISIBLE_MAX_X(350) —
    // đặt lại trong tầm nhìn để quái đánh được ngay.
    enemy.x = 50

    for (let i = 0; i < 200; i++) {
      system.update(0.05)
    }

    expect(player.currentHp).toBeLessThan(player.maxHp)
  })

  it('Phaser CÓ render và phát projectile_impact (đường tắt hiển thị) — damage vẫn áp đúng, KHÔNG bị double khi core cũng tự resolve cùng missile', () => {
    const eventBus = new EventBus()
    const system = createBattleSystem(eventBus)
    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)
    system.update(3)
    enemy.x = 50

    let spawnedProjectileId: string | undefined

    eventBus.on<{ projectileId: string; sourceId: string; targetId: string }>('projectile_spawned', event => {
      if (event.sourceId === 'enemy') {
        spawnedProjectileId = event.projectileId
      }
    })

    system.update(0.05)

    expect(spawnedProjectileId).toBeDefined()

    // Phaser phát 'projectile_impact' NGAY (đường tắt 60fps, trước khi
    // core's resolveMissilesHeadless() ở tick sau kịp tự tính missile.x
    // chạm đích) — damage phải áp NGAY từ đường tắt này.
    eventBus.emit('projectile_impact', { projectileId: spawnedProjectileId, targetId: 'player' })

    expect(player.currentHp).toBeLessThan(player.maxHp)

    const hpAfterFirstHit = player.currentHp

    // Missile đã bị core remove sau lần resolve trên — dù Phaser phát
    // lại impact (frame kế, circle chưa kịp destroy) hay core's update()
    // chạy tiếp, KHÔNG được áp damage lần 2 cho CÙNG 1 missile.
    eventBus.emit('projectile_impact', { projectileId: spawnedProjectileId, targetId: 'player' })

    // Vài tick nhỏ (< 1s, dưới attackTimer interval của enemy) — đủ để
    // resolveMissilesHeadless() chạy thêm vài lần mà KHÔNG cho enemy kịp
    // bắn missile thứ 2 (sẽ tự gây thêm damage thật, làm sai lệch
    // assertion bên dưới vì lý do khác chứ không phải vì double-resolve).
    for (let i = 0; i < 5; i++) {
      system.update(0.05)
    }

    // HP có thể NHÍCH LÊN chút do updateRegen() tự nhiên chạy mỗi tick —
    // chỉ cấm giảm thêm (double-resolve = thêm 1 lần damage).
    expect(player.currentHp).toBeGreaterThanOrEqual(hpAfterFirstHit)
  })

  it('target chết giữa đường (trước khi missile bay tới) — missile tự dọn qua core, KHÔNG áp damage lên xác chết, KHÔNG throw', () => {
    const eventBus = new EventBus()
    const system = createBattleSystem(eventBus)
    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)
    system.update(3)
    enemy.x = 50

    // enemy bắn missile về player ngay tick đầu (timer=0, đủ tầm).
    system.update(0.01)

    // Player "chết" giữa đường bay (chưa kịp trúng đòn) — mô phỏng bị
    // nguồn sát thương khác giết trước khi missile enemy tới.
    player.currentHp = 0
    player.alive = false

    expect(() => {
      for (let i = 0; i < 50; i++) {
        system.update(0.05)
      }
    }).not.toThrow()

    // HP đã 0 từ trước — missile hết mục tiêu không được phép "hồi
    // sinh"/đẩy currentHp xuống âm hay gây lỗi state nào khác.
    expect(player.currentHp).toBe(0)
  })

  it('delta lớn (tab bị throttle) — missile vẫn resolve đúng NGAY trong 1 lần update(), không cần đợi nhiều bước nhỏ', () => {
    const eventBus = new EventBus()
    const system = createBattleSystem(eventBus)
    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)
    system.update(3)
    enemy.x = 50

    // Spawn đúng 1 missile (timer=0 ở tick đầu), rồi dồn 1 delta lớn duy
    // nhất — missile.x += speed*direction*deltaSeconds thừa sức vượt
    // quãng đường còn lại (500 unit/s * vài giây >> khoảng cách 50 unit)
    // trong ĐÚNG 1 lần gọi update(), không phải chờ nhiều bước nhỏ.
    system.update(0.01)
    system.update(5)

    expect(player.currentHp).toBeLessThan(player.maxHp)
  })
})
