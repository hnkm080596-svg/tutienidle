/**
 * Audio seam guards (sound-system W9) - the sound system's load-bearing
 * ownership rules, pinned as code:
 *
 *   1. Core never imports audio. `src/core/**` outside `src/core/audio/`
 *      must not import AudioManager/AudioCueManifest or `tone`: core emits
 *      presentation-observation events only; bindings live in
 *      `src/presentation/audio/`.
 *   2. AudioCueManifest stays data-only. The manifest is the asset-drop
 *      contract - a Tone/Vue/Phaser import would drag synthesis or the UI
 *      stack into a file that must stay loadable by anything.
 *   3. No .vue file imports `tone` directly. Components reach audio through
 *      AudioManager / the audio store; synthesis primitives are an
 *      AudioManager-internal detail.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { readTs, SCAN_TIMEOUT, srcCorpus } from './helpers/scanTs'

const SRC_DIR = join(process.cwd(), 'src')

const IMPORT_RE = /(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,]*?\s+from\s+)?['"]([^'"]+)['"]/g

function importSpecifiers(text: string): string[] {
  const out: string[] = []
  for (const match of text.matchAll(IMPORT_RE)) {
    out.push(match[1]!)
  }
  return out
}

describe('audio boundary', () => {
  it(
    'core outside core/audio never imports audio modules or tone',
    () => {
      const offenders: string[] = []
      for (const file of srcCorpus(SRC_DIR)) {
        if (!file.fromSrc.startsWith('core/')) continue
        if (file.fromSrc.startsWith('core/audio/')) continue
        // Tests may spy on AudioManager to prove a domain event reaches
        // the real consumer - the ban is on production coupling.
        if (file.fromSrc.endsWith('.test.ts')) continue
        for (const spec of importSpecifiers(file.text)) {
          if (spec === 'tone' || spec.startsWith('tone/') || spec.includes('audio/Audio') || spec.includes('/audio/Audio')) {
            offenders.push(`${file.fromSrc} -> ${spec}`)
          }
        }
      }
      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it('AudioCueManifest is data-only (no tone/vue/phaser imports)', () => {
    const text = readTs(join(SRC_DIR, 'core/audio/AudioCueManifest.ts'))
    // `=== x || startsWith(x + '/')` - a `phaser/subpath` or
    // `tone/build/...` import must not slip past an equality check.
    for (const spec of importSpecifiers(text)) {
      for (const banned of ['tone', 'vue', 'phaser']) {
        expect(spec === banned || spec.startsWith(`${banned}/`)).toBe(false)
      }
    }
  })

  it(
    'no .vue file imports tone directly',
    () => {
      const offenders: string[] = []
      for (const file of srcCorpus(SRC_DIR)) {
        if (!file.path.endsWith('.vue')) continue
        for (const spec of importSpecifiers(file.text)) {
          if (spec === 'tone' || spec.startsWith('tone/')) {
            offenders.push(`${file.fromSrc} -> ${spec}`)
          }
        }
      }
      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'direct AudioManager consumers stay inside the documented pinia-free allowlist',
    () => {
      // Spec W7 routes audio through useAudioStore().cue. The only files
      // allowed to touch AudioManager directly are the audio internals, the
      // dom-audio bundle lane, and the pinia-free primitives (GameButton and
      // Chip must mount without an active pinia - see InkWashPrimitives.test).
      const ALLOWLIST = new Set([
        'presentation/assets/AssetBundleManager.ts',
        'components/common/GameButton.vue',
        'components/common/primitives/Chip.vue',
      ])
      const offenders: string[] = []
      for (const file of srcCorpus(SRC_DIR)) {
        if (file.fromSrc.endsWith('.test.ts')) continue
        if (file.fromSrc.startsWith('core/audio/')) continue
        if (file.fromSrc.startsWith('stores/audio')) continue
        if (file.fromSrc.startsWith('presentation/audio/')) continue
        if (!/AudioManager\s*\.\s*getInstance\s*\(|\.\s*playCue\s*\(/.test(file.text)) continue
        if (!ALLOWLIST.has(file.fromSrc)) offenders.push(file.fromSrc)
      }
      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )
})
