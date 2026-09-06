// @vitest-environment jsdom
// 6A-T5 (2026-09-01) â€” CombatScene wiring PlayerHudLayer: HUD hiá»‡n khi
// battle, vitals/positions events update HP/MP, exit zone click phÃ¡t
// 'combat_exit_request' qua eventBus, shutdown dá»n sáº¡ch (khÃ´ng leak).
import { describe, expect, it, vi } from 'vitest'
import { createTestScene } from './combat/combatTestHarness'
import type { EntityVitalsChangedEvent } from '@/core/combat/EntityVitalsSystem'
import type { BattlePositionsEvent } from '@/core/battle/BattleEvents'
import { KIEM_BAR_READER_KEY, type KiemBarReader } from '@/game/support/kiemBarBridge'

interface FakeHud {
  hpCalls: Array<{ current: number; max: number }>
  mpCalls: Array<{ current: number; max: number }>
  kiemCalls: Array<{ current: number; max: number; label: string }>
  visible: boolean | null
  destroyed: boolean
  updateHp(current: number, max: number): void
  updateMp(current: number, max: number): void
  updateKiem(current: number, max: number, label: string): void
  layout(width: number, height: number): void
  setVisible(v: boolean): void
  destroy(): void
}

function makeFakeHud(): FakeHud {
  const hud: FakeHud = {
    hpCalls: [],
    mpCalls: [],
    kiemCalls: [],
    visible: null,
    destroyed: false,
    updateHp(current, max) {
      hud.hpCalls.push({ current, max })
    },
    updateMp(current, max) {
      hud.mpCalls.push({ current, max })
    },
    updateKiem(current, max, label) {
      hud.kiemCalls.push({ current, max, label })
    },
    layout() {},
    setVisible(v) {
      hud.visible = v
    },
    destroy() {
      hud.destroyed = true
    },
  }

  return hud
}

interface FakeRegistry {
  map: Map<string, unknown>
  set(key: string, value: unknown): void
  get(key: string): unknown
}

function makeFakeRegistry(): FakeRegistry {
  const map = new Map<string, unknown>()

  return {
    map,
    set(key, value) {
      map.set(key, value)
    },
    get(key) {
      return map.get(key)
    },
  }
}

function createScene(fakeHud: FakeHud, registry: FakeRegistry = makeFakeRegistry()) {
  const scene = createTestScene('bare')

  scene.playerHud = fakeHud
  scene.time = { now: 0 }

  const emitted: Array<{ type: string; payload?: unknown }> = []

  scene.eventBus = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn((type: string, payload?: unknown) => {
      emitted.push({ type, payload })
    }),
  }

  scene.registry = registry

  scene.sprites = new Map()
  scene.spriteForRaw = (id?: string) => (id ? scene.sprites.get(id) : undefined)

  return { scene, emitted }
}

const VITALS = (over: Partial<EntityVitalsChangedEvent>): EntityVitalsChangedEvent => ({
  type: 'entity_vitals_changed',
  entityId: 'player',
  reason: 'damage',
  hpBefore: 100,
  hpAfter: 90,
  maxHp: 100,
  wardBefore: 0,
  wardAfter: 0,
  maxWard: 0,
  mpBefore: 0,
  mpAfter: 0,
  maxMp: 0,
  amount: 10,
  killed: false,
  ...over,
})

const POSITIONS = (over: Partial<BattlePositionsEvent>): BattlePositionsEvent => ({
  type: 'positions',
  mode: 'combat',
  playerX: 1,
  playerRow: 1 as never,
  playerCurrentHp: 80,
  playerMaxHp: 100,
  playerMaterialized: true,
  enemies: [],
  ...over,
})

