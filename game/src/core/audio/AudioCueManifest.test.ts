// AudioCueManifest.test.ts - W1 manifest validation + resolveAudioCue chain.
import { describe, expect, it } from 'vitest'

import { AUDIO_CHANNELS } from './AudioChannels'
import { AUDIO_CUES, resolveAudioCue, type AudioCueDef } from './AudioCueManifest'
import { SOUND_LIBRARY } from './AudioManager'

const ENTRIES = Object.entries(AUDIO_CUES)

describe('AudioCueManifest', () => {
  it('has every row on a valid channel', () => {
    for (const [id, def] of ENTRIES) {
      expect(AUDIO_CHANNELS, `channel of ${id}`).toContain(def.channel)
    }
  })

  it('keeps optional fields in range', () => {
    for (const [id, def] of ENTRIES) {
      if (def.volume !== undefined) {
        expect(def.volume, `volume of ${id}`).toBeGreaterThanOrEqual(0)
        expect(def.volume, `volume of ${id}`).toBeLessThanOrEqual(1)
      }
      if (def.cooldownMs !== undefined) {
        expect(def.cooldownMs, `cooldownMs of ${id}`).toBeGreaterThan(0)
      }
      if (def.duckMusic !== undefined) {
        expect(def.duckMusic, `duckMusic of ${id}`).toBeGreaterThan(0)
        expect(def.duckMusic, `duckMusic of ${id}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('every synthFallback exists in SOUND_LIBRARY', () => {
    for (const [id, def] of ENTRIES) {
      if (def.synthFallback !== undefined) {
        expect(SOUND_LIBRARY, `synthFallback of ${id}`).toHaveProperty(def.synthFallback)
      }
    }
  })

  it('OQ-A: no music-channel row carries a synthFallback', () => {
    for (const [id, def] of ENTRIES) {
      if (def.channel === 'music') {
        expect(def.synthFallback, `synthFallback of ${id}`).toBeUndefined()
      }
    }
  })

  it('OQ-C: qualifier families expand to concrete catalog ids', () => {
    // Spot-check one concrete id per expanded family.
    const concrete: Array<[string, string]> = [
      ['combat.cast.tram', 'sfx'],
      ['combat.reaction.duong_viem', 'sfx'],
      ['combat.impact.slash', 'sfx'],
      ['combat.kiem.combo.nhat_tuyen', 'sfx'],
      ['music.home.morning', 'music'],
    ]
    for (const [id, channel] of concrete) {
      const def: AudioCueDef | undefined = AUDIO_CUES[id]
      expect(def, id).toBeDefined()
      expect(def?.channel).toBe(channel)
    }
  })
})

describe('resolveAudioCue', () => {
  it('returns exact matches', () => {
    expect(resolveAudioCue('combat.hit')).toBe(AUDIO_CUES['combat.hit'])
    expect(resolveAudioCue('music.home.noon')).toBe(AUDIO_CUES['music.home.noon'])
  })

  it('strips trailing qualifier segments until a row matches', () => {
    // Unknown skill id -> combat.cast family row.
    expect(resolveAudioCue('combat.cast.not_a_real_skill')).toBe(AUDIO_CUES['combat.cast'])
    expect(resolveAudioCue('combat.impact.unknown_preset')).toBe(AUDIO_CUES['combat.impact'])
    expect(resolveAudioCue('combat.kiem.combo.unknown')).toBe(AUDIO_CUES['combat.kiem.combo'])
    expect(resolveAudioCue('music.home.unknown')).toBe(AUDIO_CUES['music.home'])
    // ui.toast has no family anchor row, so unknown kinds exhaust to undefined.
    expect(resolveAudioCue('ui.toast.not_a_kind')).toBeUndefined()
  })

  it('returns undefined for unknown ids', () => {
    expect(resolveAudioCue('bogus.x.y')).toBeUndefined()
    expect(resolveAudioCue('')).toBeUndefined()
  })
})
