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

// String-aware comment strip: `// emit('x'` prose and /* ... */ blocks do
// not count, but `//` INSIDE a quoted literal ('a//b') must survive - a
// naive line strip would corrupt the literal being scanned.
function uncommented(text: string): string {
  const noHtml = text.replace(/<!--[\s\S]*?-->/g, '')
  let out = ''
  let i = 0
  let quote: string | null = null
  while (i < noHtml.length) {
    const c = noHtml[i]!
    if (quote !== null) {
      out += c
      if (c === '\\') {
        out += noHtml[i + 1] ?? ''
        i += 2
        continue
      }
      if (c === quote) quote = null
      i++
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      out += c
      i++
      continue
    }
    if (c === '/' && noHtml[i + 1] === '/') {
      while (i < noHtml.length && noHtml[i] !== '\n') i++
      continue
    }
    if (c === '/' && noHtml[i + 1] === '*') {
      const end = noHtml.indexOf('*/', i + 2)
      i = end === -1 ? noHtml.length : end + 2
      continue
    }
    out += c
    i++
  }
  return out
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
      // (cue calls take a single arg; `[^)]*` covers ternary/map-index
      // forms). A bare `cue('id')` (destructured) is covered too: the
      // name may be preceded by start, a non-word char, or the `.`
      // receiver - `xcue(`/`decode(` stay excluded.
      const CALL = /(?:^|[^\w]|\.)(?:cue|playCue)\s*(?:\?\.\s*)?\(([^)]*)\)/g
      // A local declaration `function cue(...)` / `get cue()` is not a
      // store call - skip it so the bare-call arm only fires on real
      // invocations with cue-id literals.
      const DECL_TAIL = /\b(?:function|get|set)\s*$/
      const LOCAL_DECL = /\b(?:function\s+(?:\*\s*)?|(?:const|let|var)\s+)(cue|playCue)\b/g
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
        // Names declared locally in this file (`function cue`, `const cue
        // =`) are not the store seam - bare calls to them are exempt.
        const localNames = new Set<string>()
        for (const d of text.matchAll(LOCAL_DECL)) localNames.add(d[1]!)
        for (const m of text.matchAll(CALL)) {
          // Position of the `cue`/`playCue` name itself (the match may
          // start one char earlier on the permitted prefix).
          const prefixLen = /^(?:[^\w]|\.)/.test(m[0]) ? 1 : 0
          const namePos = (m.index ?? 0) + prefixLen
          if (DECL_TAIL.test(text.slice(Math.max(0, namePos - 40), namePos))) continue
          if (prefixLen === 0 || m[0][0] !== '.') {
            const name = /^playCue/.test(m[0].slice(prefixLen)) ? 'playCue' : 'cue'
            if (localNames.has(name)) continue
          }
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
