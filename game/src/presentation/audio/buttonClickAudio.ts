import { AudioManager } from '@/core/audio/AudioManager'

export interface UiButtonClickOptions {
  /** When false (default true), the button does NOT play ui.click on click. */
  sound?: boolean
  /** When true (default false), suppresses ui.click playback. */
  silent?: boolean
}

/**
 * Shared Pinia-free click SFX helper for UI button primitives (R10).
 * Unlocks the AudioContext on first user gesture and plays `ui.click`
 * unless explicitly muted via `sound: false` or `silent: true`.
 */
export function playUiButtonClick(options?: UiButtonClickOptions): void {
  const audio = AudioManager.getInstance()
  audio.unlock()
  if (options?.sound === false || options?.silent === true) {
    return
  }
  audio.playCue('ui.click')
}
