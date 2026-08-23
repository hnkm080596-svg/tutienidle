import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from './ui'

describe('ui pause safety', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('xóa pause cũ khi vào scene Độ Kiếp không có nút Resume', () => {
    const ui = useUiStore()

    ui.setPaused(true)
    ui.enterTribulationScene()

    expect(ui.isPaused).toBe(false)
    expect(ui.isTribulationSceneActive).toBe(true)
  })

  it('không để pause rò qua ranh giới vào/ra Combat Scene', () => {
    const ui = useUiStore()

    ui.setPaused(true)
    ui.exitCombatScene()
    expect(ui.isPaused).toBe(false)

    ui.setPaused(true)
    ui.enterCombatScene('stage')
    expect(ui.isPaused).toBe(false)
  })
})
