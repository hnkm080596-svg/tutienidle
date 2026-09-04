import { describe, expect, it } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { BuffSystem } from '../buff/BuffSystem'
import { EventBus } from '../events/EventBus'
import { ActionImpactSystem } from './ActionImpactSystem'
import { createBaseStats } from '../stats/StatBlock'
import { HERO_COLUMN } from './BattleLane'
import { buffs } from '../../data/buff/buffs'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'
import type { EntityVitalsChangedEvent } from '../combat/EntityVitalsSystem'

// Kiếm Tu Bạt Kiếm (Task 4, spec §4.2) — TỤ LỰC: mọi damage/randomness
// khác bị triệt tiêu (crit/dodge/block = 0, attack cao + defense/endurance
// zero khi cần phép đo chính xác) để test chỉ đo đúng cơ chế channel.
function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = {
    ...createBaseStats(),
    // attack=0 mặc định — CHỈ Player override attack:100 tường minh ở
    // từng test (xem createPlayer()). Quái giữ attack=0: enemy1/2/3 bị
    // ép đứng ĐÚNG cột HERO_COLUMN (distance=0) để nằm gọn trong vùng
    // 'all_lanes' của channel — nếu quái cũng có attack>0 thì distance=0
    // <= attackRange=0 vẫn đủ điều kiện "trong tầm" (Chebyshev 0<=0) và
    // sẽ phản công Player, nhiễu phép đo damage/amp thuần channel.
    attack: 0,
    defense: 0,
    evasionRate: 0,
    criticalRate: 0,
    blockChance: 0,
    dexterity: 0,
    // Không ai chủ động tấn công nhau ngoài channel tick — attackRange=0
    // đảm bảo Player scheduler (updatePlayerSkills) không tìm được
    // target cho slot nào (loadout chỉ có skill channel, vốn đã KHÔNG
    // đi qua beginPlayerCast — attackRange=0 chỉ để tránh nhiễu thêm),
    // và enemy archetype mặc định không tự bước vào tầm bắn.
    attackRange: 0,
    speed: 0,
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
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  }
}

/** Player — attack:100 tường minh (nguồn damage của channel), quái giữ attack:0. */
function createPlayer(overrides: Partial<CombatEntity>): CombatEntity {
  const player = createCombatant({ id: 'player', type: 'player', x: 0, ...overrides })

  player.stats.attack = 100

  return player
}

// bat_kiem_thuat (test-only fixture) — target 'all_enemies' đủ để
// targetingForSkill() (CombatAction.ts:44) tự quyết shape 'all_lanes',
// engine thật sự chỉ đọc execution.kind==='channel' + tickSeconds.
function createBatKiemThuat(tickSeconds = 3): Skill {
  return {
    id: 'bat_kiem_thuat',
    name: 'Bạt Kiếm Thuật (test)',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 0,
    remainingCooldown: 0,
    cost: 0,
    target: 'all_enemies',
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }],
    execution: { kind: 'channel', tickSeconds },
    loadoutSlot: 0,
    loadoutSlots: [0],
    resourceType: 'none',
    unlocked: true,
    equipped: true,
  }
}

function setup(tickSeconds = 3) {
  const eventBus = new EventBus()
  const skillManager = new SkillManager()
  const skillSystem = new SkillSystem(skillManager)
  const combat = new CombatSystem(eventBus)

  const system = new BattleSystem(
    combat,
    skillManager,
    skillSystem,
    new SkillEffectSystem(),
    new BuffRegistry(),
    eventBus,
    new ActionImpactSystem({ eventBus, rollCritical: () => false }),
    undefined,
    undefined,
    undefined,
    // Final review fix (Important #6) — channel activation giờ gate
    // thêm kiemTuRoute === 'bat_kiem' (khớp UI). Đây là fixture test
    // độc lập Kiếm Tu route hoàn chỉnh (chỉ Bạt Kiếm) nên luôn 'bat_kiem'.
    () => 'bat_kiem',
  )

  const skill = createBatKiemThuat(tickSeconds)

  skillManager.add(skill)

  const vitalsEvents: EntityVitalsChangedEvent[] = []

  eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (event) => {
    vitalsEvents.push(event)
  })

  function tick(deltaSeconds: number) {
    skillSystem.update(deltaSeconds, 0)
    system.update(deltaSeconds)
  }

  return { system, combat, tick, skill, vitalsEvents, eventBus }
}

