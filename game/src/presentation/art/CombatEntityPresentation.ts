// CombatEntityPresentation — what a combat entity's art IS, as a type.
//
// Spec B §4.1/§4.2/§4.3
// (docs/superpowers/specs/2026-09-11-combat-animation-metadata-design.md).
//
// Two classes, not one. §3.2 is a deliberate economy on ART COST: the player
// (and later, bosses) get real per-clip animation; ordinary enemies get one
// still image plus a procedural motion that costs no art at all.
//
// A DISCRIMINATED UNION, so a consumer has to decide which it is holding. The
// alternative — an animated presentation whose clips happen to be absent — is
// the `Partial<Record<…>>` shape Spec A §4.2 has just finished removing from the
// registry gate, where it pushed an absence check onto every call site.
//
// PROMOTION IS A DATA CHANGE. An enemy gains animation when its entry becomes
// `{ kind: 'animated', clips: … }`. No playback code is touched, because every
// consumer already narrows on `kind`. That reversibility is the whole reason
// §3.2's economy is safe to take; if it stopped being true, the economy would
// have become load-bearing and the design would be wrong (§9 criterion 7).
import type { CombatAnimationName } from '@/core/battle/CombatAnimationTypes'

export type { CombatAnimationName }

/**
 * One animation clip, as a range of NAMED frames inside a trimmed
 * TexturePacker atlas (§3.1).
 *
 * Frames are addressed by name rather than by index into a uniform grid, because
 * a trimmed atlas's JSON carries `sourceSize` and `spriteSourceSize` per frame —
 * exactly the data spec C needs to plant a foot on a grid cell without guessing.
 * A uniform grid pads every frame to the same box and throws that away.
 *
 * There is deliberately no `frameCount`: it is `lastFrame - firstFrame + 1`, and
 * two ways to state one number is the defect Spec A logged as V9.
 */
export interface AtlasClip {
  /** Phaser animation key, unique per entity+name. */
  key: string

  /** Atlas texture key. Shared by every clip of one entity. */
  sheetKey: string

  /** Atlas PNG. */
  sheetUrl: string

  /** Atlas JSON, beside the PNG. */
  atlasUrl: string

  /** Frame naming, as TexturePacker emits it: `frame_` + `000` + `.png`. */
  framePrefix: string
  frameSuffix: string
  zeroPad: number

  /** Inclusive frame range within the atlas. */
  firstFrame: number
  lastFrame: number

  frameRate: number

  /** -1 = loop (idle/ready/standby), 0 = play once (cast/death). */
  repeat: number

  /**
   * The frame at which this clip's action READS as having happened — a sword
   * connecting, a palm striking. Absolute (same numbering as `firstFrame`), and
   * within [firstFrame, lastFrame].
   *
   * Declared here and consumed by spec D, which replaces the current
   * `ATTACK_LUNGE_DURATION_MS / 2` — half a movement tween, with no relationship
   * to the art it is timing. NOTHING IN B READS THIS (§6, B8). Changing playback
   * timing in the same pass as the metadata would make a regression in either
   * impossible to attribute.
   *
   * Absent on looping clips, which have no impact moment.
   */
  impactFrame?: number
}

/** Every clip of one animated entity. No partial records (§7). */
export type CombatAnimationCatalogue = Record<CombatAnimationName, AtlasClip>

/** One still image. What a `kind: 'static'` entity actually draws. */
export interface StaticEntityArt {
  textureKey: string
  textureUrl: string
  sourceSize: { w: number; h: number }
}

/**
 * Procedural motion for a static entity. Costs no art — this is the whole point
 * of §3.2's economy, and the reason "static" does not have to mean "dead".
 *
 * Worth stating plainly because the decision described enemies as static "như
 * hiện tại": they were not. Walk sway/bob/tilt were deleted outright on
 * 2026-08-26 (`combat-grid-view.ts`), leaving rotation 0 and a straight
 * projected position. So this is a TARGET state, and reaching it means adding a
 * motion that is not there — cheap, but not a no-op.
 */
export interface IdleMotion {
  /**
   * Peak vertical offset, in SCREEN pixels, and NOT scaled by projection depth.
   *
   * Decided 2026-09-11: one size for every row. The alternative — scaling
   * amplitude by the row's depth factor, so a far enemy breathes less — is more
   * correct perspective and was explicitly not wanted. A far enemy is already
   * small; scaling its motion too makes it read as frozen.
   */
  amplitudePx: number

  /** One full cycle, in ms. Jittered per entity so a row does not pulse as one. */
  periodMs: number
}

export type CombatEntityPresentation =
  | { kind: 'animated'; clips: CombatAnimationCatalogue }
  | { kind: 'static'; texture: StaticEntityArt; idleMotion: IdleMotion }

/**
 * Single source of truth for the animation key format, so a scene can compute a
 * key without rebuilding a whole catalogue to read one field.
 */
export function combatAnimationKey(entityKey: string, name: CombatAnimationName): string {
  return `${entityKey}-${name}`
}
