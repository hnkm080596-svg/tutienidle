// @vitest-environment jsdom
//
// Bảng 9.5 #5 (2026-09-07) — TurnCombatSkillBar hiển thị tên skill thật
// (TurnSkillDisplayMeta) thay nhãn role cố định; fallback nhãn role khi
// id không có trong map.
//
// Mount theo pattern project (createApp + h, KHÔNG @vue/test-utils —
// chưa cài, xem CombatExitConfirmModal.test.ts). Mock composable bằng
// vi.mock (hoisted factory).
import { describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import type { TurnSkillPresentationEntry } from '@/core/combat/CombatSkillPresentation'

const mocks = vi.hoisted(() => ({
  slotList: [] as TurnSkillPresentationEntry[],
  chooseSlot: vi.fn(),
  setBattleManualMode: vi.fn(),
  setCombatInputMode: vi.fn(),
}))

vi.mock('@/composables/useTurnCombatManual', () => ({
  useTurnCombatManual: () => ({
    isAwaitingChoice: { value: true },
    isBattleFighting: { value: true },
    slotList: { value: mocks.slotList },
    chooseSlot: mocks.chooseSlot,
  }),
}))

vi.mock('@/composables/useGameState', () => ({
  useGameManager: () => ({
    setBattleManualMode: mocks.setBattleManualMode,
  }),
}))

vi.mock('@/stores/ui', () => ({
  useUiStore: () => ({
    combatInputMode: 'auto',
    setCombatInputMode: mocks.setCombatInputMode,
  }),
}))

import TurnCombatSkillBar from './TurnCombatSkillBar.vue'

function entry(overrides: Partial<TurnSkillPresentationEntry> = {}): TurnSkillPresentationEntry {
  return {
    skillId: 'fixture_basic',
    cooldownRemaining: 0,
    cooldownTotal: 0,
    resourceCost: 0,
    state: 'ready',
    ...overrides,
  }
}

function mountBar(): HTMLElement {
  const container = document.createElement('div')

  document.body.appendChild(container)

  const app = createApp({ render: () => h(TurnCombatSkillBar) })

  app.mount(container)

  return container
}

describe('TurnCombatSkillBar — display label (9.5 #5)', () => {
  it('slot mang skillName → hiển thị tên thật thay nhãn role', async () => {
    mocks.slotList = [
      entry({ skillId: 'tram', skillName: 'Huy Kiếm', skillDescription: 'Một chiêu thức cơ bản.' }),
      entry(),
      entry(),
    ]

    const container = mountBar()
    await nextTick()

    expect(container.textContent).toContain('Huy Kiếm')
    // 2 slot còn lại fallback nhãn role.
    expect(container.textContent).toContain('Đặc Biệt')
    expect(container.textContent).toContain('Tuyệt Kỹ')

    appCleanup(container)
  })

  it('không có skillName nào → giữ nguyên 3 nhãn role', async () => {
    mocks.slotList = [entry(), entry(), entry()]

    const container = mountBar()
    await nextTick()

    expect(container.textContent).toContain('Thường')
    expect(container.textContent).toContain('Đặc Biệt')
    expect(container.textContent).toContain('Tuyệt Kỹ')

    appCleanup(container)
  })
})

function appCleanup(container: HTMLElement): void {
  container.remove()
}
