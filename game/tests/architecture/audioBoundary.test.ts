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
import { uncommented } from './helpers/commentStrip'

const SRC_DIR = join(process.cwd(), 'src')

const IMPORT_RE = /(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,]*?\s+from\s+)?['"]([^'"]+)['"]/g
// Dynamic/lazy import lanes - `await import('tone')` and `require('tone')`
// bypass the static regex, and a lazy audio stack is the realistic smuggle.
// Comment spans between `(` and the specifier, and backtick specifiers,
// must not slip past the literal-quote extractor either.
const DYNAMIC_IMPORT_RE =
  /(?:import|require)\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\s*)*['"`]([^'"`]+)['"`]\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\s*)*\)/g


function importSpecifiers(text: string, fileName: string): string[] {
  const clean = uncommented(text, fileName)
  const out: string[] = []
  for (const match of clean.matchAll(IMPORT_RE)) {
    out.push(match[1]!)
  }
  for (const match of clean.matchAll(DYNAMIC_IMPORT_RE)) {
    out.push(match[1]!)
  }
  return out
}

// A specifier belongs to the audio subsystem when its path walks through an
// `audio/` directory - matching on the directory (not on an 'Audio' filename
// prefix) keeps a future core/audio/util.ts inside the ban. The `($)` tail
// also catches a directory import (`@/core/audio` resolving to index.ts).
const AUDIO_SPEC_RE = /(^|\/)audio([/?#.]|$)/

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
        for (const spec of importSpecifiers(file.text, file.fromSrc)) {
          // Specifiers containing escapes ('cor\u0065/audio', 't\x6fne')
          // resolve to banned paths at evaluation time while evading the
          // literal match - no legitimate static import needs a backslash.
          if (
            spec.includes('\\') ||
            /^tone([/?#.]|$)/.test(spec) ||
            AUDIO_SPEC_RE.test(spec)
          ) {
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
    for (const spec of importSpecifiers(text, 'core/audio/AudioCueManifest.ts')) {
      for (const banned of ['tone', 'vue', 'phaser']) {
        expect(spec === banned || spec.startsWith(`${banned}/`)).toBe(false)
      }
    }
  })

  it(
    'no file outside core/audio imports tone directly',
    () => {
      // .ts reaches synthesis just as well as .vue - the ban is on the
      // whole non-core/audio tree, not only SFCs.
      const offenders: string[] = []
      for (const file of srcCorpus(SRC_DIR)) {
        if (file.fromSrc.endsWith('.test.ts')) continue
        if (file.fromSrc.startsWith('core/audio/')) continue
        for (const spec of importSpecifiers(file.text, file.fromSrc)) {
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
      // dom-audio bundle lane, the pinia-free primitives (GameButton and
      // Chip must mount without an active pinia - see InkWashPrimitives.test),
      // and App.vue as the composition root for the unlock-gesture listener
      // (onReady disarm must observe the manager, not the store).
      const ALLOWLIST = new Set([
        'presentation/assets/AssetBundleManager.ts',
        'components/common/GameButton.vue',
        'components/common/primitives/Chip.vue',
        'App.vue',
      ])
      const offenders: string[] = []
      for (const file of srcCorpus(SRC_DIR)) {
        if (file.fromSrc.endsWith('.test.ts')) continue
        if (file.fromSrc.startsWith('core/audio/')) continue
        // Exact-file exemption - a startsWith('stores/audio') anchor would
        // silently exempt a future sibling like stores/audioSneak.ts.
        if (file.fromSrc === 'stores/audio.ts') continue
        if (file.fromSrc.startsWith('presentation/audio/')) continue
        // Trigger on ANY AudioManager reach: a direct call, a playCue, or
        // importing the module at all (destructured getInstance or a renamed
        // import would otherwise slip past the call-shape regex). The
        // specifier arm tolerates `.ts`/query suffixes on the module path.
        if (
          !/AudioManager\s*\.\s*getInstance\s*\(|\.\s*playCue\s*\(|['"][^'"]*audio\/AudioManager[^'"]*['"]/.test(
            uncommented(file.text, file.fromSrc),
          )
        ) {
          continue
        }
        if (!ALLOWLIST.has(file.fromSrc)) offenders.push(file.fromSrc)
      }
      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'jsdom tests reaching the real audio path pin visibilityState=visible',
    () => {
      // jsdom defaults document.visibilityState to 'prerender' - the real
      // playCue gate drops every cue there, so a jsdom test exercising the
      // real audio path without the pin passes vacuously. Any jsdom test
      // file referencing AudioManager/playCue must carry the pin.
      const offenders: string[] = []
      for (const file of srcCorpus(SRC_DIR)) {
        if (!file.fromSrc.endsWith('.test.ts')) continue
        if (!file.text.includes('@vitest-environment jsdom')) continue
        if (!/AudioManager|playCue/.test(file.text)) continue
        if (!file.text.includes("visibilityState")) {
          offenders.push(file.fromSrc)
        }
      }
      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )
})
