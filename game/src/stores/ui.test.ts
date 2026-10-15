import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore, type HomeSurfaceId } from './ui'

describe('ui store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('click nền Động Phủ đóng đồng thời panel, standalone và wheel', () => {
    const ui = useUiStore()

    ui.leftPanelMode = 'pill_room'
    ui.standalonePanel = 'skill'
    ui.isCommandWheelOpen = true

    ui.closeHomeOverlays()

    expect(ui.activeHomeSurface).toBeNull()
    expect(ui.hasHomeOverlayOpen).toBe(false)
    expect(ui.leftPanelMode).toBeNull()
    expect(ui.standalonePanel).toBeNull()
    expect(ui.characterOverlayOpen).toBe(false)
    expect(ui.isCommandWheelOpen).toBe(false)
  })

  it('activeHomeSurface is the single owner: opening any home surface automatically closes any previous surface', () => {
    const ui = useUiStore()

    ui.openHomeSurface('character')
    expect(ui.activeHomeSurface).toBe('character')
    expect(ui.characterOverlayOpen).toBe(true)
    expect(ui.characterSceneTab).toBe('character')
    expect(ui.hasHomeOverlayOpen).toBe(true)

    ui.openHomeSurface('pill_room')
    expect(ui.activeHomeSurface).toBe('pill_room')
    expect(ui.leftPanelMode).toBe('pill_room')
    expect(ui.characterOverlayOpen).toBe(false)

    ui.openHomeSurface('skill')
    expect(ui.activeHomeSurface).toBe('skill')
    expect(ui.standalonePanel).toBe('skill')
    expect(ui.leftPanelMode).toBeNull()

    ui.openHomeSurface('feedback')
    expect(ui.activeHomeSurface).toBe('feedback')
    expect(ui.standalonePanel).toBeNull()
    expect(ui.leftPanelMode).toBeNull()
    expect(ui.characterOverlayOpen).toBe(false)
    expect(ui.hasHomeOverlayOpen).toBe(true)

    // Opening inventory via openHomeSurface closes feedback automatically.
    const nextSurface: HomeSurfaceId = 'inventory'
    ui.openHomeSurface(nextSurface)
    expect(ui.activeHomeSurface).toBe('inventory')
    expect(ui.characterOverlayOpen).toBe(true)
    expect(ui.characterSceneTab).toBe('inventory')
  })
})

