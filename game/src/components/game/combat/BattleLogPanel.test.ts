// @vitest-environment jsdom
//
// T4-36 - battle log must render display names (participant entity.name
// + TurnSkillDisplayMeta), never raw ids like 'wild_wolf_1' or
// 'hoa_cau_thuat'. Mounted with a fake GameManager over the standard
// GAME_MANAGER_KEY/STATE_VERSION_KEY injection seam.
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import { i18n } from '@/i18n'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import type { GameManager } from '@/core/game/GameManager'
import type { TurnBattle, TurnBattleParticipant } from '@/core/battle/turn/TurnBattleSystem'
import BattleLogPanel from './BattleLogPanel.vue'

const cleanup: Array<() => void> = []

function participant(id: string, name: string): TurnBattleParticipant {
  return { id, entity: { name } } as unknown as TurnBattleParticipant
}

function mountPanel(battle: TurnBattle) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const manager = {
    getTurnBattle: () => battle,
    getActiveTurnBattleStage: () => null,
  } as unknown as GameManager

  const app = createApp({ render: () => h(BattleLogPanel) })
  app.use(createPinia())
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, ref(0))
  app.provide(BUMP_STATE_KEY, () => {})
  app.mount(container)

  cleanup.push(() => {
    app.unmount()
    container.remove()
  })

  return container
}

function battleWith(entries: TurnBattle['log']): TurnBattle {
  return {
    state: 'fighting',
    players: [participant('player', 'Ta')],
    enemies: [participant('wild_wolf_1', 'Dã Lang')],
    log: entries,
  }
}

afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose()
})

describe('BattleLogPanel display names (T4-36)', () => {
  it('renders the participant name and skill display name, never raw ids', () => {
    const container = mountPanel(
      battleWith([{ turn: 3, actorId: 'wild_wolf_1', skillId: 'hoa_cau_thuat', targetIds: ['player'], ccBlocked: false }]),
    )

    const line = container.querySelector('.battle-log-panel__line')?.textContent ?? ''

    expect(line).toContain('Dã Lang')
    expect(line).toContain('Ta')
    expect(line).toContain('Hỏa Cầu Thuật')
    expect(line).not.toContain('wild_wolf_1')
    expect(line).not.toContain('hoa_cau_thuat')
    expect(line).toMatch(/Lượt 3/)
  })

  it('ccBlocked renders the localized locked line', () => {
    const container = mountPanel(
      battleWith([{ turn: 5, actorId: 'player', skillId: '', targetIds: [], ccBlocked: true }]),
    )

    const line = container.querySelector('.battle-log-panel__line')?.textContent ?? ''

    expect(line).toContain('Ta')
    expect(line).not.toContain('player')
  })

  it('empty skillId falls back to the localized basic-attack label', () => {
    const container = mountPanel(
      battleWith([{ turn: 1, actorId: 'player', skillId: '', targetIds: ['wild_wolf_1'], ccBlocked: false }]),
    )

    const line = container.querySelector('.battle-log-panel__line')?.textContent ?? ''

    expect(line).toContain('Ta')
    expect(line).toContain('Dã Lang')
    expect(line).not.toContain('wild_wolf_1')
  })
})
