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
 *   - `commandWheelCatalog.ts` (then in `src/game/support/`, now in
 *     `src/data/ui/`) imported two panel-id types from '@/stores/ui'
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
      // The MIRROR of the rule above, and §10.5a of the spec: "No Vue file
      // imports from src/game/". It is now ZERO, having started at nine
      // modules, each given a home that matches what it is:
      //
      //   art descriptors with NO src/game/ consumer at all
      //     DongFuArt, DongFuBuildingArt, DongFuStackLoader
      //       -> presentation/background/
      //   static-only UI data
      //     commandWheelCatalog, commandWheelOrbit -> data/ui/
      //   vocabulary both layers name
      //     SlotState -> presentation/contracts/
      //   a DOM<->canvas size bridge, as its own header already called it
      //     combatInsets -> presentation/geometry/
      //   a reader the shell registers and the scene polls each frame
      //     kiemBarBridge -> presentation/bridges/
      //   the player art contract, read by five scenes and by the gate
      //     PlayerVisualProfiles -> presentation/art/
      //   the backdrop art: which variant is showing and which files it is
      //   made of, SPLIT from the Phaser depth table and tint that stay behind
      //     ThanhVanArt -> presentation/background/ThanhVanBackdropArt.ts
      //
      // Empty is the whole point, and it is not a vacuous assertion: the probe
      // for this test is a component importing anything at all from src/game/,
      // and it goes red. `src/game/` re-exports the moved halves, so a file
      // that reaches for the old path still fails here rather than silently
      // working.
      const RECORDED: string[] = []

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
