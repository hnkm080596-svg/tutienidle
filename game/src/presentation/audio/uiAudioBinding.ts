// uiAudioBinding - presentation adapter mapping uiStore panel/wheel state
// transitions to manifest cue ids through a $subscribe diff. Zero edits to
// stores/ui.ts: the seam is the store subscription, same shape as
// combatAudioBinding's eventBus observation (audio never writes back).
//
// Panel semantics: exactly one "active panel" signature derived from the
// four panel fields in precedence order; any signature change emits
// ui.panel.close for the outgoing panel first, then ui.panel.open for the
// incoming one - a panel->panel swap therefore sounds close+open.

import { AudioManager } from '@/core/audio/AudioManager'
import { useUiStore } from '@/stores/ui'

type UiStore = ReturnType<typeof useUiStore>

interface PanelSnapshot {
  leftPanelMode: string | null
  standalonePanel: string | null
  characterOverlayOpen: boolean
  characterDetailOpen: boolean
  isCommandWheelOpen: boolean
}

function snapshotOf(store: UiStore): PanelSnapshot {
  return {
    leftPanelMode: store.leftPanelMode,
    standalonePanel: store.standalonePanel,
    characterOverlayOpen: store.characterOverlayOpen,
    characterDetailOpen: store.characterDetailOpen,
    isCommandWheelOpen: store.isCommandWheelOpen,
  }
}

function panelKey(s: PanelSnapshot): string | null {
  if (s.characterDetailOpen) return 'detail'
  if (s.characterOverlayOpen) return 'overlay'
  if (s.standalonePanel !== null) return `standalone:${s.standalonePanel}`
  if (s.leftPanelMode !== null) return `left:${s.leftPanelMode}`
  return null
}

/**
 * Binds uiStore panel/wheel transitions to ui.panel + ui.wheel cues.
 * Returns the unsubscribe function. Fires nothing on bind (transitions
 * only, no initial-state replay).
 */
export function bindUiAudio(uiStore: UiStore): () => void {
  const audio = AudioManager.getInstance()
  let prev = snapshotOf(uiStore)

  // flush:'sync' — cues must land inside the pointer gesture that caused
  // the transition; 'pre' would batch past the autoplay window.
  return uiStore.$subscribe(
    () => {
      const next = snapshotOf(uiStore)

      const prevPanel = panelKey(prev)
      const nextPanel = panelKey(next)
      if (prevPanel !== nextPanel) {
        if (prevPanel !== null) audio.playCue('ui.panel.close')
        if (nextPanel !== null) audio.playCue('ui.panel.open')
      }

      if (prev.isCommandWheelOpen !== next.isCommandWheelOpen) {
        audio.playCue(next.isCommandWheelOpen ? 'ui.wheel.open' : 'ui.wheel.close')
      }

      prev = next
    },
    { flush: 'sync' },
  )
}
