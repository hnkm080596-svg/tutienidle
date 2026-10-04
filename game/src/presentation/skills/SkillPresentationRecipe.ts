import type { CombatVfxPresetId } from '@/core/battle/CombatAction'
import type { PlaybackRef, SkillCastPresentation, ResolvedPresentationGroup } from '@/core/battle/turn/SkillPresentationFacts'

export type SkillPrimitive = 'trajectory' | 'stroke' | 'burst' | 'aura' | 'ground-shape' | 'actor-impulse' | 'camera-cue' | 'sheet'
export interface SkillCue {
  readonly primitive: SkillPrimitive
  readonly offsetMs: number
  readonly durationMs: number
  readonly anchor: 'source' | 'target' | 'targets'
  readonly shape: 'blade' | 'orb' | 'slash' | 'ring' | 'sparks' | 'rune' | 'impulse' | 'camera' | 'sheet'
  readonly impulsePx?: number
  readonly intensity?: number
  readonly recall?: boolean
  readonly bend?: number
  readonly count?: number
  readonly releaseMs?: number
  readonly cruiseMs?: number
  readonly accelerationMs?: number
  // 'sheet' primitive payload - spritesheet atlas playback authored by
  // VfxSheetManifest (see data/vfx/VfxSheetManifest.ts).
  readonly sheetKey?: string
  readonly firstFrame?: number
  readonly lastFrame?: number
  readonly fps?: number
  readonly fitPx?: number
  readonly grounded?: boolean
}
export interface SkillPresentationRecipe {
  readonly id: string
  readonly version: 1
  readonly color: number
  readonly castMs: number
  readonly impactMs: number
  readonly recoveryMs: number
  readonly cast: readonly SkillCue[]
  readonly impact: readonly SkillCue[]
  readonly recovery: readonly SkillCue[]
}
export interface SkillCueContext {
  readonly ref: PlaybackRef
  readonly recipe: SkillPresentationRecipe
  // Runtime context-phase vocabulary - 'cast' during cast playback,
  // 'resolved' during resolved (impact+recovery) playback. This is NOT
  // the recipe-section vocabulary ('cast' | 'impact' | 'recovery') used
  // by validateSkillRecipe and primitivePhaseAllowlist below: a cue
  // authored in the impact or recovery section runs with phase
  // 'resolved'.
  readonly phase: 'cast' | 'resolved'
  readonly cast?: SkillCastPresentation
  readonly group?: ResolvedPresentationGroup
  // Set by the runner at resolved-playback start when any group recipe carries
  // an authored camera-cue: the generic landed-hit camera impulse must yield
  // (authored precedence, independent of cue ordering within a recipe).
  readonly hasAuthoredCameraCue?: boolean
  // Set by the runner for resolved-phase cues: whether the receipt's PRIMARY
  // group contains a landed hit (the W2.5 landed-hit predicate). Camera
  // feedback gates on this flag, never on the cue's own group - in a routed
  // composite the cue may ride a combo lane whose outcome is irrelevant.
  readonly primaryLanded?: boolean
}
export interface SkillCueHandle {
  sample(elapsedMs: number): void
  finish(): void
  cancel(): void
}
export interface SkillPresentationDriver {
  open(cue: SkillCue, context: SkillCueContext): SkillCueHandle
}
export type SkillRecipeResolver = (presetId: CombatVfxPresetId) => SkillPresentationRecipe

const primitives = new Set<SkillPrimitive>(['trajectory', 'stroke', 'burst', 'aura', 'ground-shape', 'actor-impulse', 'camera-cue', 'sheet'])
// One-shot primitives execute only in the playback phase whose context
// carries the facts they read: actor-impulse needs context.cast (present
// only during cast playback), camera-cue needs group / primaryLanded
// (present only during resolved playback). Authored anywhere else the cue
// could only no-op silently, so a misplaced placement is a recipe bug -
// fail validation instead of dropping it at runtime.
const primitivePhaseAllowlist: Partial<Record<SkillPrimitive, readonly string[]>> = {
  'actor-impulse': ['cast'],
  'camera-cue': ['impact', 'recovery'],
}
export function validateSkillRecipe(recipe: SkillPresentationRecipe): void {
  if (!recipe.id || recipe.version !== 1 || !Number.isInteger(recipe.color) || recipe.color < 0 || recipe.color > 0xffffff)
    throw new Error('Invalid skill recipe identity or color')
  for (const phase of ['cast', 'impact', 'recovery'] as const) {
    const duration = recipe[`${phase}Ms`]
    if (!Number.isFinite(duration) || duration < 0 || duration > 1500 || recipe[phase].length > 12)
      throw new Error('Unbounded skill recipe phase')
    for (const cue of recipe[phase]) {
      if (!primitives.has(cue.primitive) || !Number.isFinite(cue.offsetMs) || !Number.isFinite(cue.durationMs)
        || cue.offsetMs < 0 || cue.durationMs <= 0 || cue.offsetMs + cue.durationMs > duration
        || !['source', 'target', 'targets'].includes(cue.anchor)
        || !['blade', 'orb', 'slash', 'ring', 'sparks', 'rune', 'impulse', 'camera', 'sheet'].includes(cue.shape))
        throw new Error('Invalid skill recipe cue')
      if (cue.primitive === 'sheet') {
        if (!cue.sheetKey || cue.sheetKey.length > 64
          || !Number.isInteger(cue.firstFrame) || !Number.isInteger(cue.lastFrame)
          || cue.firstFrame! < 0 || cue.lastFrame! < cue.firstFrame! || cue.lastFrame! > 9999
          || !Number.isFinite(cue.fps) || cue.fps! < 1 || cue.fps! > 120
          || !Number.isFinite(cue.fitPx) || cue.fitPx! < 8 || cue.fitPx! > 640)
          throw new Error('Invalid skill sheet cue')
      }
      const allowedPhases = primitivePhaseAllowlist[cue.primitive]
      if (allowedPhases && !allowedPhases.includes(phase))
        throw new Error('Skill recipe cue in wrong phase')
      if (cue.impulsePx !== undefined
        && (!Number.isFinite(cue.impulsePx) || cue.impulsePx <= 0 || cue.impulsePx > 64))
        throw new Error('Unbounded skill cue impulse')
      if (cue.intensity !== undefined
        && (!Number.isFinite(cue.intensity) || cue.intensity <= 0 || cue.intensity > 0.01))
        throw new Error('Unbounded skill cue camera intensity')
      for (const value of [cue.bend, cue.count, cue.releaseMs, cue.cruiseMs, cue.accelerationMs])
        if (value !== undefined && !Number.isFinite(value)) throw new Error('Non-finite skill cue parameter')
      if (cue.primitive !== 'sheet'
        && [cue.sheetKey, cue.firstFrame, cue.lastFrame, cue.fps, cue.fitPx, cue.grounded].some((value) => value !== undefined))
        throw new Error('Sheet cue fields on non-sheet primitive')
      if (cue.count !== undefined && (!Number.isInteger(cue.count) || cue.count < 1 || cue.count > 256))
        throw new Error('Unbounded skill cue count')
    }
  }
}
export const FALLBACK_SKILL_RECIPE: SkillPresentationRecipe = Object.freeze({
  id: 'fallback', version: 1, color: 0xe8d49a,
  castMs: 180, impactMs: 100, recoveryMs: 80,
  cast: [], impact: [], recovery: [],
})
