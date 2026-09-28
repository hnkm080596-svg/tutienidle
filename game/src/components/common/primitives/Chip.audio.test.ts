/* eslint-disable vue/one-component-per-file */
// @vitest-environment jsdom
// W7 - Chip emits ui.tab on click and nothing when disabled (the
// blanket tab/filter cue; AudioManager direct, no Pinia needed).
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createApp, h } from 'vue'
import Chip from './Chip.vue'
import { AudioManager } from '@/core/audio/AudioManager'

let playCue: ReturnType<typeof vi.spyOn>
let unlock: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  const audio = AudioManager.getInstance()
  playCue = vi.spyOn(audio, 'playCue').mockImplementation(() => {})
  unlock = vi.spyOn(audio, 'unlock').mockImplementation(() => Promise.resolve())
})

afterEach(() => {
  playCue.mockRestore()
  unlock.mockRestore()
})

function mountChip(disabled: boolean): { host: HTMLElement; app: ReturnType<typeof createApp> } {
  const host = document.createElement('div')
  const app = createApp({
    render: () => h(Chip, { disabled }, () => 'Tab'),
  })
  app.mount(host)
  return { host, app }
}

describe('Chip audio', () => {
  it('plays ui.tab on click', () => {
    const { host, app } = mountChip(false)
    host.querySelector('button')!.click()
    expect(playCue).toHaveBeenCalledWith('ui.tab')
    app.unmount()
  })

  it('plays nothing when disabled', () => {
    const { host, app } = mountChip(true)
    host.querySelector('button')!.click()
    expect(playCue).not.toHaveBeenCalled()
    app.unmount()
  })
})
