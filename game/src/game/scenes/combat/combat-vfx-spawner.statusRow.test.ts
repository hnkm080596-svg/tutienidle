// Buff bar (2026-09-02, Task 4) — CombatVfxSpawner status icon ROW:
// - enemy: hàng icon dưới foot sprite (perspective: foot = rect.y)
// - player: hàng icon trên cụm sub-bar HUD (tính từ viewport height)
// - 2 tầng: temporary (rowTier 0) + permanent (rowTier 1)
// - stack label góc phải-dưới; >8 icon gộp counter "+N" ở icon cuối
// Mock scene = fake objects thuần (pattern PlayerHudLayer.test.ts),
// KHÔNG instantiate Phaser thật.
// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { CombatVfxSpawner } from './combat-vfx-spawner'
import {
  STATUS_ICON_SIZE,
  STATUS_ICON_SPACING,
  STATUS_MAX_PER_ROW,
  STATUS_FOOT_ROW_OFFSET_Y,
  STATUS_ROW_GAP,
} from './combatConstants'
import { HUD_MARGIN, HUD_HP_HEIGHT, HUD_SUB_HEIGHT, HUD_GAP } from './PlayerHudLayer'
import type { StatusVfxAttachedEvent } from '@/core/battle/BattleEvents'

interface FakeGameObject {
  x: number
  y: number
  angle: number
  visible: boolean
  destroyed: boolean
  text: string
  setAngle(deg: number): FakeGameObject
  setDepth(): FakeGameObject
  setPosition(x: number, y: number): FakeGameObject
  setOrigin(): FakeGameObject
  setVisible(v: boolean): FakeGameObject
  setInteractive(): FakeGameObject
  on(): FakeGameObject
  setText(t: string): FakeGameObject
  destroy(): void
}

function makeFakeGameObject(initialText = ''): FakeGameObject {
  const obj: FakeGameObject = {
    x: 0,
    y: 0,
    angle: 0,
    visible: true,
    destroyed: false,
    text: initialText,
    setAngle(deg: number) {
      obj.angle = deg
      return obj
    },
    setDepth() {
      return obj
    },
    setPosition(x: number, y: number) {
      obj.x = x
      obj.y = y
      return obj
    },
    setOrigin() {
      return obj
    },
    setVisible(v: boolean) {
      obj.visible = v
      return obj
    },
    setInteractive() {
      return obj
    },
    on() {
      return obj
    },
    setText(t: string) {
      obj.text = t
      return obj
    },
    destroy() {
      obj.destroyed = true
    },
  }

  return obj
}

interface FakeSprite {
  rect: { x: number; y: number; displayHeight: number }
}

function makeFakeScene(viewport: { width: number; height: number }, sprites: Map<string, FakeSprite>) {
  const created: FakeGameObject[] = []

  return {
    created,
    statuses: new Map<string, unknown>(),
    spriteFor: (id: string) => sprites.get(id),
    isPerspective: true,
    scale: viewport,
    add: {
      rectangle() {
        const obj = makeFakeGameObject()
        created.push(obj)
        return obj
      },
      circle() {
        const obj = makeFakeGameObject()
        created.push(obj)
        return obj
      },
      text(_x: number, _y: number, initial: string) {
        const obj = makeFakeGameObject(initial)
        created.push(obj)
        return obj
      },
    },
  }
}

