// @vitest-environment jsdom
// W7 - uiAudioBinding maps uiStore panel/wheel transitions to cue ids
// through a $subscribe diff (zero ui.ts edits). Covers: open/close
// transitions, panel->panel swap (close+open), wheel open/close, and
// non-panel mutations staying silent.
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { bindUiAudio } from './uiAudioBinding'
import { useUiStore } from '@/stores/ui'
import { AudioManager } from '@/core/audio/AudioManager'

let playCue: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  setActivePinia(createPinia())
  playCue = vi.spyOn(AudioManager.getInstance(), 'playCue').mockImplementation(() => {})
})

afterEach(() => {
  playCue.mockRestore()
})

function cues(): string[] {
  return playCue.mock.calls.map((call: unknown[]) => call[0] as string)
}

describe('bindUiAudio', () => {
  it('plays ui.panel.open when a left panel opens and ui.panel.close when it closes', () => {
    const ui = useUiStore()
    const unbind = bindUiAudio(ui)

    ui.leftPanelMode = 'settings'
    expect(cues()).toEqual(['ui.panel.open'])

    ui.leftPanelMode = null
    expect(cues()).toEqual(['ui.panel.open', 'ui.panel.close'])
    unbind()
  })

  it('emits close+open on a panel->panel swap', () => {
    const ui = useUiStore()
    const unbind = bindUiAudio(ui)

    ui.leftPanelMode = 'settings'
    playCue.mockClear()

    ui.leftPanelMode = 'vendor'
    expect(cues()).toEqual(['ui.panel.close', 'ui.panel.open'])
    unbind()
  })

  it('treats overlay/standalone fields as one ordered panel signature', () => {
    const ui = useUiStore()
    const unbind = bindUiAudio(ui)

    ui.characterOverlayOpen = true
    expect(cues()).toEqual(['ui.panel.open'])

    // Overlay takes precedence over standalone - swap still reads close+open.
    ui.characterOverlayOpen = false
    ui.standalonePanel = 'realm'
    expect(cues()).toEqual(['ui.panel.open', 'ui.panel.close', 'ui.panel.open'])

    ui.standalonePanel = null
    unbind()
  })

  it('plays ui.wheel.open/ui.wheel.close on the command wheel flag', () => {
    const ui = useUiStore()
    const unbind = bindUiAudio(ui)

    ui.isCommandWheelOpen = true
    ui.isCommandWheelOpen = false
    expect(cues()).toEqual(['ui.wheel.open', 'ui.wheel.close'])
    unbind()
  })

  it('stays silent for unrelated store mutations', () => {
    const ui = useUiStore()
    const unbind = bindUiAudio(ui)

    ui.combatOrigin = 'stage'
    ui.battleRunMode = 'repeat'
    expect(cues()).toEqual([])
    unbind()
  })

  it('fires nothing on bind (no initial-state replay)', () => {
    const ui = useUiStore()
    ui.leftPanelMode = 'settings'
    const unbind = bindUiAudio(ui)
    expect(cues()).toEqual([])
    unbind()
  })
})
