/**
 * Impact-marker authority (impact-sync sec.15-18, sec.67, sec.37).
 *
 * art/animation-impact-markers.json is the ONE authoring surface; the
 * registries read it at module load (CharacterArt/MonsterArt clip()) and
 * the packers validate + inject it into the manifests. These tests pin
 * the contract in both directions: the committed table is VALID against
 * the registry it feeds, the validation script REJECTS every malformed
 * shape, and the runtime math (clipImpactMs) honors the marker policy.
 *
 * Boundaries are exercised through the real applier in --dry-run mode -
 * the same validation the packers run - rather than a re-implemented
 * check that could drift from it.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHARACTER_ART } from '@/game/support/CharacterArt'
import { MONSTER_ART } from '@/game/support/MonsterArt'
import { animatedCombatEntities } from '@/presentation/art/CombatPresentationCatalogue'
import {
  castTimingClipsOf,
  clipImpactMs,
  UNMARKED_CAST_CLIP_FRAME_LIMIT,
  type AtlasClip,
} from '@/presentation/art/CombatEntityPresentation'
import { ANIMATION_FALLBACK_MS } from '@/core/battle/turn/TurnBattleConstants'

import IMPACT_MARKERS from '../../art/animation-impact-markers.json'

const GAME_ROOT = path.resolve(__dirname, '..', '..')

function registryRanges(
  slug: string,
  kind: 'characters' | 'enemies',
): Record<string, { firstFrame: number; lastFrame: number }> {
  type LooseVariant = {
    slug: string
    clips: {
      idle: { firstFrame: number; lastFrame: number }
      death: { firstFrame: number; lastFrame: number }
      attack?: { firstFrame: number; lastFrame: number }
      ult?: { firstFrame: number; lastFrame: number }
    }
    castClips?: Record<string, { firstFrame: number; lastFrame: number; framePrefix: string }>
  }
  const variant: LooseVariant | undefined =
    (kind === 'characters' ? CHARACTER_ART[slug] : MONSTER_ART[slug]) as LooseVariant | undefined
  if (!variant) {
    return {}
  }

  const named: Record<string, { firstFrame: number; lastFrame: number }> = {
    idle: variant.clips.idle,
    death: variant.clips.death,
    ...(variant.clips.attack ? { attack: variant.clips.attack } : {}),
    ...(variant.clips.ult ? { ult: variant.clips.ult } : {}),
  }

  // Cast clips key the map by selector but report under their SOURCE name
  // (`src`, defaulting to `cast-<key>`) - the same name markers use.
  const cast: Record<string, { firstFrame: number; lastFrame: number }> = {}
  for (const range of Object.values(variant.castClips ?? {})) {
    // The source clip name is recoverable from the framePrefix
    // `<slug>-<src>-` - markers key on it, not the selector.
    const src = range.framePrefix.slice(variant.slug.length + 1, -1)
    cast[src] = range
  }

  return { ...named, ...cast }
}

describe('impact markers - committed table validity', () => {
  it('references only known variants and source clips, with in-range integers', () => {
    for (const kind of ['characters', 'enemies'] as const) {
      for (const [slug, clips] of Object.entries(
        IMPACT_MARKERS[kind] as Record<string, Record<string, number>>,
      )) {
        const ranges = registryRanges(slug, kind)
        expect(
          Object.keys(ranges).length,
          `marker names unknown ${kind} variant '${slug}'`,
        ).toBeGreaterThan(0)

        for (const [clipName, marker] of Object.entries(clips)) {
          const range = ranges[clipName]
          expect(range, `'${slug}' marker names unknown clip '${clipName}'`).toBeDefined()
          const frameCount = range!.lastFrame - range!.firstFrame + 1
          expect(
            Number.isInteger(marker) && marker >= 0 && marker < frameCount,
            `'${slug}'.${clipName}=${marker} outside 0..${frameCount - 1}`,
          ).toBe(true)
        }
      }
    }
  })
})

describe('impact markers - validation failure modes (sec.67)', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'impact-markers-'))

  function run(markers: unknown): { ok: boolean; stderr: string } {
    const file = path.join(tmp, `markers-${Math.random().toString(36).slice(2)}.json`)
    writeFileSync(file, JSON.stringify(markers))
    try {
      execFileSync(
        process.execPath,
        ['scripts/apply-impact-markers.mjs', '--dry-run', '--markers', file],
        { cwd: GAME_ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
      )
      return { ok: true, stderr: '' }
    } catch (error) {
      return { ok: false, stderr: String((error as { stderr?: string }).stderr ?? error) }
    }
  }

  it('accepts marker 0 and the last valid index', () => {
    // zuofeng attack is [1,18] -> 18 frames, clip-local last index 17.
    expect(run({ characters: { zuofeng: { attack: 0 } } }).ok).toBe(true)
    expect(run({ characters: { zuofeng: { attack: 17 } } }).ok).toBe(true)
  })

  it('rejects a negative marker', () => {
    expect(run({ characters: { zuofeng: { attack: -1 } } }).ok).toBe(false)
  })

  it('rejects index == frameCount', () => {
    expect(run({ characters: { zuofeng: { attack: 18 } } }).ok).toBe(false)
  })

  it('rejects a non-integer marker', () => {
    expect(run({ characters: { zuofeng: { attack: 3.5 } } }).ok).toBe(false)
    expect(run({ characters: { zuofeng: { attack: '5' } } }).ok).toBe(false)
  })

  it('rejects an unknown source clip', () => {
    expect(run({ characters: { zuofeng: { laugh: 1 } } }).ok).toBe(false)
  })

  it('rejects an unknown variant', () => {
    expect(run({ characters: { ghost_city: { attack: 0 } } }).ok).toBe(false)
    expect(run({ enemies: { ghost_city: { attack: 0 } } }).ok).toBe(false)
  })

  it('accepts the committed table unchanged (smoke)', () => {
    expect(run(IMPACT_MARKERS).ok).toBe(true)
  })
})

describe('clipImpactMs runtime math (sec.31-33)', () => {
  const base: AtlasClip = {
    key: 'k',
    sheetKey: 's',
    sheetUrl: 'u',
    atlasUrl: 'a',
    framePrefix: 'p',
    frameSuffix: '.png',
    zeroPad: 3,
    firstFrame: 0,
    lastFrame: 16,
    frameRate: 10,
    sourceSize: { w: 1, h: 1 },
    extent: { x: 0, y: 0, w: 1, h: 1 },
    repeat: 0,
  }

  it('explicit marker -> midpoint of that frame', () => {
    // (marker + 0.5) * frameMs - marker 7 at 10fps -> 750ms.
    expect(clipImpactMs({ ...base, impactFrameIndex: 7 })).toBe(750)
  })

  it('marker 0 lands at the first frame midpoint - 0 is a real marker', () => {
    expect(clipImpactMs({ ...base, impactFrameIndex: 0 })).toBe(50)
  })

  it('short unmarked clip -> clip end, no debt', () => {
    const clip = { ...base, lastFrame: 2 } // 3 frames <= UNMARKED limit
    expect(clipImpactMs(clip)).toBe((2 + 0.5) * 100)
  })

  it('long unmarked clip -> safe clip end (debt flag is the caller warn)', () => {
    const clip = { ...base, lastFrame: 16 } // 17 frames > limit, no marker
    expect(clipImpactMs(clip)).toBe(1650)
    expect(clip.lastFrame - clip.firstFrame + 1).toBeGreaterThan(
      UNMARKED_CAST_CLIP_FRAME_LIMIT,
    )
  })
})

describe('shipping gate (sec.32/37): every reachable cast clip is marked or under the limit', () => {
  it('no >4-frame cast-reachable clip lacks an authored marker', () => {
    const offenders: string[] = []

    for (const { entityKey, clips } of animatedCombatEntities()) {
      for (const clip of castTimingClipsOf(clips)) {
        const frameCount = clip.lastFrame - clip.firstFrame + 1
        if (frameCount > UNMARKED_CAST_CLIP_FRAME_LIMIT && clip.impactFrameIndex === undefined) {
          offenders.push(`${entityKey}: ${clip.key} (${frameCount}f)`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it('every marked cast timing lands below ANIMATION_FALLBACK_MS (sec.37)', () => {
    for (const { entityKey, clips } of animatedCombatEntities()) {
      for (const clip of castTimingClipsOf(clips)) {
        expect(
          clipImpactMs(clip),
          `${entityKey}: ${clip.key} impact lands past the fallback horizon`,
        ).toBeLessThan(ANIMATION_FALLBACK_MS)
      }
    }
  })
})
