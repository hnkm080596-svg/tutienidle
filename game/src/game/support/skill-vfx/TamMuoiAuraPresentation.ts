import type {
  ActorAnchorFact,
  PlaybackRef,
  SkillCastPresentation,
  SkillPresentationResolved,
} from '@/core/battle/turn/SkillPresentationFacts'
import {
  HOA_CAU_VFX_ASSETS,
  TAM_MUOI_AURA_LOOP_MS,
  type HoaCauAsset,
} from '@/game/support/HoaCauVfxAssets'
import type { HoaCauSprite } from './HoaCauFireballPresentation'

/** Aura sprites ride the fire sheets, which are authored for an ADD blend. */
export interface TamMuoiAuraSprite extends HoaCauSprite {
  setBlendAdd(additive: boolean): unknown
}

/** Where the aura sits relative to its caster sprite, per render. */
export interface TamMuoiAuraAnchor {
  /** Foot point of the caster sprite (both sheets are authored origin .5,1). */
  x: number
  y: number
  /** Scale that reproduces the authored 256px cell at body height. */
  scale: number
  /** Live sprite depth - the two layers sandwich it (-0.5 / +0.5). */
  depth: number
}

export interface TamMuoiAuraSurface {
  anchor(fact: ActorAnchorFact): TamMuoiAuraAnchor | undefined
  createSprite(key: string, frame: string): TamMuoiAuraSprite
  isCurrent?(ref: PlaybackRef): boolean
  /** Live "is the caster's tam_muoi window still up" check - drives the
      persistent phase after the cast ignite. When absent the aura keeps
      the legacy cast-only lifecycle. */
  buffActive?(fact: ActorAnchorFact): boolean
  reducedMotion?: boolean
}

export function isTamMuoiAuraCast(cast: SkillCastPresentation): boolean {
  return cast.presetId === 'tam_muoi_aura' && cast.disposition === 'action'
}

const AURA_FADE_IN_MS = 220
const AURA_IGNITE_MS = 480
const AURA_IGNITE_REDUCED_MS = 200
const AURA_IGNITE_SWELL = 0.22
/** The runner always resolves a started cast; this caps a lost-receipt loop. */
const AURA_OVERDUE_MS = 800
/** Buff attach lands on the next status diff after the sealed receipt;
    this is how long the persistent phase waits for the window to appear. */
const BUFF_ATTACH_GRACE_MS = 2000
const AURA_FADE_OUT_MS = 300

type Active = {
  cast: SkillCastPresentation
  releaseMs: number
  elapsedMs: number
  resolved: boolean
  igniteElapsedMs: number | null
  /** Post-ignite persistent phase while the window buff is live. */
  lingerElapsedMs: number | null
  buffSeen: boolean
  fadeElapsedMs: number | null
}

/** Purely visual: wraps the caster for the cast, ignites on the sealed
    receipt, then keeps burning for the whole tam_muoi window (drains
    when the buff lapses or the caster dies); never acknowledges impact
    or changes battle facts. */
export class TamMuoiAuraPresentation {
  private active?: Active
  private sprites = new Map<string, TamMuoiAuraSprite>()

  constructor(private readonly surface: TamMuoiAuraSurface) {}

  start(cast: SkillCastPresentation, releaseMs: number): void {
    this.cancel()
    if (!isTamMuoiAuraCast(cast) || this.surface.anchor(cast.source) === undefined) return
    this.active = { cast, releaseMs, elapsedMs: 0, resolved: false,
      igniteElapsedMs: null, lingerElapsedMs: null, buffSeen: false, fadeElapsedMs: null }
    this.render()
  }

