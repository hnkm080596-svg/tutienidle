/**
 * Binding-wiring guard (sound-system W9 cross-check, SND-A1-06) - the bus
 * event names the audio bindings subscribe to must actually be emitted by
 * real core code, and every literal cue id passed to `.cue()`/`.playCue()`
 * must resolve through the manifest. EventBus is stringly-typed by design,
 * so a typo on either side dead-cues silently: this scan is the only guard.
 *
 * What is checked:
 *  1. Every event name bound in combatAudioBinding's STATIC_CUES /
 *     PAYLOAD_CUES tables appears in an `emit('<name>'` call somewhere
 *     under src/.
 *  2. Every string literal handed to `.cue('...')` / `.playCue('...')`
 *     resolves via resolveAudioCue (exact match or qualifier strip).
 *     Template literals (`combat.cast.${skillId}`) pass when their static
 *     prefix resolves.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { SCAN_TIMEOUT, srcCorpus } from './helpers/scanTs'
import { AUDIO_CUES, resolveAudioCue } from '@/core/audio/AudioCueManifest'

const SRC_DIR = join(process.cwd(), 'src')
const FILES = srcCorpus(SRC_DIR)

// Cheap line-comment strip so `// emit('x'` prose does not count.
function uncommented(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

const EMITTED = new Set<string>()
for (const file of FILES) {
  for (const m of uncommented(file.text).matchAll(/\bemit\s*(?:<[^>]*>)?\(\s*'([a-z_]+)'/g)) {
    EMITTED.add(m[1]!)
  }
}

describe('audio binding wiring', () => {
  it(
    'every event name bound in combatAudioBinding is emitted by real code',
    () => {
      const binding = uncommented(
        readFileSync(join(SRC_DIR, 'presentation/audio/combatAudioBinding.ts'), 'utf8'),
      )
      // Row heads in both tables look like ['event_name', ...] across lines.
      const bound = new Set<string>()
      for (const m of binding.matchAll(/\[\s*'([a-z_]+)'/g)) bound.add(m[1]!)
      const dead = [...bound].filter((name) => !EMITTED.has(name))
      expect(dead).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'every literal cue id passed to .cue()/.playCue() resolves via the manifest',
    () => {
      const CALL = /\.(?:cue|playCue)\(\s*(['"`])((?:(?!\1)[^\\])+)\1/g
      const violations: string[] = []
      for (const file of FILES) {
        // Tests legitimately feed bogus ids - only production files bind.
        if (file.fromSrc.endsWith('.test.ts')) continue
        for (const m of uncommented(file.text).matchAll(CALL)) {
          const literal = m[2]!
          if (literal.includes('${')) {
            const prefix = literal.replace(/\.\$\{[^}]+\}$/, '')
            // The static prefix resolves itself OR covers concrete rows
            // beneath it (`combat.element.${element}` -> combat.element.*).
            const covered = Object.keys(AUDIO_CUES).some((k) => k.startsWith(prefix + '.'))
            if (resolveAudioCue(prefix) === undefined && !covered) {
              violations.push(`${file.fromSrc} -> ${literal}`)
            }
            continue
          }
          if (!literal.includes('.')) continue
          if (resolveAudioCue(literal) === undefined) {
            violations.push(`${file.fromSrc} -> ${literal}`)
          }
        }
      }
      expect(violations).toEqual([])
    },
    SCAN_TIMEOUT,
  )
})
