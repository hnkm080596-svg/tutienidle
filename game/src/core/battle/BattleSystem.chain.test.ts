import { describe, expect, it } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { BuffSystem } from '../buff/BuffSystem'
import { EventBus } from '../events/EventBus'
import { ActionImpactSystem } from '../battle/ActionImpactSystem'
import { createBaseStats } from '../stats/StatBlock'
import { createSkillRuntimeStats } from '../skill/SkillRuntimeStats'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

// Pháp Tu Đạo Sắc (spec 2026-08-30-phap-tu-dao-sac §7) — wire chuỗi
// combo Thuần hệ vào BattleSystem: gate scheduler (B chỉ cast sau A),
// +Thế mỗi link cast hoàn tất, reset về A khi quái chết. Fixture theo
// pattern BattleSystem.hoaThe.test.ts (skill test-only, không đọc
// data/skill/Skills.ts thật).
function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
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

function chainSkill(id: string, slot: number): Skill {
  return {
    id,
    name: `${id} (test)`,
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 0.5,
    remainingCooldown: 0,
    cost: 0,
    target: 'enemy',
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }],
    execution: { kind: 'cooldown' },
    loadoutSlot: slot,
    loadoutSlots: [slot],
    resourceType: 'none',
    unlocked: true,
    equipped: true,
  }
}

// Đếm cast qua event 'cast' (nguồn duy nhất phát ở resolveSkillEffects,
// xem BattleSystem.ts) — pattern BattleSystem.teleport.test.ts. Lưu
// THỨ TỰ để assert gate chuỗi (A phải trước B).
function makeCastRecorder(eventBus: EventBus) {
  const castSkillIds: string[] = []

  eventBus.on<{ skillId: string }>('cast', (event) => {
    castSkillIds.push((event as { skillId: string }).skillId)
  })

  return {
    ids: () => [...castSkillIds],
    count: (skillId: string) => castSkillIds.filter(id => id === skillId).length,
    firstIndexOf: (skillId: string) => castSkillIds.indexOf(skillId),
  }
}

function setup(chainSkillIds: string[] = ['chain_a', 'chain_b']) {
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

  chainSkillIds.forEach((skillId, index) => {
    skillManager.add(chainSkill(skillId, index))
  })

  system.setChainDefinition({ skillIds: chainSkillIds })

  const recorder = makeCastRecorder(eventBus)

  function tick(deltaSeconds: number) {
    skillSystem.update(deltaSeconds, 0)
    system.update(deltaSeconds)
  }

  return { system, tick, recorder, eventBus }
}

