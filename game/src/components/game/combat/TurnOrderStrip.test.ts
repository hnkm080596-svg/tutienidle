// @vitest-environment jsdom
// Phase A6 (2026-09-08) — TurnOrderStrip buff badge row: visible buffs
// render as polarity-colored badges with name ×stacks (remainingTurns)
// and a description tooltip; hidden buffs are skipped. Mount per project
// pattern (createApp + h + provide, no @vue/test-utils).
import { describe, expect, it, vi } from 'vitest'
import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import TurnOrderStrip from './TurnOrderStrip.vue'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { i18n } from '@/i18n'
import { createBaseStats } from '@/core/stats/StatBlock'
import { BuffPool } from '@/core/buff/BuffPool'
import { BuffSystem } from '@/core/buff/BuffSystem'
import { BUFF_REGISTRY } from '@/data/buff/BuffRegistry'
import type { TurnBattle, TurnBattleParticipant } from '@/core/battle/turn/TurnBattleSystem'
import type { CombatEntity } from '@/core/combat/CombatEntity'

function makeEntity(id: string): CombatEntity {
  const stats = createBaseStats()

  return {
    id,
    name: id,
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: 100,
    maxHp: 100,
    currentMp: 0,
    currentSwordIntent: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    currentThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
  } as CombatEntity
}

function makeParticipant(id: string): TurnBattleParticipant {
  return {
    id,
    entity: makeEntity(id),
    speed: 100,
    priority: 0,
    actionGauge: 0,
    alive: true,
    buffs: new BuffPool(),
    consecutiveHardCcTurns: 0,
  }
}

function makeBattleFixture() {
  const player = makeParticipant('player')
  const enemy = makeParticipant('enemy_1')
  enemy.entity.type = 'enemy'

  // Seed: 1 debuff (2 stacks), 1 buff, 1 hidden buff on the player.
  const buffs = new BuffSystem(player.buffs)
  const source = player.entity

  buffs.apply(BUFF_REGISTRY.get('bong'), source, player.entity, BUFF_REGISTRY)
  buffs.apply(BUFF_REGISTRY.get('bong'), source, player.entity, BUFF_REGISTRY)

  const buffDef = BUFF_REGISTRY.get('bong')

  buffs.apply(
    { ...buffDef, id: 'a6_hidden', name: 'Hidden Buff', hidden: true, duration: 5, stackMode: 'refresh', effects: [] },
    source,
    player.entity,
    BUFF_REGISTRY,
  )

  const khaiSon = BUFF_REGISTRY.get('khai_son')

  buffs.apply(khaiSon, source, player.entity, BUFF_REGISTRY)

  const battle: TurnBattle = {
    players: [player],
    enemies: [enemy],
    state: 'fighting',
  }

  return { battle, player }
}

interface MockGameManager {
  getTurnBattle: ReturnType<typeof vi.fn>
  getActiveTurnBattleStage: ReturnType<typeof vi.fn>
}

function mountStrip(gm: MockGameManager): HTMLElement {
  const container = document.createElement('div')

  document.body.appendChild(container)

  const app = createApp({ render: () => h(TurnOrderStrip) })

  const pinia = createPinia()

  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, gm as unknown as import('@/core/game/GameManager').GameManager)
  app.provide(STATE_VERSION_KEY, ref(0))
  app.provide(BUMP_STATE_KEY, vi.fn())
  app.mount(container)

  return container
}

function makeGameManager(battle: TurnBattle | null, stage: { perfectClearTurnLimit?: number } | null = null): MockGameManager {
  return {
    getTurnBattle: vi.fn(() => battle),
    getActiveTurnBattleStage: vi.fn(() => stage),
  }
}

describe('TurnOrderStrip buff badges (Phase A6)', () => {
  it('renders visible buff badges with name, stacks, remaining turns, and polarity classes', () => {
    const { battle } = makeBattleFixture()
    const container = mountStrip(makeGameManager(battle))

    const badges = Array.from(container.querySelectorAll('.turn-order-strip__buff'))

    // 3 instances on the pool (2× bong stacks = 1 instance with 2 stacks +
    // khai_son) + 1 hidden → 2 visible badges.
    expect(badges).toHaveLength(2)

    const bongBadge = badges.find((badge) => badge.textContent?.includes('Bỏng'))

    expect(bongBadge).toBeDefined()
    expect(bongBadge!.className).toContain('is-debuff')
    expect(bongBadge!.textContent).toContain('×2')

    const buffBadge = badges.find((badge) => badge.className.includes('is-buff'))

    expect(buffBadge).toBeDefined()

    container.remove()
  })

  it('skips hidden buffs', () => {
    const { battle } = makeBattleFixture()
    const container = mountStrip(makeGameManager(battle))

    const badges = Array.from(container.querySelectorAll('.turn-order-strip__buff'))

    expect(badges.some((badge) => badge.textContent?.includes('Hidden'))).toBe(false)

    container.remove()
  })

  it('renders a description tooltip (title attribute) on each badge', () => {
    const { battle } = makeBattleFixture()
    const container = mountStrip(makeGameManager(battle))

    const badges = Array.from(container.querySelectorAll<HTMLElement>('.turn-order-strip__buff'))

    for (const badge of badges) {
      expect(badge.getAttribute('title')).toBeTruthy()
    }

    container.remove()
  })

  it('renders no badges when the battle is null', () => {
    const container = mountStrip(makeGameManager(null))

    expect(container.querySelectorAll('.turn-order-strip__buff')).toHaveLength(0)
    expect(container.querySelector('.turn-order-strip')).toBeNull()

    container.remove()
  })
})