describe('CombatScene â€” PlayerHudLayer wiring (6A-T5)', () => {
  it('vitals cá»§a player (entityId === PLAYER_ID) â†’ updateHp; enemy vitals bá» qua', () => {
    const hud = makeFakeHud()
    const { scene } = createScene(hud)

    scene.onVitalsChanged(VITALS({ entityId: 'player', hpAfter: 90, maxHp: 100 }))
    scene.onVitalsChanged(VITALS({ entityId: 'enemy_1', hpAfter: 1, maxHp: 50 }))

    expect(hud.hpCalls).toHaveLength(1)
    expect(hud.hpCalls[0]).toEqual({ current: 90, max: 100 })
  })

  it('vitals mpAfter/maxMp > 0 â†’ updateMp (player MP pool)', () => {
    const hud = makeFakeHud()
    const { scene } = createScene(hud)

    scene.onVitalsChanged(VITALS({ mpAfter: 30, maxMp: 60 }))

    expect(hud.mpCalls).toHaveLength(1)
    expect(hud.mpCalls[0]).toEqual({ current: 30, max: 60 })
  })

  it('positions event cáº­p nháº­t HP (nguá»“n thá»© hai â€” fast-path khi chÆ°a cÃ³ vitals)', () => {
    const hud = makeFakeHud()
    const { scene } = createScene(hud)

    scene.onPositions(POSITIONS({ playerCurrentHp: 77, playerMaxHp: 120 }))

    expect(hud.hpCalls).toHaveLength(1)
    expect(hud.hpCalls[0]).toEqual({ current: 77, max: 120 })
  })

  it('exit zone click â†’ emit combat_exit_request qua eventBus (bridge sang DOM modal T6)', () => {
    const hud = makeFakeHud()
    const { scene, emitted } = createScene(hud)

    scene.requestCombatExit()

    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toMatchObject({ type: 'combat_exit_request' })
  })
})

describe('CombatScene — Kiếm bar poll per-tick (9.4)', () => {
  function sceneWithKiemReader(reader: KiemBarReader) {
    const hud = makeFakeHud()
    const registry = makeFakeRegistry()

    registry.set(KIEM_BAR_READER_KEY, reader)

    const { scene } = createScene(hud, registry)

    return { hud, scene }
  }

  it('route kiem_tran → updateKiem(currentKiemThe, MAX_KIEM_THE, "Kiếm Thế") mỗi poll', () => {
    const reader = vi.fn((): ReturnType<KiemBarReader> => ({
      current: 30,
      max: 100,
      label: 'Kiếm Thế',
    }))
    const { hud, scene } = sceneWithKiemReader(reader)

    scene.pollKiemBar()
    scene.pollKiemBar()

    expect(reader).toHaveBeenCalledTimes(2)
    expect(hud.kiemCalls).toHaveLength(2)
    expect(hud.kiemCalls[0]).toEqual({ current: 30, max: 100, label: 'Kiếm Thế' })
  })

  it('route bat_kiem → updateKiem(temp + permanent, max, "Kiếm Ý T.2")', () => {
    const reader = vi.fn((): ReturnType<KiemBarReader> => ({
      current: 40,
      max: 920,
      label: 'Kiếm Ý T.2',
    }))
    const { hud, scene } = sceneWithKiemReader(reader)

    scene.pollKiemBar()

    expect(hud.kiemCalls).toHaveLength(1)
    expect(hud.kiemCalls[0]).toEqual({ current: 40, max: 920, label: 'Kiếm Ý T.2' })
  })

  it('reader trả null (battle null / route không phải Kiếm Tu) → ẩn bar updateKiem(0, 0, "")', () => {
    const reader = vi.fn((): ReturnType<KiemBarReader> => null)
    const { hud, scene } = sceneWithKiemReader(reader)

    scene.pollKiemBar()

    expect(hud.kiemCalls).toHaveLength(1)
    expect(hud.kiemCalls[0]).toEqual({ current: 0, max: 0, label: '' })
  })

  it('KHÔNG có reader đăng ký → ẩn bar (an toàn, không throw)', () => {
    const hud = makeFakeHud()
    const registry = makeFakeRegistry()
    const { scene } = createScene(hud, registry)

    scene.pollKiemBar()

    expect(hud.kiemCalls).toHaveLength(1)
    expect(hud.kiemCalls[0]).toEqual({ current: 0, max: 0, label: '' })
  })

  it('scene KHÔNG có registry (stub) → ẩn bar, không throw (regression 9.4)', () => {
    const hud = makeFakeHud()
    const { scene } = createScene(hud)

    scene.registry = undefined

    scene.pollKiemBar()

    expect(hud.kiemCalls).toHaveLength(1)
    expect(hud.kiemCalls[0]).toEqual({ current: 0, max: 0, label: '' })
  })
})
