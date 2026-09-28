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
import { SCAN_TIMEOUT, srcCorpus, isTestFile } from './helpers/scanTs'
import { AUDIO_CUES, resolveAudioCue } from '@/core/audio/AudioCueManifest'
import { scriptBlockSpansOf, markupCommentRanges, literalRanges, uncommented, usesJsxBlocks } from './helpers/commentStrip'

const SRC_DIR = join(process.cwd(), 'src')
const FILES = srcCorpus(SRC_DIR)
const NONLITERAL_EMITS: string[] = []


const EMITTED = new Set<string>()
for (const file of FILES) {
  // Test-only emitters must not satisfy a production bound name; Vue
  // component emits (emit('back'), emit('close')...) are UI events, not
  // domain bus events - sweeping them would let a future bound audio
  // event name be falsely satisfied by an unrelated component emit.
  if (isTestFile(file.fromSrc) || file.fromSrc.endsWith('.vue')) continue
  const cleanText = uncommented(file.text, file.fromSrc)
  // `emit('x')` inside a string/template literal is data, not a real
  // emit - line-local quote parity cannot see multi-line literals, so
  // matches inside literal spans are dropped.
  const lits = literalRanges(cleanText, file.fromSrc)
  const inLit = (i: number) => lits.some((r) => i >= r.pos && i < r.end)
  // A COMPUTED emit name at the call site - `emit(`x${y}`)` or
  // `emit('a' + 'b')` - can satisfy-or-skip a bound event name
  // invisibly: producers must emit bound names literally so the
  // bound-vs-emitted cross-check stays sound. Forwarded names
  // (`emit(entry.event, payload)`) and non-bus emits
  // (`this.emit(target, reason, ...)`) share the `emit(ident)` shape
  // with smuggling and cannot be told apart statically, so only the
  // computable-at-call-site shapes are flagged. (W11 latent arm.)
  // Files declaring `emit` as a callback/method signature
  // (`emit: (issue: string) => void`, `emit(target: CombatEntity...)`)
  // use a local emitter, not the bus - skip them entirely.
  const declaresLocalEmit = /\bemit\s*:\s*\([^)]*\)\s*=>|\bemit\s*\(\s*[\w$]+\s*:/.test(cleanText)
  // The local-emitter exemption applies PER CALLEE, not file-wide: a
  // bare `emit(` may be the local callback when a file declares one, but
  // a receiver-qualified `bus.emit(...)` is unambiguously the bus and is
  // always arm-checked (one `emit(reason: ...)` signature must not
  // silence every emit in an emit-heavy file).
  // Receiver-qualified `bus.emit`/`bus?.emit` is never exempt. Whitespace
  // inside the member access (`bus. emit`, `bus?. emit`) is legal JS - the
  // lookback must skip it, not inspect the single previous char.
  const emitExempt = (i: number) =>
    declaresLocalEmit && !/(?:\?\s*)?\.\s*$/.test(cleanText.slice(0, i))
  // `emit(('name'))` paren-wraps the literal - the `\(*` run peels the
  // wrap so the bound name still registers. The local-emitter exemption
  // applies here too: a literal emitted on a non-bus local emitter never
  // reaches the bus, so it must not satisfy the bound-name check.
  for (const m of cleanText.matchAll(/\bemit\s*(?:<[\s\S]{0,2000}?>)?\(\s*\(*\s*['"`]([a-z_0-9]+)['"`]/g)) {
    if (emitExempt(m.index ?? 0)) continue
    if (inLit(m.index ?? 0)) continue
    EMITTED.add(m[1]!)
  }
  {
    // `emit(('a' + 'b'))` paren-wraps the first literal - the `\(*` run
    // after the call paren reaches through the wrap.
    for (const m of cleanText.matchAll(/\bemit\s*(?:<[\s\S]{0,2000}?>)?\(\s*\(*\s*(?:`[^`]*\$\{|['"`][^'"`\n]*['"`]\s*\+)/g)) {
      if (emitExempt(m.index ?? 0)) continue
      if (inLit(m.index ?? 0)) continue
      NONLITERAL_EMITS.push(`${file.fromSrc} -> ${m[0]}`)
    }
    // Call-led head args: `emit(fn() + 'x')` continues a computed name
    // past the call; `emit(f(...), payload)` puts a computed value in
    // name position (arg 0 of a multi-arg emit). A SINGLE-arg pure call
    // `emit(payloadFactory(...))` is the payload-object emit convention
    // - indistinguishable from a name-producing call statically - so it
    // is carved out like `emit(name)`. Anything ELSE continuing the
    // expression after the head call's `)` is a computed name: `+`, `.`,
    // `as`, `??`, `?.`, `!`, a real second arg, ... Scanner-side regexes
    // cannot see past `)`, so this arm walks the balanced call itself.
    // `new X(...)` heads also produce a value: allow an optional `new`
    // before the callee ident so `emit(new Cue(), payload)` is flagged.
    for (const m of cleanText.matchAll(/\bemit\s*(?:<[\s\S]{0,2000}?>)?\(\s*\(*\s*(?:new\s+)?[\w$]+(?:\.[\w$]+)*\s*\(/g)) {
      if (emitExempt(m.index ?? 0)) continue
      if (inLit(m.index ?? 0)) continue
      // m ends at the callee's `(`. Skip it balanced.
      let depth = 0
      let i = (m.index ?? 0) + m[0].length - 1
      for (; i < cleanText.length; i++) {
        const c = cleanText[i]!
        if (inLit(i)) continue
        if (c === '(') depth++
        else if (c === ')') {
          depth--
          if (depth === 0) break
        }
      }
      if (depth !== 0) continue
      let j = i + 1
      while (j < cleanText.length && /\s/.test(cleanText[j]!)) j++
      // `)` may close EMIT's paren (payload emit) or a paren-wrap
      // around the call (`emit((f()), payload)`) - peel consecutive
      // `)` and keep peeking; a `,`/operator after the wrap means the
      // call sits in name position. Accepted residual: a sequence-
      // expression wrap `emit((f(), 'name'))` ends at `)` and reads
      // as the payload lane.
      while (cleanText[j] === ')') {
        j++
        while (j < cleanText.length && /\s/.test(cleanText[j]!)) j++
        if (
          cleanText[j] === undefined ||
          cleanText[j] === ')' ||
          cleanText[j] === ';' ||
          cleanText[j] === '}'
        ) {
          break
        }
        if (cleanText[j] !== ')') break
      }
      if (
        cleanText[j] === undefined ||
        cleanText[j] === ')' ||
        cleanText[j] === ';' ||
        cleanText[j] === '}'
      ) {
        continue // single-arg payload emit (possibly paren-wrapped)
      }
      if (cleanText[j] === ',') {
        // `emit(f(...),\n)` carries a trailing comma - it is still a
        // single-arg payload emit; only a comma followed by a real
        // second argument puts the call in name position.
        let k = j + 1
        while (k < cleanText.length && /\s/.test(cleanText[k]!)) k++
        if (cleanText[k] === ')') continue
      }
      NONLITERAL_EMITS.push(`${file.fromSrc} -> emit(${m[0].slice(0, 40)}...) (computed head arg)`)
    }
    // Ident/member-led concat: `emit(x + 'y')`, `emit(obj.k + 'y')` -
    // the head ident is not followed by `(` so the call arm never sees
    // it; the `+` directly after the value is the marker.
    for (const m of cleanText.matchAll(/\bemit\s*(?:<[\s\S]{0,2000}?>)?\(\s*\(*\s*[\w$]+(?:\.[\w$]+)*\s*\+/g)) {
      if (emitExempt(m.index ?? 0)) continue
      if (inLit(m.index ?? 0)) continue
      NONLITERAL_EMITS.push(`${file.fromSrc} -> ${m[0]} (computed head arg)`)
    }
    // Bracket-member emit `bus['emit'](...)` - the `emit` inside a string
    // literal never satisfies `emit\s*\(`, and a receiver-qualified call
    // is never exempt. Mirror of the `['cue'](` receiver arm.
    for (const m of cleanText.matchAll(/\[\s*['"]emit['"]\s*\]\s*\(/g)) {
      NONLITERAL_EMITS.push(`${file.fromSrc} -> ${m[0]} (bracket-member emit)`)
    }
    // Object-payload emits name the event via `emit({type: 'x'})` - flag
    // only a computed `type` (`[expr]` key or non-literal value).
    for (const m of cleanText.matchAll(/\bemit\s*(?:<[\s\S]{0,2000}?>)?\(\s*\(*\s*\{\s*(?:\[\s*[^\]]+\]|type\s*:\s*[^\s,'"`)}\n]+)/g)) {
      if (emitExempt(m.index ?? 0)) continue
      if (inLit(m.index ?? 0)) continue
      NONLITERAL_EMITS.push(`${file.fromSrc} -> ${m[0]} (computed event key)`)
    }
  }
}

/** Template markup minus live script blocks and HTML comments: spans
 *  come from the skeleton's live-parse (`scriptBlockSpansOf`), so an
 *  unbalanced nested `<script>` cannot swallow the template tail the
 *  way a `<script>...</script>` regex strip does. */
function scriptlessTemplateText(text: string): string {
  const chars = text.split('')
  for (const sp of scriptBlockSpansOf(text)) {
    for (let i = sp.pos; i < sp.end && i < chars.length; i++) chars[i] = ' '
  }
  // Comment masking comes from the walk, not a naive `<!--...-->` regex:
  // an `<!--` inside a quoted attribute is attr text, not a comment open.
  for (const cr of markupCommentRanges(text)) {
    for (let i = cr.pos; i < cr.end && i < chars.length; i++) chars[i] = ' '
  }
  return chars.join('')
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
    'event producers emit bound names literally',
    () => {
      expect(NONLITERAL_EMITS).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'cue-id literals in binding tables are exact manifest members',
    () => {
      // Binding tables hand cue ids back as VALUES (=> 'combat.hit',
      // cueId: 'x', map values) - they never pass through the .cue(
      // call-site arm, and resolveAudioCue's qualifier-strip fallback
      // can silently accept a typo'd id as a wrong-but-valid row. Sweep
      // the cue-bearing files for dotted literals and require exact
      // manifest membership. AudioCueId is `string` (not a keyof union),
      // so the type system cannot carry this check.
      // Sweep the cue-bearing surface, not a fixed file list: a fifth
      // binding module under presentation/audio or a cue literal in a
      // store must not escape the membership pin.
      const bindingFiles = srcCorpus(SRC_DIR).filter(
        (f) =>
          !isTestFile(f.fromSrc) &&
          (f.fromSrc.startsWith('presentation/audio/') ||
            f.fromSrc.startsWith('stores/')),
      )
      // Domain-scoped cue shape: a dotted literal whose first segment is a
      // manifest domain is cue-positioned; plain dotted literals (storage
      // keys like `tutienidle.audio.v2`, i18n keys) are not cue ids.
      const cueDomains = new Set(
        Object.keys(AUDIO_CUES).map((k) => k.split('.')[0]!),
      )
      const bad: string[] = []
      for (const f of bindingFiles) {
        const text = uncommented(f.text, f.fromSrc)
        for (const r of literalRanges(text, f.fromSrc)) {
          const lit = text.slice(r.pos + 1, r.end - 1)
          if (!/^[a-z_0-9]+(\.[a-z_0-9]+)+$/.test(lit)) continue
          if (!cueDomains.has(lit.split('.')[0]!)) continue
          if (!(lit in AUDIO_CUES)) bad.push(`${f.fromSrc} -> ${lit}`)
        }
      }
      expect(bad).toEqual([])
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
      // The generic-args group is lazy so generics carrying parens
      // (`cue<F<() => R>>`) still reach the `(`.
      // Quote chars are allowed prefixes here (literal interiors are
      // filtered by literalRanges below) so a template attribute like
      // @click="cue('x')" still matches.
      const CALL =
        /(?:^|[^\w])(?:cue|playCue)\s*!?\s*(?:<[\s\S]{0,2000}?>)?\s*!?\s*(?:\?\.\s*)?\(([^)]*)\)/g
      // A local declaration at line start (`function cue(`, `get cue(`,
      // `set cue(`, optionally `async`) is not a store call - the check
      // must anchor on the declaration line, not just a trailing word:
      // `myMap.set\ncue('x')` must NOT be exempted.
      // Two declaration shapes at line start: (a) keyword decls
      // (`function cue(`, `async function cue(`, `get cue(`, `set cue(`)
      // and (b) modifier runs preceding a method name (`static cue(`,
      // `public async cue(`) - in (b) the callee itself is the method
      // name so the line text before it is modifiers only.
      const MODIFIER = '(?:public|private|protected|static|abstract|override|async|readonly|export|declare|default)'
      const LINE_DECL = new RegExp(
        `(?:^|[{;])\\s*(?:(?:${MODIFIER}\\s+)*(?:function\\s*\\*?\\s*|get\\s+|set\\s+)|(?:${MODIFIER}\\s+)+)$`,
      )
      // Only REAL local functions exempt the bare-call arm: `function cue`
      // / `const cue = (` / `const cue = async` / `const cue = function`.
      // `const cue = useAudioStore().cue` aliases the store seam and its
      // calls must still be checked - a value-side store ref means no
      // exemption.
      const LOCAL_DECL = /\bfunction\s*(?:\*\s*)?(cue|playCue)\b|\b(?:const|let|var)\s+(cue|playCue)\s*=\s*(?:async\b|function\b|\()/g
      const checkLiteral = (violations: Set<string>, fromSrc: string, literal: string): void => {
        if (literal.includes('${')) {
          const prefix = literal.replace(/\.\$\{[^}]+\}$/, '')
          // The static prefix resolves itself OR covers concrete rows
          // beneath it (`combat.element.${element}` -> combat.element.*).
          const covered = Object.keys(AUDIO_CUES).some((k) => k.startsWith(prefix + '.'))
          if (resolveAudioCue(prefix) === undefined && !covered) {
            violations.add(`${fromSrc} -> ${literal}`)
          }
          return
        }
        // Undotted literals are never manifest ids either - `cue('bogus')`
        // must flag just like `cue('bogus.id')`.
        if (resolveAudioCue(literal) === undefined) {
          violations.add(`${fromSrc} -> ${literal}`)
        }
      }
      const violations = new Set<string>()
      for (const file of FILES) {
        // Tests legitimately feed bogus ids - only production files bind.
        if (isTestFile(file.fromSrc)) continue
        // For .vue, sweep template text too: event handlers like
        // @click="cue('x')" are real call sites (none in-tree today -
        // enforced anyway so a future template call cannot escape).
        // For .vue, sweep event-handler and bound-attribute VALUES too:
        // `@click="cue('x')"` / `:x="cue('y')"` compile to real call
        // sites. Literal attrs (`title="cue('x')"`) are inert text, not
        // expressions - restricting the sweep to handler/bound attrs
        // keeps them from producing false violations.
        const templateText = file.fromSrc.endsWith('.vue')
          ? [
              // Event-handler and bound-attribute VALUES (`@click=",
              // `v-on:x=`, `v-bind:x=`, `:x=`) compile to real call sites;
              // literal attrs (`title="...")` are inert text, not
              // expressions. Bare `v-on=`/`v-bind=` object-syntax values
              // (`v-on="{click: () => cue('x')}"`) and {{ ... }}
              // interpolation bodies are executable too - sweep all of
              // them (reported W12: prefixed-only miss). EVERY directive
              // value compiles to an expression: `v-if`/`v-show`/`v-for`/
              // `v-html`/`v-text`/`v-slot`/`v-memo` run exactly like
              // `@click`/`:x` - restricting to on/bind leaves them out.
              ...scriptlessTemplateText(file.text)
                .matchAll(
                  /(?:@|#|:|v-[\w.-]*:)[\w.\[\]:#-]*\s*=\s*(['"])((?:(?!\1)[\s\S])*)\1|\bv-[\w.-]+\s*=\s*(['"])((?:(?!\3)[\s\S])*)\3|\{\{([\s\S]*?)\}\}/g,
                ),
            ]
              .map((m) => m[2] ?? m[4] ?? m[5]!)
              .join('\n')
          : ''
        const scriptText = uncommented(file.text, file.fromSrc)
        const text = scriptText + '\n' + templateText
        // Literal spans (strings, template text, regexes) - a match
        // sitting inside one is data, not code. Covers multi-line
        // literals where line-local parity desyncs. Computed over the
        // SCRIPT only: Vue template attribute text is real code, not a
        // TS literal, and must not be filtered out.
        // tsx .vue blocks must scan under the JSX variant - `.vue` maps
        // to Standard TS, which mis-lexes JsxText quotes into phantom
        // strings (a `'` inside <div>don't</div> hides real calls).
        const lits = literalRanges(scriptText, file.fromSrc, usesJsxBlocks(file.text, file.fromSrc))
        const inLit = (i: number) => lits.some((r) => i >= r.pos && i < r.end)
        // Literal-blanked copy for brace-balance walks - a `{`/`}` inside
        // a string default (`{a = '{', cue}`) miscounts the depth.
        const noLitChars = text.split('')
        for (const r of lits) {
          for (let i = r.pos; i < r.end && i < noLitChars.length; i++) {
            noLitChars[i] = ' '
          }
        }
        const noLit = noLitChars.join('')
        // Imported local names: `import { importedCueId } from ...` -
        // an imported ident fed to cue() is a cross-file smuggle lane.
        const importedIdents = new Set<string>()
        // Capture the whole import clause (up to `from`/newline), then
        // pull each specifier form out of it: `import{a}from'x'` (no
        // whitespace), `import def, {a}` and `import def, * as ns` mixed
        // forms drop the tail under an either/or alternation.
        for (const im of text.matchAll(/^\s*import\s*(?:type\s+)?([^'"\n;]*?)\s*(?:\bfrom\b|$)/gm)) {
          const clause = im[1]!
          const brace = /\{([^}]*)\}/.exec(clause)
          if (brace) {
            for (const spec of brace[1]!.split(',')) {
              const m = /(?:\bas\s+)?([\w$]+)\s*$/.exec(spec.trim())
              if (m) importedIdents.add(m[1]!)
            }
          }
          const ns = /\*\s+as\s+([\w$]+)/.exec(clause)
          if (ns) importedIdents.add(ns[1]!)
          const head = /^\s*([\w$]+)/.exec(clause)
          if (head) importedIdents.add(head[1]!)
        }
        // Names declared locally in this file (`function cue`, `const cue
        // =`) are not the store seam - bare calls to them are exempt.
        const aliases: string[] = []
        const localNames = new Set<string>()
        for (const d of text.matchAll(LOCAL_DECL)) {
          const name = d[1] ?? d[2]!
          // A one-line wrapper `const cue = (id) => store.cue(id)` is a
          // seam ALIAS, not a domain-local - its RHS references the
          // seam, so call sites of it must still be checked.
          const rhs = text.slice(
            (d.index ?? 0) + d[0].length,
            (d.index ?? 0) + d[0].length + 2000,
          )
          // The seam check must see the WHOLE RHS up to the statement
          // end - `const cue = (\n  id,\n) => audioStore.cue(id)` (a
          // shape prettier emits) puts the seam reference past line 1.
          if (/\b(?:cue|playCue|useAudioStore|audioStore|store)\b/.test(rhs.split(';')[0]!)) {
            aliases.push(name)
            continue
          }
          localNames.add(name)
        }
        // Destructure aliases (`const { cue: q } = useAudioStore()` then
        // `q('id')`) rename the seam - collect them and check their calls
        // through the same literal resolution pipeline. The object
        // pattern may NEST (`{ a: {b}, cue: q }`) - a flat `[^}]*` stops
        // at the inner `}` and drops the renames after it, so match the
        // balanced brace span instead of a flat run. The brace count must
        // run on a literal-blanked copy: a `{` inside a string default
        // (`{a = '{', cue}`) would inflate the depth and swallow the
        // seam-RHS gate.
        for (const dm of noLit.matchAll(/\b(?:const|let|var)\s*\{/g)) {
          const openIdx = (dm.index ?? 0) + dm[0].length - 1
          let depth = 0
          let end = -1
          for (let i = openIdx; i < noLit.length; i++) {
            if (noLit[i] === '{') depth++
            else if (noLit[i] === '}') {
              depth--
              if (depth === 0) {
                end = i
                break
              }
            }
          }
          if (end < 0) continue
          // Only a destructure FROM the seam renames the store's cue -
          // `const { cue: q } = { cue: localFn }` is a domain-local and
          // its calls must stay exempt (same RHS rule as seamDeclared).
          const afterBrace = noLit.slice(end + 1, end + 1 + 2000)
          if (
            !/^\s*=\s*(?:useAudioStore\s*\(|(?:audioStore|store|audioMgr|audioManager|audio|am)\b)/.test(
              afterBrace,
            )
          ) {
            continue
          }
          const body = noLit.slice(openIdx, end + 1)
          for (const am of body.matchAll(/\b(?:cue|playCue)\s*:\s*([A-Za-z_]\w*)/g)) {
            aliases.push(am[1]!)
          }
        }
        // Parameter destructuring `function f({cue: q})` / `({cue: q}) =>`
        // renames the seam inside the call - collect those aliases too.
        // Nested `({cue: q, rest: {a}})` and defaults `({cue: q} = d)`
        // carry extra braces/equals the loose match must absorb.
        for (const dm of text.matchAll(/\(\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}\s*(?::[^)]*)?(?:=[^)]*)?\)/g)) {
          for (const am of dm[0].matchAll(/\b(?:cue|playCue)\s*:\s*([A-Za-z_]\w*)/g)) {
            aliases.push(am[1]!)
          }
        }
        // `import { cue as q }` from the store module renames the seam
        // without a destructure - collect those aliases too. Capital
        // targets included: `cue as Q` is a rename, and a cast like
        // `x as Foo` never appears on the seam names themselves.
        for (const am of text.matchAll(/\b(?:cue|playCue)\s+as\s+([A-Za-z_$][\w$]*)/g)) {
          aliases.push(am[1]!)
        }
        // The alias arm must mirror CALL's token order exactly (leading
        // `\s*!?` included): dropping it meant `cue !<T>(x)` - a legal
        // non-null assertion BEFORE the generic list - escaped whenever
        // any alias existed in the file.
        const callRe =
          aliases.length === 0
            ? CALL
            : new RegExp(
                `(?:^|[^\\w])(?:cue|playCue|${aliases.join('|')})\\s*!?\\s*(?:<[\\s\\S]{0,2000}?>)?\\s*!?\\s*(?:\\?\\.\\s*)?\\(([^)]*)\\)`,
                'g',
              )
        for (const m of text.matchAll(callRe)) {
          // Position of the callee name itself (the match may start one
          // char earlier on the permitted prefix).
          const prefixLen = /^(?:[^\w]|\.)/.test(m[0]) ? 1 : 0
          const namePos = (m.index ?? 0) + prefixLen
          if (inLit(namePos)) continue
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
          // `{` right after `)` is a method-shorthand body. `:` is only a
          // declaration when a TYPE name follows (`cue(id): Ret {`); a
          // same-line `cue('x') : 1` is a fake-shorthand shape and is not
          // exempted.
          if (
            /^\s*$/.test(beforeOnLine) &&
            (/^[ \t]*\{/.test(afterCall) || /^[ \t]*:\s*[A-Za-z_]/.test(afterCall))
          ) continue
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
          // A bare CONSTANT-style identifier arg that resolves to no
          // in-file literal is a cross-file lane: `cue(SOME_IMPORTED)`
          // smuggles any id through an import this scan cannot read.
          // (Locals/params are lowercase idiomatically; screaming idents
          // are const-table names.)
          let identResolved = false
          const screamingIdent = /^[A-Z_][A-Z0-9_]*$/.test(ident) && /^\s*[A-Z_][A-Z0-9_]*\s*$/.test(argText)
          // The literal arms must LOOK AHEAD on the opening quote -
          // consuming it would leave `tail` inside the string and
          // LITERAL.exec would never see the bound value (dead branch).
          // The map/array arm consumes `{`/`[` on purpose (obj sweep).
          // Decl RHS shapes: `= 'lit'`, `= ('lit')`, `= cond ? 'a' : 'b'`,
          // `??=`/`||=`, `= {k:'lit'}` / `= ['lit']`, `X: 'lit'` in an
          // object literal, and call wrappers `= Fn('lit')` (the literal
          // inside the call is the bound value). The ternary arm ends the
          // match at the `?` lookahead so the tail walk sweeps both
          // branches.
          const decl =
            `\\b${ident}\\s*(?::[^=\\n]+)?(?:\\?\\?=|\\|\\|=|&&=|\\+=|=)\\s*` +
            `(?:\\(*\\s*(?=['"\`])|[\\[{]|\\w+\\s*\\(\\s*(?=['"\`])|[^;="'\`\\n]*?\\?\\s*(?=['"\`])|[^;="'\`\\n]*?(?:&&|\\|\\|)\\s*(?=['"\`]))` +
            `|\\b${ident}\\s*:\\s*(?=['"\`])`
          for (const dm of text.matchAll(new RegExp(decl, 'g'))) {
            identResolved = true
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
                  // `+` continues a concat; `:` continues a ternary's
                  // false branch (the `?` arm lands before the true
                  // literal).
                  const plus = /^\s*[:+]\s*/.exec(tail.slice(cursor))
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
          // Imported names are the cross-file lane regardless of casing:
          // `cue(importedCueId)` smuggles any id past the manifest check
          // because this scan cannot resolve the other module's value.
          if (!identResolved && (screamingIdent || importedIdents.has(ident))) {
            violations.add(`${file.fromSrc} -> unresolved cross-file ident ${ident}`)
          }
        }
        // `.cue`/`.playCue` on an audio-seam receiver referenced as a
        // VALUE (callback passing like arr.forEach(store.cue), alias
        // RHS) is not a call shape and would escape CALL entirely - flag
        // it. Receiver names are restricted to audio-seam idiom so the
        // VFX domain's own `cue` property (SkillCue) is not flagged.
        // `useAudioStore(pinia)` is the real Pinia signature - args are
        // allowed; member tails (`store.self.cue`) keep the seam.
        const RECEIVER = '(?:useAudioStore\\s*\\([^)]*\\)|(?:audioStore|store|audioMgr|audioManager|audio|am)(?:\\.[\\w$]+)*)'
        for (const vm of text.matchAll(
          // `[?!]*` before the dot keeps `store?.cue` and `store!.cue`
          // on the receiver arm.
          new RegExp(
            `\\b${RECEIVER}\\s*[?!]*\\s*\\.\\s*(cue|playCue)\\b(?!\\s*!?\\s*(?:<[\\s\\S]{0,2000}?>)?\\s*!?\\s*(?:\\?\\.\\s*)?\\()`,
            'g',
          ),
        )) {
          violations.add(`${file.fromSrc} -> value-ref .${vm[1]} at offset ${vm.index}`)
        }
        // A bare seam identifier passed as a value (`arr.forEach(cue)`)
        // never reaches `.cue(` - flag it, but ONLY when the bare name
        // is sourced from the audio store (`const {cue} = store` /
        // `const cue = store.cue`). A domain-local `cue` (SkillCue
        // params in the VFX driver) is a different binding.
        // Decl shapes must see through ARBITRARY nesting in the object
        // pattern (`{ a: {b: {cue}} } = store`) - a flat or one-level
        // `[^}]*` run stops at an inner `}` and misses the seam name
        // after it, so the balanced-brace span is walked instead.
        const seamDeclared =
          [...noLit.matchAll(/\b(?:const|let|var)\s*\{/g)].some((dm) => {
            const openIdx = (dm.index ?? 0) + dm[0].length - 1
            let depth = 0
            let end = -1
            for (let i = openIdx; i < noLit.length; i++) {
              if (noLit[i] === '{') depth++
              else if (noLit[i] === '}') {
                depth--
                if (depth === 0) {
                  end = i
                  break
                }
              }
            }
            if (end < 0) return false
            if (!/\b(?:cue|playCue)\b/.test(noLit.slice(openIdx, end + 1))) return false
            return new RegExp(`^\\s*=\\s*${RECEIVER}`).test(noLit.slice(end + 1))
          }) ||
          new RegExp(
            `\\bconst\\s+(?:cue|playCue)\\s*=\\s*${RECEIVER}\\s*[?!]*\\s*\\.\\s*(?:cue|playCue)\\b`,
          ).test(text)
        if (seamDeclared) {
          for (const vm of text.matchAll(/[(,]\s*(cue|playCue)\s*[,)]/g)) {
            if (localNames.has(vm[1]!)) continue
            if (inLit(vm.index ?? 0)) continue
            violations.add(`${file.fromSrc} -> bare-ref ${vm[1]} at offset ${vm.index}`)
          }
        }
        // Indirect invocation escapes the dotted value-ref arm:
        // `store.cue.call(this, x)`, `.apply`, `.bind`, and the bare
        // destructured `cue.call(...)` form.
        for (const vm of text.matchAll(
          new RegExp(
            `\\b${RECEIVER}\\s*[?!]*\\s*\\.\\s*(?:cue|playCue)\\s*\\.\\s*(?:call|apply|bind)\\s*\\(`,
            'g',
          ),
        )) {
          violations.add(`${file.fromSrc} -> indirect ${vm[0]} at offset ${vm.index}`)
        }
        for (const vm of text.matchAll(/\b(cue|playCue)\s*\.\s*(?:call|apply|bind)\s*\(/g)) {
          if (localNames.has(vm[1]!)) continue
          if (inLit(vm.index ?? 0)) continue
          violations.add(`${file.fromSrc} -> indirect ${vm[0]} at offset ${vm.index}`)
        }
        // Bracket access computing the cue name from quoted segments
        // (`['cue']`, `['cu'+'e']`, `['c'+'ue']`, `['c\x75e']`,
        // `['play'+'Cue']`) is indirect invocation on ANY receiver -
        // `obj['cue'](x)` is not idiomatic member access. A trailing
        // `(` is required - a bare read `const f = obj['cue']` is data
        // flow, not invocation. Escapes inside segments are decoded
        // before the join is compared.
        const decodeSeg = (seg: string): string =>
          seg
            .replace(/\\x([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
            .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
            .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
        // The receiver may be a call result or a parenthesized expr too:
        // `useAudioStore()['cue'](x)` / `(store)['cue'](x)` must not
        // evade (an ident-only chain never saw the `()` tail).
        for (const vm of text.matchAll(/(?:\b[A-Za-z_$][\w$]*(?:\.[\w$]+)*(?:\s*\([^()]*\))?|\([^()]*\))\s*\[\s*([^\]]*)\]\s*\(/g)) {
          const segs = [...vm[1]!.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)].map(
            (sm) => decodeSeg(sm[1] ?? sm[2] ?? sm[3]!),
          )
          if (segs.length === 0) continue
          if (segs.join('') === 'cue' || segs.join('') === 'playCue') {
            violations.add(`${file.fromSrc} -> indirect ${vm[0]} at offset ${vm.index}`)
          }
        }
        // `store.cu\u0065(...)` spells the seam through a unicode escape -
        // flag escapes embedded in identifier-ish text. (A `\uXXXX` inside
        // a plain string literal is not matched because a word char must
        // sit immediately before the backslash.)
        // `\u0063ue('x')` at statement start has no word char before the
        // backslash - the prefix class is optional so both the embedded
        // form (`store.cu\u0065`) and the leading form flag.
        for (const vm of text.matchAll(/(^|[^\\])\\u(?:[0-9a-fA-F]{4}|\{[0-9a-fA-F]+\})/gm)) {
          // `\uXXXX` inside a literal ('caf\u0065', /a\u{62}c/) is data,
          // not an identifier escape - literal spans cover multi-line
          // literals where line-parity desyncs.
          if (inLit(vm.index ?? 0)) continue
          violations.add(`${file.fromSrc} -> ident escape ${vm[0]} at offset ${vm.index}`)
        }
        // `cue` as a tagged template (`cue`tag``) bypasses the call arm's
        // `(` requirement - flag it outright (not a real API here).
        // Collected aliases are tagged the same way.
        const tagRe =
          aliases.length === 0
            ? /\b(?:cue|playCue)\s*`/g
            : new RegExp(`\\b(?:cue|playCue|${aliases.join('|')})\\s*\``, 'g')
        for (const vm of text.matchAll(tagRe)) {
          if (inLit(vm.index ?? 0)) continue
          violations.add(`${file.fromSrc} -> tagged-template ${vm[0].trim()} at offset ${vm.index}`)
        }
        // `(cue)('x')` wraps the callee in parens - the `)` between the
        // name and the call `(` defeats the CALL arm.
        for (const vm of text.matchAll(/\(\s*(cue|playCue)\s*\)\s*\(/g)) {
          if (localNames.has(vm[1]!)) continue
          if (inLit(vm.index ?? 0)) continue
          violations.add(`${file.fromSrc} -> paren-callee ${vm[0]} at offset ${vm.index}`)
        }
      }
      expect([...violations].sort()).toEqual([])
    },
    SCAN_TIMEOUT,
  )
})
