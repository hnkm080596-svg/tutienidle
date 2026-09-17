/**
 * Guard (V5) — the Phaser registry is reached only through the typed gate.
 *
 * Spec: docs/superpowers/specs/2026-09-11-frontend-static-dynamic-boundary-design.md
 * §4 and §7.
 *
 * Measured before the gate existed: 22 reads across 8 keys, 11 carrying an
 * `as { … }` cast. A rename on the domain side produced no type error anywhere;
 * it failed at runtime, inside a scene, usually as a silently missing visual.
 * The gate declares each key's type once. This keeps the casts from growing
 * back.
 *
 * What it does NOT police: `registry` is also the name of the CONTENT registry
 * in `src/core/` (`this.registry.get(buffId)`), which is a different object
 * entirely and none of this spec's business. So the guard matches on the gate's
 * own key names rather than on the word "registry" — a narrower rule that
 * cannot produce a false positive on core.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { SCAN_TIMEOUT, srcCorpus } from './helpers/scanTs'

const SRC_DIR = join(process.cwd(), 'src')
const GATE_MODULE = 'presentation/gate/PresentationGate.ts'

/** Keys the gate owns. Kept as literals: the guard must not import app code. */
const GATE_KEYS = [
  'gameManager',
  'eventBus',
  'sceneAdapter',
  'bundleManager',
  'playerVisualProfileId',
  'lastBattlePositionsSnapshot',
  'battlefieldGeometry',
  'kiemBarReader',
  // Audit T7-67 - added 2026-09-16 after drifting (theBarReader shipped in
  // Phap Tu Task 16 without joining this list). When the gate gains a key,
  // add its literal here in the same commit or the guard goes blind to it.
  'theBarReader',
]

const RAW_ACCESS = new RegExp(
  String.raw`\bregistry\s*[?]?\.\s*(?:get|set)\s*\(\s*['"](?:${GATE_KEYS.join('|')})['"]`,
)

const FILES = srcCorpus(SRC_DIR).filter(
  (file) => !file.fromSrc.endsWith('.test.ts') && file.fromSrc !== GATE_MODULE,
)

describe('presentation gate', () => {
  it(
    'the gate module is where the spec puts it',
    () => {
      const found = srcCorpus(SRC_DIR).some((file) => file.fromSrc === GATE_MODULE)

      expect(found).toBe(true)
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
    'no production file reaches a gate key through a raw registry call',
    () => {
      const offenders = FILES.filter((file) => RAW_ACCESS.test(file.text)).map(
        (file) => file.fromSrc,
      )

      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'no production file casts a registry read back to a structural shape',
    () => {
      // The defect the gate replaced, in its exact written form. A cast is how
      // the untyped read used to be made to compile.
      const cast = /\bregistry\s*[?]?\.\s*get\s*\([^)]*\)\s+as\s/

      const offenders = FILES.filter((file) => cast.test(file.text)).map((file) => file.fromSrc)

      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )
})
