// @vitest-environment jsdom
// 6A-T5 (2026-09-01) — CombatScene wiring PlayerHudLayer: HUD hiện khi
// battle, vitals/positions events update HP/MP, exit zone click phát
// 'combat_exit_request' qua eventBus, shutdown dọn sạch (không leak).
import { describe, expect, it, vi } from 'vitest'
import { CombatScene } from './CombatScene'
import type { EntityVitalsChangedEvent } from '@/core/combat/EntityVitalsSystem'
import type { BattlePositionsEvent } from '@/core/battle/BattleEvents'

interface FakeHud {
  hpCalls: Array<{ current: number; max: number }>
  mpCalls: Array<{ current: number; max: number }>
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
    visible: null,
    destroyed: false,
    updateHp(current, max) {
      hud.hpCalls.push({ current, max })
    },
    updateMp(current, max) {
      hud.mpCalls.push({ current, max })
    },
    updateKiem() {},
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

function createScene(fakeHud: FakeHud) {
  const scene = Object.create(CombatScene.prototype) as any

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

  scene.registry = new Map()

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

describe('CombatScene — PlayerHudLayer wiring (6A-T5)', () => {
  it('vitals của player (entityId === PLAYER_ID) → updateHp; enemy vitals bỏ qua', () => {
    const hud = makeFakeHud()
    const { scene } = createScene(hud)

    scene.onVitalsChanged(VITALS({ entityId: 'player', hpAfter: 90, maxHp: 100 }))
    scene.onVitalsChanged(VITALS({ entityId: 'enemy_1', hpAfter: 1, maxHp: 50 }))

    expect(hud.hpCalls).toHaveLength(1)
    expect(hud.hpCalls[0]).toEqual({ current: 90, max: 100 })
  })

  it('vitals mpAfter/maxMp > 0 → updateMp (player MP pool)', () => {
    const hud = makeFakeHud()
    const { scene } = createScene(hud)

    scene.onVitalsChanged(VITALS({ mpAfter: 30, maxMp: 60 }))

    expect(hud.mpCalls).toHaveLength(1)
    expect(hud.mpCalls[0]).toEqual({ current: 30, max: 60 })
  })

  it('positions event cập nhật HP (nguồn thứ hai — fast-path khi chưa có vitals)', () => {
    const hud = makeFakeHud()
    const { scene } = createScene(hud)

    scene.onPositions(POSITIONS({ playerCurrentHp: 77, playerMaxHp: 120 }))

    expect(hud.hpCalls).toHaveLength(1)
    expect(hud.hpCalls[0]).toEqual({ current: 77, max: 120 })
  })

  it('exit zone click → emit combat_exit_request qua eventBus (bridge sang DOM modal T6)', () => {
    const hud = makeFakeHud()
    const { scene, emitted } = createScene(hud)

    scene.requestCombatExit()

    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toMatchObject({ type: 'combat_exit_request' })
  })
})
