// @vitest-environment jsdom
//
// Ui automation flags persistence (2026-08-26) — người chơi yêu cầu
// "lưu lại flag của các trạng thái tự động". Test roundtrip qua
// localStorage + các đường fallback (JSON hỏng/giá trị sai kiểu).
// (2026-08-30) isAutoConsumeTinhHoa đã GỠ — snapshot chỉ còn battleRunMode.
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from './ui'
import {
  UI_AUTOMATION_STORAGE_KEY,
  loadPersistedUiAutomationFlags,
  savePersistedUiAutomationFlags,
} from './uiFlagsPersistence'

describe('ui automation flags — persistence (plan yêu cầu người chơi)', () => {
  beforeEach(() => {
    localStorage.clear()

    setActivePinia(createPinia())
  })

  it('store mới chưa có save → default manual', () => {
    const ui = useUiStore()

    expect(ui.battleRunMode).toBe('manual')
  })

  it('setBattleRunMode tự ghi snapshot vào localStorage', () => {
    const ui = useUiStore()

    ui.setBattleRunMode('repeat')

    const raw = localStorage.getItem(UI_AUTOMATION_STORAGE_KEY)!

    expect(JSON.parse(raw)).toMatchObject({
      battleRunMode: 'repeat',
    })
  })

  it('giá trị sai kiểu bị chặn khi load', () => {
    const ui = useUiStore()

    ui.setBattleRunMode('repeat')

    // Mô phỏng dữ liệu rác ghi đè trực tiếp.
    localStorage.setItem(
      UI_AUTOMATION_STORAGE_KEY,

      JSON.stringify({ battleRunMode: 'turbo' }),
    )

    const loaded = loadPersistedUiAutomationFlags()

    expect(loaded.battleRunMode).toBeUndefined()

    // Store mới đọc snapshot sạch còn lại trước đó? Không — key đã bị
    // ghi đè, nên hydrate về defaults an toàn.
    setActivePinia(createPinia())

    const fresh = useUiStore()

    expect(fresh.battleRunMode).toBe('manual')
  })

  it('roundtrip hydrate đúng các automation flag còn hiệu lực', () => {
    savePersistedUiAutomationFlags({
      battleRunMode: 'progress',
      combatInputMode: 'auto',
    })

    setActivePinia(createPinia())

    const ui = useUiStore()

    expect(ui.battleRunMode).toBe('progress')
  })

  it('localStorage JSON hỏng → fallback defaults, không throw', () => {
    localStorage.setItem(UI_AUTOMATION_STORAGE_KEY, '{not-json')

    setActivePinia(createPinia())

    const ui = useUiStore()

    expect(ui.battleRunMode).toBe('manual')

    // Helper load cũng không throw.
    expect(loadPersistedUiAutomationFlags()).toEqual({})
  })

  it('mutation TRỰC TIẾP từ panel (battleRunMode = ...) được $subscribe bắt và lưu', async () => {
    // Wire giống App.vue: subscribe filtered-snapshot với skip-unchanged.
    let lastSnapshot = ''

    const ui = useUiStore()

    ui.$subscribe((_mutation, state) => {
      const snapshot = JSON.stringify({
        m: state.battleRunMode,
      })

      if (snapshot === lastSnapshot) {
        return
      }

      lastSnapshot = snapshot

      savePersistedUiAutomationFlags({
        battleRunMode: state.battleRunMode,
        combatInputMode: state.combatInputMode,
      })
    }, { detached: true })

    // CombatVictoryPanel/StageSelectPanel gán thẳng thế này.
    ui.battleRunMode = 'progress'

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(loadPersistedUiAutomationFlags().battleRunMode).toBe('progress')

    // Gán cùng giá trị lần nữa → snapshot trùng, KHÔNG ghi lặp (skip).
    const writeCountBefore = JSON.parse(localStorage.getItem(UI_AUTOMATION_STORAGE_KEY)!).battleRunMode

    ui.battleRunMode = 'progress'

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(JSON.parse(localStorage.getItem(UI_AUTOMATION_STORAGE_KEY)!).battleRunMode).toBe(
      writeCountBefore,
    )
  })
})
