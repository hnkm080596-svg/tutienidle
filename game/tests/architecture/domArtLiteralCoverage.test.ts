/**
 * Guard - DOM art literal coverage (A10: one canonical catalog).
 *
 * catalogPreloadParity.test.ts covers Phaser `load.*` literals. This is the
 * DOM-lane sibling: every image-art URL literal quoted in production source
 * - a component `<img>` src, a composable constant, a preview page, a CSS
 * url() - must be enumerated by some asset bundle, or it is an untracked
 * fetch that no warm lane knows about.
 *
 * Membership checks every enumerated URL field (dom-image `url`, Phaser
 * `textureUrl`/`atlasUrl`) across ALL bundles: a literal needs an owner,
 * whichever lane claims it. Dynamic paths (`'...' + id`, template
 * interpolation) cannot be scanned - they are owned by the registry or
 * data row that produces them, which the uiArt test enumerates directly.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { srcCorpus, isTestFile, SCAN_TIMEOUT } from './helpers/scanTs'
import { enumerateResources } from '@/presentation/assets/AssetBundleCatalog'

const GAME_ROOT = process.cwd()
const ALL_BUNDLES = [
  'core-ui',
  'home',
  'combat',
  'tribulation',
  'ui-chrome',
  'ui-scenes',
] as const

/** Quoted '/assets/<something>.<image-ext>' literal. A trailing slash or a
    `${}` interpolation means the string is a prefix/template, not a fetch
    target - dynamic concatenations are enumerated via their owners. */
const ART_LITERAL = /['"](\/assets\/[^'"`$]+\.(?:png|svg|webp|jpe?g|avif))['"]/g

/** Comment-only lines cannot fetch - a literal inside a `//` or `*` doc
    line is documentation, not a load site (e.g. the Technique.ts example). */
const COMMENT_LINE = /^\s*(?:\/\/|\*)/

/** Deliberate, recorded exemptions: 'file: url' pairs a maintainer opted
    out of enumeration. Entries require a comment explaining why. */
const ALLOWED_UNCOVERED = new Set([
  // components/scenes/alchemy/AlchemySurface.vue - dead-path fallback icon:
  // the file itself does not exist (404s when the recipe->pill lookup
  // misses). Pre-existing defect; enumerating a missing file would fail
  // the uiArt on-disk guard. Revisit when dedicated art lands.
  'components/scenes/alchemy/AlchemySurface.vue: /assets/pills/truc_co_dan.png',
  // game/support/HoaCauVfxAssets.ts - dev-lab preview variant: the Hoa The
  // seal is lab-only until its skill slot is approved; warming it into a
  // prod bundle would ship megabytes of review-only art to players.
  'game/support/HoaCauVfxAssets.ts: /assets/vfx/hoa-cau-thuat/fire-stroke/hoa-the.png',
])

describe('dom art literal coverage', () => {
  it('every image-art literal in production source is enumerated by a bundle', { timeout: SCAN_TIMEOUT }, () => {
    const catalogUrls = new Set<string>()

    for (const d of enumerateResources([...ALL_BUNDLES])) {
      for (const field of ['url', 'textureUrl', 'atlasUrl'] as const) {
        const value = field in d ? (d as Record<string, string | undefined>)[field] : undefined
        if (value !== undefined) {
          catalogUrls.add(value.replace(/^\/+/, ''))
        }
      }
    }

    const corpus = srcCorpus(join(GAME_ROOT, 'src'))
    const uncovered: string[] = []

    for (const file of corpus) {
      if (isTestFile(file.path)) continue

      for (const line of file.text.split('\n')) {
        if (COMMENT_LINE.test(line)) continue
        for (const literal of line.matchAll(ART_LITERAL)) {
          const url = literal[1]!.replace(/^\/+/, '')
          if (!catalogUrls.has(url) && !ALLOWED_UNCOVERED.has(`${file.fromSrc}: ${literal[1]}`)) {
            uncovered.push(`${file.fromSrc}: ${literal[1]}`)
          }
        }
      }
    }

    expect(
      uncovered,
      `image-art literals not enumerated by any asset bundle:\n${uncovered.join('\n')}`,
    ).toEqual([])
  })
})
