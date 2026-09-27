import type Phaser from 'phaser'
import type { ActorAnchorFact, SkillCastPresentation } from '@/core/battle/turn/SkillPresentationFacts'
import type { SkillCue, SkillCueContext, SkillCueHandle, SkillPresentationDriver } from '@/presentation/skills/SkillPresentationRecipe'
import { DEPTH_GROUND_VFX } from '../BattleLayers'
import { VfxPool } from './VfxPool'
import { flightProgress, makeFlightCurve, sampleCurve, type Point } from './trajectory'

export type SkillVfxGraphics = Pick<Phaser.GameObjects.Graphics,
  'clear' | 'setVisible' | 'setDepth' | 'lineStyle' | 'lineBetween' | 'fillStyle' |
  'fillTriangle' | 'strokeCircle' | 'strokeEllipse' | 'destroy'>
export interface SkillVfxSurface {
  graphics(): SkillVfxGraphics
  anchor(fact: ActorAnchorFact): Point | undefined
  ground(fact: Pick<ActorAnchorFact, 'row' | 'column'>): Point | undefined
  uprightDepth(fact: ActorAnchorFact): number
  actorImpulse?(fact: ActorAnchorFact, durationMs: number, impulsePx: number, cast?: SkillCastPresentation): void
  cameraImpulse?(durationMs: number, intensity: number): void
}
export type SkillVfxQuality = 'standard' | 'low'
export const SKILL_VFX_BUDGETS = {
  standard: { graphics: 24, blades: 8, trailSamples: 24, afterimages: 3, sparks: 32 },
  low: { graphics: 12, blades: 3, trailSamples: 8, afterimages: 0, sparks: 6 },
} as const
const quietHandle: SkillCueHandle = { sample() {}, finish() {}, cancel() {} }

/** One pooled Graphics per cue; trails and particles are bounded analytic geometry. */
export class PhaserSkillVfxDriver implements SkillPresentationDriver {
  private readonly pool: VfxPool<SkillVfxGraphics>
  private epoch = 0
  // One camera impulse per action receipt; authored cues and the generic
  // landed-hit impulse share the latch so the <=1/action cap holds. Keyed on
  // requestId - stable for the action's whole lifetime - rather than
  // ref.token, which preparePresentationResume rotates; a token key would
  // let the cue fire a second time for the same action after a resume.
  private readonly cameraImpulseFired = new Set<string>()
  private readonly budget
  constructor(
    private readonly surface: SkillVfxSurface,
    quality: SkillVfxQuality = 'standard',
    private readonly reducedMotion = false,
  ) {
    this.budget = SKILL_VFX_BUDGETS[quality]
    this.pool = new VfxPool(this.budget.graphics, () => surface.graphics(),
      graphics => { graphics.clear(); graphics.setVisible(false) }, graphics => graphics.destroy())
  }
  get stats() { return this.pool.stats }
  /**
   * Battle-boundary reset. 'battle' (default) clears everything for a new
   * battle. 'rebind' is an in-place reattach to the SAME battle/session:
   * pooled vfx retire, but the camera latch must survive - a complete-phase
   * resume re-opens recovery cues for the same requestId, and the <=1-per-
   * action latch contract belongs to the action, not the attach.
   */
  reset(scope: 'battle' | 'rebind' = 'battle'): void {
    this.epoch++
    if (scope === 'battle') this.cameraImpulseFired.clear()
    this.pool.reset()
  }
  destroy(): void { this.epoch++; this.cameraImpulseFired.clear(); this.pool.destroy() }
  private latchCamera(requestId: string): boolean {
    if (this.cameraImpulseFired.has(requestId)) return false
    this.cameraImpulseFired.add(requestId)
    return true
  }

