/**
 * Guard (V4) — a Phaser.Game is constructed in exactly one place.
 *
 * Spec: docs/superpowers/specs/2026-09-11-frontend-static-dynamic-boundary-design.md
 * §5 and §7.
 *
 * Two shells used to hand-roll construction, dynamic import, resize
 * observation, teardown and error handling, in two different bodies of code.
 * Neither was wrong — but under §2 a static shell hosting a dynamic region is
 * the STANDARD composition, so region three and region four would each have
 * been another copy, and Mission 0 §13 warns that reusing a renderer does not
 * make a hosting lifecycle correct.
 *
 * Scope limit: source-shaped. A construction through an aliased constructor
 * (`const G = Phaser.Game; new G(...)`) would slip past it.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { SCAN_TIMEOUT, srcCorpus } from './helpers/scanTs'

const SRC_DIR = join(process.cwd(), 'src')
const HOST_MODULE = 'presentation/host/useDynamicRegion.ts'

const CONSTRUCTS_GAME = /\bnew\s+(?:\w+\s*\.\s*)?Game\s*\(/

/**
 * Comments removed. Both shells
 * TALK about `new Phaser.Game()` in their comments — PhaserCanvas.vue and
 * AssetLoaderScene.ts each describe the bootstrap they take part in — and a
 * guard that cannot tell prose from code reports the wrong two files and
 * teaches everyone to ignore it. String literals are deliberately KEPT: the
 * import-path check below reads them, and stripping them made that check
 * silently unfalsifiable — caught by probing it.
 */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

const FILES = srcCorpus(SRC_DIR).filter((file) => !file.fromSrc.endsWith('.test.ts'))

describe('dynamic region host', () => {
  it(
    'the host composable is where the spec puts it',
    () => {
      expect(FILES.some((file) => file.fromSrc === HOST_MODULE)).toBe(true)
    },
    SCAN_TIMEOUT,
  )

  it(
    'has files to police — a guard over an empty corpus proves nothing',
    () => {
      expect(FILES.length).toBeGreaterThan(100)
    },
    SCAN_TIMEOUT,
  )

  it(
    'nothing outside the host constructs a Phaser.Game',
    () => {
      const offenders = FILES.filter(
        (file) => file.fromSrc !== HOST_MODULE && CONSTRUCTS_GAME.test(code(file.text)),
      ).map((file) => file.fromSrc)

      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'no shell holds a scene instance from src/game/',
    () => {
      // V10. A shell holding a scene can call every public method on it and
      // nobody reviews which it chose; a shell holding a DynamicRegion can send
      // the events `contracts/regionEvents.ts` names. Type-only imports count:
      // a shell that needs the scene's TYPE is holding the scene.
      const shells = FILES.filter(
        (file) => file.fromSrc.startsWith('components/') || file.fromSrc.startsWith('composables/'),
      )

      const holdsScene = /\bfrom\s+['"]@\/game\/scenes\/[^'"]*['"]/

      const offenders = shells
        .filter((file) => holdsScene.test(code(file.text)))
        .filter((file) => !/\bimport\s*\(\s*['"]@\/game\/scenes\//.test(file.text))
        .map((file) => file.fromSrc)

      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )
})
