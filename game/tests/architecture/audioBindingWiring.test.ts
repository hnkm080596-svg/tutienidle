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
import { uncommented } from './helpers/commentStrip'

const SRC_DIR = join(process.cwd(), 'src')
const FILES = srcCorpus(SRC_DIR)


const EMITTED = new Set<string>()
for (const file of FILES) {
  // Test-only emitters must not satisfy a production bound name; Vue
  // component emits (emit('back'), emit('close')...) are UI events, not
  // domain bus events - sweeping them would let a future bound audio
  // event name be falsely satisfied by an unrelated component emit.
  if (file.fromSrc.endsWith('.test.ts') || file.fromSrc.endsWith('.vue')) continue
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
      // A local declaration at line start (`function cue(`, `get cue(`,
      // `set cue(`, optionally `async`) is not a store call - the check
      // must anchor on the declaration line, not just a trailing word:
      // `myMap.set\ncue('x')` must NOT be exempted.
      const LINE_DECL = /^\s*(?:async\s+)?(?:function\s*\*?\s*|get\s+|set\s+)$/
      // Only REAL local functions exempt the bare-call arm: `function cue`
      // / `const cue = (` / `const cue = async` / `const cue = function`.
      // `const cue = useAudioStore().cue` aliases the store seam and its
      // calls must still be checked - a value-side store ref means no
      // exemption.
      const LOCAL_DECL = /\bfunction\s*(?:\*\s*)?(cue|playCue)\b|\b(?:const|let|var)\s+(cue|playCue)\s*=\s*(?:async\b|function\b|\()/g
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
        for (const d of text.matchAll(LOCAL_DECL)) localNames.add(d[1] ?? d[2]!)
        // Destructure aliases (`const { cue: q } = useAudioStore()` then
        // `q('id')`) rename the seam - collect them and check their calls
        // through the same literal resolution pipeline.
        const aliases: string[] = []
        for (const dm of text.matchAll(/\bconst\s*\{[^}]*\}/g)) {
          for (const am of dm[0].matchAll(/\b(?:cue|playCue)\s*:\s*([A-Za-z_]\w*)/g)) {
            aliases.push(am[1]!)
          }
        }
        const callRe =
          aliases.length === 0
            ? CALL
            : new RegExp(
                `(?:^|[^\\w]|\\.)(?:cue|playCue|${aliases.join('|')})\\s*(?:\\?\\.\\s*)?\\(([^)]*)\\)`,
                'g',
              )
        for (const m of text.matchAll(callRe)) {
          // Position of the callee name itself (the match may start one
          // char earlier on the permitted prefix).
          const prefixLen = /^(?:[^\w]|\.)/.test(m[0]) ? 1 : 0
          const namePos = (m.index ?? 0) + prefixLen
          // Declaration shapes at line start (`function cue(`, `get cue(`,
          // `set cue(`) are not calls - anchor on the LINE before the
          // name, not a trailing-word lookback (which suppressed real
          // calls after `myMap.set`-style lines).
          const lineStart = text.lastIndexOf('\n', namePos) + 1
          const beforeOnLine = text.slice(lineStart, namePos)
          if (LINE_DECL.test(beforeOnLine)) continue
          // Method shorthand `cue(id: string) {` (stores/audio.ts) is a
          // declaration, not a call: line-start name + args closed by
          // `{`/`:` immediately after `)`. A mid-line `? cue(x) : y`
          // keeps `x ?` before it on the line, so ternaries stay scanned.
          const afterCall = text.slice((m.index ?? 0) + m[0].length)
          if (/^\s*$/.test(beforeOnLine) && /^\s*[:{]/.test(afterCall)) continue
          if (prefixLen === 0 || m[0][0] !== '.') {
            const callee = /^[A-Za-z_]\w*/.exec(m[0].slice(prefixLen))![0]
            if (localNames.has(callee)) continue
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
          // The literal arms must LOOK AHEAD on the opening quote -
          // consuming it would leave `tail` inside the string and
          // LITERAL.exec would never see the bound value (dead branch).
          // The map/array arm consumes `{`/`[` on purpose (obj sweep).
          const decl = `\\b${ident}\\s*(?::[^=\\n]+)?=\\s*(?:(?=['"\`])|[\\[{])|\\b${ident}\\s*:\\s*(?=['"\`])`
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
              if (first && first.index < 8) {
                checkLiteral(violations, file.fromSrc, first[2]!)
                // Concat initializers (`const X = 'a' + 'bogus.id'`)
                // bind more than the first literal - sweep the rest of
                // the statement when a `+` connector follows.
                const stmtEnd = tail.search(/[;\n]/)
                const stmt = stmtEnd === -1 ? tail : tail.slice(0, stmtEnd)
                if (/\+/.test(stmt)) {
                  for (const lit of stmt.matchAll(LITERAL)) {
                    if (lit.index === first.index) continue
                    checkLiteral(violations, file.fromSrc, lit[2]!)
                  }
                }
              }
            }
          }
        }
      }
      expect(violations).toEqual([])
    },
    SCAN_TIMEOUT,
  )
})
