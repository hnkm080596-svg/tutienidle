import { describe, expect, it } from 'vitest'
import { SkillEffectSystem } from './SkillEffectSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { BuffSystem } from '../buff/BuffSystem'
import { BuffManager } from '../buff/BuffManager'
import { BuffRegistry } from '../buff/BuffRegistry'
import { AilmentSystem } from '../ailment/AilmentSystem'
import { AilmentManager } from '../ailment/AilmentManager'
import { AilmentRegistry } from '../ailment/AilmentRegistry'
import { ReactionManager } from '../element/ReactionManager'
import { EventBus } from '../events/EventBus'
import { ActionImpactSystem } from '../battle/ActionImpactSystem'
import { createBaseStats } from '../stats/StatBlock'
import { ailments } from '../../data/ailment/ailments'
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
    currentRage: 0,
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

function createContext(eventBus: EventBus, targetAilments: AilmentSystem): SkillEffectContext {
  const ailmentRegistry = new AilmentRegistry()

  for (const template of ailments) {
    ailmentRegistry.register(template)
  }

  return {
    combatSystem: new CombatSystem(eventBus),
        fireHit: () => {},
    buffRegistry: new BuffRegistry(),
    ailmentRegistry,
    sourceBuffs: new BuffSystem(new BuffManager()),
    targetBuffs: new BuffSystem(new BuffManager()),
    targetAilments,
    reactionManager: new ReactionManager(eventBus),
  }
}

describe('SkillEffectSystem — effect "ailment" trigger Reaction (Combat Rework Phase 6)', () => {
  it('2 skill effect ailment khác hành liên tiếp lên cùng target thì tự kích Reaction', () => {
    const eventBus = new EventBus()
    const skillEffectSystem = new SkillEffectSystem()
    const targetAilments = new AilmentSystem(new AilmentManager())
    const ctx = createContext(eventBus, targetAilments)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    // Skill 1 (giả lập 1 kỹ năng Hỏa Tu bất kỳ) — áp Bỏng.
    skillEffectSystem.apply({ type: 'ailment', ailmentId: 'bong', ailmentChance: 1 }, source, target, ctx)

    expect(targetAilments.getActiveIds()).toEqual(['bong'])

    // Skill 2 (giả lập 1 kỹ năng Thủy Tu bất kỳ) — áp Tê Cóng, khớp
    // ELEMENT_REACTIONS['bong']['te_cong'] ("Bốc Hơi", 60 dmg) — phải
    // TỰ kích qua đúng ctx.reactionManager, không cần gọi tay thêm.
    skillEffectSystem.apply({ type: 'ailment', ailmentId: 'te_cong', ailmentChance: 1 }, source, target, ctx)

    // Combat Balance Pass (2026-08-29) — powerScalingRatio 0.5:
    // 60 + attack(10)×0.5 = 65.
    expect(target.currentHp).toBe(1000 - 65)
    expect(targetAilments.getActiveIds()).toEqual([])
  })

  it('cùng 1 hành (skill lặp lại) thì KHÔNG tự kích Reaction', () => {
    const eventBus = new EventBus()
    const skillEffectSystem = new SkillEffectSystem()
    const targetAilments = new AilmentSystem(new AilmentManager())
    const ctx = createContext(eventBus, targetAilments)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    skillEffectSystem.apply({ type: 'ailment', ailmentId: 'bong', ailmentChance: 1 }, source, target, ctx)
    skillEffectSystem.apply({ type: 'ailment', ailmentId: 'bong', ailmentChance: 1 }, source, target, ctx)

    expect(target.currentHp).toBe(1000)
    expect(targetAilments.getActiveIds()).toEqual(['bong'])
  })
})

