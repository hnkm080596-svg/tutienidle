import { describe, expect, it, vi } from 'vitest'
import { SkillEffectSystem } from './SkillEffectSystem'
import type { SkillEffectContext } from './SkillEffectSystem'
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
import type { SkillEffect } from './SkillEffect'

// Pháp Tu Thuần Hệ (plan 2026-09-03, engine E-1..E-5) — tests cho các
// mở rộng SkillEffect/SkillEffectSystem: add_stack/remove_buff active
// (E-3), hitCount cố định (E-4), grantsZone + element (E-5),
// spreadsAilmentId (E-1), stacksPerAffectedTarget (E-2).

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

function createRegistry(): BuffRegistry {
  const registry = new BuffRegistry()

  for (const definition of buffs) {
    registry.register(definition)
  }

  return registry
}

function createContext(overrides: Partial<SkillEffectContext> = {}): SkillEffectContext {
  const eventBus = new EventBus()

  return {
    combatSystem: new CombatSystem(eventBus),
    fireHit: vi.fn(() => ({ landed: true })),
    buffRegistry: createRegistry(),
    sourceBuffs: new BuffSystem(new BuffPool()),
    targetBuffs: new BuffSystem(new BuffPool()),
    reactionManager: new ReactionManager(eventBus),
    ...overrides,
  }
}

describe("SkillEffectSystem — E-3: 'add_stack' cho active skill", () => {
  it('add_stack +2 trên target đang có trung_doc 2 tầng → 4 tầng', () => {
    const system = new SkillEffectSystem()
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target' })
    const targetBuffs = new BuffSystem(new BuffPool())
    const ctx = createContext({ targetBuffs })

    // 2 lần apply = 2 tầng (trung_doc stackMode 'stack').
    targetBuffs.apply(ctx.buffRegistry.get('trung_doc'), source, target, ctx.buffRegistry)
    targetBuffs.apply(ctx.buffRegistry.get('trung_doc'), source, target, ctx.buffRegistry)
    expect(targetBuffs.getStacks('trung_doc')).toBe(2)

    system.apply({ type: 'add_stack', buffId: 'trung_doc', stacks: 2 }, source, target, ctx)

    expect(targetBuffs.getStacks('trung_doc')).toBe(4)
  })

  it('add_stack mặc định +1 khi không khai stacks', () => {
    const system = new SkillEffectSystem()
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target' })
    const targetBuffs = new BuffSystem(new BuffPool())
    const ctx = createContext({ targetBuffs })

    targetBuffs.apply(ctx.buffRegistry.get('trung_doc'), source, target, ctx.buffRegistry)

    system.apply({ type: 'add_stack', buffId: 'trung_doc' }, source, target, ctx)

    expect(targetBuffs.getStacks('trung_doc')).toBe(2)
  })

  it('add_stack không tạo mới khi target chưa có buff (no-op)', () => {
    const system = new SkillEffectSystem()
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target' })
    const targetBuffs = new BuffSystem(new BuffPool())
    const ctx = createContext({ targetBuffs })

    system.apply({ type: 'add_stack', buffId: 'trung_doc', stacks: 3 }, source, target, ctx)

    expect(targetBuffs.getActiveIds()).toEqual([])
  })

  it('add_stack cộng dồn qua nhiều nguồn nhưng cap ở maxStacks của buff', () => {
    const system = new SkillEffectSystem()
    const source = createCombatant({ id: 'source', type: 'player' })
    const other = createCombatant({ id: 'other', type: 'player' })
    const target = createCombatant({ id: 'target' })
    const targetBuffs = new BuffSystem(new BuffPool())
    const ctx = createContext({ targetBuffs })

    // 2 nguồn, mỗi nguồn 2 tầng → tổng 4; +3 từ source → 5 (trần maxStacks 5).
    targetBuffs.apply(ctx.buffRegistry.get('trung_doc'), source, target, ctx.buffRegistry)
    targetBuffs.apply(ctx.buffRegistry.get('trung_doc'), source, target, ctx.buffRegistry)
    targetBuffs.apply(ctx.buffRegistry.get('trung_doc'), other, target, ctx.buffRegistry)
    targetBuffs.apply(ctx.buffRegistry.get('trung_doc'), other, target, ctx.buffRegistry)

    system.apply({ type: 'add_stack', buffId: 'trung_doc', stacks: 3 }, source, target, ctx)

    expect(targetBuffs.getStacks('trung_doc')).toBe(5)
  })

  it('add_stack refresh: true gia hạn thời gian các instance đang chạy', () => {
    const system = new SkillEffectSystem()
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target' })
    const targetBuffs = new BuffSystem(new BuffPool())
    const ctx = createContext({ targetBuffs })

    targetBuffs.apply(ctx.buffRegistry.get('trung_doc'), source, target, ctx.buffRegistry)

    const instance = targetBuffs.getFromSource('trung_doc', 'source')!
    instance.remainingTime = 1

    system.apply({ type: 'add_stack', buffId: 'trung_doc', stacks: 1, refresh: true }, source, target, ctx)

    expect(targetBuffs.getFromSource('trung_doc', 'source')!.remainingTime).toBeGreaterThan(1)
  })

  it('add_stack scope source tác động pool của source (vd khuếch đại buff self)', () => {
    const system = new SkillEffectSystem()
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target' })
    const sourceBuffs = new BuffSystem(new BuffPool())
    const ctx = createContext({ sourceBuffs })

    sourceBuffs.apply(ctx.buffRegistry.get('khai_son'), source, source, ctx.buffRegistry)

    system.apply({ type: 'add_stack', buffId: 'khai_son', stacks: 2, scope: 'source' }, source, target, ctx)

    expect(sourceBuffs.getStacks('khai_son')).toBe(3)
  })
})

