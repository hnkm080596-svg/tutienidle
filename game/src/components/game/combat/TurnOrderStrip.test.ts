// @vitest-environment jsdom
// Single initiative line with accessible actor avatars; no visible text,
// badges, round counters or per-chip gauges. Mount the real component.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import TurnOrderStrip from './TurnOrderStrip.vue'
import { resetInitiativeSummons, setInitiativeSummoned } from '@/presentation/combat/CombatInitiativeReady'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { i18n } from '@/i18n'
import { createBaseStats } from '@/core/stats/StatBlock'
import type { BuffInstanceSnapshot } from '@/core/buff2/BuffInstance'
import type { TurnBattle, TurnBattleParticipant } from '@/core/battle/turn/TurnBattleSystem'
import type { CombatEntity } from '@/core/combat/CombatEntity'

let nextFrame: FrameRequestCallback | undefined
const cleanups: Array<() => void> = []
beforeEach(() => {
  resetInitiativeSummons()
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { nextFrame = callback; return 1 }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  nextFrame = undefined
  resetInitiativeSummons()
  vi.unstubAllGlobals()
})
async function frameAt(time: number) {
  const callback = nextFrame
  expect(callback).toBeDefined()
  callback!(time)
  await nextTick()
}
function avatarTrack(container: HTMLElement) {
  const track = container.querySelector('.combat-initiative-track')!
  expect(track).not.toBeNull()
  expect(track.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 600 48')
  expect(track.textContent?.trim()).toBe('')
  expect(track.querySelector('text, header, .turn-order-strip__buff, .turn-order-strip__gauge-fill, .turn-order-strip__round')).toBeNull()
  return track
}

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
    currentThe: 0,

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
    
    consecutiveHardCcTurns: 0,
  }
}

function makeSnapshot(
  definitionId: string,
  targetId: string,
  overrides: Partial<BuffInstanceSnapshot> = {},
): BuffInstanceSnapshot {
  return {
    instanceId: `inst.${definitionId}`,
    definitionId,
    sourceId: targetId,
    targetId,
    stacks: 1,
    remaining: 3,
    continuousTurns: 0,
    continuousSeconds: 0,
    modifiers: [],
    createdSequence: 0,
    lastAppliedSequence: 0,
    ...overrides,
  }
}

function makeBattleFixture() {
  const player = makeParticipant('player')
  const enemy = makeParticipant('enemy_1')
  enemy.entity.type = 'enemy'

  // Seed: 1 debuff (2 stacks), 1 buff, 1 hidden buff on the player.
  const playerBuffs: BuffInstanceSnapshot[] = [
    makeSnapshot('hoa_an', 'player', { stacks: 2 }),
    makeSnapshot('thach_giap_buff', 'player'),
    makeSnapshot('ho_ve', 'player'),
  ]

  const battle: TurnBattle = {
    players: [player],
    enemies: [enemy],
    state: 'fighting',
  }

  return { battle, player, playerBuffs }
}

interface MockGameManager {
  getTurnBattle: ReturnType<typeof vi.fn>
  getActiveTurnBattleStage: ReturnType<typeof vi.fn>
  getBattleBuffs: ReturnType<typeof vi.fn>
  getFreezeReasons: ReturnType<typeof vi.fn>
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
  cleanups.push(() => { app.unmount(); container.remove() })

  return container
}

function makeGameManager(
  battle: TurnBattle | null,
  stage: { perfectClearTurnLimit?: number } | null = null,
  buffs: readonly BuffInstanceSnapshot[] = [],
): MockGameManager {
  return {
    getTurnBattle: vi.fn(() => battle),
    getActiveTurnBattleStage: vi.fn(() => stage),
    getBattleBuffs: vi.fn(() => buffs),
    getFreezeReasons: vi.fn(() => []),
  }
}

describe('TurnOrderStrip avatar-only presentation', () => {
  it('renders actor avatars without buff text, badges or counters', () => {
    const { battle, playerBuffs } = makeBattleFixture()
    const container = mountStrip(makeGameManager(battle, null, playerBuffs))
    const track = avatarTrack(container)
    expect(track.querySelectorAll('[data-actor-id]')).toHaveLength(2)
    expect(track.querySelectorAll('image')).toHaveLength(2)
    expect(track.querySelector('[data-actor-id="player"]')?.getAttribute('aria-label')).toBe('player')
    expect(track.querySelector('[data-actor-id="enemy_1"]')?.getAttribute('aria-label')).toBe('enemy_1')
  })

  it('does not query buff content for the avatar-only strip', () => {
    const { battle, playerBuffs } = makeBattleFixture()
    const gm = makeGameManager(battle, null, playerBuffs)
    const container = mountStrip(gm)
    avatarTrack(container)
    expect(gm.getBattleBuffs).not.toHaveBeenCalled()
    expect(container.querySelectorAll('[data-actor-id] image')).toHaveLength(2)
  })

  it('keeps avatar identity accessible without native tooltip or visible name text', () => {
    const { battle, playerBuffs } = makeBattleFixture()
    const container = mountStrip(makeGameManager(battle, null, playerBuffs))
    const avatars = avatarTrack(container).querySelectorAll('[data-actor-id]')
    expect(avatars).toHaveLength(2)
    for (const avatar of avatars) {
      expect(avatar.getAttribute('role')).toBe('img')
      expect(avatar.getAttribute('tabindex')).toBe('0')
      expect(avatar.getAttribute('aria-label')).toBeTruthy()
      expect(avatar.getAttribute('title')).toBeNull()
    }
  })

  it('renders no track when the battle is null', () => {
    const container = mountStrip(makeGameManager(null))
    expect(container.querySelector('.combat-initiative-track')).toBeNull()
    expect(container.querySelectorAll('[data-actor-id]')).toHaveLength(0)
  })
})

