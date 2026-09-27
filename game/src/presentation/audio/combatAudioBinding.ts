// combatAudioBinding — presentation-side adapter that maps domain events
// (emitted on GameManager.eventBus) to manifest cue ids.
//
// Boundary: the eventBus events are already emitted by the domain for
// presentation consumers (VFX, HUD). This binding only observes them —
// audio never influences gameplay state (A7), and never joins the
// turn_cast_start / action_impact ack protocol (observation feeds only).
//
// The table generalizes `eventType -> cueId | (event) => cueId | undefined`:
// payload rows return undefined to stay silent for events that shouldn't
// cue (e.g. 'damage' on enemies — it fires alongside hit/critical and
// would double-trigger; only the player's own hits hurt audibly).

import type { EventBus, EventHandler } from '@/core/events/EventBus'
import { AudioManager } from '@/core/audio/AudioManager'
import { AUDIO_CUES } from '@/core/audio/AudioCueManifest'
import type { SessionRef } from '@/core/presentation/PresentationSession'
import type { Route } from '@/presentation/PresentationContracts'
import { PLAYER_ID } from '@/core/skill/PassiveSystem'

// ---- Static rows -------------------------------------------------------

const STATIC_CUES: ReadonlyArray<readonly [string, string]> = [
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
  ['combat_exit_request', 'ui.modal.open'],
  ['combat_scene_exit', 'combat.exit'],
  ['tribulation_started', 'tribulation.begin'],
  ['tribulation_lightning', 'tribulation.thunder'],
  ['tribulation_chapter_changed', 'tribulation.chapter'],
  // W6 emits
  ['proc_reflect', 'combat.thetu.reflect'],
  ['proc_on_hit', 'combat.phaptu.proc'],
  ['perfect_clear', 'progress.perfect'],
  ['hidden_window_opened', 'progress.hidden_open'],
  ['hothe_absorb', 'combat.hothe.absorb'],
]

// ---- Payload-discriminated rows ----------------------------------------

interface VitalsLike {
  wardBefore?: number
  wardAfter?: number
}

interface TargetLike {
  targetId?: string
}

interface SkillCastLike {
  skillId?: string
}

interface ActionImpactLike {
  presetId?: string
}

interface StatusAttachLike {
  polarity?: string
  dotType?: string
}

interface RewardParticleLike {
  kind?: string
}

interface BattleEndLike {
  state?: string
}

interface TribulationOutcomeLike {
  state?: string
}

interface MindQuestionLike {
  correct?: boolean
}

interface CultivationLike {
  isCultivating?: boolean
}

interface ReactiveProcLike {
  trigger?: string
  success?: boolean
}

// Preset -> ngu hanh element fallback (combat.element.*). Lives here — the
// manifest stays data-only and presets already resolve exactly; this table
// is the middle hop for presets without their own row.
const ELEMENT_BY_PRESET: Readonly<Record<string, string>> = {
  fire_burst: 'hoa',
  hoa_cau_comet: 'hoa',
  lightning_strike: 'hoa',
  water_surge: 'thuy',
  thuy_tien_dart: 'thuy',
  earth_shockwave: 'tho',
  tho_cau_boulder: 'tho',
  metal_slash: 'kim',
  diem_kim_point: 'kim',
  tram_slash: 'kim',
  wood_spikes: 'moc',
  doc_chuong_palm: 'moc',
  wind_blade: 'moc',
}

function cueForActionImpact(event: ActionImpactLike): string | undefined {
  const presetId = event.presetId
  if (!presetId) return 'combat.impact'

  // Kiem Pho content routes to the kiem family rows (stripped qualifier).
  if (presetId.startsWith('kiem_combo_')) {
    const comboId = presetId.slice('kiem_combo_'.length)
    return `combat.kiem.combo.${comboId}` in AUDIO_CUES
      ? `combat.kiem.combo.${comboId}`
      : 'combat.kiem.combo'
  }
  if (presetId === 'tu_luc') return 'combat.kiem.tu_luc'
  if (presetId.startsWith('kiem_orb_')) {
    return `combat.impact.${presetId}` in AUDIO_CUES ? `combat.impact.${presetId}` : 'combat.impact'
  }

  const specific = `combat.impact.${presetId}`
  if (specific in AUDIO_CUES) return specific
  const element = ELEMENT_BY_PRESET[presetId]
  return element ? `combat.element.${element}` : 'combat.impact'
}

