// Buff bar (2026-09-02, Task 5) — floating text tên hiệu ứng CHỈ lần
// đầu attach theo key `targetId:buffId` (không gồm sourceId): 2 nguồn
// cùng buff id → 1 floating; event cũ không buffName → không floating
// (compat). Màu theo polarity.
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { CombatScene } from './CombatScene'
import { BUFF_ATTACH_COLOR, DEBUFF_ATTACH_COLOR } from './combat/combatConstants'
import type { StatusVfxAttachedEvent } from '@/core/battle/BattleEvents'

function makeEvent(overrides: Partial<StatusVfxAttachedEvent> = {}): StatusVfxAttachedEvent {
  return {
    type: 'status_vfx_attached',
    statusInstanceId: 'enemy:bong:src1',
    targetId: 'enemy',
    dotType: 'bong',
    stacks: 1,
    durationSeconds: 4,
    buffName: 'Bỏng',
    polarity: 'debuff',
    permanent: false,
    ...overrides,
  }
}

function createScene() {
  const scene = Object.create(CombatScene.prototype) as Record<string, unknown> & {
    floatedStatusKeys?: Set<string>
  }

  const sprites = new Map<string, unknown>([
    ['enemy', { rect: { x: 300, y: 400, displayHeight: 48 } }],
    ['player', { rect: { x: 100, y: 500, displayHeight: 48 } }],
  ])

  scene.sprites = sprites
  scene.floatedStatusKeys = new Set()

  const floatings: Array<{ text: string; color: string }> = []

  scene.showFloatingText = vi.fn((sprite: unknown, text: string, color: string) => {
    void sprite
    floatings.push({ text, color })
  })

  scene.statuses = new Map()

  // vfxSpawner là lazy getter trên prototype — override bằng own property.
  Object.defineProperty(scene, 'vfxSpawner', {
    value: { onStatusAttached: vi.fn() },
    writable: true,
    configurable: true,
  })

  return { scene, floatings }
}

describe('CombatScene — floating text lần đầu attach (buff bar)', () => {
  let scene: Record<string, unknown> & { floatedStatusKeys?: Set<string> }
  let floatings: Array<{ text: string; color: string }>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sceneAny: any

  beforeEach(() => {
    const created = createScene()

    scene = created.scene
    sceneAny = scene
    floatings = created.floatings
  })

  it('attach lần đầu → floating tên + màu đỏ (debuff)', () => {
    sceneAny.onStatusAttached(makeEvent())

    expect(floatings).toHaveLength(1)
    expect(floatings[0]).toEqual({ text: 'Bỏng', color: DEBUFF_ATTACH_COLOR })
  })

  it('2 nguồn cùng targetId:dotType → CHỈ 1 floating (key không gồm sourceId)', () => {
    sceneAny.onStatusAttached(makeEvent({ statusInstanceId: 'enemy:bong:src1' }))
    sceneAny.onStatusAttached(makeEvent({ statusInstanceId: 'enemy:bong:src2' }))

    expect(floatings).toHaveLength(1)
  })

  it('dotType khác nhau trên cùng target → floating riêng', () => {
    sceneAny.onStatusAttached(makeEvent())
    sceneAny.onStatusAttached(
      makeEvent({ statusInstanceId: 'enemy:te_cong:src1', dotType: 'te_cong', buffName: 'Tê Cóng' }),
    )

    expect(floatings).toHaveLength(2)
  })

  it('buff polarity → màu xanh', () => {
    sceneAny.onStatusAttached(
      makeEvent({
        statusInstanceId: 'player:khai_son:src',
        targetId: 'player',
        dotType: 'khai_son',
        buffName: 'Khai Sơn',
        polarity: 'buff',
      }),
    )

    expect(floatings[0]?.color).toBe(BUFF_ATTACH_COLOR)
  })

  it('event cũ không buffName → không floating (compat), spawner vẫn nhận delegate', () => {
    sceneAny.onStatusAttached(makeEvent({ buffName: undefined }))

    expect(floatings).toHaveLength(0)

    const spawner = scene.vfxSpawner as { onStatusAttached: ReturnType<typeof vi.fn> }

    expect(spawner.onStatusAttached).toHaveBeenCalledTimes(1)
  })

  it('sprite thiếu → không floating, không crash, spawner vẫn nhận', () => {
    scene.sprites = new Map()

    sceneAny.onStatusAttached(makeEvent())

    expect(floatings).toHaveLength(0)

    const spawner = scene.vfxSpawner as { onStatusAttached: ReturnType<typeof vi.fn> }

    expect(spawner.onStatusAttached).toHaveBeenCalledTimes(1)
  })
})
