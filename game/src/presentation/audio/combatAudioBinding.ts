// combatAudioBinding — presentation-side adapter that maps domain combat
// events (emitted on GameManager.eventBus) to AudioManager SFX.
//
// Boundary: the eventBus events are already emitted by the battle domain
// for presentation consumers (VFX, HUD). This binding only observes them —
// audio never influences gameplay state (A7).

import type { EventBus, EventHandler } from '@/core/events/EventBus'
import { AudioManager, type SoundId } from '@/core/audio/AudioManager'
import type { SessionRef } from '@/core/presentation/PresentationSession'

// One domain event -> one sound. 'damage' intentionally omitted: it fires
// together with 'hit'/'critical' and would double-trigger the same tick.
const COMBAT_EVENT_SOUNDS: ReadonlyArray<readonly [string, SoundId]> = [
  ['attack', 'combatAttack'],
  ['hit', 'combatHit'],
  ['critical', 'combatCritical'],
  ['dodge', 'combatDodge'],
  ['block', 'combatBlock'],
  ['death', 'combatKill'],
]

interface BattleEndEvent {
  type: 'battle_end'
  state: 'victory' | 'defeat'
}

/**
 * Subscribes combat audio to the domain event bus.
 * Returns an unbind function for teardown (HMR/tests).
 */
export function bindCombatAudio(eventBus: EventBus): () => void {
  const audio = AudioManager.getInstance()
  const bound: Array<readonly [string, EventHandler<unknown>]> = []

  for (const [eventType, sound] of COMBAT_EVENT_SOUNDS) {
    const handler: EventHandler<unknown> = () => audio.play(sound)
    eventBus.on(eventType, handler)
    bound.push([eventType, handler])
  }

  const onSessionStarted: EventHandler<SessionRef> = (session) => {
    if (session.kind === 'combat') audio.play('battleStart')
  }
  eventBus.on('presentation_session_started', onSessionStarted)
  bound.push(['presentation_session_started', onSessionStarted as EventHandler<unknown>])

  const onBattleEnd: EventHandler<BattleEndEvent> = (event) => {
    audio.play(event.state === 'victory' ? 'battleVictory' : 'battleDefeat')
  }
  eventBus.on('battle_end', onBattleEnd)
  bound.push(['battle_end', onBattleEnd as EventHandler<unknown>])

  return () => {
    for (const [eventType, handler] of bound) {
      eventBus.off(eventType, handler)
    }
  }
}
