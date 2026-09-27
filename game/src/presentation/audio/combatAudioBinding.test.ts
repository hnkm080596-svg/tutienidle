// combatAudioBinding.test.ts — verifies domain events map to manifest cue
// ids, discriminators gate correctly, route-suppressed rows stay silent
// off-route, and unbind() detaches every handler.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventBus } from '@/core/events/EventBus'
import { bindCombatAudio } from './combatAudioBinding'
import { AudioManager, resetAudioManagerForTest } from '@/core/audio/AudioManager'

// Playback is stubbed at the manager level — Tone internals are covered by
// AudioManager.test.ts; manifest resolution by AudioCueManifest.test.ts.
let cueSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  resetAudioManagerForTest()
  cueSpy = vi.spyOn(AudioManager.getInstance(), 'playCue').mockImplementation(() => {})
})

afterEach(() => {
  cueSpy.mockRestore()
  resetAudioManagerForTest()
})

describe('bindCombatAudio', () => {
  it('maps static domain events to their cue ids', () => {
    const bus = new EventBus()
    bindCombatAudio(bus)

    const cases: Array<[string, string]> = [
      ['attack', 'combat.cast'],
      ['hit', 'combat.hit'],
      ['critical', 'combat.crit'],
      ['dodge', 'combat.dodge'],
      ['block', 'combat.block'],
      ['death', 'combat.death'],
      ['kill', 'combat.kill'],
      ['heal', 'combat.heal'],
      ['talent_survive_lethal', 'combat.survive_lethal'],
      ['turn_ready', 'combat.turn_ready'],
      ['status_vfx_removed', 'combat.buff.expire'],
      ['essence_stream_arrival', 'combat.essence'],
          ['combat_scene_exit', 'combat.exit'],
      ['tribulation_started', 'tribulation.begin'],
      ['tribulation_lightning', 'tribulation.thunder'],
      ['tribulation_chapter_changed', 'tribulation.chapter'],
      ['proc_reflect', 'combat.thetu.reflect'],
      ['proc_on_hit', 'combat.phaptu.proc'],
      ['perfect_clear', 'progress.perfect'],
      ['hidden_window_opened', 'progress.hidden_open'],
      ['hothe_absorb', 'combat.hothe.absorb'],
    ]

    for (const [event, expectedCue] of cases) {
      cueSpy.mockClear()
      bus.emit(event, { type: event })
      expect(cueSpy, event).toHaveBeenCalledWith(expectedCue)
    }
  })

  it('plays combat.hurt only when the PLAYER takes damage', () => {
    const bus = new EventBus()
    bindCombatAudio(bus)

    bus.emit('damage', { type: 'damage', targetId: 'enemy-1' })
    expect(cueSpy).not.toHaveBeenCalled()

    bus.emit('damage', { type: 'damage', targetId: 'player' })
    expect(cueSpy).toHaveBeenCalledWith('combat.hurt')
  })

  it('routes ward deltas to grant/break/ward', () => {
    const bus = new EventBus()
    bindCombatAudio(bus)

    bus.emit('entity_vitals_changed', { wardBefore: 0, wardAfter: 50 })
    expect(cueSpy).toHaveBeenLastCalledWith('combat.ward.grant')

    bus.emit('entity_vitals_changed', { wardBefore: 50, wardAfter: 0 })
    expect(cueSpy).toHaveBeenLastCalledWith('combat.ward.break')

    bus.emit('entity_vitals_changed', { wardBefore: 50, wardAfter: 20 })
    expect(cueSpy).toHaveBeenLastCalledWith('combat.ward')

    cueSpy.mockClear()
    bus.emit('entity_vitals_changed', { wardBefore: 0, wardAfter: 0 })
    expect(cueSpy).not.toHaveBeenCalled()
  })

  it('turn_cast_start carries the skill qualifier', () => {
    const bus = new EventBus()
    bindCombatAudio(bus)

    bus.emit('turn_cast_start', { skillId: 'tram' })
    expect(cueSpy).toHaveBeenCalledWith('combat.cast.tram')

    bus.emit('turn_cast_start', {})
    expect(cueSpy).toHaveBeenCalledWith('combat.cast')
  })

  it('action_impact routes kiem combos to the kiem family', () => {
    const bus = new EventBus()
    bindCombatAudio(bus)

    bus.emit('action_impact', { presetId: 'kiem_combo_nhat_tuyen' })
    expect(cueSpy).toHaveBeenCalledWith('combat.kiem.combo.nhat_tuyen')

    bus.emit('action_impact', { presetId: 'slash' })
    expect(cueSpy).toHaveBeenCalledWith('combat.impact.slash')

    bus.emit('action_impact', { presetId: 'totally_unknown_preset' })
    expect(cueSpy).toHaveBeenCalledWith('combat.impact')
  })

  it('status_vfx_attached picks buff/debuff/dot by polarity+dotType', () => {
    const bus = new EventBus()
    bindCombatAudio(bus)

    bus.emit('status_vfx_attached', { polarity: 'buff' })
    expect(cueSpy).toHaveBeenLastCalledWith('combat.buff.apply')
    bus.emit('status_vfx_attached', { polarity: 'debuff' })
    expect(cueSpy).toHaveBeenLastCalledWith('combat.debuff.apply')
    bus.emit('status_vfx_attached', { polarity: 'debuff', dotType: 'poison' })
    expect(cueSpy).toHaveBeenLastCalledWith('combat.dot.apply')
  })

  it('session kind picks combat.start / tribulation.start', () => {
    const bus = new EventBus()
    bindCombatAudio(bus)

    bus.emit('presentation_session_started', { sessionId: 's1', kind: 'combat' })
    expect(cueSpy).toHaveBeenCalledWith('combat.start')

    cueSpy.mockClear()
    bus.emit('presentation_session_started', { sessionId: 's2', kind: 'tribulation' })
    expect(cueSpy).toHaveBeenCalledWith('tribulation.start')
  })

  it('battle_end + tribulation_outcome discriminate on state', () => {
    const bus = new EventBus()
    bindCombatAudio(bus)

    bus.emit('battle_end', { state: 'victory' })
    expect(cueSpy).toHaveBeenLastCalledWith('combat.victory')
    bus.emit('battle_end', { state: 'defeat' })
    expect(cueSpy).toHaveBeenLastCalledWith('combat.defeat')

    bus.emit('tribulation_outcome', { state: 'victory' })
    expect(cueSpy).toHaveBeenLastCalledWith('tribulation.victory')
    bus.emit('tribulation_outcome', { state: 'defeat' })
    expect(cueSpy).toHaveBeenLastCalledWith('tribulation.fail')
  })

  it('mind_question_result and cultivation_changed discriminate', () => {
    const bus = new EventBus()
    bindCombatAudio(bus)

    bus.emit('mind_question_result', { correct: true })
    expect(cueSpy).toHaveBeenLastCalledWith('tribulation.answer.ok')
    bus.emit('mind_question_result', { correct: false })
    expect(cueSpy).toHaveBeenLastCalledWith('tribulation.answer.fail')

    bus.emit('cultivation_changed', { isCultivating: true })
    expect(cueSpy).toHaveBeenLastCalledWith('ambient.cultivate.on')
    bus.emit('cultivation_changed', { isCultivating: false })
    expect(cueSpy).toHaveBeenLastCalledWith('ambient.cultivate.off')
  })

  it('reactive_proc cues on success only, per trigger', () => {
    const bus = new EventBus()
    bindCombatAudio(bus)

    bus.emit('reactive_proc', { success: false, trigger: 'counter' })
    expect(cueSpy).not.toHaveBeenCalled()

    bus.emit('reactive_proc', { success: true, trigger: 'intercept' })
    expect(cueSpy).toHaveBeenLastCalledWith('combat.ungthe.intercept')
    bus.emit('reactive_proc', { success: true, trigger: 'counter' })
    expect(cueSpy).toHaveBeenLastCalledWith('combat.ungthe.counter')
    bus.emit('reactive_proc', { success: true })
    expect(cueSpy).toHaveBeenLastCalledWith('combat.ungthe')
  })

  it('farm_cycle is suppressed off home route', () => {
    const bus = new EventBus()
    let route: 'home' | 'combat' = 'combat'
    bindCombatAudio(bus, { routeProvider: () => route })

    bus.emit('farm_cycle', { stageId: 's1' })
    expect(cueSpy).not.toHaveBeenCalled()

    route = 'home'
    bus.emit('farm_cycle', { stageId: 's1' })
    expect(cueSpy).toHaveBeenCalledWith('farm.cycle')
  })

  it('unbind() detaches every handler', () => {
    const bus = new EventBus()
    const unbind = bindCombatAudio(bus)

    unbind()

    bus.emit('attack', { type: 'attack' })
    bus.emit('battle_end', { type: 'battle_end', state: 'victory' })
    bus.emit('presentation_session_started', { sessionId: 's3', kind: 'combat' })
    expect(cueSpy).not.toHaveBeenCalled()
  })
})
