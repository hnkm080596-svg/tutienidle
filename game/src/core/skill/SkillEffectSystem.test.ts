import { describe, expect, it, vi } from 'vitest'
import { SkillEffectSystem } from './SkillEffectSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { BuffSystem } from '../buff/BuffSystem'
import { BuffPool } from '../buff/BuffPool'
import { BuffRegistry } from '../buff/BuffRegistry'
import { ReactionManager } from '../element/ReactionManager'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import { createSkillRuntimeStats } from './SkillRuntimeStats'
import { buffs } from '../../data/buff/buffs'
import type { CombatEntity } from '../combat/CombatEntity'
import type { SkillEffectContext } from './SkillEffectSystem'

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats()

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

function createContext(eventBus: EventBus, targetBuffs: BuffSystem): SkillEffectContext {
  const buffRegistry = new BuffRegistry()

  for (const definition of buffs) {
    buffRegistry.register(definition)
  }

  return {
    combatSystem: new CombatSystem(eventBus),
    fireHit: () => {},
    buffRegistry,
    sourceBuffs: new BuffSystem(new BuffPool()),
    targetBuffs,
    reactionManager: new ReactionManager(eventBus),
  }
}

// Unit-style helpers (mocked ctx, no real registries) — mirrors
// SkillActionRegistry.test.ts's convention, used for the case 'debuff'
// proc-mechanic tests below where only specific ctx methods matter.
function makeEntity(overrides: Partial<CombatEntity> = {}): CombatEntity {
  return {
    id: 'entity',
    alive: true,
    realmIndex: 0,
    currentSwordIntent: 0,
    currentKimThe: 0,
    stats: { skillDamagePercent: 0, maxMp: 0, attack: 10, elementApplicationPercent: 0 } as CombatEntity['stats'],
    ...overrides,
  } as CombatEntity
}

function makeCtx(overrides: Partial<SkillEffectContext> = {}): SkillEffectContext {
  return {
    combatSystem: {} as SkillEffectContext['combatSystem'],
    fireHit: vi.fn(() => ({ landed: true })),
    buffRegistry: { get: (id: string) => ({ id }) } as unknown as SkillEffectContext['buffRegistry'],
    sourceBuffs: { apply: vi.fn() } as unknown as SkillEffectContext['sourceBuffs'],
    targetBuffs: { apply: vi.fn() } as unknown as SkillEffectContext['targetBuffs'],
    reactionManager: { checkAndTrigger: () => {} } as unknown as SkillEffectContext['reactionManager'],
    ...overrides,
  }
}

describe("apply() — case 'debuff' (absorbs old case 'ailment': chance roll, Kim Thế/Huyết Phá procs, reaction check)", () => {
  it('rolls chance + elementApplicationPercent, applies via targetBuffs, fires reaction check', () => {
    const source = makeEntity({ stats: { elementApplicationPercent: 0.1 } as CombatEntity['stats'] })
    const target = makeEntity()
    const apply = vi.fn()
    const checkAndTrigger = vi.fn()
    const ctx = makeCtx({
      targetBuffs: { apply } as unknown as SkillEffectContext['targetBuffs'],
      reactionManager: { checkAndTrigger } as unknown as SkillEffectContext['reactionManager'],
    })
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const system = new SkillEffectSystem()
    system.apply({ type: 'debuff', buffId: 'bong', ailmentChance: 0.8 }, source, target, ctx)

    expect(apply).toHaveBeenCalled()
    expect(checkAndTrigger).toHaveBeenCalled()

    vi.restoreAllMocks()
  })

  it('grantsKimThePerProc still grants Kim Thế on a successful debuff proc', () => {
    const source = makeEntity({
      currentKimThe: 0,
      skillStats: { ...createSkillRuntimeStats(), kimTheGainPerProc: 5 },
    })
    const target = makeEntity()
    const ctx = makeCtx()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const system = new SkillEffectSystem()
    system.apply(
      { type: 'debuff', buffId: 'bong', ailmentChance: 1, grantsKimThePerProc: true },
      source, target, ctx,
    )

    expect(source.currentKimThe).toBeGreaterThan(0)

    vi.restoreAllMocks()
  })
})

describe('SkillEffectSystem — effect "debuff" trigger Reaction (Combat Rework Phase 6, absorbs old "ailment")', () => {
  it('2 skill effect debuff khác hành liên tiếp lên cùng target thì tự kích Reaction', () => {
    const eventBus = new EventBus()
    const skillEffectSystem = new SkillEffectSystem()
    const targetBuffs = new BuffSystem(new BuffPool())
    const ctx = createContext(eventBus, targetBuffs)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    // Skill 1 (giả lập 1 kỹ năng Hỏa Tu bất kỳ) — áp Bỏng.
    skillEffectSystem.apply({ type: 'debuff', buffId: 'bong', ailmentChance: 1 }, source, target, ctx)

    expect(targetBuffs.getActiveIds()).toEqual(['bong'])

    // Skill 2 (giả lập 1 kỹ năng Thủy Tu bất kỳ) — áp Tê Cóng, khớp
    // ELEMENT_REACTIONS['bong']['te_cong'] ("Bốc Hơi", 60 dmg) — phải
    // TỰ kích qua đúng ctx.reactionManager, không cần gọi tay thêm.
    skillEffectSystem.apply({ type: 'debuff', buffId: 'te_cong', ailmentChance: 1 }, source, target, ctx)

    // Combat Balance Pass (2026-08-29) — powerScalingRatio 1.0 (T5.4):
    // 60 + attack(10)×1.0 = 70.
    expect(target.currentHp).toBe(1000 - 70)
    expect(targetBuffs.getActiveIds()).toEqual([])
  })

  it('cùng 1 hành (skill lặp lại) thì KHÔNG tự kích Reaction', () => {
    const eventBus = new EventBus()
    const skillEffectSystem = new SkillEffectSystem()
    const targetBuffs = new BuffSystem(new BuffPool())
    const ctx = createContext(eventBus, targetBuffs)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    skillEffectSystem.apply({ type: 'debuff', buffId: 'bong', ailmentChance: 1 }, source, target, ctx)
    skillEffectSystem.apply({ type: 'debuff', buffId: 'bong', ailmentChance: 1 }, source, target, ctx)

    expect(target.currentHp).toBe(1000)
    expect(targetBuffs.getActiveIds()).toEqual(['bong'])
  })
})

