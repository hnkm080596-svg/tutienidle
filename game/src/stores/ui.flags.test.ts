// @vitest-environment jsdom
//
// Ui automation flags persistence (2026-08-26) — người chơi yêu cầu
// "lưu lại flag của các trạng thái tự động". Test roundtrip qua
// localStorage + các đường fallback (JSON hỏng/giá trị sai kiểu).
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

  it('store mới chưa có save → defaults false/false/manual', () => {
    const ui = useUiStore()

    expect(ui.isAutoBreakthrough).toBe(false)
    expect(ui.isAutoConsumeTinhHoa).toBe(false)
    expect(ui.battleRunMode).toBe('manual')
  })

  it('toggle action tự ghi snapshot vào localStorage', () => {
    const ui = useUiStore()

    ui.toggleAutoConsumeTinhHoa()

    const raw = localStorage.getItem(UI_AUTOMATION_STORAGE_KEY)!

    // 2026-08-28 — bỏ isAutoBreakthrough khỏi flow; ghi luôn false để
    // save cũ KHÔNG ghi đè bằng true sau khi hydrate.
    expect(JSON.parse(raw)).toMatchObject({
      isAutoBreakthrough: false,
      isAutoConsumeTinhHoa: true,
    })
  })

  it('setBattleRunMode cũng được lưu; giá trị sai kiểu bị chặn khi load', () => {
    const ui = useUiStore()

    ui.setBattleRunMode('repeat')

    // Mô phỏng dữ liệu rác ghi đè trực tiếp.
    localStorage.setItem(
      UI_AUTOMATION_STORAGE_KEY,

      JSON.stringify({ isAutoBreakthrough: 'yes', battleRunMode: 'turbo' }),
    )

    const loaded = loadPersistedUiAutomationFlags()

    expect(loaded.isAutoBreakthrough).toBeUndefined()
    expect(loaded.battleRunMode).toBeUndefined()

    // Store mới đọc snapshot sạch còn lại trước đó? Không — key đã bị
    // ghi đè, nên hydrate về defaults an toàn.
    setActivePinia(createPinia())

    const fresh = useUiStore()

    expect(fresh.isAutoBreakthrough).toBe(false)
    expect(fresh.battleRunMode).toBe('manual')
  })

  it('roundtrip: save cũ (có isAutoBreakthrough=true) hydrate AN TOÀN — field bị bỏ qua runtime', () => {
    savePersistedUiAutomationFlags({
      isAutoBreakthrough: true,

      isAutoConsumeTinhHoa: true,

      battleRunMode: 'progress',
    })

    setActivePinia(createPinia())

    const ui = useUiStore()

    // 2026-08-28 — tiểu cảnh giới tự tăng; flag vẫn đọc (back-compat) nhưng
    // runtime ÉP về false. Đây là gate bảo vệ: dù save cũ có ghi true,
    // game không cho phép tắt auto-advance nữa.
    expect(ui.isAutoBreakthrough).toBe(false)
    expect(ui.isAutoConsumeTinhHoa).toBe(true)
    expect(ui.battleRunMode).toBe('progress')
  })

  it('localStorage JSON hỏng → fallback defaults, không throw', () => {
    localStorage.setItem(UI_AUTOMATION_STORAGE_KEY, '{not-json')

    setActivePinia(createPinia())

    const ui = useUiStore()

    expect(ui.isAutoBreakthrough).toBe(false)
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
        c: state.isAutoConsumeTinhHoa,

        m: state.battleRunMode,
      })

      if (snapshot === lastSnapshot) {
        return
      }

      lastSnapshot = snapshot

      savePersistedUiAutomationFlags({
        isAutoBreakthrough: false,

        isAutoConsumeTinhHoa: state.isAutoConsumeTinhHoa,

        battleRunMode: state.battleRunMode,
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
