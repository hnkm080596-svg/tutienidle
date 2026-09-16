import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from './ui'

describe('ui store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('click nền Động Phủ đóng đồng thời panel, standalone, popover và wheel', () => {
    const ui = useUiStore()

    ui.leftPanelMode = 'pill_room'
    ui.standalonePanel = 'skill'
    ui.activeBuildingPopoverId = 'chi_hien_quan'
    ui.isCommandWheelOpen = true

    ui.closeHomeOverlays()

    expect(ui.leftPanelMode).toBeNull()
    expect(ui.standalonePanel).toBeNull()
    expect(ui.activeBuildingPopoverId).toBeNull()
    expect(ui.isCommandWheelOpen).toBe(false)
  })
})