// Hỏa Tu Trúc Cơ (Plans/FirePath mục 6/8, "Dẫn Hỏa"/"Hỏa Nguyên",
// 2026-08-21) — elementApplicationPercent cộng THẲNG vào ailmentChance
// gốc của skill, clamp tối đa 1. Test bằng 2 biên xác định (0 và 1),
// không cần mock Math.random — Math.random() luôn nằm trong [0, 1) nên
// "< 0" luôn false và "< 1" luôn true, tất định 100%.
describe('SkillEffectSystem — effect "debuff" elementApplicationPercent (Plans/FirePath)', () => {
  it('ailmentChance gốc 0 + elementApplicationPercent 0 — không bao giờ áp', () => {
    const eventBus = new EventBus()
    const skillEffectSystem = new SkillEffectSystem()
    const targetBuffs = new BuffSystem(new BuffPool())
    const ctx = createContext(eventBus, targetBuffs)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target' })

    skillEffectSystem.apply({ type: 'debuff', buffId: 'bong', ailmentChance: 0 }, source, target, ctx)

    expect(targetBuffs.getActiveIds()).toEqual([])
  })

  it('ailmentChance gốc 0 + elementApplicationPercent 1 ("Dẫn Hỏa" + "Hỏa Nguyên" cộng dồn đủ) — luôn áp', () => {
    const eventBus = new EventBus()
    const skillEffectSystem = new SkillEffectSystem()
    const targetBuffs = new BuffSystem(new BuffPool())
    const ctx = createContext(eventBus, targetBuffs)

    const source = createCombatant({ id: 'source', type: 'player' })

    source.stats.elementApplicationPercent = 1

    const target = createCombatant({ id: 'target' })

    skillEffectSystem.apply({ type: 'debuff', buffId: 'bong', ailmentChance: 0 }, source, target, ctx)

    expect(targetBuffs.getActiveIds()).toEqual(['bong'])
  })

  it('elementApplicationPercent clamp tối đa 1 — không throw/lỗi khi vượt 1', () => {
    const eventBus = new EventBus()
    const skillEffectSystem = new SkillEffectSystem()
    const targetBuffs = new BuffSystem(new BuffPool())
    const ctx = createContext(eventBus, targetBuffs)

    const source = createCombatant({ id: 'source', type: 'player' })

    source.stats.elementApplicationPercent = 5

    const target = createCombatant({ id: 'target' })

    expect(() => skillEffectSystem.apply({ type: 'debuff', buffId: 'bong', ailmentChance: 0.5 }, source, target, ctx)).not.toThrow()
    expect(targetBuffs.getActiveIds()).toEqual(['bong'])
  })
})

describe('SkillEffectSystem — guard latent (attributes rỗng, target chết giữa chừng)', () => {
  it('attributeScaling với attributes rỗng — multiplier không thành -Infinity', () => {
    const eventBus = new EventBus()
    const skillEffectSystem = new SkillEffectSystem()
    const targetBuffs = new BuffSystem(new BuffPool())
    const ctx = createContext(eventBus, targetBuffs)

    const fired: number[] = []
    ctx.fireHit = (_target, damageInfo) => {
      fired.push(damageInfo.multiplier)
    }

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    skillEffectSystem.apply(
      { type: 'damage', value: 1, attributeScaling: [{ attributes: [], ratioPerPoint: 0.003 }] },
      source,
      target,
      ctx,
    )

    expect(fired).toHaveLength(1)
    expect(Number.isFinite(fired[0])).toBe(true)
    expect(fired[0]).toBeCloseTo(1, 5)
  })

  it('target chết vì damage — bỏ qua effect còn lại, không áp debuff lên xác', () => {
    const eventBus = new EventBus()
    const skillEffectSystem = new SkillEffectSystem()
    const targetBuffs = new BuffSystem(new BuffPool())
    const ctx = createContext(eventBus, targetBuffs)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    ctx.fireHit = () => {
      target.currentHp = 0
      target.alive = false
    }

    skillEffectSystem.applyAll(
      [
        { type: 'damage', value: 1 },
        { type: 'debuff', buffId: 'bong', ailmentChance: 1 },
      ],
      source,
      target,
      ctx,
    )

    expect(targetBuffs.getActiveIds()).toEqual([])
  })

  it('hitCountByRealm — dừng loạt hit khi target chết giữa chừng', () => {
    const eventBus = new EventBus()
    const skillEffectSystem = new SkillEffectSystem()
    const targetBuffs = new BuffSystem(new BuffPool())
    const ctx = createContext(eventBus, targetBuffs)

    const source = createCombatant({ id: 'source', type: 'player', realmIndex: 3 })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    let hits = 0
    ctx.fireHit = () => {
      hits++
      target.currentHp = 0
      target.alive = false
    }

    skillEffectSystem.apply({ type: 'damage', value: 1, hitCountByRealm: true }, source, target, ctx)

    // realmIndex 3 = 4 hit nếu target sống; chết sau hit 1 → dừng ngay.
    expect(hits).toBe(1)
  })
})