describe("SkillEffectSystem — E-3: 'remove_buff' cho active skill", () => {
  it('remove_buff mặc định gỡ 1 instance của buffId cụ thể trên target', () => {
    const system = new SkillEffectSystem()
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target' })
    const targetBuffs = new BuffSystem(new BuffPool())
    const ctx = createContext({ targetBuffs })

    targetBuffs.apply(ctx.buffRegistry.get('trung_doc'), source, target, ctx.buffRegistry)
    targetBuffs.apply(ctx.buffRegistry.get('bong'), source, target, ctx.buffRegistry)

    system.apply({ type: 'remove_buff', buffId: 'trung_doc' }, source, target, ctx)

    expect(targetBuffs.getActiveIds()).toEqual(['bong'])
  })

  it('remove_buff có buffId chỉ gỡ đúng id đó, kể cả khi count lớn', () => {
    const system = new SkillEffectSystem()
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target' })
    const targetBuffs = new BuffSystem(new BuffPool())
    const ctx = createContext({ targetBuffs })

    targetBuffs.apply(ctx.buffRegistry.get('trung_doc'), source, target, ctx.buffRegistry)
    targetBuffs.apply(ctx.buffRegistry.get('bong'), source, target, ctx.buffRegistry)
    targetBuffs.apply(ctx.buffRegistry.get('te_cong'), source, target, ctx.buffRegistry)

    system.apply({ type: 'remove_buff', buffId: 'bong', count: 5 }, source, target, ctx)

    expect(targetBuffs.getActiveIds().sort()).toEqual(['te_cong', 'trung_doc'])
  })

  it('remove_buff scope source + polarity debuff + count 8 → gỡ tối đa 8 debuff trên source', () => {
    const system = new SkillEffectSystem()
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target' })
    const sourceBuffs = new BuffSystem(new BuffPool())
    const ctx = createContext({ sourceBuffs })

    // 10 debuff (id phân biệt vì cùng sourceId 'other') + 1 buff.
    const debuffIds = ['bong', 'te_cong', 'trung_doc', 'chay_mau', 'hoai_tu', 'troi_chan', 'dung_nham', 'huyet_doc', 'suy_nhuoc', 'uy_ap']
    for (const id of debuffIds) {
      sourceBuffs.apply(ctx.buffRegistry.get(id), createCombatant({ id: 'other' }), source, ctx.buffRegistry)
    }
    sourceBuffs.apply(ctx.buffRegistry.get('khai_son'), createCombatant({ id: 'other' }), source, ctx.buffRegistry)

    system.apply({ type: 'remove_buff', polarity: 'debuff', count: 8, scope: 'source' }, source, target, ctx)

    const remaining = sourceBuffs.getAll().map((buff) => buff.id)
    expect(remaining).toHaveLength(3)
    expect(remaining).toContain('khai_son')
    // Gỡ theo thứ tự pool → 2 debuff CUỐI pool order còn lại (pool
    // order theo buffs.ts: bong, te_cong, trung_doc, chay_mau, hoai_tu,
    // troi_chan, choang, lam_cham, han_khi, suy_nhuoc, uy_ap).
    expect(remaining).toEqual(['suy_nhuoc', 'uy_ap', 'khai_son'])
  })

  it('remove_buff count lớn hơn số debuff đang có → gỡ hết, không crash', () => {
    const system = new SkillEffectSystem()
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target' })
    const sourceBuffs = new BuffSystem(new BuffPool())
    const ctx = createContext({ sourceBuffs })

    sourceBuffs.apply(ctx.buffRegistry.get('bong'), createCombatant({ id: 'other' }), source, ctx.buffRegistry)
    sourceBuffs.apply(ctx.buffRegistry.get('khai_son'), createCombatant({ id: 'other' }), source, ctx.buffRegistry)

    expect(() =>
      system.apply({ type: 'remove_buff', polarity: 'debuff', count: 8, scope: 'source' }, source, target, ctx),
    ).not.toThrow()

    expect(sourceBuffs.getActiveIds()).toEqual(['khai_son'])
  })

  it('remove_buff không buffId không polarity → gỡ mọi instance theo thứ tự pool, count mặc định 1', () => {
    const system = new SkillEffectSystem()
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target' })
    const targetBuffs = new BuffSystem(new BuffPool())
    const ctx = createContext({ targetBuffs })

    targetBuffs.apply(ctx.buffRegistry.get('bong'), source, target, ctx.buffRegistry)
    targetBuffs.apply(ctx.buffRegistry.get('te_cong'), source, target, ctx.buffRegistry)

    system.apply({ type: 'remove_buff' }, source, target, ctx)

    expect(targetBuffs.getActiveIds()).toEqual(['te_cong'])
  })
})
