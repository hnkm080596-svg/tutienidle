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

describe("SkillEffectSystem — E-4: 'hitCount' (N missile cố định)", () => {
  it('effect damage hitCount 8 → fireHit gọi đúng 8 lần', () => {
    const system = new SkillEffectSystem()
    const source = createCombatant({ id: 'source', type: 'player', realmIndex: 4 })
    const target = createCombatant({ id: 'target' })
    const fireHit = vi.fn(() => ({ landed: true }))
    const ctx = createContext({ fireHit })

    system.apply({ type: 'damage', value: 1, hitCount: 8 }, source, target, ctx)

    expect(fireHit).toHaveBeenCalledTimes(8)
  })

  it('mỗi hit là 1 fireHit RIÊNG (mỗi hit tự roll crit/dodge ở tầng impact) — không gộp 1 đòn ×8', () => {
    const system = new SkillEffectSystem()
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target' })
    const fireHit = vi.fn(() => ({ landed: true }))
    const ctx = createContext({ fireHit })

    system.apply({ type: 'damage', value: 0.6, hitCount: 8 }, source, target, ctx)

    // 8 call tách biệt, mỗi call multiplier 0.6 (không phải 1 call 4.8).
    expect(fireHit).toHaveBeenCalledTimes(8)
    for (const call of fireHit.mock.calls) {
      expect((call[1] as { multiplier: number }).multiplier).toBeCloseTo(0.6, 5)
    }
  })

  it('hitCount thắng hitCountByRealm khi cả hai set (loại trừ nhau)', () => {
    const system = new SkillEffectSystem()
    const source = createCombatant({ id: 'source', type: 'player', realmIndex: 4 })
    const target = createCombatant({ id: 'target' })
    const fireHit = vi.fn(() => ({ landed: true }))
    const ctx = createContext({ fireHit })

    system.apply({ type: 'damage', value: 1, hitCount: 8, hitCountByRealm: true }, source, target, ctx)

    // realmIndex 4 + hitCountByRealm = 5; hitCount 8 tường minh thắng.
    expect(fireHit).toHaveBeenCalledTimes(8)
  })

  it('không hitCount/không hitCountByRealm → 1 hit như cũ', () => {
    const system = new SkillEffectSystem()
    const source = createCombatant({ id: 'source', type: 'player', realmIndex: 4 })
    const target = createCombatant({ id: 'target' })
    const fireHit = vi.fn(() => ({ landed: true }))
    const ctx = createContext({ fireHit })

    system.apply({ type: 'damage', value: 1 }, source, target, ctx)

    expect(fireHit).toHaveBeenCalledTimes(1)
  })

  it('hitCountByRealm một mình vẫn = realmIndex + 1 (regression)', () => {
    const system = new SkillEffectSystem()
    const source = createCombatant({ id: 'source', type: 'player', realmIndex: 3 })
    const target = createCombatant({ id: 'target' })
    const fireHit = vi.fn(() => ({ landed: true }))
    const ctx = createContext({ fireHit })

    system.apply({ type: 'damage', value: 1, hitCountByRealm: true }, source, target, ctx)

    expect(fireHit).toHaveBeenCalledTimes(4)
  })

  it('target chết giữa loạt → dừng hit còn lại (kể cả hitCount tường minh)', () => {
    const system = new SkillEffectSystem()
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target' })
    let hits = 0
    const ctx = createContext({
      fireHit: () => {
        hits += 1
        if (hits === 3) {
          target.currentHp = 0
          target.alive = false
        }
        return { landed: true }
      },
    })

    system.apply({ type: 'damage', value: 1, hitCount: 8 }, source, target, ctx)

    expect(hits).toBe(3)
  })
})

describe("SkillEffectSystem — E-5: 'grantsZone' tổng quát (element)", () => {
  it('grantsZone + zoneElement fire → spawnSwordZone nhận element fire, công thức damage/tick giữ nguyên', () => {
    const system = new SkillEffectSystem()
    const source = createCombatant({ id: 'source', type: 'player', realmIndex: 0 })
    source.stats.attack = 100
    const target = createCombatant({ id: 'target', x: 8, row: 2 })
    const spawnSwordZone = vi.fn()
    const ctx = createContext({ spawnSwordZone })

    system.apply(
      {
        type: 'damage',
        value: 2,
        grantsZone: true,
        zoneElement: 'fire',
        swordZoneCharges: 6,
        swordZoneTickInterval: 1,
        swordZoneDamageRatio: 0.5,
      },
      source,
      target,
      ctx,
    )

    expect(spawnSwordZone).toHaveBeenCalledTimes(1)
    expect(spawnSwordZone).toHaveBeenCalledWith({
      ownerId: 'source',
      row: 2,
      column: 8,
      laneRadius: 0,
      columnRadius: 1,
      charges: 6,
      tickInterval: 1,
      // finalMultiplier 2 × ratio 0.5 × attack 100 = 100 — công thức cũ.
      damagePerTick: 100,
      element: 'fire',
    })
  })

  it('grantsSwordZone (Kiếm Tu) → element metal như cũ', () => {
    const system = new SkillEffectSystem()
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', x: 8, row: 2 })
    const spawnSwordZone = vi.fn()
    const ctx = createContext({ spawnSwordZone })

    system.apply({ type: 'damage', value: 1, grantsSwordZone: true }, source, target, ctx)

    expect(spawnSwordZone).toHaveBeenCalledTimes(1)
    expect(spawnSwordZone.mock.calls[0]![0]).toMatchObject({ element: 'metal' })
  })

  it('grantsZone không zoneElement → mặc định metal', () => {
    const system = new SkillEffectSystem()
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', x: 8, row: 2 })
    const spawnSwordZone = vi.fn()
    const ctx = createContext({ spawnSwordZone })

    system.apply({ type: 'damage', value: 1, grantsZone: true }, source, target, ctx)

    expect(spawnSwordZone.mock.calls[0]![0]).toMatchObject({ element: 'metal' })
  })

  it('target chết → không spawn zone (cả 2 flag)', () => {
    const system = new SkillEffectSystem()
    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', x: 8, row: 2 })
    const spawnSwordZone = vi.fn()
    const ctx = createContext({
      spawnSwordZone,
      fireHit: () => {
        target.currentHp = 0
        target.alive = false
        return { landed: true }
      },
    })

    system.apply({ type: 'damage', value: 1, grantsZone: true, zoneElement: 'wood' }, source, target, ctx)

    expect(spawnSwordZone).not.toHaveBeenCalled()
  })
})