// Gauge values drive avatar position only; domain state remains unchanged.
describe('TurnOrderStrip initiative travel and actor visibility', () => {
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

  it('moves the player avatar halfway along the single line for half gauge', async () => {
    const { battle, player } = bareBattle()
    player.actionGauge = 500
    const container = mountStrip(makeGameManager(battle))
    for (let time = 100; time <= 600; time += 100) await frameAt(time)
    const track = avatarTrack(container)
    const marker = track.querySelector('[data-actor-id="player"]')!
    expect(marker.getAttribute('data-progress')).toBe('50')
    expect(marker.getAttribute('transform')).toBe('translate(300, 0)')
    expect(player.actionGauge).toBe(500)
  })

  it('clamps avatar travel at the line endpoint without changing the actor gauge', async () => {
    const { battle, player } = bareBattle()
    player.actionGauge = 1200
    const container = mountStrip(makeGameManager(battle))
    for (let time = 100; time <= 1300; time += 100) await frameAt(time)
    const marker = avatarTrack(container).querySelector('[data-actor-id="player"]')!
    expect(marker.getAttribute('data-progress')).toBe('100')
    expect(marker.getAttribute('transform')).toBe('translate(576, 0)')
    expect(player.actionGauge).toBe(1200)
  })

  it('renders each living actor once instead of duplicating upcoming-order chips', () => {
    const { battle, player, enemy } = bareBattle()
    player.actionGauge = 0
    enemy.actionGauge = 0
    const container = mountStrip(makeGameManager(battle))
    const markers = avatarTrack(container).querySelectorAll('[data-actor-id]')
    expect(Array.from(markers, marker => marker.getAttribute('data-actor-id')).sort()).toEqual(['enemy_1', 'player'])
    for (const marker of markers) expect(marker.querySelector('image')?.getAttribute('href')).toBeTruthy()
  })

  it('round advancement does not introduce a visible counter into the avatar line', () => {
    const { battle } = bareBattle({ roundsElapsed: 3 })
    const container = mountStrip(makeGameManager(battle))
    const track = avatarTrack(container)
    expect(track.querySelectorAll('[data-actor-id]')).toHaveLength(2)
    expect(battle.roundsElapsed).toBe(3)
  })

  it('stage perfect-clear limits do not add numbers or over-limit badges to the line', () => {
    const { battle } = bareBattle({ roundsElapsed: 15 })
    const gm = makeGameManager(battle, { perfectClearTurnLimit: 15 })
    const container = mountStrip(gm)
    const track = avatarTrack(container)
    expect(track.querySelector('.is-over')).toBeNull()
    expect(track.querySelectorAll('image')).toHaveLength(2)
    expect(gm.getActiveTurnBattleStage).not.toHaveBeenCalled()
  })

  it('unsummoned actors stay hidden while the battle is fighting', () => {
    const { battle } = bareBattle({ roundsElapsed: 14 })
    setInitiativeSummoned('enemy_1', false)
    const container = mountStrip(makeGameManager(battle, { perfectClearTurnLimit: 15 }))
    const track = avatarTrack(container)
    expect(track.querySelectorAll('[data-actor-id]')).toHaveLength(1)
    expect(track.querySelector('[data-actor-id="enemy_1"]')).toBeNull()
    expect(track.querySelector('[data-actor-id="player"]')).not.toBeNull()
  })

  it('dead actors are absent from the avatar line even without a stage', () => {
    const { battle, enemy } = bareBattle({ roundsElapsed: 2 })
    enemy.entity.alive = false
    const container = mountStrip(makeGameManager(battle, null))
    const track = avatarTrack(container)
    expect(track.querySelectorAll('[data-actor-id]')).toHaveLength(1)
    expect(track.querySelector('[data-actor-id="player"]')).not.toBeNull()
    expect(track.querySelector('[data-actor-id="enemy_1"]')).toBeNull()
  })
})