const PAYLOAD_CUES: ReadonlyArray<readonly [string, (event: never) => string | undefined]> = [
  // 'damage' fires alongside hit/critical — audible only when the PLAYER
  // takes the hit (combat.hurt), else silent to avoid double-triggering.
  [
    'damage',
    (event: TargetLike) => (event.targetId === PLAYER_ID ? 'combat.hurt' : undefined),
  ],
  [
    'entity_vitals_changed',
    (event: VitalsLike) => {
      const before = event.wardBefore ?? 0
      const after = event.wardAfter ?? 0
      if (after > before) return 'combat.ward.grant'
      if (before > 0 && after === 0) return 'combat.ward.break'
      if (after !== before) return 'combat.ward'
      return undefined
    },
  ],
  [
    'turn_cast_start',
    (event: SkillCastLike) => (event.skillId ? `combat.cast.${event.skillId}` : 'combat.cast'),
  ],
  ['action_impact', cueForActionImpact],
  [
    'status_vfx_attached',
    (event: StatusAttachLike) => {
      if (event.dotType) return 'combat.dot.apply'
      if (event.polarity === 'debuff') return 'combat.debuff.apply'
      return 'combat.buff.apply'
    },
  ],
  [
    'reward_particle',
    (event: RewardParticleLike) =>
      event.kind === 'essence' ? 'combat.essence' : 'combat.loot',
  ],
  [
    'battle_end',
    (event: BattleEndLike) =>
      event.state === 'victory' ? 'combat.victory' : 'combat.defeat',
  ],
  [
    'presentation_session_started',
    (event: SessionRef) =>
      event.kind === 'combat' ? 'combat.start' : event.kind === 'tribulation' ? 'tribulation.start' : undefined,
  ],
  [
    'tribulation_outcome',
    (event: TribulationOutcomeLike) =>
      event.state === 'victory' ? 'tribulation.victory' : 'tribulation.fail',
  ],
  [
    'mind_question_result',
    (event: MindQuestionLike) =>
      event.correct === true ? 'tribulation.answer.ok' : 'tribulation.answer.fail',
  ],
  [
    'cultivation_changed',
    (event: CultivationLike) =>
      event.isCultivating ? 'ambient.cultivate.on' : 'ambient.cultivate.off',
  ],
  // W6: reactive proc — success-only cue per spec (failed rolls stay silent).
  [
    'reactive_proc',
    (event: ReactiveProcLike) => {
      if (event.success !== true) return undefined
      if (event.trigger === 'intercept') return 'combat.ungthe.intercept'
      if (event.trigger === 'counter') return 'combat.ungthe.counter'
      return 'combat.ungthe'
    },
  ],
]

export interface CombatAudioBindingOptions {
  /**
   * Route lookup used to suppress off-route cues (farm_cycle ticks fire
   * while the player is not on 'home'). Default: play regardless.
   */
  routeProvider?: () => Route | null
}

/**
 * Subscribes combat audio to the domain event bus.
 * Returns an unbind function for teardown (HMR/tests).
 */
export function bindCombatAudio(
  eventBus: EventBus,
  options: CombatAudioBindingOptions = {},
): () => void {
  const audio = AudioManager.getInstance()
  const bound: Array<readonly [string, EventHandler<unknown>]> = []

  const subscribe = (eventType: string, select: (event: never) => string | undefined) => {
    const handler: EventHandler<unknown> = (event) => {
      const cueId = select(event as never)
      if (cueId) audio.playCue(cueId)
    }
    eventBus.on(eventType, handler)
    bound.push([eventType, handler])
  }

  for (const [eventType, cueId] of STATIC_CUES) {
    subscribe(eventType, () => cueId)
  }
  for (const [eventType, select] of PAYLOAD_CUES) {
    subscribe(eventType, select)
  }

  // farm.cycle only matters on the home screen — ticks continue off-route
  // and must not sound from combat/tribulation.
  const farmHandler: EventHandler<unknown> = () => {
    const route = options.routeProvider?.()
    if (route === undefined || route === 'home') audio.playCue('farm.cycle')
  }
  eventBus.on('farm_cycle', farmHandler)
  bound.push(['farm_cycle', farmHandler])

  return () => {
    for (const [eventType, handler] of bound) {
      eventBus.off(eventType, handler)
    }
  }
}
