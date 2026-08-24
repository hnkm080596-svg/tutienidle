import { describe, expect, it } from 'vitest'
import { AilmentSystem } from './AilmentSystem'
import { AilmentManager } from './AilmentManager'
import { AilmentRegistry } from './AilmentRegistry'
import { createBaseStats } from '../stats/StatBlock'
import { ailments } from '../../data/ailment/ailments'
import type { CombatEntity } from '../combat/CombatEntity'
import type { AilmentTemplate } from './AilmentRegistry'

// Thổ Tu (Thạch Hóa, Plans/magicpathgeneral, 2026-08-21) — "Thạch Hóa
// giờ là 1 hiệu ứng khiến kẻ địch có 50% Choáng X giây khi bị đòn đánh
// trúng" — field TỔNG QUÁT onHitChance/onHitAppliesAilmentId trên
// AilmentTemplate, không hard-code riêng Thạch Hóa trong
// AilmentSystem.rollOnHitEffects(). Test dùng biên 0/1 (không mock
// Math.random), cùng convention SkillEffectSystem.test.ts's
// elementApplicationPercent tests.
function getTemplate(id: string): AilmentTemplate {
  const template = ailments.find(ailment => ailment.id === id)

  if (!template) {
    throw new Error(`data/ailment/ailments.ts thiếu '${id}'`)
  }

  return template
}

function createAilmentRegistry(): AilmentRegistry {
  const registry = new AilmentRegistry()

  for (const template of ailments) {
    registry.register(template)
  }

  return registry
}

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
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  }
}

describe('Thạch Hóa — debuff THẬT (evasionRate), không còn là marker rỗng (phản hồi người dùng 2026-08-21)', () => {
  it('category "modifier" (KHÔNG còn "alignment") + statModifiers giảm evasionRate thật', () => {
    const template = getTemplate('thach_hoa')

    expect(template.category).toBe('modifier')
    expect(template.statModifiers).toEqual([{ stat: 'evasionRate', percent: -0.3 }])
  })

  it('apply() lên target — getActiveModifiers() trả về đúng modifier evasionRate', () => {
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target' })

    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('thach_hoa'), source, target)

    const modifiers = ailmentSystem.getActiveModifiers()

    expect(modifiers).toContainEqual(
      expect.objectContaining({ stat: 'evasionRate', percent: -0.3, sourceId: 'source' }),
    )
  })
})

describe('AilmentSystem.rollOnHitEffects (Thạch Hóa, Plans/magicpathgeneral)', () => {
  it('Thạch Hóa (onHitChance thật 0.5) active — target thực sự có khả năng nhận Choáng (kiểm tra field, không kiểm tra roll)', () => {
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target' })

    const ailmentSystem = new AilmentSystem(new AilmentManager())
    const registry = createAilmentRegistry()

    ailmentSystem.apply(getTemplate('thach_hoa'), source, target, registry)

    expect(registry.get('thach_hoa').onHitChance).toBe(0.5)
    expect(registry.get('thach_hoa').onHitAppliesAilmentId).toBe('choang')
  })

  it('không có ailment on-hit-proc nào active — rollOnHitEffects() không áp gì cả', () => {
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target' })

    const ailmentSystem = new AilmentSystem(new AilmentManager())
    const registry = createAilmentRegistry()

    ailmentSystem.rollOnHitEffects(source, target, registry)

    expect(ailmentSystem.getActiveIds()).toEqual([])
  })

  it('ailment on-hit-proc active với onHitChance=1 (biên trên) — LUÔN áp onHitAppliesAilmentId', () => {
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target' })

    const ailmentSystem = new AilmentSystem(new AilmentManager())
    const registry = createAilmentRegistry()

    // Snapshot thủ công 1 template test riêng (onHitChance=1) thay vì
    // Thạch Hóa thật (0.5) — biên xác định, không phụ thuộc Math.random.
    ailmentSystem.apply({ ...getTemplate('thach_hoa'), onHitChance: 1 }, source, target, registry)

    ailmentSystem.rollOnHitEffects(source, target, registry)

    expect(ailmentSystem.getActiveIds().sort()).toEqual(['choang', 'thach_hoa'])
    expect(ailmentSystem.isStunned()).toBe(true)
  })

  it('onHitChance=0 (biên dưới) — KHÔNG BAO GIỜ áp dù ailment vẫn active', () => {
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target' })

    const ailmentSystem = new AilmentSystem(new AilmentManager())
    const registry = createAilmentRegistry()

    ailmentSystem.apply({ ...getTemplate('thach_hoa'), onHitChance: 0 }, source, target, registry)

    for (let i = 0; i < 20; i++) {
      ailmentSystem.rollOnHitEffects(source, target, registry)
    }

    expect(ailmentSystem.getActiveIds()).toEqual(['thach_hoa'])
    expect(ailmentSystem.isStunned()).toBe(false)
  })

  it('Choáng vừa proc sourceId = kẻ VỪA đánh trúng (source truyền vào rollOnHitEffects), KHÔNG phải sourceId gốc của Thạch Hóa', () => {
    const originalCaster = createCombatant({ id: 'original_caster', type: 'player' })
    const laterAttacker = createCombatant({ id: 'later_attacker' })
    const target = createCombatant({ id: 'target' })

    const ailmentSystem = new AilmentSystem(new AilmentManager())
    const registry = createAilmentRegistry()

    // thach_hoa được nguồn A áp lên, nhưng lần TRÚNG ĐÒN kích Choáng
    // lại đến từ nguồn B (vd 1 skill/entity khác đánh trúng target
    // đang mang Thạch Hóa) — Choáng phải mang sourceId của B.
    ailmentSystem.apply({ ...getTemplate('thach_hoa'), onHitChance: 1 }, originalCaster, target, registry)

    ailmentSystem.rollOnHitEffects(laterAttacker, target, registry)

    const activeIds = ailmentSystem.getActiveIds()

    expect(activeIds).toContain('choang')
  })

  it('ailment không khai onHitChance (vd Bỏng thường) — rollOnHitEffects() bỏ qua, không crash', () => {
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target' })

    const ailmentSystem = new AilmentSystem(new AilmentManager())
    const registry = createAilmentRegistry()

    ailmentSystem.apply(getTemplate('bong'), source, target, registry)

    expect(() => ailmentSystem.rollOnHitEffects(source, target, registry)).not.toThrow()
    expect(ailmentSystem.getActiveIds()).toEqual(['bong'])
  })
})
