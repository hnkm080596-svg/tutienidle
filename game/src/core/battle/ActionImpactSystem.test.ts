import { describe, expect, it, vi } from 'vitest'
import { ActionImpactSystem } from './ActionImpactSystem'
import type { EventBus } from '../events/EventBus'
import type { Battle } from '../battle/Battle'
import type { CombatEntity } from '../combat/CombatEntity'

// Combat Grid Rework — acceptance criteria:
// - "Một action chỉ tạo một impact VFX" → ĐÚNG MỘT event action_impact
//   bất kể multi-hit hay fan-out nhiều target.
// - Multi-hit resolve từng hit riêng (crit roll riêng mỗi hit).
// - Target chết trước impact → bỏ, không damage/event.
function entity(id: string, alive = true): CombatEntity {
  return { id, name: id, x: 5, row: 2 as never, currentHp: 100, maxHp: 100, alive } as unknown as CombatEntity
}

function battleWith(player: CombatEntity, enemies: CombatEntity[]): Battle {
  return {
    player,
    enemies: enemies.map(e => ({ entity: e })),
  } as unknown as Battle
}

function createSystem(rollCritical = () => false) {
  const eventBus = { emit: vi.fn(), on: vi.fn(), off: vi.fn() }
  const system = new ActionImpactSystem({
    eventBus: eventBus as unknown as EventBus,
    rollCritical,
  })

  const impacts = () => eventBus.emit.mock.calls.filter(([type]) => type === 'action_impact')

  return { system, eventBus: eventBus as unknown as EventBus, impacts }
}

describe('ActionImpactSystem — basic action pipeline', () => {
  it('windup chưa hết → KHÔNG resolve; hết windup → resolve hitCount lần + ĐÚNG MỘT action_impact', () => {
    const { system, impacts } = createSystem()
    const player = entity('player')
    const enemy = entity('enemy')
    const battle = battleWith(player, [enemy])
    const resolveOneHit = vi.fn(() => ({ landed: true }))

    system.scheduleBasic({
      actionId: 'tram',
      sourceId: 'player',
      targetId: 'enemy',
      damage: { kind: 'physical', multiplier: 1 },
      skillId: 'tram',
      presetId: 'slash',
      windupSeconds: 0.12,
      hitCount: 3,
    })

    system.tick(battle, 0.05, resolveOneHit)
    expect(resolveOneHit).not.toHaveBeenCalled()
    expect(impacts()).toHaveLength(0)

    system.tick(battle, 0.2, resolveOneHit)

    // Multi-hit: MỖI hit resolve riêng (3 lệnh gọi resolveOneHit)…
    expect(resolveOneHit).toHaveBeenCalledTimes(3)

    // …nhưng VẪN chỉ ĐÚNG MỘT event action_impact.
    const list = impacts()
    expect(list).toHaveLength(1)

    const [type, payload] = list[0]!
    expect(type).toBe('action_impact')
    expect(payload).toMatchObject({
      actionId: 'tram',
      sourceId: 'player',
      primaryTargetId: 'enemy',
      hitCount: 3,
      presetId: 'slash',
      // anchorCell snapshot từ vị trí target TẠI THỜI ĐIỂM impact.
      anchorCell: { row: 2, column: 5 },
      affectedArea: { rowStart: 2, rowEnd: 2, colStart: 5, colEnd: 5, shape: 'single' },
    })
  })

  it('mỗi hit có crit roll RIÊNG qua deps.rollCritical', () => {
    let call = 0
    const roller = vi.fn(() => {
      call += 1
      return call % 2 === 1 // true,false,true...
    })
    const { system, impacts } = createSystem(roller)
    const player = entity('player')
    const enemy = entity('enemy')
    const battle = battleWith(player, [enemy])

    const receivedCrits: boolean[] = []
    const resolveOneHit = vi.fn((_b, _s, _t, _d, opts) => {
      receivedCrits.push(opts!.critical!)
      return { landed: true }
    })

    system.scheduleBasic({
      actionId: 'x',
      sourceId: 'player',
      targetId: 'enemy',
      damage: { kind: 'physical', multiplier: 1 },
      presetId: 'slash',
      windupSeconds: 0,
      hitCount: 4,
    })

    system.tick(battle, 0.1, resolveOneHit)

    expect(receivedCrits).toEqual([true, false, true, false])
    expect(impacts()[0]![1]).toMatchObject({ hitCount: 4 })
  })

  it('target CHẾT trước khi windup kết thúc → bỏ impact (không event, không resolve)', () => {
    const { system, impacts } = createSystem()
    const player = entity('player')
    const enemy = entity('enemy')
    const battle = battleWith(player, [enemy])
    const resolveOneHit = vi.fn(() => ({ landed: true }))

    system.scheduleBasic({
      actionId: 'tram',
      sourceId: 'player',
      targetId: 'enemy',
      damage: { kind: 'physical', multiplier: 1 },
      presetId: 'slash',
      windupSeconds: 0.12,
    })

    enemy.alive = false
    system.tick(battle, 0.5, resolveOneHit)

    expect(resolveOneHit).not.toHaveBeenCalled()
    expect(impacts()).toHaveLength(0)
  })
})

