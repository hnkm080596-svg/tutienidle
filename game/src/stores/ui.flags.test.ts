// @vitest-environment jsdom
//
// Ui automation flags persistence (2026-08-26) - nguoi choi yeu cau
// "luu lai flag cua cac trang thai tu dong". Test roundtrip qua
// localStorage + cac duong fallback (JSON hong/gia tri sai kieu).
// (2026-08-30) isAutoConsumeTinhHoa da GO - snapshot chi con battleRunMode.
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from './ui'
import {
  UI_AUTOMATION_STORAGE_KEY,
  installAutomationFlagsPersistence,
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

    // Mo phong du lieu rac ghi de truc tiep.
    localStorage.setItem(
      UI_AUTOMATION_STORAGE_KEY,

      JSON.stringify({ battleRunMode: 'turbo' }),
    )

    const loaded = loadPersistedUiAutomationFlags()

    expect(loaded.battleRunMode).toBeUndefined()

    // Store moi doc snapshot sach con lai truoc do? Khong - key da bi
    // ghi de, nen hydrate ve defaults an toan.
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

    // Helper load cung khong throw.
    expect(loadPersistedUiAutomationFlags()).toEqual({})
  })

  it('mutation TRỰC TIẾP từ panel (battleRunMode = ...) được $subscribe bắt và lưu', async () => {
    // Wiring production that - App.vue goi dung ham nay.
    const ui = useUiStore()

    const unsubscribe = installAutomationFlagsPersistence(ui)

    // CombatVictoryPanel/StageSelectPanel gan thang the nay.
    ui.battleRunMode = 'progress'

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(loadPersistedUiAutomationFlags().battleRunMode).toBe('progress')

    // Gan cung gia tri lan nua -> snapshot trung, KHONG ghi lap (skip).
    const persistedModeBefore = JSON.parse(localStorage.getItem(UI_AUTOMATION_STORAGE_KEY)!).battleRunMode

    ui.battleRunMode = 'progress'

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(JSON.parse(localStorage.getItem(UI_AUTOMATION_STORAGE_KEY)!).battleRunMode).toBe(
      persistedModeBefore,
    )

    unsubscribe()
  })

  it('mutation chỉ combatInputMode (battleRunMode giữ nguyên) vẫn persist — Mission A4', async () => {
    const ui = useUiStore()

    const unsubscribe = installAutomationFlagsPersistence(ui)

    // Prime snapshot qua battleRunMode change.
    ui.battleRunMode = 'repeat'

    await new Promise((resolve) => setTimeout(resolve, 0))

    // Gio chi doi combatInputMode - dirty check cu so sanh mot minh
    // battleRunMode nen se bo qua mutation nay.
    ui.combatInputMode = 'manual'

    await new Promise((resolve) => setTimeout(resolve, 0))

    const loaded = loadPersistedUiAutomationFlags()

    expect(loaded.battleRunMode).toBe('repeat')
    expect(loaded.combatInputMode).toBe('manual')

    unsubscribe()
  })
})
