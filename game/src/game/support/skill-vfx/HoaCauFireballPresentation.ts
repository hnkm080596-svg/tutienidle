import type { ActorAnchorFact, PlaybackRef, SkillCastPresentation, SkillPresentationResolved } from '@/core/battle/turn/SkillPresentationFacts'
import { HOA_CAU_VFX_ASSETS, type HoaCauAsset } from '@/game/support/HoaCauVfxAssets'
import { hoaCauTiming, landedHoaCauTargets, sampleHoaCauTimeline } from './HoaCauFireballTimeline'

type Point = Readonly<{ x: number; y: number }>
const PORTAL_BLEND_MS = 180
/** Raised right palm in the shared Phap Tu 244x252 cast frame (frames 6-12). */
export function hoaCauHandAnchor(sprite: Readonly<{
  x: number; y: number; displayWidth: number; displayHeight: number; originX: number; originY: number
}>): Point {
  return {
    x: sprite.x + (235 / 244 - sprite.originX) * sprite.displayWidth,
    y: sprite.y + (46 / 252 - sprite.originY) * sprite.displayHeight,
  }
}
export interface HoaCauSprite {
  setFrame(frame: string): unknown
  setPosition(x: number, y: number): unknown
  setVisible(visible: boolean): unknown
  setScale(scaleX: number, scaleY?: number): unknown
  setAngle(degrees: number): unknown
  setAlpha(alpha: number): unknown
  setDepth(depth: number): unknown
  destroy(): unknown
}
export interface HoaCauSurface {
  anchor(fact: ActorAnchorFact): Point | undefined
  depth(fact: ActorAnchorFact): number
  createSprite(key: string, frame: string): HoaCauSprite
  isCurrent?(ref: PlaybackRef): boolean
  reducedMotion?: boolean
}

export function isHoaCauFireballCast(cast: SkillCastPresentation): boolean {
  return cast.presetId === 'hoa_cau_comet' && cast.disposition === 'action'
}

type Active = {
  cast: SkillCastPresentation
  impactMs: number
  elapsedMs: number
  origin: Point
  portalOrigin: Point
  destination: Point
  impactElapsedMs: number | null
  impactPositions: readonly { fact: ActorAnchorFact; point: Point }[]
  resolved: boolean
}

/** Purely visual: this class never acknowledges impact or changes battle facts. */
export class HoaCauFireballPresentation {
  private active?: Active
  private sprites = new Map<string, HoaCauSprite>()

  constructor(private readonly surface: HoaCauSurface) {}

  start(cast: SkillCastPresentation, impactMs: number): void {
    this.cancel()
    if (!isHoaCauFireballCast(cast)) return
    const source = this.surface.anchor(cast.source)
    const target = cast.declaredTargets[0] && this.surface.anchor(cast.declaredTargets[0])
    if (!source || !target) return
    const direction = Math.sign(target.x - source.x) || 1
    this.active = {
      cast, impactMs: hoaCauTiming(impactMs).impactMs, elapsedMs: 0,
      portalOrigin: { x: source.x + direction * 24, y: source.y },
      origin: { x: source.x + direction * 72, y: source.y },
      destination: { x: target.x, y: source.y },
      impactElapsedMs: null, impactPositions: [],
      resolved: false,
    }
    this.render()
  }

  update(deltaMs: number): void {
    const active = this.active
    if (!active || !Number.isFinite(deltaMs) || deltaMs < 0) return
    if (this.surface.isCurrent && !this.surface.isCurrent(active.cast.ref)) { this.cancel(); return }
    active.elapsedMs += deltaMs
    if (active.impactElapsedMs !== null) active.impactElapsedMs += deltaMs
    this.render()
    if (active.resolved && (active.impactElapsedMs === null || active.impactElapsedMs >= 900)
      && active.elapsedMs >= hoaCauTiming(active.impactMs).releaseMs
        + hoaCauTiming(active.impactMs).closeDurationMs) this.cancel()
  }

