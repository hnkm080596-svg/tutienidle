// combatAudioBinding.test.ts — verifies domain combat events map to SFX,
// non-combat sessions are ignored, and unbind() detaches every handler.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventBus } from '@/core/events/EventBus'
import { bindCombatAudio } from './combatAudioBinding'
import { AudioManager, resetAudioManagerForTest } from '@/core/audio/AudioManager'

// Sound playback is stubbed at the manager level — the Tone-dependent
// internals are covered by AudioManager.test.ts.
let playSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  resetAudioManagerForTest()
  playSpy = vi.spyOn(AudioManager.getInstance(), 'play').mockImplementation(() => {})
})

afterEach(() => {
  playSpy.mockRestore()
  resetAudioManagerForTest()
})

describe('bindCombatAudio', () => {
  it('maps combat domain events to their SFX ids', () => {
    const bus = new EventBus()
    bindCombatAudio(bus)

    const cases: Array<[string, string]> = [
      ['attack', 'combatAttack'],
      ['hit', 'combatHit'],
      ['critical', 'combatCritical'],
      ['dodge', 'combatDodge'],
      ['block', 'combatBlock'],
      ['death', 'combatKill'],
    ]

    for (const [event, expectedSound] of cases) {
      playSpy.mockClear()
      bus.emit(event, { type: event })
      expect(playSpy).toHaveBeenCalledWith(expectedSound)
    }
  })

  it('plays battleStart only for combat sessions', () => {
    const bus = new EventBus()
    bindCombatAudio(bus)

    bus.emit('presentation_session_started', { sessionId: 's1', kind: 'tribulation' })
    expect(playSpy).not.toHaveBeenCalled()

    bus.emit('presentation_session_started', { sessionId: 's2', kind: 'combat' })
    expect(playSpy).toHaveBeenCalledWith('battleStart')
  })

  it('plays victory/defeat from the battle_end state', () => {
    const bus = new EventBus()
    bindCombatAudio(bus)

    bus.emit('battle_end', { type: 'battle_end', state: 'victory' })
    expect(playSpy).toHaveBeenCalledWith('battleVictory')

    bus.emit('battle_end', { type: 'battle_end', state: 'defeat' })
    expect(playSpy).toHaveBeenCalledWith('battleDefeat')
  })

  it('unbind() detaches every handler', () => {
    const bus = new EventBus()
    const unbind = bindCombatAudio(bus)

    unbind()

    bus.emit('attack', { type: 'attack' })
    bus.emit('battle_end', { type: 'battle_end', state: 'victory' })
    bus.emit('presentation_session_started', { sessionId: 's3', kind: 'combat' })
    expect(playSpy).not.toHaveBeenCalled()
  })
})