describe('ActionImpactSystem — skill batch (§3 một action một VFX)', () => {
  function setupBatch() {
    const { system, eventBus, impacts } = createSystem(() => false)
    const player = entity('player')
    const primary = entity('primary')
    const secondary = entity('secondary')
    const battle = battleWith(player, [primary, secondary])

    const resolveOneHit = vi.fn((_b, _s, target, damage, opts) => {
      void target
      void damage
      void opts
      return { landed: true }
    })

    return { system, eventBus, impacts, player, primary, secondary, battle, resolveOneHit }
  }

  it('endSkillBatch phát ĐÚNG MỘT event; affectedTargetIds primary đứng đầu; anchor neo primary', () => {
    const t = setupBatch()

    t.system.beginSkillBatch({
      actionId: 'hoa_cau_thuat',
      sourceId: 'player',
      primaryTargetId: 'primary',
      presetId: 'fire_burst',
      anchorCell: { row: 2 as never, column: 5 },
      area: { rowStart: 1, rowEnd: 3, colStart: 4, colEnd: 6, shape: 'area' },
      hitCount: 1,
    })

    t.system.fireSkillHit(t.battle, t.player, t.secondary, { kind: 'elemental', components: [], multiplier: 1 }, {}, t.resolveOneHit)
    t.system.fireSkillHit(t.battle, t.player, t.primary, { kind: 'physical', multiplier: 1 }, {}, t.resolveOneHit)
    t.system.endSkillBatch(t.battle)

    expect(t.resolveOneHit).toHaveBeenCalledTimes(2)

    const list = t.impacts()
    expect(list).toHaveLength(1)

    const payload = list[0]![1] as Record<string, unknown>
    expect(payload.primaryTargetId).toBe('primary')
    expect(payload.affectedTargetIds).toEqual(['primary', 'secondary'])
    expect(payload.landedTargetIds).toEqual(['secondary', 'primary'])
    expect(payload.dodgedTargetIds).toEqual([])
    expect(payload.anchorCell).toEqual({ row: 2, column: 5 })
    expect(payload.presetId).toBe('fire_burst')
  })

  it('snapshot anchor trước hit và tách target dodge khỏi target landed', () => {
    const t = setupBatch()

    t.system.beginSkillBatch({
      actionId: 'locked-impact',
      sourceId: 'player',
      primaryTargetId: 'primary',
      presetId: 'slash',
      anchorCell: { row: 2 as never, column: 5 },
      area: { rowStart: 2, rowEnd: 2, colStart: 5, colEnd: 5, shape: 'single' },
      hitCount: 1,
    })

    t.system.fireSkillHit(
      t.battle,
      t.player,
      t.primary,
      { kind: 'physical', multiplier: 1 },
      {},
      () => {
        t.primary.x = 9
        return { landed: false }
      },
    )
    t.system.endSkillBatch(t.battle)

    const payload = t.impacts()[0]![1]
    expect(payload.anchorCell).toEqual({ row: 2, column: 5 })
    expect(payload.landedTargetIds).toEqual([])
    expect(payload.dodgedTargetIds).toEqual(['primary'])
  })

  it('secondaryPercent scale damage cho mục tiêu PHỤ (earth pure), primary full', () => {
    const t = setupBatch()

    t.system.beginSkillBatch({
      actionId: 'tho_cau_thuat',
      sourceId: 'player',
      primaryTargetId: 'primary',
      presetId: 'earth_shockwave',
      anchorCell: { row: 2 as never, column: 5 },
      area: { rowStart: 0, rowEnd: 4, colStart: 3, colEnd: 7, shape: 'area' },
      hitCount: 1,
      secondaryPercent: 0.5,
      knockbackDistance: 2,
    })

    const seen: Array<{ id: string; multiplier: number; knockback?: number; isPrimary: boolean }> = []

    t.system.fireSkillHit(
      t.battle,
      t.player,
      t.primary,
      { kind: 'physical', multiplier: 100 },
      {},
      (_b, _s, target, damage, opts) => {
        seen.push({ id: target.id, multiplier: damage.multiplier, knockback: opts.knockbackDistance, isPrimary: opts.isPrimary })
        return { landed: true }
      },
    )
    t.system.fireSkillHit(
      t.battle,
      t.player,
      t.secondary,
      { kind: 'physical', multiplier: 100 },
      {},
      (_b, _s, target, damage, opts) => {
        seen.push({ id: target.id, multiplier: damage.multiplier, knockback: opts.knockbackDistance, isPrimary: opts.isPrimary })
        return { landed: true }
      },
    )

    t.system.endSkillBatch(t.battle)

    expect(seen.find(s => s.id === 'primary')).toMatchObject({ multiplier: 100, knockback: 2 })
    expect(seen.find(s => s.id === 'secondary')).toMatchObject({ multiplier: 50, knockback: 2 })
  })

  it('endSkillBatch không mở batch → no-op; clear() huỷ pending + batch', () => {
    const t = setupBatch()

    t.system.endSkillBatch(t.battle) // chưa mở — không crash, không emit
    expect(t.impacts()).toHaveLength(0)

    t.system.beginSkillBatch({
      actionId: 'x',
      sourceId: 'player',
      primaryTargetId: 'p',
      presetId: 'slash',
      anchorCell: { row: 2 as never, column: 5 },
      area: { rowStart: 2, rowEnd: 2, colStart: 5, colEnd: 5, shape: 'single' },
      hitCount: 1,
    })
    t.system.clear()
    t.system.endSkillBatch(t.battle)

    expect(t.impacts()).toHaveLength(0)
  })
})
