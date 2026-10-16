// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h } from 'vue'
import { i18n } from '@/i18n'
import RealmFidelityScene from './RealmFidelityScene.vue'
import type { RealmUiModel } from './realmUi'

const model = {
  name: 'Phàm Nhân',
  currentFloor: 1,
  maxFloor: 18,
  progress: 35,
  cultivation: '35 / 100',
  rate: '+1 / s',
  passives: [{ id: 'test-passive', name: 'Linh Khí', description: 'Nội tại', effectLines: ['+5%'] }],
  nextRealmName: 'Luyện Khí',
  ctaLabel: 'Đột Phá',
  canAdvanceFloor: false,
  ctaEnabled: false,
  ritualAction: 'breakthrough',
} satisfies RealmUiModel

afterEach(() => { document.body.innerHTML = '' })

describe('realm paper presentation contract', () => {
  it('renders the model-backed floor rail and forwards floor selection', () => {
    const container = document.createElement('div')
    const selectFloor = vi.fn()
    const app = createApp({
      render: () => h(RealmFidelityScene, { model, selected: 1, onSelectFloor: selectFloor }),
    })
    app.use(i18n)
    document.body.appendChild(container)
    app.mount(container)

    try {
      const floors = container.querySelectorAll<HTMLButtonElement>('[role="option"]')
      expect(floors).toHaveLength(12)
      expect(container.querySelector('.realm-floor-line')?.textContent).toBe('Tầng 1 / 12')
      expect(container.querySelector('.realm-earned')?.textContent).toContain('Linh Khí')
      floors[2]?.click()
      expect(selectFloor).toHaveBeenCalledWith(3)
    } finally {
      app.unmount()
    }
  })

  it('reveals extended floors past 12 as 13/12 .. 18/12 when currentFloor > 12', () => {
    const container = document.createElement('div')
    const extendedModel = { ...model, currentFloor: 14 }
    const app = createApp({
      render: () => h(RealmFidelityScene, { model: extendedModel, selected: 14 }),
    })
    app.use(i18n)
    document.body.appendChild(container)
    app.mount(container)

    try {
      const floors = container.querySelectorAll<HTMLButtonElement>('[role="option"]')
      expect(floors).toHaveLength(14)
      expect(container.querySelector('.realm-floor-line')?.textContent).toBe('Tầng 14 / 12')
    } finally {
      app.unmount()
    }
  })

  it('hides the bottom passive section completely when passives is empty (Mortal)', () => {
    const container = document.createElement('div')
    const mortalModel = { ...model, passives: [] }
    const app = createApp({
      render: () => h(RealmFidelityScene, { model: mortalModel, selected: 1 }),
    })
    app.use(i18n)
    document.body.appendChild(container)
    app.mount(container)

    try {
      expect(container.querySelector('.realm-earned')).toBeNull()
    } finally {
      app.unmount()
    }
  })
})
