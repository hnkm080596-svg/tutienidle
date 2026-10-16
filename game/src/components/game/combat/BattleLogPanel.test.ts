// @vitest-environment jsdom
//
// T4-36 - battle log must render display names (participant entity.name
// + TurnSkillDisplayMeta), never raw ids like 'wild_wolf_1' or
// 'hoa_cau_thuat'. Mounted with a fake GameManager over the standard
// GAME_MANAGER_KEY/STATE_VERSION_KEY injection seam.
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
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
    expect(line).toContain('Ly Hỏa Thuật')
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

  it('renders detailed damage amount, damage kind, element, crit tag, and ward absorbed', () => {
    const container = mountPanel(
      battleWith([
        {
          turn: 2,
          actorId: 'player',
          skillId: 'hoa_cau_thuat',
          targetIds: ['wild_wolf_1'],
          ccBlocked: false,
          totalDamage: 480,
          hpDamage: 400,
          wardDamage: 80,
          hitCount: 1,
          critCount: 1,
          crit: true,
          damageKind: 'magic',
          element: 'fire',
        },
      ]),
    )

    const line = container.querySelector('.battle-log-panel__line')?.textContent ?? ''

    expect(line).toContain('480')
    expect(line).toContain('ST Pháp Thuật')
    expect(line).toContain('Hỏa')
    expect(line).toContain('Chí Mạng')
    expect(line).toContain('Khiên -80')
  })

  it('switches to Thống Kê (stats) and Thu Hoạch (loot) tabs and supports alwaysVisible on empty log', async () => {
    const container = mountPanel(
      battleWith([
        {
          turn: 1,
          actorId: 'player',
          skillId: 'hoa_cau_thuat',
          targetIds: ['wild_wolf_1'],
          ccBlocked: false,
          totalDamage: 600,
          hpDamage: 600,
          wardDamage: 0,
          healed: 120,
          hitCount: 2,
          critCount: 1,
          crit: true,
        },
        {
          turn: 2,
          actorId: 'wild_wolf_1',
          skillId: '',
          targetIds: ['player'],
          ccBlocked: false,
          totalDamage: 200,
          hpDamage: 200,
          wardDamage: 0,
          hitCount: 1,
          critCount: 0,
        },
      ]),
    )

    const tabs = container.querySelectorAll<HTMLButtonElement>('.df-chatbox__tab')
    expect(tabs.length).toBe(3)

    // Switch to Thống Kê tab
    tabs[1]!.click()
    await nextTick()

    const statsRows = container.querySelectorAll('.combat-stat-row')
    expect(statsRows.length).toBe(2)
    expect(statsRows[0]?.textContent).toContain('Ta')
    expect(statsRows[0]?.textContent).toContain('600')
    expect(statsRows[0]?.textContent).toContain('75%')

    // Switch to Thu Hoạch tab
    tabs[2]!.click()
    await nextTick()

    expect(container.querySelector('.df-chatbox__empty')).not.toBeNull()
  })
})