function makeEvent(overrides: Partial<StatusVfxAttachedEvent> = {}): StatusVfxAttachedEvent {
  return {
    type: 'status_vfx_attached',
    statusInstanceId: 'enemy:bong:src',
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

const ENEMY_SPRITE: FakeSprite = { rect: { x: 300, y: 400, displayHeight: 48 } }

describe('CombatVfxSpawner — status icon row (buff bar)', () => {
  let scene: ReturnType<typeof makeFakeScene>
  let spawner: CombatVfxSpawner

  beforeEach(() => {
    scene = makeFakeScene({ width: 800, height: 600 }, new Map([['enemy', ENEMY_SPRITE]]))
    spawner = new CombatVfxSpawner(scene as unknown as never)
  })

  it('attach debuff diamond → 1 icon (angle 45) + entry đầy đủ fields', () => {
    spawner.onStatusAttached(makeEvent())

    expect(scene.statuses.size).toBe(1)

    const entry = scene.statuses.get('enemy:bong:src') as {
      targetId: string
      buffId: string
      polarity: string
      permanent: boolean
      stacks: number
      buffName: string | undefined
      remainingTime: number | undefined
      icon: FakeGameObject
      stackLabel: FakeGameObject
    }

    expect(entry.targetId).toBe('enemy')
    expect(entry.buffId).toBe('bong')
    expect(entry.polarity).toBe('debuff')
    expect(entry.permanent).toBe(false)
    expect(entry.stacks).toBe(1)
    expect(entry.buffName).toBe('Bỏng')
    expect(entry.remainingTime).toBe(4)
    expect(entry.icon.angle).toBe(45) // diamond
    expect(entry.stackLabel.visible).toBe(false) // stacks 1 → ẩn
  })

  it('attach buff circle → icon angle 0 (add.circle)', () => {
    scene = makeFakeScene(
      { width: 800, height: 600 },
      new Map([['player', { rect: { x: 100, y: 500, displayHeight: 48 } }]]),
    )
    spawner = new CombatVfxSpawner(scene as unknown as never)

    spawner.onStatusAttached(
      makeEvent({
        statusInstanceId: 'player:khai_son:src',
        targetId: 'player',
        dotType: 'khai_son',
        buffName: 'Khai Sơn',
        polarity: 'buff',
      }),
    )

    const entry = scene.statuses.get('player:khai_son:src') as { icon: FakeGameObject }

    expect(entry.icon.angle).toBe(0)
  })

  it('stacks > 1 → stack label hiện số', () => {
    spawner.onStatusAttached(makeEvent({ stacks: 3 }))

    const entry = scene.statuses.get('enemy:bong:src') as { stackLabel: FakeGameObject }

    expect(entry.stackLabel.visible).toBe(true)
    expect(entry.stackLabel.text).toBe('3')
  })

  it('update → chỉ stack label + entry.stacks đổi, không tạo GameObject mới', () => {
    spawner.onStatusAttached(makeEvent())
    const createdBefore = scene.created.length

    spawner.onStatusUpdated({
      statusInstanceId: 'enemy:bong:src',
      stacks: 2,
      durationSeconds: 5,
    })

    expect(scene.created.length).toBe(createdBefore)

    const entry = scene.statuses.get('enemy:bong:src') as {
      stacks: number
      remainingTime: number | undefined
      stackLabel: FakeGameObject
    }

    expect(entry.stacks).toBe(2)
    expect(entry.remainingTime).toBe(5)
    expect(entry.stackLabel.text).toBe('2')
    expect(entry.stackLabel.visible).toBe(true)
  })

  it('remove → destroy icon + label, entry khỏi map', () => {
    spawner.onStatusAttached(makeEvent())

    spawner.onStatusRemoved({ statusInstanceId: 'enemy:bong:src' })

    const entry = scene.statuses.get('enemy:bong:src') as { icon: FakeGameObject; stackLabel: FakeGameObject }

    expect(entry).toBeUndefined()
  })

  it('enemy temporary row: icon y = footY + OFFSET, x xếp từ giữa sprite', () => {
    spawner.onStatusAttached(makeEvent())
    spawner.updateStatusIconPositions()

    const entry = scene.statuses.get('enemy:bong:src') as { icon: FakeGameObject }

    expect(entry.icon.y).toBe(ENEMY_SPRITE.rect.y + STATUS_FOOT_ROW_OFFSET_Y)
    // 1 icon: x = giữa sprite
    expect(entry.icon.x).toBe(ENEMY_SPRITE.rect.x)
  })

  it('enemy 2 icon → x lệch nhau đúng spacing', () => {
    spawner.onStatusAttached(makeEvent())
    spawner.onStatusAttached(
      makeEvent({ statusInstanceId: 'enemy:te_cong:src', dotType: 'te_cong', buffName: 'Tê Cóng' }),
    )
    spawner.updateStatusIconPositions()

    const first = scene.statuses.get('enemy:bong:src') as { icon: FakeGameObject }
    const second = scene.statuses.get('enemy:te_cong:src') as { icon: FakeGameObject }

    // rowWidth = 2*(10+4)-4 = 24; startX = 300 - 12 + 5 = 293; icon2 = 293+14 = 307
    expect(first.icon.x).toBe(ENEMY_SPRITE.rect.x - (STATUS_ICON_SIZE + STATUS_ICON_SPACING) / 2)
    expect(second.icon.x).toBe(first.icon.x + STATUS_ICON_SIZE + STATUS_ICON_SPACING)
  })

  it('enemy permanent row: y thấp hơn temporary row 1 bậc (rowTier riêng)', () => {
    spawner.onStatusAttached(makeEvent()) // temporary
    spawner.onStatusAttached(
      makeEvent({
        statusInstanceId: 'enemy:onhit_x:src',
        dotType: 'onhit_x',
        polarity: 'buff',
        permanent: true,
      }),
    )
    spawner.updateStatusIconPositions()

    const temporary = scene.statuses.get('enemy:bong:src') as { icon: FakeGameObject }
    const permanent = scene.statuses.get('enemy:onhit_x:src') as { icon: FakeGameObject }

    // permanent row nằm DƯỚI temporary row (dưới chân, xa sprite hơn)
    expect(permanent.icon.y).toBe(temporary.icon.y + STATUS_ROW_GAP + STATUS_ICON_SIZE)
  })

  it('player temporary row: y tính từ sub2Y của HUD (viewport 800x600 → 538)', () => {
    scene = makeFakeScene({ width: 800, height: 600 }, new Map([['player', { rect: { x: 100, y: 500, displayHeight: 48 } }]]))
    spawner = new CombatVfxSpawner(scene as unknown as never)

    spawner.onStatusAttached(
      makeEvent({
        statusInstanceId: 'player:lam_cham:src',
        targetId: 'player',
        dotType: 'lam_cham',
        polarity: 'debuff',
      }),
    )
    spawner.updateStatusIconPositions()

    const entry = scene.statuses.get('player:lam_cham:src') as { icon: FakeGameObject }
    const sub2Y = 600 - HUD_MARGIN - HUD_HP_HEIGHT - HUD_GAP - HUD_SUB_HEIGHT - HUD_GAP - HUD_SUB_HEIGHT

    expect(entry.icon.y).toBe(sub2Y - STATUS_PLAYER_ROW_OFFSET_Y_FOR_TEST - STATUS_ICON_SIZE)
    expect(entry.icon.x).toBe(HUD_MARGIN)
  })

  it('>8 temporary → icon 9+ ẩn, icon cuối mang counter "+N"', () => {
    for (let i = 0; i < 10; i++) {
      spawner.onStatusAttached(
        makeEvent({ statusInstanceId: `enemy:dot${i}:src`, dotType: `dot${i}` }),
      )
    }
    spawner.updateStatusIconPositions()

    const eighth = scene.statuses.get('enemy:dot7:src') as { icon: FakeGameObject; stackLabel: FakeGameObject }
    const ninth = scene.statuses.get('enemy:dot8:src') as { icon: FakeGameObject }

    expect(eighth.stackLabel.text).toBe('+2')
    expect(eighth.stackLabel.visible).toBe(true)
    expect(ninth.icon.visible).toBe(false)
  })
})

// Local alias tránh import lặp — cùng giá trị STATUS_PLAYER_ROW_OFFSET_Y
// nhưng tách tên để test không phụ thuộc vào constant source-of-truth.
const STATUS_PLAYER_ROW_OFFSET_Y_FOR_TEST = 6
