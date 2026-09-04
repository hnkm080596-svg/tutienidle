// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUiStore } from './ui'
import {
  UI_AUTOMATION_STORAGE_KEY,
  loadPersistedUiAutomationFlags,
} from './uiFlagsPersistence'

// Slice 7 plan Task 3 — combatInputMode (manual/auto): trục RIÊNG khỏi
// battleRunMode (manual/repeat/progress governs stage-boundary behavior).
// Persist qua uiFlagsPersistence (per-device localStorage, cùng pattern).

describe('ui.combatInputMode (Slice 7 Task 3)', () => {
  beforeEach(() => {
    localStorage.removeItem(UI_AUTOMATION_STORAGE_KEY)
    setActivePinia(createPinia())
  })

  it('mặc định auto', () => {
    const ui = useUiStore()

    expect(ui.combatInputMode).toBe('auto')
  })

  it('setCombatInputMode đổi giá trị + persist snapshot', () => {
    const ui = useUiStore()

    ui.setCombatInputMode('manual')

    expect(ui.combatInputMode).toBe('manual')

    const persisted = loadPersistedUiAutomationFlags()

    expect(persisted.combatInputMode).toBe('manual')
  })

  it('hydrate từ localStorage khi khởi tạo store', () => {
    localStorage.setItem(
      UI_AUTOMATION_STORAGE_KEY,
      JSON.stringify({ battleRunMode: 'repeat', combatInputMode: 'manual' }),
    )

    setActivePinia(createPinia())
    const ui = useUiStore()

    expect(ui.combatInputMode).toBe('manual')
  })

  it('giá trị sai kiểu bị bỏ qua khi load (fallback default)', () => {
    localStorage.setItem(
      UI_AUTOMATION_STORAGE_KEY,
      JSON.stringify({ combatInputMode: 'yes' }),
    )

    setActivePinia(createPinia())
    const ui = useUiStore()

    expect(ui.combatInputMode).toBe('auto')
  })
})