// Combat speed gauge + round indicator (2026-09-12) — each combatant chip
// carries a thin ATB fill bar (actionGauge / GAUGE_MAX) and the strip shows
// the completed-round counter, capped by the stage's perfectClearTurnLimit
// when the current battle was launched from a stage that has one.
describe('TurnOrderStrip speed gauge + round indicator', () => {
  function bareBattle(overrides: Partial<TurnBattle> = {}): { battle: TurnBattle; player: TurnBattleParticipant; enemy: TurnBattleParticipant } {
    const player = makeParticipant('player')
    const enemy = makeParticipant('enemy_1')
    enemy.entity.type = 'enemy'

    const battle: TurnBattle = {
      players: [player],
      enemies: [enemy],
      state: 'fighting',
      ...overrides,
    }

    return { battle, player, enemy }
  }

  it('renders a gauge fill on each party chip proportional to actionGauge / GAUGE_MAX', () => {
    const { battle, player } = bareBattle()
    player.actionGauge = 500

    const container = mountStrip(makeGameManager(battle))
    const fill = container.querySelector<HTMLElement>('.turn-order-strip__member .turn-order-strip__gauge-fill')

    expect(fill).not.toBeNull()
    expect(fill!.style.width).toBe('50%')

    container.remove()
  })

  it('clamps the gauge at 100% and marks the chip ready when actionGauge is full', () => {
    const { battle, player } = bareBattle()
    player.actionGauge = 1200

    const container = mountStrip(makeGameManager(battle))
    const fill = container.querySelector<HTMLElement>('.turn-order-strip__member .turn-order-strip__gauge-fill')

    expect(fill!.style.width).toBe('100%')
    expect(fill!.className).toContain('is-ready')

    container.remove()
  })

  it('renders a gauge fill on each upcoming-order item too', () => {
    const { battle, player, enemy } = bareBattle()
    player.actionGauge = 0
    enemy.actionGauge = 0

    const container = mountStrip(makeGameManager(battle))
    const items = Array.from(container.querySelectorAll('.turn-order-strip__item'))

    // Same speed -> priority order (player first); every item gets a bar.
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect(item.querySelector('.turn-order-strip__gauge-fill')).not.toBeNull()
    }

    container.remove()
  })

  it('shows the CURRENT round (roundsElapsed + 1, 1-based) on the round chip', () => {
    // 3 rounds completed -> the 4th is in progress, so the chip reads
    // "Hiệp 4", matching the PC predicate `roundsElapsed < limit at
    // victory` (finish before the displayed round completes).
    const { battle } = bareBattle({ roundsElapsed: 3 })

    const container = mountStrip(makeGameManager(battle))
    const chip = container.querySelector('.turn-order-strip__round')

    expect(chip).not.toBeNull()
    expect(chip!.textContent).toContain('Hiệp 4')

    container.remove()
  })

  it('appends the stage perfect-clear limit and marks the chip over-limit when exceeded', () => {
    // PC requires roundsElapsed < limit at victory. At roundsElapsed = 15,
    // limit = 15 the window is already gone — the in-progress round is the
    // 16th, displayed as "Hiệp 16/15" with is-over.
    const { battle } = bareBattle({ roundsElapsed: 15 })
    const stage = { perfectClearTurnLimit: 15 }

    const container = mountStrip(makeGameManager(battle, stage as never))
    const chip = container.querySelector('.turn-order-strip__round')

    expect(chip!.textContent).toContain('16')
    expect(chip!.textContent).toContain('15')
    expect(chip!.className).toContain('is-over')

    container.remove()
  })

  it('does not mark the chip over while the current round can still finish under the limit', () => {
    // roundsElapsed = 14, limit = 15 -> in round 15, still PC-able.
    const { battle } = bareBattle({ roundsElapsed: 14 })
    const stage = { perfectClearTurnLimit: 15 }

    const container = mountStrip(makeGameManager(battle, stage as never))
    const chip = container.querySelector('.turn-order-strip__round')

    expect(chip!.textContent).toContain('15')
    expect(chip!.className).not.toContain('is-over')

    container.remove()
  })

  it('shows a plain counter for battles without a stage (tribulation) or without a limit', () => {
    const { battle } = bareBattle({ roundsElapsed: 2 })

    const container = mountStrip(makeGameManager(battle, null))
    const chip = container.querySelector('.turn-order-strip__round')

    expect(chip!.textContent).toBe('Hiệp 3')
    expect(chip!.className).not.toContain('is-over')

    container.remove()
  })
})
