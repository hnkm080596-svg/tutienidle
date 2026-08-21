import { describe, expect, it } from 'vitest'
import { MissileSystem, type MissileTarget } from './MissileSystem'
import { MissileManager } from './MissileManager'
import { EventBus } from '../../events/EventBus'
import type { CombatEntity } from '../CombatEntity'

// Player cố định ở x=0, mọi target đứng dương trên trục X — khớp mô
// hình 1D thật của BattleLane (player bên trái, quái tiến từ phải).
// stats chỉ cần đúng field fire() thật sự đọc (projectileSpeedPercent,
// xem MissileSystem.ts) — không cần Stats đầy đủ như createBaseStats().
function makeSource(x = 0): CombatEntity {
  return { id: 'source', x, stats: { projectileSpeedPercent: 0 } } as CombatEntity
}

function createSystem() {
  return new MissileSystem(new MissileManager(), new EventBus())
}

// Bay đủ số tick để chắc chắn đạn tới đích dù target đứng xa cỡ nào
// trong phạm vi test (MISSILE_SPEED=500, dùng delta lớn/nhiều lần lặp
// để không phải tính tay quãng đường).
function advance(system: MissileSystem, getTargets: (sourceId: string) => MissileTarget[], resolveHit: (missileSourceId: string, targetId: string) => void, ticks: number, deltaSeconds = 0.1) {
  for (let i = 0; i < ticks; i++) {
    system.update(deltaSeconds, getTargets, (missile, targetId) => resolveHit(missile.sourceId, targetId))
  }
}

describe('MissileSystem — Normal', () => {
  it('bay tới target rồi tự huỷ sau khi resolveHit đúng 1 lần', () => {
    const system = createSystem()
    const source = makeSource(0)
    const target: CombatEntity = { id: 'enemy_a', x: 100 } as CombatEntity

    system.fire(source, target, { kind: 'physical', multiplier: 1 }, false)

    const hits: string[] = []
    const getTargets = () => [{ id: 'enemy_a', x: 100 }]

    advance(system, getTargets, (_s, targetId) => hits.push(targetId), 50)

    expect(hits).toEqual(['enemy_a'])
  })

  it('target biến mất khỏi getTargets (chết) trước khi trúng — đạn tự tiêu, không gọi resolveHit', () => {
    const system = createSystem()
    const source = makeSource(0)
    const target: CombatEntity = { id: 'enemy_a', x: 100 } as CombatEntity

    system.fire(source, target, { kind: 'physical', multiplier: 1 }, false)

    const hits: string[] = []

    advance(system, () => [], (_s, targetId) => hits.push(targetId), 5)

    expect(hits).toEqual([])
  })
})

describe('MissileSystem — Pierce', () => {
  it('trúng target đầu rồi xuyên tiếp tới target kế cùng hướng, đúng số lần pierceCount', () => {
    const system = createSystem()
    const source = makeSource(0)
    const targetA: CombatEntity = { id: 'enemy_a', x: 100 } as CombatEntity

    system.fire(source, targetA, { kind: 'physical', multiplier: 1 }, false, undefined, { pierceCount: 1 })

    const targets: MissileTarget[] = [
      { id: 'enemy_a', x: 100 },
      { id: 'enemy_b', x: 200 },
    ]

    const hits: string[] = []

    advance(system, () => targets, (_s, targetId) => hits.push(targetId), 100)

    expect(hits).toEqual(['enemy_a', 'enemy_b'])
  })

  it('hết lượt pierce thì huỷ đạn, không xuyên thêm dù còn target phía sau', () => {
    const system = createSystem()
    const source = makeSource(0)
    const targetA: CombatEntity = { id: 'enemy_a', x: 100 } as CombatEntity

    system.fire(source, targetA, { kind: 'physical', multiplier: 1 }, false, undefined, { pierceCount: 1 })

    const targets: MissileTarget[] = [
      { id: 'enemy_a', x: 100 },
      { id: 'enemy_b', x: 200 },
      { id: 'enemy_c', x: 300 },
    ]

    const hits: string[] = []

    advance(system, () => targets, (_s, targetId) => hits.push(targetId), 200)

    expect(hits).toEqual(['enemy_a', 'enemy_b'])
  })

  it('không có target nào xa hơn cùng hướng thì huỷ đạn ngay sau lần trúng đầu', () => {
    const system = createSystem()
    const source = makeSource(0)
    const targetA: CombatEntity = { id: 'enemy_a', x: 100 } as CombatEntity

    system.fire(source, targetA, { kind: 'physical', multiplier: 1 }, false, undefined, { pierceCount: 3 })

    const targets: MissileTarget[] = [{ id: 'enemy_a', x: 100 }]

    const hits: string[] = []

    advance(system, () => targets, (_s, targetId) => hits.push(targetId), 50)

    expect(hits).toEqual(['enemy_a'])
  })
})

