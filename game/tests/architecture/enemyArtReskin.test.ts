/**
 * enemy-art-wave1 - pin the MonsterArt registry to the generated files it
 * claims to describe. The registry is hand-written beside
 * `public/assets/enemies/animated/manifest.json`; this suite is what makes a
 * stale row fail a test instead of rendering a hole in combat.
 *
 * Covers: every variant's sheet/atlas/avatar on disk, every declared clip
 * frame by exact `<slug>-<clip>-NNN.png` naming, sourceSize/avatarSize
 * against the real files, ENEMY_RESKIN_MAP keys against real enemy ids, and
 * the runtime-id -> slug resolution (incl. ferocious longest-prefix order).
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ENEMIES } from '@/data/enemy/Enemies'
import {
  ANIMATED_ENEMY_KEYS,
  ENEMY_RESKIN_MAP,
  MONSTER_ART,
  resolveMonsterArtSlug,
} from '@/game/support/MonsterArt'
import {
  PLACEHOLDER_ENTITY_KEY,
  animatedArtFormFor,
  presentationFor,
  resolveCombatEntityKey,
} from '@/presentation/art/CombatPresentationCatalogue'
import { resolveEnemyTextureKey } from '@/game/support/EnemyArt'
import { SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()

interface AtlasFile {
  frames: Record<string, { sourceSize: { w: number; h: number } }>
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

const KNOWN_ENEMY_IDS = new Set(ENEMIES.map((enemy) => enemy.id))

interface ManifestVariant {
  sourceSize: { w: number; h: number }
  extent: { x: number; y: number; w: number; h: number }
  clips: Record<
    string,
    { firstFrame: number; lastFrame: number; sheet: string | null; atlas: string | null } | undefined
  >
}

const MANIFEST = JSON.parse(
  readFileSync(publicPath('assets/enemies/animated/manifest.json'), 'utf8'),
) as { variants: Record<string, ManifestVariant> }

describe('enemy art reskin registry (wave 1)', () => {
  it(
    'every variant\'s sheet, atlas, avatar and sfx exist on disk where declared',
    () => {
      for (const variant of Object.values(MONSTER_ART)) {
        const clipRanges = [variant.clips.idle, variant.clips.death, variant.clips.attack].filter(
          (clip) => clip !== undefined,
        )

        for (const clip of clipRanges) {
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

        if (variant.attackSfxUrl) {
          expect(
            existsSync(publicPath(variant.attackSfxUrl)),
            `${variant.slug}: missing sfx ${variant.attackSfxUrl}`,
          ).toBe(true)
        }
      }
    },
    SCAN_TIMEOUT,
  )

  it(
    'every declared clip frame exists in its atlas, with matching sourceSize',
    () => {
      for (const variant of Object.values(MONSTER_ART)) {
        const clipRanges = [variant.clips.idle, variant.clips.death, variant.clips.attack].filter(
          (clip) => clip !== undefined,
        )

        for (const clip of clipRanges) {
          const atlas = JSON.parse(readFileSync(publicPath(clip.atlasUrl), 'utf8')) as AtlasFile

          for (let index = clip.firstFrame; index <= clip.lastFrame; index++) {
            const name = `${clip.framePrefix}${String(index).padStart(3, '0')}.png`
            const frame = atlas.frames[name]

            expect(frame, `${variant.slug}: atlas missing frame ${name}`).toBeDefined()
            expect(frame!.sourceSize, `${variant.slug}/${name} sourceSize drift`).toEqual(
              variant.sourceSize,
            )
          }
        }
      }
    },
    SCAN_TIMEOUT,
  )

  it(
    'sourceSize/extent/clip ranges equal the manifest - the table cannot drift from the packer',
    () => {
      for (const variant of Object.values(MONSTER_ART)) {
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

        for (const name of ['idle', 'death', 'attack'] as const) {
          const declared = variant.clips[name]
          const emitted = m!.clips[name]

          if (!declared) {
            expect(emitted, `${variant.slug}: manifest has '${name}' the table drops`).toBeUndefined()
            continue
          }

          expect(emitted, `${variant.slug}: manifest lacks '${name}'`).toBeDefined()
          expect(declared.firstFrame).toBe(emitted!.firstFrame)
          expect(declared.lastFrame).toBe(emitted!.lastFrame)

          // The clip must sit on the sheet the packer emitted it on - a
          // clip that lands on sheet-2 silently breaks a hardcoded
          // `sheet-1` registry row (no wired variant does today; the
          // reserved multi-sheet boss would).
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
      for (const variant of Object.values(MONSTER_ART)) {
        expect(pngSize(publicPath(variant.avatarUrl)), variant.slug).toEqual(variant.avatarSize)
      }
    },
    SCAN_TIMEOUT,
  )

  it('every reskin target is a declared variant and every key is a real enemy id', () => {
    for (const [enemyId, slug] of Object.entries(ENEMY_RESKIN_MAP)) {
      expect(MONSTER_ART[slug], `${enemyId} -> undeclared variant '${slug}'`).toBeDefined()
      expect(KNOWN_ENEMY_IDS.has(enemyId), `'${enemyId}' is not an enemy in the data`).toBe(true)
    }
  })

  it('no reskin key is a runtime-suffix prefix of an UNMAPPED enemy template id', () => {
    // resolveMonsterArtSlug matches `<key>_` prefixes for spawned runtime ids
    // (`<templateId>_<nonce>`). A future template named `<key>_<word>` would
    // silently inherit the key's art unless it is mapped too - pin that no
    // unmapped template id sits inside another reskin key's prefix reach.
    for (const templateId of KNOWN_ENEMY_IDS) {
      if (ENEMY_RESKIN_MAP[templateId] !== undefined) continue
      for (const key of Object.keys(ENEMY_RESKIN_MAP)) {
        expect(
          templateId.startsWith(`${key}_`),
          `'${templateId}' falls inside reskin key '${key}_' reach - map it or rename`,
        ).toBe(false)
      }
    }
  })

  it('runtime ids resolve by longest prefix - ferocious beats base, unmapped returns undefined', () => {
    expect(resolveMonsterArtSlug('mortal_feral_dog')).toBe('graymane-wolf')
    expect(resolveMonsterArtSlug('mortal_feral_dog_9f2c')).toBe('graymane-wolf')
    expect(resolveMonsterArtSlug('mortal_ferocious_feral_dog_9f2c')).toBe('graymane-wolf-ferocious')
    expect(resolveMonsterArtSlug('ferocious_flood_serpent_1a2b')).toBe(
      'streamscale-forkman-floodserpent-ferocious',
    )
    expect(resolveMonsterArtSlug('flood_serpent_1a2b')).toBe('streamscale-forkman-floodserpent')
    expect(resolveMonsterArtSlug('mortal_savage_tiger_9f2c')).toBeUndefined()
  })

  it('entity resolution: mapped enemies are animated, unmapped keep static art or the placeholder', () => {
    // Mapped -> variant slug, kind animated, authored attack clip present.
    expect(resolveCombatEntityKey('mortal_feral_dog_9f2c')).toBe('graymane-wolf')
    const wolf = presentationFor('graymane-wolf')
    expect(wolf?.kind).toBe('animated')
    if (wolf?.kind === 'animated') {
      expect(wolf.clips.attack).toBeDefined()
      // standby reuses the idle frame range - the dump has no standby art.
      expect(wolf.clips.standby.firstFrame).toBe(wolf.clips.idle.firstFrame)
      expect(wolf.clips.standby.lastFrame).toBe(wolf.clips.idle.lastFrame)
    }

    // Unmapped mortal enemy -> its static batch PNG.
    const tigerKey = resolveEnemyTextureKey('mortal_savage_tiger')
    expect(tigerKey).toBeDefined()
    expect(resolveCombatEntityKey('mortal_savage_tiger_9f2c')).toBe(tigerKey)
    expect(presentationFor(tigerKey!)?.kind).toBe('static')

    // Unknown id -> wildcard placeholder.
    expect(resolveCombatEntityKey('no_such_enemy_9f2c')).toBe(PLACEHOLDER_ENTITY_KEY)
  })

  it('ANIMATED_ENEMY_KEYS is exactly the reskin image - no orphan slugs, no missing ones', () => {
    expect([...ANIMATED_ENEMY_KEYS].sort()).toEqual(
      [...new Set(Object.values(ENEMY_RESKIN_MAP))].sort(),
    )

    // And every one of them actually has an animated form registered.
    for (const key of ANIMATED_ENEMY_KEYS) {
      expect(animatedArtFormFor(key), `no animated form for '${key}'`).toBeDefined()
    }
  })
})
