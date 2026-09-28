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

// Cheap comment strip so `// emit('x'` prose and /* ... */ blocks do not count.
function uncommented(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

const EMITTED = new Set<string>()
for (const file of FILES) {
  // Test-only emitters must not satisfy a production bound name.
  if (file.fromSrc.endsWith('.test.ts')) continue
  for (const m of uncommented(file.text).matchAll(/\bemit\s*(?:<[^>]*>)?\(\s*['"`]([a-z_0-9]+)['"`]/g)) {
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
      for (const m of binding.matchAll(/\[\s*['"`]([a-z_0-9]+)['"`]/g)) bound.add(m[1]!)
      // Direct subscriptions outside the tables (e.g. the route-gated
      // farm_cycle row) must satisfy the same emitted-by-real-code rule.
      for (const m of binding.matchAll(/\bon\s*\(\s*['"`]([a-z_0-9]+)['"`]/g)) bound.add(m[1]!)
      const dead = [...bound].filter((name) => !EMITTED.has(name))
      expect(dead).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'every literal cue id passed to .cue()/.playCue() resolves via the manifest',
    () => {
      const LITERAL = /(['"`])((?:(?!\1)[^\\])+)\1/g
      // `.cue(` / `.playCue(` call, arguments up to the closing paren
      // (cue calls take a single arg; `[^)]*` covers ternary/map-index forms).
      const CALL = /\.(?:cue|playCue)\(([^)]*)\)/g
      const checkLiteral = (violations: string[], fromSrc: string, literal: string): void => {
        if (literal.includes('${')) {
          const prefix = literal.replace(/\.\$\{[^}]+\}$/, '')
          // The static prefix resolves itself OR covers concrete rows
          // beneath it (`combat.element.${element}` -> combat.element.*).
          const covered = Object.keys(AUDIO_CUES).some((k) => k.startsWith(prefix + '.'))
          if (resolveAudioCue(prefix) === undefined && !covered) {
            violations.push(`${fromSrc} -> ${literal}`)
          }
          return
        }
        if (!literal.includes('.')) return
        if (resolveAudioCue(literal) === undefined) {
          violations.push(`${fromSrc} -> ${literal}`)
        }
      }
      const violations: string[] = []
      for (const file of FILES) {
        // Tests legitimately feed bogus ids - only production files bind.
        if (file.fromSrc.endsWith('.test.ts')) continue
        const text = uncommented(file.text)
        for (const m of text.matchAll(CALL)) {
          const argText = m[1]!
          for (const lit of argText.matchAll(LITERAL)) {
            checkLiteral(violations, file.fromSrc, lit[2]!)
          }
          // Identifier/expression args (`cue(KIND_SOUND[kind])`,
          // `cue(cueId)`): resolve the name to literals in the same file -
          // `NAME = 'lit'`, `NAME: 'lit'`, flat map values `NAME = {k: 'lit'}`,
          // and parameter defaults `NAME = 'lit'`.
          const identMatch = argText.match(/^\s*([A-Za-z_]\w*)/)
          if (!identMatch) continue
          const ident = identMatch[1]!
          const decl = `\\b${ident}\\s*(?::[^=\\n]+)?=\\s*(?:['"\`]|[\\[{])|\\b${ident}\\s*:\\s*['"\`]`
          for (const dm of text.matchAll(new RegExp(decl, 'g'))) {
            const tail = text.slice(dm.index! + dm[0].length)
            // If the declaration ended on `{` it opened a flat
            // `{k: 'lit', k2: 'lit2'}` map - sweep its string values.
            // Otherwise the declaration is `NAME = 'lit'` and only the
            // FIRST literal is the bound value; sweeping further would
            // flag unrelated literals that merely follow the declaration.
            const obj = dm[0].endsWith('{') ? tail.match(/^[^}]*\}/) : null
            if (obj) {
              for (const lit of obj[0].matchAll(LITERAL)) {
                checkLiteral(violations, file.fromSrc, lit[2]!)
              }
            } else {
              const first = LITERAL.exec(tail)
              LITERAL.lastIndex = 0
              if (first && first.index < 8) checkLiteral(violations, file.fromSrc, first[2]!)
            }
          }
        }
      }
      expect(violations).toEqual([])
    },
    SCAN_TIMEOUT,
  )
})