  update(deltaMs: number): void {
    const active = this.active
    if (!active || !Number.isFinite(deltaMs) || deltaMs < 0) return
    // isCurrent guards only the in-flight cast - once the receipt is
    // sealed the pending-playback token clears and the persistent phase
    // must not read it as a stale playback.
    if (!active.resolved && this.surface.isCurrent && !this.surface.isCurrent(active.cast.ref)) {
      this.cancel(); return
    }
    active.elapsedMs += deltaMs
    if (active.igniteElapsedMs !== null) active.igniteElapsedMs += deltaMs
    if (active.lingerElapsedMs !== null) active.lingerElapsedMs += deltaMs
    if (active.fadeElapsedMs !== null) active.fadeElapsedMs += deltaMs
    this.render()
    const igniteMs = this.surface.reducedMotion ? AURA_IGNITE_REDUCED_MS : AURA_IGNITE_MS
    if (active.igniteElapsedMs !== null && active.igniteElapsedMs >= igniteMs
      && active.lingerElapsedMs === null && active.fadeElapsedMs === null) {
      // Ignite finished: with a live buff channel the aura persists for
      // the whole tam_muoi window; without one it ends as before.
      if (this.surface.buffActive === undefined) this.cancel()
      else active.lingerElapsedMs = 0
    } else if (active.lingerElapsedMs !== null) {
      const up = this.surface.buffActive!(active.cast.source)
      if (up) active.buffSeen = true
      else if (active.buffSeen) { active.lingerElapsedMs = null; active.fadeElapsedMs = 0 }
      else if (active.lingerElapsedMs > BUFF_ATTACH_GRACE_MS) this.cancel()
    } else if (active.fadeElapsedMs !== null && active.fadeElapsedMs >= AURA_FADE_OUT_MS) {
      this.cancel()
    } else if (!active.resolved && active.elapsedMs > active.releaseMs + AURA_OVERDUE_MS) {
      this.cancel()
    }
  }

  resolve(resolved: SkillPresentationResolved): void {
    const active = this.active
    if (!active || !resolved.sealed || resolved.ref.token !== active.cast.ref.token
      || resolved.ref.requestId !== active.cast.ref.requestId) return
    active.resolved = true
    active.igniteElapsedMs = 0
    active.elapsedMs = Math.max(active.elapsedMs, active.releaseMs)
    this.render()
  }

  cancel(): void {
    for (const sprite of this.sprites.values()) sprite.destroy()
    this.sprites.clear()
    this.active = undefined
  }

  destroy(): void { this.cancel() }

  private sprite(asset: HoaCauAsset): TamMuoiAuraSprite {
    let sprite = this.sprites.get(asset.key)
    if (!sprite) {
      sprite = this.surface.createSprite(asset.key, `frame_${asset.firstFrame}`)
      sprite.setBlendAdd(true)
      this.sprites.set(asset.key, sprite)
    }
    return sprite
  }

  private render(): void {
    const active = this.active
    if (!active) return
    for (const sprite of this.sprites.values()) sprite.setVisible(false)
    const anchor = this.surface.anchor(active.cast.source)
    if (!anchor) return

    // Both layers share one loop phase; each loops over its own occupied
    // range (the authored ramps pad a different number of blank cells).
    const phase = active.elapsedMs / TAM_MUOI_AURA_LOOP_MS

    let alpha = 1
    let scale = anchor.scale
    if (active.fadeElapsedMs !== null) {
      // Window ended: drain the aura out.
      alpha = Math.max(0, 1 - active.fadeElapsedMs / AURA_FADE_OUT_MS)
    } else if (active.igniteElapsedMs === null) {
      alpha = Math.min(1, active.elapsedMs / AURA_FADE_IN_MS)
    } else if (active.lingerElapsedMs !== null) {
      // Buff-persistent phase: steady burn while the window is up.
      alpha = 1
    } else if (this.surface.reducedMotion) {
      alpha = Math.max(0, 1 - active.igniteElapsedMs / AURA_IGNITE_REDUCED_MS)
    } else {
      const k = Math.min(1, active.igniteElapsedMs / AURA_IGNITE_MS)
      scale = anchor.scale * (1 + AURA_IGNITE_SWELL * Math.sin(Math.PI * k))
      alpha = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45
    }

    for (const [asset, depth] of [
      [HOA_CAU_VFX_ASSETS.tamMuoiAuraBack, anchor.depth - 0.5],
      [HOA_CAU_VFX_ASSETS.tamMuoiAuraFront, anchor.depth + 0.5],
    ] as const) {
      const sprite = this.sprite(asset)
      const count = asset.lastFrame - asset.firstFrame + 1
      const frame = asset.firstFrame + Math.floor(phase * count) % count
      sprite.setFrame(`frame_${frame}`)
      sprite.setPosition(anchor.x, anchor.y)
      sprite.setScale(scale)
      sprite.setDepth(depth)
      sprite.setAlpha(alpha)
      sprite.setVisible(true)
    }
  }
}
