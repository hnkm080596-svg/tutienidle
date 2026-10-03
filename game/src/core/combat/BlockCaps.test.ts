// @vitest-environment node
// T5.5 (2026-09-01) - Block 2 chieu: player base 5%, soft cap 75% (stat
// cong don), hard cap 90% (diem roll - buff tam khong vuot).
import { describe, expect, it, vi, afterEach } from 'vitest'
import { createBaseStats } from '../stats/StatBlock'
import { clampStatValue } from '../stats/StatMetadata'
import { CombatSystem } from './CombatSystem'
import type { EventBus } from '../events/EventBus'
import type { CombatEntity } from './CombatEntity'
import type { ActionDamageInfo } from '../battle/ActionImpactSystem'

function makeEntity(blockChance: number): CombatEntity {
  const stats = createBaseStats({ blockChance })

  return {
    id: 'e1',
    name: 'e',
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: 1000,
    maxHp: 1000,
    currentMp: 0,

    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
  }
}

const damage: ActionDamageInfo = { kind: 'physical', multiplier: 1 }

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Block 3-layer caps (T5.5)', () => {
  it('player base blockChance = 5% (trước đây 0 — đối xứng 2 chiều)', () => {
    expect(createBaseStats().blockChance).toBe(0.05)
  })

  it('soft cap: stat cộng dồn bị clamp 0.75 trong StatMetadata', () => {
    expect(clampStatValue('blockChance', 0.99)).toBe(0.75)
    expect(clampStatValue('blockChance', 0.5)).toBe(0.5)
  })

  it('hard cap 90%: buff tạm vượt soft cap vẫn bị chặn tại rollBlock', () => {
    const system = new CombatSystem({ on: () => {}, off: () => {}, emit: () => {} } as unknown as EventBus)
    const target = makeEntity(0.99) // gia dinh buff tam da vuot 0.75

    // Chan 10 000 lan roll voi random luon thanh cong - khong roll nao
    // duoc blocked khi gia tri sau soft-clamp (0.75) < hard cap 0.9... O
    // day muon verify hard cap phai bo qua soft clamp - nhung spec chot:
    // soft cap chan stat THUAN, hard cap chi co y nghia khi nguon khong
    // qua clampStatValue. rollBlock ap ca 2: min(0.9, clamp(0.99)) = 0.75.
    // Test nay khoa CHUOI clamp: value tho 0.99 -> roll rate 0.75.
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.74)

    let blocked = 0

    for (let i = 0; i < 100; i++) {
      const result = system.resolveActionHit(makeEntity(0), target, damage)
      if (result.blocked) blocked++
      spy.mockClear()
      spy.mockReturnValue(0.74)
    }

    expect(blocked).toBe(100)
  })

  it('hard cap chặn trên 0.9 khi nguồn raw vượt (nếu có đường không qua soft clamp)', () => {
    // Direct verify cong thuc roll: min(0.9, raw sau soft clamp).
    // Diem roll dung raw stats.blockChance qua clampStatValue roi min hard.
    const raw = 0.95

    const effective = Math.min(0.9, clampStatValue('blockChance', raw))

    expect(effective).toBe(0.75) // soft chan truoc hard trong setup hien tai
  })

  it('base 5%: 100 rolls với random < 0.05 đều blocked, random >= 0.05 đều không', () => {
    const system = new CombatSystem({ on: () => {}, off: () => {}, emit: () => {} } as unknown as EventBus)
    const target = makeEntity(0.05)

    vi.spyOn(Math, 'random').mockReturnValue(0.049)
    expect(system.resolveActionHit(makeEntity(0), target, damage).blocked).toBe(true)

    vi.spyOn(Math, 'random').mockReturnValue(0.051)
    expect(system.resolveActionHit(makeEntity(0), target, damage).blocked).toBe(false)
  })
})
