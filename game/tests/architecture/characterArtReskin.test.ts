/**
 * character-art-infra - pin the CharacterArt registry to the generated files
 * it claims to describe. The registry is hand-written beside
 * `public/assets/characters/animated/manifest.json`; this suite is what makes
 * a stale row fail a test instead of rendering a hole in combat.
 *
 * Covers: every wired variant's sheet/atlas/avatar on disk, every declared
 * clip frame by exact `<slug>-<clip>-NNN.png` naming, sourceSize/avatarSize/
 * extent against the real files and manifest, CHARACTER_RESKIN_MAP keys
 * against real PlayerVisualProfileIds, the per-clip sheet placement
 * (zuofeng's clips span three sheets), and ANIMATED_CHARACTER_KEYS parity.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PLAYER_VISUAL_PROFILES } from '@/presentation/art/PlayerVisualProfiles'
import {
  ANIMATED_CHARACTER_KEYS,
  CHARACTER_ART,
  CHARACTER_RESKIN_MAP,
  CHARACTER_ZERO_PAD,
  resolveCharacterArtSlug,
} from '@/game/support/CharacterArt'
import {
  animatedArtFormFor,
  presentationFor,
  resolvePlayerEntityKey,
} from '@/presentation/art/CombatPresentationCatalogue'
import { MONSTER_ART } from '@/game/support/MonsterArt'
import { MORTAL_ENEMY_TEMPLATE_IDS, resolveEnemyTextureKey } from '@/game/support/EnemyArt'
import { COMPANIONS } from '@/data/companion/Companions'
import { SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()

interface AtlasFile {
  frames: Record<
    string,
    {
      sourceSize: { w: number; h: number }
      spriteSourceSize?: { x: number; y: number; w: number; h: number }
    }
  >
  meta: { image: string }
}

function publicPath(url: string): string {
  return join(GAME_ROOT, 'public', url)
}

/** PNG IHDR: width/height are big-endian uint32 at bytes 16/20. */
function pngSize(path: string): { w: number; h: number } {
  const buf = readFileSync(path)
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

const KNOWN_PROFILE_IDS = new Set(Object.values(PLAYER_VISUAL_PROFILES).map((p) => p.id))

interface ManifestVariant {
  sourceSize: { w: number; h: number }
  extent: { x: number; y: number; w: number; h: number }
  clips: Record<
    string,
    { firstFrame: number; lastFrame: number; sheet: string | null; atlas: string | null } | undefined
  >
}

const MANIFEST = JSON.parse(
  readFileSync(publicPath('assets/characters/animated/manifest.json'), 'utf8'),
) as { variants: Record<string, ManifestVariant> }

const clipRangesOf = (variant: (typeof CHARACTER_ART)[string]) =>
  [variant.clips.idle, variant.clips.death, variant.clips.attack, variant.clips.ult].filter(
    (clip) => clip !== undefined,
  )

describe('character art reskin registry (infra)', () => {
  it(
    'every wired variant\'s sheet, atlas and avatar exist on disk where declared',
    () => {
      for (const variant of Object.values(CHARACTER_ART)) {
        for (const clip of clipRangesOf(variant)) {
          expect(
            existsSync(publicPath(clip.sheetUrl)),
            `${variant.slug}: missing sheet ${clip.sheetUrl}`,
          ).toBe(true)
          expect(
            existsSync(publicPath(clip.atlasUrl)),
            `${variant.slug}: missing atlas ${clip.atlasUrl}`,
          ).toBe(true)
        }

        expect(
          existsSync(publicPath(variant.avatarUrl)),
          `${variant.slug}: missing avatar ${variant.avatarUrl}`,
        ).toBe(true)
      }
    },
    SCAN_TIMEOUT,
  )

  it(
    'every declared clip frame exists in its atlas, with matching sourceSize',
    () => {
      for (const variant of Object.values(CHARACTER_ART)) {
        for (const clip of clipRangesOf(variant)) {
          const atlas = JSON.parse(readFileSync(publicPath(clip.atlasUrl), 'utf8')) as AtlasFile

          for (let index = clip.firstFrame; index <= clip.lastFrame; index++) {
            const name = `${clip.framePrefix}${String(index).padStart(CHARACTER_ZERO_PAD, '0')}.png`
            const frame = atlas.frames[name]

            expect(frame, `${variant.slug}: atlas missing frame ${name}`).toBeDefined()
            expect(frame!.sourceSize, `${variant.slug}/${name} sourceSize drift`).toEqual(
              variant.sourceSize,
            )

            // Feet-anchor invariant (Clean-A3 A-10): origin (0.5,1) anchors
            // the authored box's feet; the box is DEFINED by the idle
            // union. Authored motion legitimately deviates frame to frame
            // (idle shuffles, lunges, falls) and the packer contract allows
            // non-idle frames to poke outside the union - so drift is
            // bounded, not zero: a wholesale-misplaced clip drifts by tens
            // of px, real motion by single digits. Ult FX may overflow
            // ABOVE the top freely.
            if (frame!.spriteSourceSize) {
              const bottomDrift =
                frame!.spriteSourceSize.y + frame!.spriteSourceSize.h - frame!.sourceSize.h
              const tolerance = Math.max(4, Math.round(frame!.sourceSize.h * 0.03))
              expect(
                Math.abs(bottomDrift),
                `${variant.slug}/${name} feet anchor drift`,
              ).toBeLessThanOrEqual(tolerance)
            }
          }
        }
      }
    },
    SCAN_TIMEOUT,
  )

  it(
    'sourceSize/extent/clip ranges equal the manifest - including per-clip sheet placement',
    () => {
      for (const variant of Object.values(CHARACTER_ART)) {
        const m = MANIFEST.variants[variant.slug]

        expect(m, `${variant.slug}: missing from manifest`).toBeDefined()
        expect(variant.sourceSize, `${variant.slug} sourceSize`).toEqual(m!.sourceSize)

        // The registry rounds to 6dp; the manifest stores full float precision.
        const round6 = (n: number) => Number(n.toFixed(6))
        const manifestExtent = {
          x: round6(m!.extent.x),
          y: round6(m!.extent.y),
          w: round6(m!.extent.w),
          h: round6(m!.extent.h),
        }

        expect(variant.extent, `${variant.slug} extent`).toEqual(manifestExtent)

        for (const name of ['idle', 'death', 'attack', 'ult'] as const) {
          const declared = variant.clips[name]
          const emitted = m!.clips[name]

          if (!declared) {
            expect(emitted, `${variant.slug}: manifest has '${name}' the table drops`).toBeUndefined()
            continue
          }

          expect(emitted, `${variant.slug}: manifest lacks '${name}'`).toBeDefined()
          expect(declared.firstFrame).toBe(emitted!.firstFrame)
          expect(declared.lastFrame).toBe(emitted!.lastFrame)
          expect(
            declared.sheetUrl.endsWith(`/${emitted!.sheet}`),
            `${variant.slug}/${name}: declared sheetUrl ${declared.sheetUrl} != emitted ${emitted!.sheet}`,
          ).toBe(true)
          expect(
            declared.atlasUrl.endsWith(`/${emitted!.atlas}`),
            `${variant.slug}/${name}: declared atlasUrl ${declared.atlasUrl} != emitted ${emitted!.atlas}`,
          ).toBe(true)
        }
      }
    },
    SCAN_TIMEOUT,
  )

  it(
    'avatarSize equals the real PNG dims - the static fallback cannot lie about its box',
    () => {
      for (const variant of Object.values(CHARACTER_ART)) {
        expect(pngSize(publicPath(variant.avatarUrl)), variant.slug).toEqual(variant.avatarSize)
      }
    },
    SCAN_TIMEOUT,
  )

  it('every reskin target is a declared variant and every key is a real profile id', () => {
    for (const [profileId, slug] of Object.entries(CHARACTER_RESKIN_MAP)) {
      expect(CHARACTER_ART[slug], `${profileId} -> undeclared variant '${slug}'`).toBeDefined()
      expect(KNOWN_PROFILE_IDS.has(profileId as never), `'${profileId}' is not a visual profile`).toBe(true)
    }
  })

  it('profile resolution: mapped profiles hit their slug, unmapped return undefined', () => {
    for (const [profileId, slug] of Object.entries(CHARACTER_RESKIN_MAP)) {
      expect(resolveCharacterArtSlug(profileId), profileId).toBe(slug)
    }
    expect(resolveCharacterArtSlug('not_a_profile')).toBeUndefined()
  })

  // resolvePlayerEntityKey is the function every combat consumer calls - the
  // MUT-02 campaign proved tests that resolve expectations through it are
  // self-consistent, so pin its OUTPUT directly.
  it('resolvePlayerEntityKey returns the character slug for mapped profiles, fallback otherwise', () => {
    for (const [profileId, slug] of Object.entries(CHARACTER_RESKIN_MAP)) {
      expect(resolvePlayerEntityKey(profileId, 'legacy-fallback-key'), profileId).toBe(slug)
    }
    expect(resolvePlayerEntityKey('not_a_profile', 'legacy-fallback-key')).toBe(
      'legacy-fallback-key',
    )
  })

  it('entity presentation: character slugs are animated with authored attack + ult clips', () => {
    const zuofeng = presentationFor('zuofeng')
    expect(zuofeng?.kind).toBe('animated')
    if (zuofeng?.kind === 'animated') {
      expect(zuofeng.clips.attack).toBeDefined()
      expect(zuofeng.clips.ult).toBeDefined()
      // standby reuses the idle frame range - the dump has no standby art.
      expect(zuofeng.clips.standby.firstFrame).toBe(zuofeng.clips.idle.firstFrame)
      expect(zuofeng.clips.standby.lastFrame).toBe(zuofeng.clips.idle.lastFrame)
      // The ult clip sits on its own emitted sheet (manifest-pinned above).
      expect(zuofeng.clips.ult!.sheetKey).toBe('zuofeng-sheet-3')
    }
    // Minh hand-drawn sets (2026-09-27): every wired variant is animated
    // with authored clips; standby still reuses the idle range.
    for (const slug of ['pham_nhan', 'ngu_kiem', 'ngu_hanh']) {
      const entity = presentationFor(slug)
      expect(entity?.kind, slug).toBe('animated')
      if (entity?.kind === 'animated') {
        expect(entity.clips.attack, `${slug}.attack`).toBeDefined()
        expect(entity.clips.standby.firstFrame).toBe(entity.clips.idle.firstFrame)
        expect(entity.clips.standby.lastFrame).toBe(entity.clips.idle.lastFrame)
      }
    }
    // ult authored for pham_nhan/ngu_hanh only; ngu_hanh death is the
    // packer-synthesized 1-frame clip (manifest 'synthetic' flag).
    expect(presentationFor('pham_nhan')?.kind === 'animated' && 
      (presentationFor('pham_nhan') as { clips: { ult?: unknown } }).clips.ult).toBeDefined()
    expect(presentationFor('ngu_hanh')?.kind === 'animated' &&
      (presentationFor('ngu_hanh') as { clips: { ult?: unknown } }).clips.ult).toBeDefined()
  })

  // Character slugs share the catalogue keyspace with monster variants and
  // companion entity ids - register() is last-writer-wins, so a collision
  // silently overwrites a reskin. Pin the namespaces disjoint so a future
  // companion named 'zuofeng' fails HERE with a clear message, not in an
  // unrelated 'missing ult clip' failure.
  it('character slugs collide with no monster variant or companion id', () => {
    const forbidden = new Set([...Object.keys(MONSTER_ART), ...COMPANIONS.map((c) => c.id)])

    for (const slug of Object.keys(CHARACTER_ART)) {
      expect(forbidden.has(slug), `character slug '${slug}' collides with a monster/companion key`).toBe(false)
    }
  })

  // The catalogue keyspace is shared by EVERY producer (Clean-R2 F2.2): a
  // companion id that equals a monster slug, or a profile texture key that
  // equals a variant slug, collides silently in register() (last-writer-wins)
  // and in enemy-entity-key resolution. Pin all four namespaces pairwise
  // disjoint so the collision fails HERE, not as a phantom animation.
  it('catalogue keys are pairwise disjoint across all five producers', () => {
    const monsterSlugs = Object.keys(MONSTER_ART)
    const characterSlugs = Object.keys(CHARACTER_ART)
    const companionIds = COMPANIONS.map((c) => c.id)
    // Multiple profiles legitimately share one texture key (fallback
    // profiles point at the mortal art) - dedupe within a namespace first;
    // the pin guards only CROSS-namespace ownership.
    const profileKeys = [...new Set(Object.values(PLAYER_VISUAL_PROFILES).map((p) => p.combatTextureKey))]
    // Enemy template texture keys (resolveEnemyTextureKey output) register
    // into the same last-writer-wins catalogue keyspace AFTER characters -
    // a future enemy key equal to a character slug would clobber the
    // character entry (Clean-B2 CR2-F6).
    const enemyTextureKeys = [
      ...new Set(MORTAL_ENEMY_TEMPLATE_IDS.map((id) => resolveEnemyTextureKey(id)).filter((k): k is string => k !== undefined)),
    ]

    const seen = new Map<string, string>()
    for (const [namespace, keys] of [
      ['monster', monsterSlugs],
      ['character', characterSlugs],
      ['companion', companionIds],
      ['profile', profileKeys],
      ['enemyTexture', enemyTextureKeys],
    ] as const) {
      for (const key of keys) {
        const prior = seen.get(key)
        expect(prior, `key '${key}' owned by both ${prior} and ${namespace}`).toBeUndefined()
        seen.set(key, namespace)
      }
    }
  })

  // Clean-R2 F2.1: optional clips (attack/ult) must be OMITTED when absent,
  // never present-but-undefined - preload/bundle/playback consumers iterate
  // Object.values(clips) and would dereference undefined.sheetKey.
  it('no animated catalogue emits an undefined clip entry', () => {
    for (const key of ANIMATED_CHARACTER_KEYS) {
      const clips = animatedArtFormFor(key)
      if (!clips) continue
      for (const [slot, clip] of Object.entries(clips)) {
        expect(clip, `${key}.clips.${slot} is present-but-undefined`).toBeDefined()
      }
    }
  })

  it('ANIMATED_CHARACTER_KEYS is exactly the reskin image - no orphan slugs, no missing ones', () => {
    expect([...ANIMATED_CHARACTER_KEYS].sort()).toEqual(
      [...new Set(Object.values(CHARACTER_RESKIN_MAP))].sort(),
    )

    for (const key of ANIMATED_CHARACTER_KEYS) {
      expect(animatedArtFormFor(key), `no animated form for '${key}'`).toBeDefined()
    }
  })
})
