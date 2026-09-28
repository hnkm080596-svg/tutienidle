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
  for (const m of uncommented(file.text, file.fromSrc).matchAll(/\bemit\s*(?:<[^>]*>)?\(\s*['"`]([a-z_0-9]+)['"`]/g)) {
    EMITTED.add(m[1]!)
  }
}

describe('audio binding wiring', () => {
  it(
    'every event name bound in combatAudioBinding is emitted by real code',
    () => {
      const binding = uncommented(
        readFileSync(join(SRC_DIR, 'presentation/audio/combatAudioBinding.ts'), 'utf8'),
        'presentation/audio/combatAudioBinding.ts',
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
      const CALL =
        /(?:^|[^\w]|\.)(?:cue|playCue)\s*!?\s*(?:<(?:[^<>\n]|<[^<>\n]*>)*>)?\s*!?\s*(?:\?\.\s*)?\(([^)]*)\)/g
      // A local declaration at line start (`function cue(`, `get cue(`,
      // `set cue(`, optionally `async`) is not a store call - the check
      // must anchor on the declaration line, not just a trailing word:
      // `myMap.set\ncue('x')` must NOT be exempted.
      // Two declaration shapes at line start: (a) keyword decls
      // (`function cue(`, `async function cue(`, `get cue(`, `set cue(`)
      // and (b) modifier runs preceding a method name (`static cue(`,
      // `public async cue(`) - in (b) the callee itself is the method
      // name so the line text before it is modifiers only.
      const MODIFIER = '(?:public|private|protected|static|abstract|override|async|readonly)'
      const LINE_DECL = new RegExp(
        `^\\s*(?:(?:${MODIFIER}\\s+)*(?:function\\s*\\*?\\s*|get\\s+|set\\s+)|(?:${MODIFIER}\\s+)+)$`,
      )
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
        // For .vue, sweep template text too: event handlers like
        // @click="cue('x')" are real call sites (none in-tree today -
        // enforced anyway so a future template call cannot escape).
        const templateText = file.fromSrc.endsWith('.vue')
          ? file.text
              .replace(/<script[\s\S]*?<\/script>/gi, '')
              .replace(/<!--[\s\S]*?-->/g, '')
          : ''
        const text = uncommented(file.text, file.fromSrc) + '\n' + templateText
        // Names declared locally in this file (`function cue`, `const cue
        // =`) are not the store seam - bare calls to them are exempt.
        const localNames = new Set<string>()
        for (const d of text.matchAll(LOCAL_DECL)) localNames.add(d[1] ?? d[2]!)
        // Destructure aliases (`const { cue: q } = useAudioStore()` then
        // `q('id')`) rename the seam - collect them and check their calls
        // through the same literal resolution pipeline.
        const aliases: string[] = []
        for (const dm of text.matchAll(/\b(?:const|let|var)\s*\{[^}]*\}/g)) {
          for (const am of dm[0].matchAll(/\b(?:cue|playCue)\s*:\s*([A-Za-z_]\w*)/g)) {
            aliases.push(am[1]!)
          }
        }
        // `import { cue as q }` from the store module renames the seam
        // without a destructure - collect those aliases too.
        for (const am of text.matchAll(/\b(?:cue|playCue)\s+as\s+([A-Za-z_]\w*)/g)) {
          aliases.push(am[1]!)
        }
        const callRe =
          aliases.length === 0
            ? CALL
            : new RegExp(
                `(?:^|[^\\w]|\\.)(?:cue|playCue|${aliases.join('|')})(?:<(?:[^<>\\n]|<[^<>\\n]*>)*>)?\\s*!?\\s*(?:\\?\\.\\s*)?\\(([^)]*)\\)`,
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
          // `{`/`:` on the SAME line right after `)`. Allowing \n here
          // let `cue('bogus')\n{...}` skip the check as a fake shorthand.
          const afterCall = text.slice((m.index ?? 0) + m[0].length)
          if (/^\s*$/.test(beforeOnLine) && /^[ \t]*[:{]/.test(afterCall)) continue
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
          const decl = `\\b${ident}\\s*(?::[^=\\n]+)?=\\s*(?:\\(\\s*)?(?:(?=['"\`])|[\\[{])|\\b${ident}\\s*:\\s*(?=['"\`])`
          for (const dm of text.matchAll(new RegExp(decl, 'g'))) {
            const tail = text.slice(dm.index! + dm[0].length)
            // If the declaration ended on `{` it opened a flat
            // `{k: 'lit', k2: 'lit2'}` map - sweep its string values.
            // Otherwise the declaration is `NAME = 'lit'` and only the
            // FIRST literal is the bound value; sweeping further would
            // flag unrelated literals that merely follow the declaration.
            const arr = dm[0].endsWith('[') ? tail.match(/^[^\]]*\]/) : null
            const obj = dm[0].endsWith('{') ? tail.match(/^[^}]*\}/) : null
            if (arr) {
              for (const lit of arr[0].matchAll(LITERAL)) {
                checkLiteral(violations, file.fromSrc, lit[2]!)
              }
            } else if (obj) {
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
                // Walk 'lit' + 'lit' + ... chains across line breaks:
                // after each literal, if the next token is +, the next
                // literal also binds. Stops before unrelated statements.
                let cursor = first.index + first[0].length
                for (;;) {
                  const plus = /^\s*\+\s*/.exec(tail.slice(cursor))
                  if (!plus) break
                  cursor += plus[0].length
                  const nxt = /^(['"`])([^'"`\n]*)\1/.exec(tail.slice(cursor))
                  if (!nxt) break
                  checkLiteral(violations, file.fromSrc, nxt[2]!)
                  cursor += nxt[0].length
                }
              }
            }
          }
        }
        // `.cue`/`.playCue` on an audio-seam receiver referenced as a
        // VALUE (callback passing like arr.forEach(store.cue), alias
        // RHS) is not a call shape and would escape CALL entirely - flag
        // it. Receiver names are restricted to audio-seam idiom so the
        // VFX domain's own `cue` property (SkillCue) is not flagged.
        for (const vm of text.matchAll(
          /\b(?:audioStore|store|audioMgr|audioManager|audio|am)\s*\.\s*(cue|playCue)\b(?!\s*!?\s*(?:<[^>\n]*>)?\s*!?\s*(?:\?\.\s*)?\()/g,
        )) {
          violations.push(`${file.fromSrc} -> value-ref .${vm[1]} at offset ${vm.index}`)
        }
        // Indirect invocation escapes the dotted value-ref arm:
        // `store['cue'](x)`, `store.cue.call(this, x)`, `.apply`, `.bind`.
        // Bracket access is never idiomatic here, so it flags outright.
        for (const vm of text.matchAll(
          /\b(?:audioStore|store|audioMgr|audioManager|audio|am)\s*(?:\[\s*['"](?:cue|playCue)['"]\s*\]|\.\s*(?:cue|playCue)\s*\.\s*(?:call|apply|bind)\s*\()/g,
        )) {
          violations.push(`${file.fromSrc} -> indirect ${vm[0]} at offset ${vm.index}`)
        }
        // `store.cu\u0065(...)` spells the seam through a unicode escape -
        // flag escapes embedded in identifier-ish text. (A `\uXXXX` inside
        // a plain string literal is not matched because a word char must
        // sit immediately before the backslash.)
        for (const vm of text.matchAll(/[A-Za-z_$]\\u[0-9a-fA-F]{4}/g)) {
          violations.push(`${file.fromSrc} -> ident escape ${vm[0]} at offset ${vm.index}`)
        }
      }
      expect(violations).toEqual([])
    },
    SCAN_TIMEOUT,
  )
})