  resolve(resolved: SkillPresentationResolved): void {
    const active = this.active
    if (!active || !resolved.sealed || resolved.ref.token !== active.cast.ref.token
      || resolved.ref.requestId !== active.cast.ref.requestId) return
    active.elapsedMs = Math.max(active.elapsedMs, active.impactMs)
    active.resolved = true
    const landed = landedHoaCauTargets(resolved)
    active.impactPositions = landed.map(fact => ({
      fact,
      point: { x: this.surface.anchor(fact)?.x ?? active.destination.x, y: active.destination.y },
    }))
    active.impactElapsedMs = landed.length ? 0 : null
    this.render()
  }

  cancel(): void {
    for (const sprite of this.sprites.values()) sprite.destroy()
    this.sprites.clear()
    this.active = undefined
  }

  destroy(): void { this.cancel() }

  private sprite(asset: HoaCauAsset, slot: string = asset.key): HoaCauSprite {
    let sprite = this.sprites.get(slot)
    if (!sprite) {
      sprite = this.surface.createSprite(asset.key, `frame_${asset.firstFrame}`)
      this.sprites.set(slot, sprite)
    }
    return sprite
  }

  private show(asset: HoaCauAsset, frame: number, position: Point, scale: number, depth: number,
    angle = 0, slot: string = asset.key, alpha = 1, scaleY = scale): void {
    const sprite = this.sprite(asset, slot)
    sprite.setFrame(`frame_${Math.max(asset.firstFrame, Math.min(asset.lastFrame, frame))}`)
    sprite.setPosition(position.x, position.y)
    sprite.setScale(scale, scaleY)
    sprite.setDepth(depth)
    sprite.setAngle(angle)
    sprite.setAlpha(alpha)
    sprite.setVisible(true)
  }

  private render(): void {
    const active = this.active
    if (!active) return
    for (const sprite of this.sprites.values()) sprite.setVisible(false)
    const timing = hoaCauTiming(active.impactMs)
    const sample = sampleHoaCauTimeline(active.elapsedMs, active.impactMs)
    const sourceDepth = this.surface.depth(active.cast.source)
    // Single authored presentation: the Arcadia triple-fire-circle is the
    // portal phase for EVERY cast (no variants).
    if (active.elapsedMs >= timing.portalStartMs && active.elapsedMs < timing.releaseMs) {
      const progress = (active.elapsedMs - timing.portalStartMs)
        / (timing.releaseMs - timing.portalStartMs)
      const frame = this.surface.reducedMotion ? 56 : Math.min(63, Math.floor(progress * 64))
      this.show(HOA_CAU_VFX_ASSETS.tripleCircle, frame, active.portalOrigin,
        0.34, sourceDepth, 0, HOA_CAU_VFX_ASSETS.tripleCircle.key, 1, 0.55)
    }
    if (sample.chargeFrame !== null) {
      const frame = this.surface.reducedMotion ? Math.max(9, Math.min(15, sample.chargeFrame)) : sample.chargeFrame
      this.show(HOA_CAU_VFX_ASSETS.charge, frame, active.origin, 1.75, sourceDepth + 0.03)
    }
    if (sample.projectileProgress !== null && !active.resolved) {
      const p = sample.projectileProgress
      const position = {
        x: active.origin.x + (active.destination.x - active.origin.x) * p,
        y: active.origin.y + (active.destination.y - active.origin.y) * p,
      }
      const elapsedFlightMs = active.elapsedMs - timing.releaseMs
      const flightAngle = Math.atan2(active.destination.y - active.origin.y,
        active.destination.x - active.origin.x) * 180 / Math.PI
      const frame = Math.floor(elapsedFlightMs / (1200 / 36)) % 36
      this.show(HOA_CAU_VFX_ASSETS.phoenixProjectile, frame, position, 1,
        sourceDepth + 0.02, flightAngle)
    }
    if (active.impactElapsedMs !== null && active.impactElapsedMs < 900) {
      const frame = Math.floor(active.impactElapsedMs / 900 * 27)
      for (const { fact, point } of active.impactPositions) {
        this.show(HOA_CAU_VFX_ASSETS.impact, frame, point, 1.2,
          this.surface.depth(fact) + 0.01, 0, `${HOA_CAU_VFX_ASSETS.impact.key}:${fact.entityId}`)
      }
    }
  }
}
