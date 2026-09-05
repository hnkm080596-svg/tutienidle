// CombatAnimationSet (Combat Art Pipeline spec §5, 2026-09-05) — sprite
// sheet animation metadata, one clip per Action Playback phase. No real
// sheets exist yet: buildPlaceholderAnimationSet() reuses an entity's
// existing static PNG as a trivial 1-frame "sheet" so the SAME loading/
// AnimationManager code path runs end-to-end today. When real multi-frame
// sheets are dropped in later (asset-drop workflow), only the content
// definition changes — no code path changes.
export type CombatAnimationName = 'idle' | 'ready' | 'cast' | 'standby' | 'death'

export interface CombatAnimationClip {
  key: string
  sheetKey: string
  sheetUrl: string
  frameWidth: number
  frameHeight: number
  frameCount: number
  frameRate: number
  /** -1 = loop (idle/ready/standby), 0 = play once (cast/death). */
  repeat: number
}

export type CombatAnimationSet = Record<CombatAnimationName, CombatAnimationClip>

const LOOPING_NAMES: readonly CombatAnimationName[] = ['idle', 'ready', 'standby']
const ONE_SHOT_NAMES: readonly CombatAnimationName[] = ['cast', 'death']

const ALL_NAMES: readonly CombatAnimationName[] = [...LOOPING_NAMES, ...ONE_SHOT_NAMES]

export function buildPlaceholderAnimationSet(
  entityKey: string,
  staticTextureUrl: string,
  frameSize: { width: number; height: number } = { width: 256, height: 256 },
): CombatAnimationSet {
  const entries = ALL_NAMES.map((name) => {
    const clip: CombatAnimationClip = {
      key: `${entityKey}-${name}`,
      sheetKey: `${entityKey}-${name}-sheet`,
      sheetUrl: staticTextureUrl,
      frameWidth: frameSize.width,
      frameHeight: frameSize.height,
      frameCount: 1,
      frameRate: 1,
      repeat: LOOPING_NAMES.includes(name) ? -1 : 0,
    }

    return [name, clip] as const
  })

  return Object.fromEntries(entries) as CombatAnimationSet
}
