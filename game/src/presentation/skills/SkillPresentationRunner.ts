import type { PlaybackRef, SkillCastPresentation, SkillPresentationResolved } from '@/core/battle/turn/SkillPresentationFacts'
import type { DomainCommandPort } from '@/presentation/gate/PresentationGate'
import { FALLBACK_SKILL_RECIPE, validateSkillRecipe } from './SkillPresentationRecipe'
import type { SkillCue, SkillCueContext, SkillCueHandle, SkillPresentationDriver, SkillPresentationRecipe, SkillRecipeResolver } from './SkillPresentationRecipe'

type PlaybackPort = Pick<DomainCommandPort, 'acknowledgeActionImpact' | 'acknowledgeActionComplete' | 'getPendingPlaybackToken'>
interface ScheduledCue {
  cue: SkillCue
  context: SkillCueContext
  offset: number
  handle?: SkillCueHandle
  ended: boolean
}
interface Playback {
  ref: PlaybackRef
  port: PlaybackPort
  phase: 'cast' | 'waiting' | 'resolved' | 'resume'
  elapsed: number
  duration: number
  cues: ScheduledCue[]
  inbox?: SkillPresentationResolved
}
const sameRef = (a: PlaybackRef, b: PlaybackRef) =>
  a.sessionId === b.sessionId && a.requestId === b.requestId && a.token === b.token

/** Presentation owns elapsed visual time only. Mechanics remain behind the captured ACK port. */
export class SkillPresentationRunner {
  private active?: Playback
  private faultCount = 0
  constructor(
    private readonly driver: SkillPresentationDriver,
    private readonly recipeFor: SkillRecipeResolver,
    private readonly onError: (error: unknown) => void = () => {},
  ) {}
  get snapshot() {
    return {
      phase: this.active?.phase ?? 'idle',
      requestId: this.active?.ref.requestId ?? null,
      elapsedMs: this.active?.elapsed ?? 0,
      activeCueCount: this.active?.cues.filter(cue => cue.handle && !cue.ended).length ?? 0,
      faultCount: this.faultCount,
    }
  }
  private fault(error: unknown): void {
    this.faultCount++
    // A diagnostics callback must never acquire pacing authority.
    try { this.onError(error) } catch { /* Diagnostics are best-effort. */ }
  }
  private recipe(preset: SkillCastPresentation['presetId']): SkillPresentationRecipe {
    try {
      const recipe = this.recipeFor(preset)
      validateSkillRecipe(recipe)
      return recipe
    } catch (error) {
      this.fault(error)
      return FALLBACK_SKILL_RECIPE
    }
  }
  start(cast: SkillCastPresentation, port: PlaybackPort): void {
    if (port.getPendingPlaybackToken() !== cast.ref.token) return
    if (this.active && sameRef(this.active.ref, cast.ref) && this.active.port === port) return
    this.cancel()
    const recipe = this.recipe(cast.presetId)
    const context: SkillCueContext = { ref: cast.ref, recipe, phase: 'cast', cast }
    this.active = {
      ref: cast.ref, port, phase: 'cast', elapsed: 0, duration: recipe.castMs,
      cues: recipe.cast.map(cue => ({ cue, context, offset: cue.offsetMs, ended: false })),
    }
    this.sample(this.active)
  }
  resolve(result: SkillPresentationResolved): void {
    const active = this.active
    if (!active || active.phase !== 'waiting' || !result.sealed || active.inbox
      || !sameRef(active.ref, result.ref)) return
    // EventBus delivery is synchronous. Consume only after the impact ACK returns.
    active.inbox = result
  }
  resumeResolved(result: SkillPresentationResolved, port: PlaybackPort): void {
    this.cancel()
    if (port.getPendingPlaybackToken() !== result.ref.token) return
    this.active = { ref: result.ref, port, phase: 'resume', elapsed: 0, duration: 120, cues: [] }
  }
  update(deltaMs: number): void {
    const active = this.active
    if (!active || !Number.isFinite(deltaMs) || deltaMs < 0) return
    if (active.port.getPendingPlaybackToken() !== active.ref.token) { this.cancel(); return }
    if (active.phase === 'waiting') {
      if (active.inbox) this.beginResolved(active)
      return
    }
    active.elapsed = Math.min(active.duration, active.elapsed + deltaMs)
    this.sample(active)
    if (this.active !== active || active.elapsed < active.duration) return
    this.releaseCues(active, false)
    if (active.phase === 'cast') {
      active.phase = 'waiting'
      active.elapsed = 0
      // Set the waiting state before entering the synchronous domain call.
      active.port.acknowledgeActionImpact(active.ref.token)
      if (this.active === active && active.inbox) this.beginResolved(active)
    } else {
      this.active = undefined
      active.port.acknowledgeActionComplete(active.ref.token)
    }
  }
  private beginResolved(active: Playback): void {
    const result = active.inbox
    if (!result) return
    active.inbox = undefined
    active.phase = 'resolved'
    active.elapsed = 0
    active.duration = 0
    active.cues = []
    for (const group of result.groups) {
      const recipe = this.recipe(group.presetId)
      const context: SkillCueContext = { ref: active.ref, recipe, phase: 'resolved', group }
      active.duration = Math.max(active.duration, recipe.impactMs + recipe.recoveryMs)
      for (const cue of recipe.impact)
        active.cues.push({ cue, context, offset: cue.offsetMs, ended: false })
      for (const cue of recipe.recovery)
        active.cues.push({ cue, context, offset: recipe.impactMs + cue.offsetMs, ended: false })
    }
    // Zero-duration results also complete on the next update, never inside impact ACK.
    this.sample(active)
  }
  private sample(active: Playback): void {
    for (const item of active.cues) {
      if (item.ended || active.elapsed < item.offset) continue
      try {
        item.handle ??= this.driver.open(item.cue, item.context)
        item.handle.sample(Math.min(item.cue.durationMs, active.elapsed - item.offset))
        if (active.elapsed >= item.offset + item.cue.durationMs) {
          item.ended = true
          item.handle.finish()
        }
      } catch (error) {
        item.ended = true
        this.fault(error)
        try { item.handle?.cancel() } catch (cleanupError) { this.fault(cleanupError) }
      }
    }
  }
  private releaseCues(active: Playback, cancelled: boolean): void {
    for (const item of active.cues) {
      if (item.ended || !item.handle) continue
      item.ended = true
      try {
        if (cancelled) item.handle.cancel()
        else item.handle.finish()
      } catch (error) { this.fault(error) }
    }
    active.cues = []
  }
  cancel(): void {
    const active = this.active
    this.active = undefined
    if (active) this.releaseCues(active, true)
  }
}