describe('MissileSystem — Bounce', () => {
  it('trúng target đầu rồi nảy sang target CÒN SỐNG gần nhất, kể cả ở PHÍA SAU', () => {
    const system = createSystem()
    const source = makeSource(0)
    const targetA: CombatEntity = { id: 'enemy_a', x: 100 } as CombatEntity

    system.fire(source, targetA, { kind: 'physical', multiplier: 1 }, false, undefined, { bounceCount: 1 })

    // enemy_behind đứng SAU vị trí bắt đầu bay (ngược hướng bay ban
    // đầu) — Bounce phải nảy được sang nó dù Pierce sẽ không (khác
    // Pierce test ở trên: bounce không giới hạn hướng).
    const targets: MissileTarget[] = [
      { id: 'enemy_a', x: 100 },
      { id: 'enemy_behind', x: 50 },
    ]

    const hits: string[] = []

    advance(system, () => targets, (_s, targetId) => hits.push(targetId), 100)

    expect(hits).toEqual(['enemy_a', 'enemy_behind'])
  })

  it('không nảy lại vào target đã trúng rồi', () => {
    const system = createSystem()
    const source = makeSource(0)
    const targetA: CombatEntity = { id: 'enemy_a', x: 100 } as CombatEntity

    system.fire(source, targetA, { kind: 'physical', multiplier: 1 }, false, undefined, { bounceCount: 2 })

    const targets: MissileTarget[] = [
      { id: 'enemy_a', x: 100 },
      { id: 'enemy_b', x: 110 },
    ]

    const hits: string[] = []

    advance(system, () => targets, (_s, targetId) => hits.push(targetId), 100)

    expect(hits).toEqual(['enemy_a', 'enemy_b'])
    expect(new Set(hits).size).toBe(2)
  })
})

describe('MissileSystem — AOE', () => {
  it('trúng target chính, đồng thời gây damage mọi target khác trong bán kính, không tốn pierce/bounce', () => {
    const system = createSystem()
    const source = makeSource(0)
    const targetA: CombatEntity = { id: 'enemy_a', x: 100 } as CombatEntity

    system.fire(source, targetA, { kind: 'physical', multiplier: 1 }, false, undefined, { aoeRadius: 30 })

    const targets: MissileTarget[] = [
      { id: 'enemy_a', x: 100 },
      { id: 'enemy_close', x: 115 },
      { id: 'enemy_far', x: 200 },
    ]

    const hits: string[] = []

    advance(system, () => targets, (_s, targetId) => hits.push(targetId), 50)

    expect(hits.sort()).toEqual(['enemy_a', 'enemy_close'])
  })
})

describe('MissileSystem — Homing', () => {
  it('mục tiêu di chuyển ra xa hơn giữa lúc bay, missile homing vẫn đuổi kịp và trúng', () => {
    const system = createSystem()
    const source = makeSource(0)
    const targetA: CombatEntity = { id: 'enemy_a', x: 100 } as CombatEntity

    system.fire(source, targetA, { kind: 'physical', multiplier: 1 }, false, undefined, { homing: true })

    let targetX = 100
    const getTargets = () => [{ id: 'enemy_a', x: targetX }]

    const hits: string[] = []

    // Target lùi xa dần vài tick đầu (vẫn chậm hơn missile) rồi đứng
    // yên — missile phải tự cập nhật hướng/đích mỗi tick để vẫn trúng.
    for (let i = 0; i < 50; i++) {
      if (i < 5) {
        targetX += 20
      }

      system.update(0.1, getTargets, (_missile, targetId) => hits.push(targetId))
    }

    expect(hits).toEqual(['enemy_a'])
  })
})