describe('BattleSystem — Bạt Kiếm auto-channel (spec §4.2, Task 4)', () => {
  it('vào trận với skill channel: mỗi tickSeconds gây 1 phát trúng MỌI hàng', () => {
    const { system, vitalsEvents } = setup(3)

    const player = createPlayer({})
    const enemy1 = createCombatant({ id: 'enemy1', row: 0 })
    const enemy2 = createCombatant({ id: 'enemy2', row: 4 })
    const enemy3 = createCombatant({ id: 'enemy3', row: 8 })

    system.start(player, enemy1)

    // Gotcha (BattleSystem.start()/spawnEnemyInto() overwrite entity.x
    // ngay khi materialize — set lại vị trí SAU khi gọi, không set qua
    // fixture): flush telegraph của enemy1 rồi ép lại toạ độ cả 3 quái
    // vào 3 hàng khác nhau, CÙNG cột HERO_COLUMN để nằm gọn trong vùng
    // 'all_lanes' (columnRadius rất lớn nhưng vẫn clamp trong lưới).
    system.flushPendingSpawns()

    enemy1.x = HERO_COLUMN
    enemy1.row = 0

    const battle = system.getBattle()!

    system.spawnEnemyInto(battle, enemy2)
    enemy2.x = HERO_COLUMN
    enemy2.row = 4

    system.spawnEnemyInto(battle, enemy3)
    enemy3.x = HERO_COLUMN
    enemy3.row = 8

    // Channel bật NGAY từ start() (skill channel đang equip duy nhất
    // trong loadout) nhưng elapsed chỉ tích khi state 'fighting'.
    expect(battle.player.tuLucActive).toBe(true)

    system.update(3) // bỏ qua countdown (BATTLE_COUNTDOWN_SECONDS=3)

    expect(battle.state).toBe('fighting')
    expect(battle.player.tuLucElapsed).toBe(0)

    const damageEventsFor = (id: string) =>
      vitalsEvents.filter((event) => event.entityId === id && event.reason === 'damage')

    system.update(2.9)

    expect(battle.player.tuLucElapsed).toBeCloseTo(2.9, 5)
    expect(damageEventsFor('enemy1')).toHaveLength(0)
    expect(damageEventsFor('enemy2')).toHaveLength(0)
    expect(damageEventsFor('enemy3')).toHaveLength(0)

    system.update(0.1) // 2.9 + 0.1 = 3.0 → đúng 1 kỳ nổ, trúng CẢ 3 hàng

    expect(damageEventsFor('enemy1')).toHaveLength(1)
    expect(damageEventsFor('enemy2')).toHaveLength(1)
    expect(damageEventsFor('enemy3')).toHaveLength(1)
    expect(battle.player.tuLucElapsed).toBeCloseTo(0, 5)
  })

  it('amp: mất 20% maxHP trong kỳ → phát quạt +6% damage (hệ số 0.3 — nerf spec 2026-08-29)', () => {
    // Control: không ai đụng tới Player trong kỳ tụ → damage nền, không amp.
    const control = setup(3)
    const controlPlayer = createPlayer({})
    // maxHp lớn để đòn quạt (kể cả bản amp) không giết chết quái giữa
    // chừng — chết thì currentHp bị clamp ở 0, che mất phần chênh amp.
    const controlEnemy = createCombatant({ id: 'enemy', row: 4, currentHp: 10_000, maxHp: 10_000 })

    control.system.start(controlPlayer, controlEnemy)
    control.system.update(3) // bỏ qua countdown

    const controlBefore = controlEnemy.currentHp

    control.system.update(3) // đúng 1 kỳ nổ, không amp

    const baseDamage = controlBefore - controlEnemy.currentHp

    expect(baseDamage).toBeGreaterThan(0)

    // Thí nghiệm: Player mất đúng 20% maxHP TRONG kỳ tụ hiện tại trước
    // khi kỳ đó nổ.
    const experiment = setup(3)
    const player = createPlayer({})
    const enemy = createCombatant({ id: 'enemy', row: 4, currentHp: 10_000, maxHp: 10_000 })

    experiment.system.start(player, enemy)
    experiment.system.update(3) // bỏ qua countdown

    experiment.combat.vitals.applyDamage(player, player.maxHp * 0.2, 'damage', enemy.id)

    expect(player.tuLucDamageTakenPercent).toBeCloseTo(0.2, 5)

    const before = enemy.currentHp

    experiment.system.update(3) // đúng 1 kỳ nổ, amp = 0.2 × 0.3 = +6%

    const ampDamage = before - enemy.currentHp

    // Amp hệ số 0.3 (nerf spec 2026-08-29 mục 3.4): 20% maxHP mất →
    // +6% damage — assert có tăng (> +5%) nhưng nhỏ hơn mức cũ 1.0.
    expect(ampDamage).toBeGreaterThan(baseDamage * 1.05)
    expect(ampDamage).toBeLessThan(baseDamage * 1.19)
    // ampPercent reset về 0 sau khi kỳ đã nổ.
    expect(player.tuLucDamageTakenPercent).toBe(0)
  })

  it('chết/khống chế cứng cắt tụ: stun → tuLucActive=false, không tick tiếp', () => {
    const { system, vitalsEvents } = setup(3)

    const player = createPlayer({})
    const enemy = createCombatant({ id: 'enemy', row: 4 })

    system.start(player, enemy)

    const battle = system.getBattle()!

    system.update(3) // bỏ qua countdown

    expect(battle.player.tuLucActive).toBe(true)

    new BuffSystem(battle.playerBuffs).apply(
      buffs.find((definition) => definition.id === 'choang')!,
      enemy,
      player,
    )

    system.update(0.1)

    expect(battle.player.tuLucActive).toBe(false)
    expect(battle.player.tuLucElapsed).toBe(0)

    const damageEventsForEnemy = () =>
      vitalsEvents.filter((event) => event.entityId === 'enemy' && event.reason === 'damage')

    const countAfterInterrupt = damageEventsForEnemy().length

    // 10s đủ chờ hết Choáng (duration 1.5s) rồi thừa 1 kỳ 3s nữa —
    // channel VẪN không tự tái kích hoạt (spec: chỉ bật lại đầu trận mới).
    system.update(10)

    expect(damageEventsForEnemy()).toHaveLength(countAfterInterrupt)
    expect(battle.player.tuLucActive).toBe(false)
  })

  it('setChannelTickSeconds đổi nhịp từ kỳ tụ KẾ TIẾP', () => {
    const { system, vitalsEvents } = setup(3)

    const player = createPlayer({})
    const enemy = createCombatant({ id: 'enemy', row: 4 })

    system.start(player, enemy)
    system.update(3) // bỏ qua countdown

    system.setChannelTickSeconds('bat_kiem_thuat', 9)

    const damageEventsForEnemy = () =>
      vitalsEvents.filter((event) => event.entityId === 'enemy' && event.reason === 'damage')

    system.update(3) // nhịp cũ (3s) đã qua nhưng nhịp mới là 9s → CHƯA nổ

    expect(damageEventsForEnemy()).toHaveLength(0)

    system.update(6) // 3 + 6 = 9s → đủ nhịp mới, nổ đúng 1 lần

    expect(damageEventsForEnemy()).toHaveLength(1)
  })

  // Review fix (Important #1) — resolveChannelTick() chạy ĐỒNG BỘ qua
  // CombatSystem pipeline; nếu target có thornsPercent, damage phản
  // ngược lại Player XẢY RA TRONG lệnh gọi này, được onEntityVitalsChanged()
  // cộng vào tuLucDamageTakenPercent TRƯỚC khi resolveChannelTick() trả
  // về. Bug cũ `player.tuLucDamageTakenPercent = 0` xoá mất phần vừa
  // cộng; fix trừ ĐÚNG snapshot đã dùng làm amp, giữ lại phần phản đòn
  // cho kỳ KẾ TIẾP.
  it('phản damage (thorns) trong lúc tick tự resolve KHÔNG bị mất — mang sang kỳ tụ KẾ TIẾP', () => {
    // Control: quái không có thorns → Player không bao giờ mất HP →
    // không có amp nào tích luỹ ở kỳ 2 (baseline "không amp").
    const control = setup(3)
    const controlPlayer = createPlayer({})
    const controlEnemy = createCombatant({ id: 'enemy', row: 4, currentHp: 10_000, maxHp: 10_000 })

    control.system.start(controlPlayer, controlEnemy)
    control.system.update(3) // bỏ qua countdown
    control.system.update(3) // kỳ 1

    const controlBeforeTick2 = controlEnemy.currentHp

    control.system.update(3) // kỳ 2, vẫn không amp

    const controlTick2Damage = controlBeforeTick2 - controlEnemy.currentHp

    // Thí nghiệm: quái có thornsPercent=0.1 — MỖI đòn channel tick trúng
    // quái sẽ phản 10% damage đó ngược lại Player NGAY TRONG
    // resolveChannelTick() của kỳ đó.
    const experiment = setup(3)
    const player = createPlayer({})
    const enemy = createCombatant({ id: 'enemy', row: 4, currentHp: 10_000, maxHp: 10_000 })

    enemy.stats.thornsPercent = 0.1 // set TRƯỚC start() — stats/baseStats cùng object lúc này (xem createCombatant)

    experiment.system.start(player, enemy)
    experiment.system.update(3) // bỏ qua countdown

    const battle = experiment.system.getBattle()!

    expect(battle.player.tuLucDamageTakenPercent).toBe(0)

    experiment.system.update(3) // kỳ 1 nổ — thorns phản damage vào Player NGAY trong lệnh này

    // Đây là assertion cốt lõi của fix: KHÔNG bị `= 0` xoá mất.
    expect(battle.player.tuLucDamageTakenPercent).toBeGreaterThan(0)

    const experimentBeforeTick2 = enemy.currentHp

    experiment.system.update(3) // kỳ 2 — amp mang từ phần thorns phản ở kỳ 1

    const experimentTick2Damage = experimentBeforeTick2 - enemy.currentHp

    expect(experimentTick2Damage).toBeGreaterThan(controlTick2Damage)
  })

  // Review fix (Important #2) — setChannelTickSeconds() đổi nhịp GIỮA
  // 1 kỳ tụ ĐANG DỞ (tuLucElapsed > 0 dưới nhịp cũ) trước đây có thể
  // khiến updateChanneling() nổ ĐÚP trong CÙNG 1 frame nếu nhịp mới nhỏ
  // hơn số giây đã tích dồn theo nhịp cũ (`while` diễn giải lại elapsed
  // cũ theo nhịp mới). Fix reset tuLucElapsed về 0 ngay trong
  // setChannelTickSeconds() khi đang tụ lực đúng skill đó — "hiệu lực từ
  // kỳ tụ KẾ TIẾP" đúng nghĩa đen: bỏ tiến độ dở dang, kỳ mới tính lại từ 0.
  it('setChannelTickSeconds đổi nhịp GIỮA kỳ tụ đang dở — reset elapsed, không nổ đúp trong 1 frame', () => {
    const { system, vitalsEvents } = setup(3)

    const player = createPlayer({})
    const enemy = createCombatant({ id: 'enemy', row: 4 })

    system.start(player, enemy)
    system.update(3) // bỏ qua countdown

    system.update(2.9) // tuLucElapsed=2.9 dưới nhịp cũ (3s) — CHƯA nổ

    const battle = system.getBattle()!

    expect(battle.player.tuLucElapsed).toBeCloseTo(2.9, 5)

    system.setChannelTickSeconds('bat_kiem_thuat', 1) // đổi nhịp GIỮA kỳ đang dở

    // Tiến độ dở dang theo nhịp CŨ bị bỏ — không diễn giải lại 2.9s đã
    // tích theo nhịp mới (nếu không sẽ nổ đúp ngay frame kế: 2.9>=1 hai lần).
    expect(battle.player.tuLucElapsed).toBe(0)

    const damageEventsForEnemy = () =>
      vitalsEvents.filter((event) => event.entityId === 'enemy' && event.reason === 'damage')

    system.update(0.5) // chưa đủ 1s nhịp mới

    expect(damageEventsForEnemy()).toHaveLength(0)

    system.update(0.5) // 0.5+0.5=1.0s → đủ nhịp mới, nổ ĐÚNG 1 LẦN

    expect(damageEventsForEnemy()).toHaveLength(1)
  })

  // Critical #2 review fix (spec §4.2) — "multiplier phát quạt tăng theo
  // x (nền: ×1 tại 3s → ×3 tại 9s, tuyến tính)". Trước fix, tickSeconds
  // chỉ quyết định LÚC NÀO tick nổ, không bao giờ quyết định NẶNG BAO
  // NHIÊU — slider Task 7 là 1 chiều lỗ DPS thuần khi kéo x lên.
  it('tick 9s gây ~3x damage so với 3 tick 3s cộng lại (không amp, kiểm soát biến)', () => {
    // 9s: đúng 1 kỳ tụ 9s, kiểm soát damageTaken=0 → chỉ đo multiplier
    // theo tickSeconds thuần.
    const nineSecond = setup(9)
    const ninePlayer = createPlayer({})
    const nineEnemy = createCombatant({ id: 'enemy', row: 4, currentHp: 100_000, maxHp: 100_000 })

    nineSecond.system.start(ninePlayer, nineEnemy)
    nineSecond.system.update(3) // bỏ qua countdown

    const nineBefore = nineEnemy.currentHp

    nineSecond.system.update(9) // đúng 1 kỳ 9s

    const nineDamage = nineBefore - nineEnemy.currentHp

    // 3s: 3 kỳ liên tiếp cộng lại — cùng tổng elapsed 9s, KHÔNG có amp
    // xen vào (control enemy không bao giờ đụng Player).
    const threeSecond = setup(3)
    const threePlayer = createPlayer({})
    const threeEnemy = createCombatant({ id: 'enemy', row: 4, currentHp: 100_000, maxHp: 100_000 })

    threeSecond.system.start(threePlayer, threeEnemy)
    threeSecond.system.update(3) // bỏ qua countdown

    const threeBefore = threeEnemy.currentHp

    threeSecond.system.update(3)
    threeSecond.system.update(3)
    threeSecond.system.update(3)

    const threeTotalDamage = threeBefore - threeEnemy.currentHp
    const threePerTickDamage = threeTotalDamage / 3

    // 1 tick 9s ≈ 3x 1 tick 3s (từng tick riêng lẻ, không phải tổng 3
    // tick — tổng 3 tick 3s vốn đã bằng 3x 1 tick 3s, nên so ĐÚNG scale
    // ×3 phải so 1 tick 9s với 1 tick 3s, không phải tổng 3 tick).
    expect(nineDamage).toBeGreaterThan(threePerTickDamage * 2.9)
    expect(nineDamage).toBeLessThan(threePerTickDamage * 3.1)
  })

  // Important #4 review fix — scheduler round-robin (updatePlayerSkills)
  // trước đây vẫn gọi beginPlayerCast()→beginCastInSlot() cho slot channel
  // MỖI lần enemy nằm trong tầm, TRƯỚC khi switch dispatch chạm case
  // 'channel' (return false) — set castingSlotIndex nhưng KHÔNG BAO GIỜ
  // dọn (channel không đi qua finishPlayerCastTransaction). Enemy trong
  // tầm (attackRange lớn, khác các test khác trong file cố ý attackRange=0
  // để tránh đúng nhiễu này) để thật sự exercise scheduler round-robin.
  it('channel skill KHÔNG bị scheduler round-robin set castingSlotIndex dù enemy trong tầm', () => {
    const { system } = setup(3)

    const player = createPlayer({ stats: { ...createBaseStats(), attack: 100, attackRange: 999 } })
    const enemy = createCombatant({ id: 'enemy', row: 4, x: HERO_COLUMN })

    system.start(player, enemy)
    system.update(3) // bỏ qua countdown

    const battle = system.getBattle()!

    expect(battle.player.tuLucActive).toBe(true)

    // Nhiều fixed-step, đủ để scheduler round-robin quét qua slot channel
    // hàng chục lần nếu còn bug — castingSlotIndex phải LUÔN undefined.
    for (let i = 0; i < 20; i++) {
      system.update(0.5)
      expect(battle.player.castingSlotIndex).toBeUndefined()
    }
  })

  // Spec dot-pha-loi-kiep §5.1 — startTribulation() đã DỞ khỏi
  // BattleSystem (kiếp không còn là trận battle mode 'tribulation',
  // TribulationDirector tự chạy). Test cũ "startTribulation() khởi tạo
  // channel state" dỡ cùng method.
})
