// combatAudioBinding.test.ts - verifies domain events map to manifest cue
// ids, discriminators gate correctly, route-suppressed rows stay silent
// off-route, and unbind() detaches every handler.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventBus } from '@/core/events/EventBus'
import { bindCombatAudio } from './combatAudioBinding'
import { AudioManager, resetAudioManagerForTest } from '@/core/audio/AudioManager'

// Playback is stubbed at the manager level - Tone internals are covered by
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

    const cases: Array<[string, string, object?]> = [
      ['attack', 'combat.cast'],
      ['hit', 'combat.hit', { sourceId: 'player', targetId: 'enemy_1' }],
      ['critical', 'combat.crit'],
      ['dodge', 'combat.dodge'],
      ['block', 'combat.block'],
      ['death', 'combat.death'],
      ['heal', 'combat.heal'],
      ['talent_survive_lethal', 'combat.survive_lethal'],
      ['turn_ready', 'combat.turn_ready'],
      ['status_vfx_removed', 'combat.buff.expire'],
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

    for (const [event, expectedCue, extra] of cases) {
      cueSpy.mockClear()
      bus.emit(event, { type: event, ...extra })
      expect(cueSpy, event).toHaveBeenCalledWith(expectedCue)
    }
  })

  it('kill stays silent - it co-fires with death on every entity death', () => {
    const bus = new EventBus()
    bindCombatAudio(bus)

    bus.emit('kill', { type: 'kill', sourceId: 'player', targetId: 'enemy-1' })
    expect(cueSpy).not.toHaveBeenCalled()

    // essence_stream_arrival is likewise silent - reward_particle(essence)
    // already voices combat.essence at drop time.
    bus.emit('essence_stream_arrival', { type: 'essence_stream_arrival' })
    expect(cueSpy).not.toHaveBeenCalled()
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

    // Grant sounds on ward_grant reason only - regen/stat_refresh
    // restoring ward must stay silent.
    bus.emit('entity_vitals_changed', { wardBefore: 0, wardAfter: 50, reason: 'ward_grant' })
    expect(cueSpy).toHaveBeenLastCalledWith('combat.ward.grant')

    cueSpy.mockClear()
    bus.emit('entity_vitals_changed', { wardBefore: 0, wardAfter: 50, reason: 'regen' })
    expect(cueSpy).not.toHaveBeenCalled()

    // Break/decline only under the damage reason family - ward_spend or
    // sacrifice eating ward is not a break.
    bus.emit('entity_vitals_changed', { wardBefore: 50, wardAfter: 0, reason: 'damage' })
    expect(cueSpy).toHaveBeenLastCalledWith('combat.ward.break')

    bus.emit('entity_vitals_changed', { wardBefore: 50, wardAfter: 20, reason: 'dot' })
    expect(cueSpy).toHaveBeenLastCalledWith('combat.ward')

    cueSpy.mockClear()
    bus.emit('entity_vitals_changed', { wardBefore: 50, wardAfter: 0, reason: 'ward_spend' })
    expect(cueSpy).not.toHaveBeenCalled()
    bus.emit('entity_vitals_changed', { wardBefore: 50, wardAfter: 50, reason: 'damage' })
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

  it('boss_ground_slam routes to the armed boss.slam row, not the silent expanded impact row', () => {
    const bus = new EventBus()
    bindCombatAudio(bus)

    bus.emit('action_impact', { presetId: 'boss_ground_slam' })
    expect(cueSpy).toHaveBeenCalledWith('combat.boss.slam')
  })

  it('reaction_resolved carries the reaction qualifier', () => {
    const bus = new EventBus()
    bindCombatAudio(bus)

    bus.emit('reaction_resolved', { reactionId: 'duong_viem' })
    expect(cueSpy).toHaveBeenCalledWith('combat.reaction.duong_viem')

    bus.emit('reaction_resolved', {})
    expect(cueSpy).toHaveBeenLastCalledWith('combat.reaction')
  })

  it('status_vfx_attached picks buff/debuff/dot by polarity+periodicDamage', () => {
    const bus = new EventBus()
    bindCombatAudio(bus)

    bus.emit('status_vfx_attached', { polarity: 'buff' })
    expect(cueSpy).toHaveBeenLastCalledWith('combat.buff.apply')
    bus.emit('status_vfx_attached', { polarity: 'debuff' })
    expect(cueSpy).toHaveBeenLastCalledWith('combat.debuff.apply')
    // dotType is just the definitionId (always set) - the DoT cue keys
    // off periodicDamage, the producer's periodic-damage flag.
    bus.emit('status_vfx_attached', { polarity: 'debuff', dotType: 'poison', periodicDamage: true })
    expect(cueSpy).toHaveBeenLastCalledWith('combat.dot.apply')
  })

  it('hit sounds whenever the target is not the player (spec contract)', () => {
    const bus = new EventBus()
    bindCombatAudio(bus)

    // Spec: suppressed only when the PLAYER takes the hit - that lane
    // already sounds via damage -> combat.hurt. Allied/companion
    // outgoing hits cue identically to the player's own.
    bus.emit('hit', { sourceId: 'enemy_1', targetId: 'player' })
    expect(cueSpy).not.toHaveBeenCalled()
    bus.emit('hit', { sourceId: 'companion_1', targetId: 'enemy_1' })
    expect(cueSpy).toHaveBeenLastCalledWith('combat.hit')
    bus.emit('hit', { sourceId: 'player', targetId: 'enemy_1' })
    expect(cueSpy).toHaveBeenLastCalledWith('combat.hit')
  })

  it('session kind voices combat.start; tribulation sessions stay silent', () => {
    const bus = new EventBus()
    bindCombatAudio(bus)

    bus.emit('presentation_session_started', { sessionId: 's1', kind: 'combat' })
    expect(cueSpy).toHaveBeenCalledWith('combat.start')

    // Tribulation sessions stay silent here - tribulation_started fires
    // the same tick and owns the start cue (tribulation.begin).
    cueSpy.mockClear()
    bus.emit('presentation_session_started', { sessionId: 's2', kind: 'tribulation' })
    expect(cueSpy).not.toHaveBeenCalled()
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

    bus.emit('reactive_proc', { success: false, mechanic: 'counter' })
    expect(cueSpy).not.toHaveBeenCalled()

    // The discriminator is `mechanic` (intercept/counter/follow_up) - the
    // producer's `trigger` field carries the reactive window name.
    bus.emit('reactive_proc', { success: true, mechanic: 'intercept' })
    expect(cueSpy).toHaveBeenLastCalledWith('combat.ungthe.intercept')
    bus.emit('reactive_proc', { success: true, mechanic: 'counter' })
    expect(cueSpy).toHaveBeenLastCalledWith('combat.ungthe.counter')
    bus.emit('reactive_proc', { success: true, trigger: 'intercept' })
    expect(cueSpy).toHaveBeenLastCalledWith('combat.ungthe')
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
