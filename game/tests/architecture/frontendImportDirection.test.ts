/**
 * Guard (V1, V2) — the dynamic layer does not reach up into the static one.
 *
 * Spec: docs/superpowers/specs/2026-09-11-frontend-static-dynamic-boundary-design.md
 * §3.2 and §7.
 *
 * `src/game/` draws. It may not import Vue's reactivity or a Pinia store: a
 * scene that watches a store has made the canvas depend on DOM state, and the
 * two then have to be torn down together in an order nobody declared. The legal
 * path is `presentation/`, which is where the layers are allowed to meet.
 *
 * Real violations at authoring time (2026-09-11):
 *   - `src/game/support/themePhaserSync.ts` imported `watch` from 'vue' and
 *     `useThemeStore` from '@/stores/themeStore'
 *   - `src/game/support/commandWheelCatalog.ts` imported two panel-id types
 *     from '@/stores/ui'
 *
 * The second was type-only, so it emitted no runtime edge. It is still a
 * violation: §3.2 governs direction, and a type-only import is precisely how a
 * runtime one later arrives without anyone noticing the direction was already
 * wrong.
 *
 * Scope limit, stated rather than papered over: this is import-shaped. A store
 * reached through a global, a dynamic `import()` built from a string, or a
 * value handed in at construction would all slip past it.
 */
import { describe, expect, it } from 'vitest'
import { join, sep } from 'node:path'
import { SCAN_TIMEOUT, srcCorpus } from './helpers/scanTs'

const SRC_DIR = join(process.cwd(), 'src')
const GAME_PREFIX = 'game/'

const GAME_FILES = srcCorpus(SRC_DIR).filter((file) => file.fromSrc.startsWith(GAME_PREFIX))

/**
 * `from 'vue'` / `from "@/stores/…"`, in a static import or a re-export, with
 * or without the `type` modifier. Bare `import 'x'` too, though it carries no
 * binding — a side-effecting store import would still be the wrong direction.
 */
function importsFrom(text: string, pattern: string): boolean {
  const quoted = `['"]${pattern}['"]`

  return (
    new RegExp(String.raw`\bfrom\s+${quoted}`).test(text) ||
    new RegExp(String.raw`\bimport\s+${quoted}`).test(text) ||
    new RegExp(String.raw`\bimport\s*\(\s*${quoted}`).test(text)
  )
}

describe('frontend import direction', () => {
  it(
    'has files to police — a guard over an empty corpus proves nothing',
    () => {
      expect(GAME_FILES.length).toBeGreaterThan(20)
      expect(GAME_FILES.every((file) => file.path.includes(`${sep}game${sep}`))).toBe(true)
    },
    SCAN_TIMEOUT,
  )

  it(
    'no file under src/game/ imports vue',
    () => {
      const offenders = GAME_FILES.filter((file) => importsFrom(file.text, 'vue')).map(
        (file) => file.fromSrc,
      )

      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'no file under src/game/ imports a Pinia store',
    () => {
      const offenders = GAME_FILES.filter((file) =>
        importsFrom(file.text, '@/stores/[^\'"]*'),
      ).map((file) => file.fromSrc)

      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'the static layer reaches into src/game/ only where it is recorded',
    () => {
      // The MIRROR of the rule above, and the one §5.4 is about: a shared art
      // descriptor read only by Vue, stranded in the dynamic layer's directory.
      // Three were (DongFuArt, DongFuBuildingArt, DongFuStackLoader — zero
      // consumers under src/game/, all consumers under src/components/); they
      // now live in presentation/background/.
      //
      // What remains is listed rather than forbidden, because each entry needs
      // its own decision and some are legitimately dynamic-layer facts. This is
      // a ratchet: the list may shrink without ceremony, and may not grow
      // without editing it here.
      const RECORDED = [
        '@/game/support/PlayerVisualProfiles',
        '@/game/support/SlotState',
        '@/game/support/ThanhVanArt',
        '@/game/support/combatInsets',
        '@/game/support/commandWheelCatalog',
        '@/game/support/commandWheelOrbit',
        '@/game/support/kiemBarBridge',
      ]

      const shells = srcCorpus(SRC_DIR).filter(
        (file) =>
          !file.fromSrc.endsWith('.test.ts') &&
          (file.fromSrc.startsWith('components/') ||
            file.fromSrc.startsWith('composables/') ||
            file.fromSrc.startsWith('stores/')),
      )

      const found = new Set<string>()

      for (const file of shells) {
        for (const match of file.text.matchAll(/from\s+['"](@\/game\/[^'"]+)['"]/g)) {
          found.add(match[1]!)
        }
      }

      expect([...found].sort()).toEqual(RECORDED)
    },
    SCAN_TIMEOUT,
  )

  it(
    'no file under src/game/ imports a Vue component or composable',
    () => {
      const offenders = GAME_FILES.filter(
        (file) =>
          importsFrom(file.text, '@/components/[^\'"]*') ||
          importsFrom(file.text, '@/composables/[^\'"]*') ||
          /\bfrom\s+['"][^'"]*\.vue['"]/.test(file.text),
      ).map((file) => file.fromSrc)

      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )
})