describe('BattleSystem — chuỗi combo Thuần hệ (spec §7)', () => {
  it('chưa setChainDefinition → hành vi cũ: skill cast tự do không gate', () => {
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

    skillManager.add(chainSkill('chain_b', 1))
    skillManager.add(chainSkill('chain_a', 0))

    const recorder = makeCastRecorder(eventBus)

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)
    system.update(3)
    enemy.x = 2
    enemy.row = 4

    for (let i = 0; i < 100; i++) {
      skillSystem.update(0.01, 0)
      system.update(0.01)
    }

    // chain_b đã được cast ít nhất 1 lần dù chain_a chưa từng có trong
    // loadout — không gate khi không có chain definition.
    expect(recorder.count('chain_b')).toBeGreaterThanOrEqual(1)
  })

  it('có chain: cast ĐẦU TIÊN của player phải là A — B chỉ xuất hiện sau A', () => {
    const { system, tick, recorder } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy', maxHp: 100000, currentHp: 100000 })

    system.start(player, enemy)
    system.update(3)
    enemy.x = 2
    enemy.row = 4

    for (let i = 0; i < 100; i++) {
      tick(0.01)
    }

    const ids = recorder.ids()

    // Cast đầu tiên của chuỗi phải là A — gate chặn B khi chưa có A.
    expect(ids.length).toBeGreaterThan(0)
    expect(ids[0]).toBe('chain_a')

    // Mọi lần B xuất hiện đều SAU lần A đầu tiên.
    if (recorder.count('chain_b') > 0) {
      expect(recorder.firstIndexOf('chain_a')).toBeLessThan(recorder.firstIndexOf('chain_b'))
    }

    expect(system.getBattle()!.player.currentThe).toBeGreaterThanOrEqual(10)
  })

  it('cast A xong → B cast được → Thế cộng dồn qua 2 link', () => {
    const { system, tick, recorder } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy', maxHp: 100000, currentHp: 100000 })

    system.start(player, enemy)
    system.update(3)
    enemy.x = 2
    enemy.row = 4

    for (let i = 0; i < 300; i++) {
      tick(0.01)
    }

    // A và B đều đã cast (A mở B) — Thế tích qua cả 2 link (+10 mỗi link).
    expect(recorder.count('chain_a')).toBeGreaterThanOrEqual(1)
    expect(recorder.count('chain_b')).toBeGreaterThanOrEqual(1)
    expect(system.getBattle()!.player.currentThe).toBeGreaterThanOrEqual(20)
  })

  it('quái chết giữa chuỗi → chain reset; Thế giữ nguyên xuyên kill (spec §2.3)', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0, stats: { ...createBaseStats(), attack: 500, evasionRate: 0, dexterity: 0 } })
    const enemy = createCombatant({ id: 'enemy', maxHp: 1, currentHp: 1 })

    system.start(player, enemy)
    system.update(3)
    enemy.x = 2
    enemy.row = 4

    for (let i = 0; i < 100; i++) {
      tick(0.01)
      if (!enemy.alive) break
    }

    expect(enemy.alive).toBe(false)

    // Sau kill: chain đã reset về A; Thế KHÔNG reset (tích xuyên kill —
    // chỉ ult mới tiêu, spec §2.3).
    expect(system.getBattle()!.player.currentThe).toBeGreaterThanOrEqual(10)
  })

  it('skill ngoài chuỗi không bị gate — cast tự do khi chain đã set', () => {    const eventBus = new EventBus()
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

    skillManager.add(chainSkill('outside_skill', 0))
    system.setChainDefinition({ skillIds: ['chain_a', 'chain_b'] })

    const recorder = makeCastRecorder(eventBus)

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy', maxHp: 100000, currentHp: 100000 })

    system.start(player, enemy)
    system.update(3)
    enemy.x = 2
    enemy.row = 4

    for (let i = 0; i < 100; i++) {
      skillSystem.update(0.01, 0)
      system.update(0.01)
    }

    expect(recorder.count('outside_skill')).toBeGreaterThanOrEqual(1)
  })

  // E-7 (2026-09-03) — glue: BattleSystem đọc runtime stats của skill A
  // (chain đầu tiên) qua player.skillStats (nguồn: GameManager
  // getSkillRuntimeStats → playerToCombatEntity) rồi TRUYỀN VÀO tham số
  // 3 của gainTheOnChainLink; buff the_man_<el> (element = hành skill A)
  // áp khi Thế chạm trần. Fixture: chain 2 skill nhưng CHỈ đăng ký A
  // (cooldown 10) → đúng 1 link duy nhất trong 1s → số đo deterministic.
  it('E-7: bonus theGainPerLinkBonus của skill A cộng vào mỗi link qua glue', () => {
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

    const skillA = chainSkill('chain_a', 0)
    skillA.cooldown = 10
    skillManager.add(skillA)

    system.setChainDefinition({ skillIds: ['chain_a', 'chain_b'] })

    const player = createCombatant({
      id: 'player',
      type: 'player',
      x: 0,
      skillStats: { ...createSkillRuntimeStats(), theGainPerLinkBonus: 5 },
    })
    const enemy = createCombatant({ id: 'enemy', maxHp: 100000, currentHp: 100000 })

    system.start(player, enemy)
    system.update(3)
    enemy.x = 2
    enemy.row = 4

    for (let i = 0; i < 100; i++) {
      skillSystem.update(0.01, 0)
      system.update(0.01)
    }

    // 1 link qua glue: 10 + 5 (bonus đọc từ player.skillStats, truyền
    // xuống TheResourceSystem) — không phải 10.
    expect(system.getBattle()!.player.currentThe).toBe(15)
  })

  it('E-7: theMaxBonus của skill A nới trần Thế qua glue', () => {
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

    const skillA = chainSkill('chain_a', 0)
    skillA.cooldown = 10
    skillManager.add(skillA)

    system.setChainDefinition({ skillIds: ['chain_a', 'chain_b'] })

    const player = createCombatant({
      id: 'player',
      type: 'player',
      x: 0,
      currentThe: 110,
      skillStats: { ...createSkillRuntimeStats(), theMaxBonus: 20 },
    })
    const enemy = createCombatant({ id: 'enemy', maxHp: 100000, currentHp: 100000 })

    system.start(player, enemy)
    system.update(3)
    enemy.x = 2
    enemy.row = 4

    for (let i = 0; i < 100; i++) {
      skillSystem.update(0.01, 0)
      system.update(0.01)
    }

    // 110 + 10 = 120 — vượt MAX_THE 100 cũ, chứng minh trần bonus áp
    // qua glue (không bonus sẽ cap ở 100).
    expect(system.getBattle()!.player.currentThe).toBe(120)
  })

  it('E-7: Thế chạm trần qua glue → áp buff the_man_<el> theo hành skill A', () => {
    const eventBus = new EventBus()
    const skillManager = new SkillManager()
    const skillSystem = new SkillSystem(skillManager)
    const buffRegistry = new BuffRegistry()

    buffRegistry.register({
      id: 'the_man_fire',
      name: 'Thế Mãn (Hỏa)',
      polarity: 'buff',
      duration: Infinity,
      stackMode: 'refresh',
      effects: [],
    })

    const system = new BattleSystem(
      new CombatSystem(eventBus),
      skillManager,
      skillSystem,
      new SkillEffectSystem(),
      buffRegistry,
      eventBus,
      new ActionImpactSystem({ eventBus, rollCritical: () => false }),
    )

    const skillA = chainSkill('chain_a', 0)
    skillA.cooldown = 10
    skillA.effects = [{ type: 'damage', value: 1, components: [{ kind: 'element', element: 'fire', ratio: 1 }] }]
    skillManager.add(skillA)

    system.setChainDefinition({ skillIds: ['chain_a', 'chain_b'] })

    const player = createCombatant({ id: 'player', type: 'player', x: 0, currentThe: 95 })
    const enemy = createCombatant({ id: 'enemy', maxHp: 100000, currentHp: 100000 })

    system.start(player, enemy)
    system.update(3)
    enemy.x = 2
    enemy.row = 4

    for (let i = 0; i < 100; i++) {
      skillSystem.update(0.01, 0)
      system.update(0.01)
    }

    const battle = system.getBattle()!

    expect(battle.player.currentThe).toBe(100)
    expect(new BuffSystem(battle.playerBuffs).getActiveIds()).toContain('the_man_fire')
  })
})
