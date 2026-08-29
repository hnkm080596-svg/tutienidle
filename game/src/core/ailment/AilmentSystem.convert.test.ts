import { describe, expect, it } from 'vitest'
import { AilmentSystem } from './AilmentSystem'
import { AilmentManager } from './AilmentManager'
import { AilmentRegistry } from './AilmentRegistry'
import { CombatSystem } from '../combat/CombatSystem'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import { ailments } from '../../data/ailment/ailments'
import type { CombatEntity } from '../combat/CombatEntity'
import type { AilmentTemplate } from './AilmentRegistry'

function getTemplate(id: string): AilmentTemplate {
  const template = ailments.find(ailment => ailment.id === id)

  if (!template) {
    throw new Error(`data/ailment/ailments.ts thiếu '${id}' — kiểm tra lại id`)
  }

  return template
}

function createRegistry(): AilmentRegistry {
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

// Làm Chậm giữ liên tục 2s -> Đóng Băng (AilmentSystem.update()'s
// convertAilment()). Duration ailment SAU chuyển hoá phải qua cùng công
// thức kháng cự như apply() — trước đây lấy trần duration template
// (kháng cự của đích bị bỏ qua). Đo qua thời điểm Đóng Băng hết hạn
// (isFrozen()), không đụng private manager.
describe('AilmentSystem — chuyển hoá (Làm Chậm -> Đóng Băng) áp dụng kháng cự', () => {
  it('target không kháng — Đóng Băng sống đủ 2s (duration template)', () => {
    const combatSystem = new CombatSystem(new EventBus())
    const registry = createRegistry()
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target' })
    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('lam_cham'), source, target, registry)
    ailmentSystem.update(2, target, combatSystem, registry)

    expect(ailmentSystem.isFrozen()).toBe(true)

    ailmentSystem.update(1.5, target, combatSystem, registry)
    expect(ailmentSystem.isFrozen()).toBe(true)

    ailmentSystem.update(1, target, combatSystem, registry)
    expect(ailmentSystem.isFrozen()).toBe(false)
  })

  it('target kháng 50% — Đóng Băng chỉ còn 1s', () => {
    const combatSystem = new CombatSystem(new EventBus())
    const registry = createRegistry()
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', stats: { ...createBaseStats(), ailmentResistPercent: 0.5 } })
    const ailmentSystem = new AilmentSystem(new AilmentManager())

    ailmentSystem.apply(getTemplate('lam_cham'), source, target, registry)
    ailmentSystem.update(2, target, combatSystem, registry)

    expect(ailmentSystem.isFrozen()).toBe(true)

    ailmentSystem.update(0.5, target, combatSystem, registry)
    expect(ailmentSystem.isFrozen()).toBe(true)

    ailmentSystem.update(1, target, combatSystem, registry)
    expect(ailmentSystem.isFrozen()).toBe(false)
  })

  it('nguồn có ailmentDurationPercent +50% — nhân thêm sau kháng cự (1.5s)', () => {
    const combatSystem = new CombatSystem(new EventBus())
    const registry = createRegistry()
    const source = createCombatant({ id: 'source', type: 'player', stats: { ...createBaseStats(), ailmentDurationPercent: 0.5 } })
    const target = createCombatant({ id: 'target', stats: { ...createBaseStats(), ailmentResistPercent: 0.5 } })
    const ailmentSystem = new AilmentSystem(new AilmentManager())
    const resolveSource = (sourceId: string) => (sourceId === source.id ? source : undefined)

    ailmentSystem.apply(getTemplate('lam_cham'), source, target, registry)
    ailmentSystem.update(2, target, combatSystem, registry, resolveSource)

    expect(ailmentSystem.isFrozen()).toBe(true)

    ailmentSystem.update(1, target, combatSystem, registry, resolveSource)
    expect(ailmentSystem.isFrozen()).toBe(true)

    ailmentSystem.update(1, target, combatSystem, registry, resolveSource)
    expect(ailmentSystem.isFrozen()).toBe(false)
  })
})