  open(cue: SkillCue, context: SkillCueContext): SkillCueHandle {
    const cast = context.cast
    const group = context.group
    const source = cast?.source ?? group?.source
    // Ordering: a context carrying neither cast nor group has no source to
    // anchor anything against, so every primitive no-ops here before the
    // phase guards below can warn - silent by design for debris contexts.
    if (!source) return quietHandle
    if (cast && !['action', 'charge-release'].includes(cast.disposition)
      && (cue.primitive === 'trajectory' || cue.primitive === 'actor-impulse'))
      return quietHandle
    // One-shot primitives move actors/cameras directly and never lease
    // graphics. Phase placement is enforced by validateSkillRecipe; the
    // guards below cover contexts built by callers that skipped validation
    // (a misplaced cue can only no-op - the facts it reads do not exist in
    // that phase), so it warns instead of dropping silently.
    if (cue.primitive === 'actor-impulse') {
      if (context.phase !== 'cast' || !cast) {
        console.warn('[SkillVfx] actor-impulse cue outside cast playback dropped')
        return quietHandle
      }
      this.surface.actorImpulse?.(source, cue.durationMs, cue.impulsePx ?? 8, cast)
      return quietHandle
    }
    // Authored camera shake: the "khi co landed hit" gate is a landed outcome
    // in the receipt's PRIMARY group, plumbed by the runner as primaryLanded.
    // The cue's own group may be a combo/composite lane whose outcome must
    // not decide camera feedback. Shake never fires under reduced motion.
    if (cue.primitive === 'camera-cue') {
      if (context.phase !== 'resolved') {
        console.warn('[SkillVfx] camera-cue cue outside resolved playback dropped')
        return quietHandle
      }
      const landed = context.primaryLanded ?? false
      if (!this.reducedMotion && landed && this.latchCamera(context.ref.requestId))
        this.surface.cameraImpulse?.(cue.durationMs, cue.intensity ?? 0.005)
      return quietHandle
    }
    const successful = group?.outcomes.filter(outcome =>
      outcome.kind === 'hit' ? outcome.landed :
      outcome.kind === 'heal' ? outcome.healed > 0 :
      outcome.kind === 'status' ? outcome.applied === true || outcome.removed === true : false) ?? []
    const hitTargets = successful.flatMap(outcome => 'target' in outcome && outcome.target ? [outcome.target] : [])
    const targets = cast?.declaredTargets ?? hitTargets
    const returning = cue.primitive === 'trajectory' && cue.recall
    const returnTargets = group?.outcomes.flatMap(outcome => outcome.kind === 'hit' ? [outcome.target] : []) ?? []
    const unique = [...new Map((returning ? returnTargets : targets).map(target => [target.entityId, target])).values()]
    if (context.phase === 'resolved' && unique.length === 0) return quietHandle
    if (cue.primitive === 'trajectory' && unique.length === 0) return quietHandle
    const lease = this.pool.acquire()
    if (!lease) return quietHandle
    const graphics = lease.value
    graphics.setVisible(true)
    const epoch = this.epoch
    let alive = true
    const end = () => { if (alive) { alive = false; lease.release() } }
    try {
      // Generic camera impulse: landed hit on the primary group, at most once
      // per action, and it yields entirely when a recipe authors its own cue.
      if (!this.reducedMotion && !context.hasAuthoredCameraCue && cue.primitive === 'stroke'
        && group?.role === 'primary'
        && group.outcomes.some(outcome => outcome.kind === 'hit' && outcome.landed)
        && this.latchCamera(context.ref.requestId))
        this.surface.cameraImpulse?.(45, 0.001)
    } catch (error) {
      // A throwing surface hook must not strand the lease: the runner never
      // receives the handle when open() throws, so release it here.
      lease.release()
      throw error
    }
    return {
      sample: elapsed => {
        if (!alive || epoch !== this.epoch) return
        graphics.clear()
        const origin = this.surface.anchor(source)
        if (!origin) return
        const visualTargets = unique.length ? unique : [source]
        graphics.setDepth(cue.primitive === 'ground-shape' ? DEPTH_GROUND_VFX : this.surface.uprightDepth(visualTargets[0]!))
        if (cue.primitive === 'trajectory') {
          const count = Math.min(this.budget.blades, Math.max(1, cast?.candidateInstanceCount ?? returnTargets.length))
          for (let i = 0; i < count; i++) {
            const destination = this.surface.anchor(visualTargets[i % visualTargets.length]!)
            if (!destination) continue
            this.flight(graphics, cue, context.recipe.color, origin, destination, elapsed, i, count)
          }
        } else {
          const anchors = cue.anchor === 'source' ? [source] : visualTargets
          for (const fact of anchors.slice(0, 8)) {
            const point = cue.primitive === 'ground-shape' ? this.surface.ground(fact) : this.surface.anchor(fact)
            if (point) this.accent(graphics, cue, context.recipe.color, point, origin, elapsed)
          }
        }
      },
      finish: end, cancel: end,
    }
  }
  private flight(g: SkillVfxGraphics, cue: SkillCue, color: number, origin: Point, destination: Point,
    elapsed: number, index: number, count: number): void {
    const spread = (index - (count - 1) / 2) * 11
    const owner = { x: origin.x - 14, y: origin.y - 28 + spread }
    const enemy = { x: destination.x + (cue.recall ? 34 : 0), y: destination.y + spread * 0.2 }
    const curve = makeFlightCurve(cue.recall ? enemy : owner, cue.recall ? owner : enemy,
      (cue.bend ?? -42) + spread * 1.5)
    const progress = cue.recall
      ? 1 - (1 - Math.min(1, elapsed / cue.durationMs)) ** 2
      : flightProgress(elapsed, cue.releaseMs ?? 120, cue.cruiseMs ?? 180, cue.accelerationMs ?? 70)
    const head = { ...sampleCurve(curve, progress) }
    const alpha = cue.recall ? Math.min(1, (1 - progress) * 4) * 0.8 : 1
    const trail = this.reducedMotion ? 3 : this.budget.trailSamples
    const length = cue.recall ? 0.13 : progress > 0.7 ? 0.27 : 0.12
    for (let n = 1; n <= trail; n++) {
      const a = sampleCurve(curve, Math.max(0, progress - length * (n - 1) / trail))
      const b = sampleCurve(curve, Math.max(0, progress - length * n / trail))
      const fade = (1 - n / (trail + 1)) * alpha
      g.lineStyle(5 * fade, color, 0.14 * fade)
      g.lineBetween(a.x, a.y, b.x, b.y)
      g.lineStyle(1.3, color, 0.75 * fade)
      g.lineBetween(a.x, a.y, b.x, b.y)
    }
    if (!this.reducedMotion && progress > 0.7 && !cue.recall)
      for (let n = 1; n <= this.budget.afterimages; n++) {
        const ghost = sampleCurve(curve, Math.max(0, progress - n * 0.045))
        this.blade(g, ghost, color, 0.18 / n)
      }
    if (progress === 0) {
      head.y += Math.sin(elapsed / 45 + index) * 1.5
      g.lineStyle(1, color, 0.3 + 0.5 * elapsed / Math.max(1, cue.releaseMs ?? 120))
      g.strokeCircle(head.x, head.y, 9 + elapsed / 35)
    }
    this.blade(g, head, color, alpha)
  }
  private blade(g: SkillVfxGraphics, point: Point & { angle: number }, color: number, alpha: number): void {
    const transform = (x: number, y: number) => ({
      x: point.x + Math.cos(point.angle) * x - Math.sin(point.angle) * y,
      y: point.y + Math.sin(point.angle) * x + Math.cos(point.angle) * y,
    })
    const tip = transform(22, 0)
    const base = transform(-11, 0)
    g.lineStyle(8, color, alpha * 0.12)
    g.lineBetween(base.x, base.y, tip.x, tip.y)
    g.fillStyle(color, alpha)
    const edgeA = transform(-7, -3)
    const edgeB = transform(-7, 3)
    g.fillTriangle(tip.x, tip.y, edgeA.x, edgeA.y, edgeB.x, edgeB.y)
    g.lineStyle(1.2, 0xffffff, alpha)
    g.lineBetween(base.x, base.y, tip.x, tip.y)
    const guardA = transform(-10, -6)
    const guardB = transform(-10, 6)
    g.lineStyle(2, 0xe8c477, alpha)
    g.lineBetween(guardA.x, guardA.y, guardB.x, guardB.y)
    const handle = transform(-18, 0)
    g.lineBetween(base.x, base.y, handle.x, handle.y)
  }
  private accent(g: SkillVfxGraphics, cue: SkillCue, color: number, point: Point, origin: Point, elapsed: number): void {
    // A 25ms local impact hold preserves readability without pausing the scene or simulation.
    const hold = cue.primitive === 'stroke' ? Math.min(25, cue.durationMs / 2) : 0
    const t = Math.max(0, Math.min(1, (elapsed - hold) / Math.max(1, cue.durationMs - hold)))
    const fade = 1 - t
    if (cue.primitive === 'stroke') {
      const angle = Math.atan2(point.y - origin.y, point.x - origin.x) - 0.22
      const dx = Math.cos(angle) * (32 + t * 20)
      const dy = Math.sin(angle) * (32 + t * 20)
      g.lineStyle(10 * fade, color, 0.18 * fade)
      g.lineBetween(point.x - dx, point.y - dy, point.x + dx * 1.5, point.y + dy * 1.5)
      g.lineStyle(2.5 * fade, 0xffffff, fade)
      g.lineBetween(point.x - dx, point.y - dy, point.x + dx * 1.5, point.y + dy * 1.5)
    } else if (cue.primitive === 'burst') {
      const count = Math.min(cue.count ?? 12, this.budget.sparks)
      for (let i = 0; i < count; i++) {
        const angle = i * 2.399963229728653
        const distance = 5 + (12 + i % 5 * 4) * t
        const x = point.x + Math.cos(angle) * distance
        const y = point.y + Math.sin(angle) * distance * 0.75
        g.lineStyle(i % 3 === 0 ? 2 : 1, i % 2 ? color : 0xffffff, fade)
        g.lineBetween(x, y, x + Math.cos(angle) * 7 * fade, y + Math.sin(angle) * 7 * fade)
      }
    } else {
      // One-shot primitives leave open() before the graphics lease; reaching
      // this branch means the dispatch contract was bypassed - warn and draw
      // nothing rather than render the wrong ellipse.
      if (cue.primitive === 'actor-impulse' || cue.primitive === 'camera-cue') {
        console.warn(`[SkillVfx] ${cue.primitive} cue reached the draw path`)
        return
      }
      const radius = 12 + t * (this.reducedMotion ? 8 : 24)
      g.lineStyle(2 * fade + 0.5, color, fade * 0.75)
      g.strokeEllipse(point.x, point.y, radius * 2, radius * (cue.primitive === 'ground-shape' ? 0.65 : 1.6))
      g.lineStyle(1, 0xffffff, fade * 0.3)
      g.strokeEllipse(point.x, point.y, radius * 1.5, radius * (cue.primitive === 'ground-shape' ? 0.5 : 1.2))
    }
  }
}
