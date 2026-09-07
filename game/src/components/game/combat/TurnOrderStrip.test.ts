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
import { TurnBuffPool } from '@/core/battle/turn/TurnBuffPool'
import { TurnBuffSystem } from '@/core/battle/turn/TurnBuffSystem'
import { TURN_BUFF_REGISTRY } from '@/data/buff/TurnBuffRegistry'
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
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    currentThe: 0,
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
    buffs: new TurnBuffPool(),
    consecutiveHardCcTurns: 0,
  }
}

function makeBattleFixture() {
  const player = makeParticipant('player')
  const enemy = makeParticipant('enemy_1')
  enemy.entity.type = 'enemy'

  // Seed: 1 debuff (2 stacks), 1 buff, 1 hidden buff on the player.
  const buffs = new TurnBuffSystem(player.buffs)
  const source = player.entity

  buffs.apply(TURN_BUFF_REGISTRY.get('bong'), source, player.entity, TURN_BUFF_REGISTRY)
  buffs.apply(TURN_BUFF_REGISTRY.get('bong'), source, player.entity, TURN_BUFF_REGISTRY)

  const buffDef = TURN_BUFF_REGISTRY.get('bong')

  buffs.apply(
    { ...buffDef, id: 'a6_hidden', name: 'Hidden Buff', hidden: true, duration: 5, stackMode: 'refresh', effects: [] },
    source,
    player.entity,
    TURN_BUFF_REGISTRY,
  )

  const khaiSon = TURN_BUFF_REGISTRY.get('khai_son')

  buffs.apply(khaiSon, source, player.entity, TURN_BUFF_REGISTRY)

  const battle: TurnBattle = {
    players: [player],
    enemies: [enemy],
    state: 'fighting',
  }

  return { battle, player }
}

interface MockGameManager {
  getTurnBattle: ReturnType<typeof vi.fn>
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

function makeGameManager(battle: TurnBattle | null): MockGameManager {
  return { getTurnBattle: vi.fn(() => battle) }
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