// Hỏa Tu Trúc Cơ (Plans/FirePath mục 6/8, "Dẫn Hỏa"/"Hỏa Nguyên",
// 2026-08-21) — elementApplicationPercent cộng THẲNG vào ailmentChance
// gốc của skill, clamp tối đa 1. Test bằng 2 biên xác định (0 và 1),
// không cần mock Math.random — Math.random() luôn nằm trong [0, 1) nên
// "< 0" luôn false và "< 1" luôn true, tất định 100%.
describe('SkillEffectSystem — effect "ailment" elementApplicationPercent (Plans/FirePath)', () => {
  it('ailmentChance gốc 0 + elementApplicationPercent 0 — không bao giờ áp', () => {
    const eventBus = new EventBus()
    const skillEffectSystem = new SkillEffectSystem()
    const targetAilments = new AilmentSystem(new AilmentManager())
    const ctx = createContext(eventBus, targetAilments)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target' })

    skillEffectSystem.apply({ type: 'ailment', ailmentId: 'bong', ailmentChance: 0 }, source, target, ctx)

    expect(targetAilments.getActiveIds()).toEqual([])
  })

  it('ailmentChance gốc 0 + elementApplicationPercent 1 ("Dẫn Hỏa" + "Hỏa Nguyên" cộng dồn đủ) — luôn áp', () => {
    const eventBus = new EventBus()
    const skillEffectSystem = new SkillEffectSystem()
    const targetAilments = new AilmentSystem(new AilmentManager())
    const ctx = createContext(eventBus, targetAilments)

    const source = createCombatant({ id: 'source', type: 'player' })

    source.stats.elementApplicationPercent = 1

    const target = createCombatant({ id: 'target' })

    skillEffectSystem.apply({ type: 'ailment', ailmentId: 'bong', ailmentChance: 0 }, source, target, ctx)

    expect(targetAilments.getActiveIds()).toEqual(['bong'])
  })

  it('elementApplicationPercent clamp tối đa 1 — không throw/lỗi khi vượt 1', () => {
    const eventBus = new EventBus()
    const skillEffectSystem = new SkillEffectSystem()
    const targetAilments = new AilmentSystem(new AilmentManager())
    const ctx = createContext(eventBus, targetAilments)

    const source = createCombatant({ id: 'source', type: 'player' })

    source.stats.elementApplicationPercent = 5

    const target = createCombatant({ id: 'target' })

    expect(() => skillEffectSystem.apply({ type: 'ailment', ailmentId: 'bong', ailmentChance: 0.5 }, source, target, ctx)).not.toThrow()
    expect(targetAilments.getActiveIds()).toEqual(['bong'])
  })
})

describe('SkillEffectSystem — guard latent (attributes rỗng, target chết giữa chừng)', () => {
  it('attributeScaling với attributes rỗng — multiplier không thành -Infinity', () => {
    const eventBus = new EventBus()
    const skillEffectSystem = new SkillEffectSystem()
    const targetAilments = new AilmentSystem(new AilmentManager())
    const ctx = createContext(eventBus, targetAilments)

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

  it('target chết vì damage — bỏ qua effect còn lại, không áp ailment lên xác', () => {
    const eventBus = new EventBus()
    const skillEffectSystem = new SkillEffectSystem()
    const targetAilments = new AilmentSystem(new AilmentManager())
    const ctx = createContext(eventBus, targetAilments)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    ctx.fireHit = () => {
      target.currentHp = 0
      target.alive = false
    }

    skillEffectSystem.applyAll(
      [
        { type: 'damage', value: 1 },
        { type: 'ailment', ailmentId: 'bong', ailmentChance: 1 },
      ],
      source,
      target,
      ctx,
    )

    expect(targetAilments.getActiveIds()).toEqual([])
  })

  it('hitCountByRealm — dừng loạt hit khi target chết giữa chừng', () => {
    const eventBus = new EventBus()
    const skillEffectSystem = new SkillEffectSystem()
    const targetAilments = new AilmentSystem(new AilmentManager())
    const ctx = createContext(eventBus, targetAilments)

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
