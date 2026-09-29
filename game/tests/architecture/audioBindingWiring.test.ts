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
import { scriptBlockSpansOf, markupCommentRanges, literalRanges, uncommented, usesJsxBlocks, templateExprText } from './helpers/commentStrip'

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
  // `emit:` in an interface body, `type` alias object literal, or
  // `declare` span is a TYPE signature - not a local emitter. Mask those
  // spans so only value-position declarations (`{ emit: (x) => ... }` in
  // an object literal, a param `emit(x: T)`) can flip the exemption;
  // otherwise an `interface { emit: ... }` would exempt every bare
  // `emit('a'+'b')` file-wide, including `const {emit} = bus` call sites.
  const tc = cleanText.split('')
  const tmask = (a: number, b: number) => {
    for (let i = a; i < b; i++) if (tc[i] !== '\n') tc[i] = ' '
  }
  // Escapes inside bracket-member segments decode before the join
  // (`['em'+'it']`, `['em\\x69t']`) - same rule the cue/shake arms use.
  const decodeBracketSeg = (seg: string): string =>
    seg
      .replace(/\\x([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
  let typeEmitDecl = false
  for (const m of cleanText.matchAll(
    /\binterface\s+[\w$]+[^{}]*\{|\btype\s+[\w$]+(?:<[^>]*>)?\s*=|\bdeclare\s+(?:module|global|namespace)\b[^;{\n]*\{?|\bdeclare\s+[^;{\n]*/g,
  )) {
    // A `interface X {` / `type A =` / `declare` inside a string literal
    // must not open a mask - `inLit` guards every other arm already.
    if (inLit(m.index ?? 0)) continue
    const open = m.index! + m[0].length - 1
    if (cleanText[open] === '{') {
      let depth = 0
      let end = -1
      for (let i = open; i < cleanText.length; i++) {
        if (inLit(i)) continue
        const c = cleanText[i]!
        if (c === '{') depth++
        else if (c === '}') {
          depth--
          if (depth === 0) {
            end = i
            break
          }
        }
      }
      const spanEnd = end < 0 ? cleanText.length : end + 1
      // `declare module/global/namespace { ... }` bodies are a foreign
      // scope - an `emit:` member inside them is not this file's emitter
      // and must not flip the file-wide exemption.
      if (
        !/\bdeclare\s+(?:module|global|namespace)\b/.test(m[0]) &&
        /\bemit\s*[:()]/.test(cleanText.slice(m.index!, spanEnd))
      ) {
        typeEmitDecl = true
      }
      tmask(m.index!, spanEnd)
    } else if (/=\s*$/.test(m[0])) {
      // `type A =`: mask through the depth-0 `;` or line end so EVERY
      // union/intersection member's `emit:` disappears - stopping at the
      // first `{` left later members (`type A = {x} | {emit: ...}`)
      // visible and flipping the file-wide exemption.
      let depth = 0
      let end = -1
      for (let i = m.index! + m[0].length; i < cleanText.length; i++) {
        if (inLit(i)) continue
        const c = cleanText[i]!
        if (c === '{' || c === '(' || c === '[') depth++
        else if (c === '}' || c === ')' || c === ']') depth--
        else if (depth <= 0) {
          if (c === ';') {
            end = i
            break
          }
          if (c === '\n') {
            // A trailing `|`/`&`/`,` keeps the alias alive across lines.
            let k = i - 1
            while (k > m.index! && /\s/.test(cleanText[k]!)) k--
            if (!/[|&,]/.test(cleanText[k] ?? '')) {
              end = i
              break
            }
          }
        }
      }
      const spanEnd = end < 0 ? cleanText.length : end
      if (/\bemit\s*[:()]/.test(cleanText.slice(m.index!, spanEnd))) {
        typeEmitDecl = true
      }
      tmask(m.index!, spanEnd)
    } else {
      if (/\bemit\s*[:()]/.test(m[0])) typeEmitDecl = true
      tmask(m.index!, m.index! + m[0].length)
    }
  }
  // Param-list paren spans (`(...)` whose `)` is followed by `=>`/`{`/`:`):
  // an `emit:` inside one is a parameter TYPE annotation declaring a
  // local emitter (`emit: (issue: string) => void`), and a bare `emit`
  // inside one is a parameter BINDING, not a value use. `f({emit: fn})`
  // argument parens fail the lookahead gate and stay value-position.
  const noTypesPre = tc.join('')
  const paramParenSpans: Array<[number, number]> = []
  // A `(` can only open a parameter list in signature position - a control
  // keyword (`if (`/`for (`/`while (`...), ternary `? (`, or a value
  // operator before it means the paren holds an expression, not params.
  const CONTROL_PAREN = /(?:\b(?:if|for|while|switch|catch|with|return|typeof|case|throw|new|in|of|do|else|yield|await|delete|void|instanceof)|\?)\s*$/
  for (const pm of noTypesPre.matchAll(/\(/g)) {
    if (inLit(pm.index ?? 0)) continue
    const ctrlParen = CONTROL_PAREN.test(noTypesPre.slice(0, pm.index!))
    let depth = 0
    let end = -1
    for (let i = pm.index!; i < noTypesPre.length; i++) {
      if (inLit(i)) continue
      const c = noTypesPre[i]!
      if (c === '(') depth++
      else if (c === ')') {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    if (end < 0) continue
    const afterParen = noTypesPre.slice(end + 1)
    // A `case`/`default` LABEL's parens are not signatures: `case f({x}):`
    // closes `)` on the case colon, which satisfies the `:` lookahead while
    // the `{x}` inside is a call argument, not a param destructure.
    if (/^\s*:/.test(afterParen)) {
      const lineStart = noTypesPre.lastIndexOf('\n', pm.index!) + 1
      if (/\b(?:case|default)\b/.test(noTypesPre.slice(lineStart, pm.index!))) continue
    }
    // Keyword-prefixed parens (`return (...)`, `await (...)`) may still hold
    // an arrow-function signature (`return ({x}: T) => x`) - for those only
    // the `=>` gate proves a param list; `{`/`:` after a control paren is a
    // block or label, never a signature tail.
    if (ctrlParen ? /^\s*=>/.test(afterParen) : /^\s*(?:=>|\{|:)/.test(afterParen)) {
      paramParenSpans.push([pm.index!, end + 1])
    }
  }
  const inParam = (i: number) => paramParenSpans.some(([a, b]) => i >= a && i < b)
  // `{emit: q}` inside a param list is a destructure rename binding
  // (`function h({emit: q})`), not a type annotation - collect its spans
  // so renames mint aliases and only real `emit:` type members flip.
  const paramBraceSpans: Array<[number, number]> = []
  for (const [pa, pb] of paramParenSpans) {
    for (const bm of noTypesPre.slice(pa, pb).matchAll(/\{/g)) {
      const openIdx = pa + (bm.index ?? 0)
      let depth = 0
      let end = -1
      for (let i = openIdx; i < pb; i++) {
        if (inLit(i)) continue
        const c = noTypesPre[i]!
        if (c === '{') depth++
        else if (c === '}') {
          depth--
          if (depth === 0) {
            end = i
            break
          }
        }
      }
      if (end >= 0) paramBraceSpans.push([openIdx, end + 1])
    }
  }
  const inParamBrace = (i: number) => paramBraceSpans.some(([a, b]) => i >= a && i < b)
  for (const em of noTypesPre.matchAll(/\bemit\s*:/g)) {
    if (inParam(em.index ?? 0) && !inParamBrace(em.index ?? 0)) typeEmitDecl = true
  }
  // A bare `emit` bound as a param (`h(emit)`, `h({emit})`) is a local
  // emitter injected by the caller - its calls cannot be literal-checked
  // here, so the file's bare calls are exempt the same way a type
  // declaration exempts them. `emit:` (type annotation / rename key) is
  // not a binding of the name `emit`.
  const emitParamBound = paramParenSpans.some(([a, b]) =>
    /(?:^|[{,(\s])emit\b(?!\s*[(:])/.test(noTypesPre.slice(a, b)),
  )
  // The exemption flips only on a TYPE-level emit declaration (inside
  // the masked spans or param lists above) or a real `emit(e?: T)`
  // signature - a runtime `{ emit: fn }` object property is not a
  // declaration of the identifier `emit` and cannot silence the file's
  // bare calls.
  const declaresLocalEmit =
    typeEmitDecl ||
    emitParamBound ||
    /\bemit\s*\(\s*[\w$]+\s*\?\s*:/.test(tc.join(''))
  // The local-emitter exemption applies PER CALLEE, not file-wide: a
  // bare `emit(` may be the local callback when a file declares one, but
  // a receiver-qualified `bus.emit(...)` is unambiguously the bus and is
  // always arm-checked (one `emit(reason: ...)` signature must not
  // silence every emit in an emit-heavy file).
  // Receiver-qualified `bus.emit`/`bus?.emit` is never exempt. Whitespace
  // inside the member access (`bus. emit`, `bus?. emit`) is legal JS - the
  // lookback must skip it, not inspect the single previous char.
  const noTypes = tc.join('')
  // Binding-pattern spans: const/for `{`/`[` destructures plus the
  // param-list parens above - a bare `emit` in binding position
  // (`const {emit} =`, `f(a, emit)`) is a name, not a value use.
  const patternSpans: Array<[number, number]> = [...paramParenSpans]
  // `for ({emit:r} of bus)` and `({emit:r} = bus)` bind through the same
  // pattern shapes the mint arm collects (keywordless-for and
  // paren-wrapped destructures) - without their spans in this set the
  // bare-value arms flag the binding site's own names.
  for (const dm of noTypes.matchAll(/\b(?:const|let|var)\s*[{[]|\bfor\s*\(\s*(?:const|let|var)?\s*[{[]|\(\s*[{[]|(?:^|[;{\n])\s*[\[{]/g)) {
    const openIdx = dm.index! + dm[0].length - 1
    const openCh = noTypes[openIdx]!
    const closeCh = openCh === '{' ? '}' : ']'
    let depth = 0
    let end = -1
    for (let i = openIdx; i < noTypes.length; i++) {
      if (inLit(i)) continue
      const c = noTypes[i]!
      if (c === openCh) depth++
      else if (c === closeCh) {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    // `(`-led and statement-led shapes are patterns only when the brace
    // is followed by `=`/`of`/`in` (a real binding). `f({emit})` /
    // `f([emit])` are call-argument literals - nothing binds there, so
    // no span may hide the names inside.
    if (
      end >= 0 &&
      (dm[0][0] === '(' || /^[;{\n]/.test(dm[0])) &&
      !/^\s*(?:=|of|in)\s/.test(noTypes.slice(end + 1)) &&
      !(
        dm[0][0] === '(' &&
        /\bcatch\s*$/.test(noTypes.slice(0, dm.index!)) &&
        /^\s*(?::[^)]*)?\)\s*\{/.test(noTypes.slice(end + 1))
      )
    ) continue
    if (end >= 0) patternSpans.push([openIdx, end + 1])
  }
  const emitExempt = (i: number) =>
    declaresLocalEmit && !emitBound && !/(?:\?\s*)?\.\s*$/.test(noTypes.slice(0, i))
  // Renames of the bus emitter make `r('x')` a real bus emit that must
  // satisfy the same literal/nonliteral rules: `{emit: r} = bus`,
  // `emit as r`, `const r = bus.emit`, `const r = bus['emit']`.
  const emitAliases = new Set<string>()
  let emitBound = false
  // `x as T` casts share the `as` keyword - a bare `emit as r` scan
  // minted aliases out of cast text, so only the named-import clause
  // (`import { emit as r }`) may mint one.
  for (const im of noTypes.matchAll(/\bimport\s*(?:type\s+)?\{[^}]*\}/g)) {
    if (inLit(im.index ?? 0)) continue
    for (const am of im[0]!.matchAll(/\bemit\s+as\s+([A-Za-z_$][\w$]*)/g)) {
      // `emit as emit` self-renames are no alias - folding `emit` back in
      // would double-classify every bare call through the alias arm.
      if (am[1] !== 'emit') emitAliases.add(am[1]!)
    }
  }
  // `{emit: r} = bus` walks the balanced `{...}` span - a nested
  // `{a: {emit: r}}` defeats a flat `[^}]*` and the rename is lost.
  // `of`/`in` cover `for (const {emit: r} of bus)`; `for ({emit: r} of
  // bus)` (no decl keyword) and `({emit: r} = bus)` (paren-wrapped
  // assignment destructure) mint the same alias - the `=|of|in` gate
  // below still filters call-argument literals like `f({emit: fn})`.
  for (const dm of noTypes.matchAll(/\b(?:const|let|var)\s*\{|\bfor\s*\(\s*\{|\(\s*\{/g)) {
    if (inLit(dm.index ?? 0)) continue
    const openIdx = dm.index! + dm[0].length - 1
    let depth = 0
    let end = -1
    for (let i = openIdx; i < noTypes.length; i++) {
      if (inLit(i)) continue
      const c = noTypes[i]!
      if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    if (end < 0) continue
    // Any `{emit: r} = receiver` extraction registers r - the alias's
    // calls carry the same literal rules whether or not the receiver
    // name matches a bus idiom (a named-otherwise emitter laundered no
    // calls through the whitelist).
    // The RHS only has to LOOK like an extraction (`=`/`of`/`in` then
    // anything) - `of [sink]`/`of getBus()` renames the emitter the
    // same way `of bus` does. A `catch ({emit: r})` clause binds the
    // same way - its `)`-then-`{` tail is a param pattern, not an RHS.
    if (
      !/^\s*(?:=|of|in)\s*(?=\S)/.test(noTypes.slice(end + 1)) &&
      !(
        dm[0][0] === '(' &&
        /\bcatch\s*$/.test(noTypes.slice(0, dm.index!)) &&
        /^\s*(?::[^)]*)?\)\s*\{/.test(noTypes.slice(end + 1))
      )
    ) continue
    // A SHORTHAND `{emit}` destructure binds `emit` itself to the bus
    // emitter - the file-wide declaresLocalEmit exemption (type member
    // `emit(e:T)`) must then stand down, since bare `emit(...)` is a
    // real bus call.
    if (/\bemit\b(?!\s*:)/.test(noTypes.slice(openIdx, end + 1))) emitBound = true
    for (const am of noTypes
      .slice(openIdx, end + 1)
      .matchAll(/\bemit\s*:\s*([A-Za-z_$][\w$]*)/g)) {
      if (am[1] !== 'emit') emitAliases.add(am[1]!)
    }
  }
  // `const r = a.b.emit` - receiver may be a member chain, not only a
  // single ident; the assignment form (`r = bus.emit`, no keyword) is
  // the same extraction. `bus!.emit` carries the member through a
  // non-null bridge the same way `?.` does.
  for (const am of noTypes.matchAll(
    // `(?<![\w$.])` keeps member-assignment targets (`obj.handler =
    // bus.emit`) from minting the PROPERTY name as a local alias.
    /\b(?:const\s+|let\s+|var\s+)?(?<![\w$.])([A-Za-z_$][\w$]*)\s*=\s*[\w$]+(?:\s*\.\s*[\w$]+)*(?:\s*[?!]\s*\.\s*|\s*\.\s*)emit\b(?!\s*\()/g,
  )) {
    if (inLit(am.index ?? 0)) continue
    if (am[1] !== 'emit') emitAliases.add(am[1]!)
  }
  // `const r = bus['emit']` / `bus['em'+'it']` - decode+join the quoted
  // segments, matching the bracket-member emit arm below.
  for (const am of noTypes.matchAll(
    // `?.[`/`![` bridges (`bus?.['emit']`) carry the same member read
    // as `bus['emit']` - the optional/non-null chain doesn't make the
    // alias mint any less real. Keyword is optional: `r = bus['emit']`
    // rebinds the alias the same way `const r = bus['emit']` does.
    /\b(?:const\s+|let\s+|var\s+)?([A-Za-z_$][\w$]*)\s*=\s*[\w$]+(?:\s*\.\s*[\w$]+)*\s*(?:\?\s*)?(?:\.|!)?\s*\[([\s\S]*?)\]/g,
  )) {
    if (inLit(am.index ?? 0)) continue
    const segs = [...am[2]!.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)].map(
      (sm) => decodeBracketSeg(sm[1] ?? sm[2] ?? sm[3]!),
    )
    if (segs.join('') === 'emit' && am[1] !== 'emit') emitAliases.add(am[1]!)
  }
  // `{emit: q}` inside a PARAM list is a destructure rename binding
  // (`function h({emit: q})`) - mint q as an emitter alias the same
  // way a `const {emit: q}` destructure does.
  for (const [pa, pb] of paramBraceSpans) {
    for (const am of noTypes
      .slice(pa, pb)
      .matchAll(/\bemit\s*:\s*([A-Za-z_$][\w$]*)/g)) {
      if (am[1] !== 'emit') emitAliases.add(am[1]!)
    }
  }
  // Classify one emit-style call's arg-0: the slice up to the first
  // top-level `,` (a second arg means the head value sits in NAME
  // position) or the call's `)`. Bound names must be emitted through a
  // plain literal arg; every computable-at-call-site shape is flagged.
  const classifyEmit = (callee: string, argStart: number): void => {
    let depth = 0
    let comma = -1
    let close = -1
    for (let i = argStart; i < cleanText.length; i++) {
      if (inLit(i)) continue
      const c = cleanText[i]!
      if (c === '(' || c === '[' || c === '{') depth++
      else if (c === ')') {
        if (depth === 0) {
          close = i
          break
        }
        depth--
      } else if (c === ']' || c === '}') depth--
      else if (c === ',' && depth === 0) {
        comma = i
        break
      }
    }
    const argEnd = comma >= 0 ? comma : close
    if (argEnd < 0) return
    // `emit(f(x),\n)` - a comma that closes on `)` is a trailing comma,
    // not a second argument.
    const hasMore = comma >= 0 && !/^\s*\)/.test(cleanText.slice(comma + 1))
    let a0 = cleanText.slice(argStart, argEnd).trim()
    // `emit(payload: CombatEventPayload)` / `emit(e?: T)` inside a class
    // or object-literal method body is a parameter SIGNATURE, not a call
    // (an ident+colon is not a legal expression) - never classify it.
    if (/^[\w$]+\s*\??\s*:/.test(a0)) return
    const a0lits = () => literalRanges(a0, file.fromSrc)
    // Whole-arg paren wraps unwrap before classifying - `emit((f()), p)`
    // is a computed head call in name position, while `emit((entry), p)`
    // stays a forwarded value (same semantics as the bare ident).
    while (a0.startsWith('(')) {
      let d = 0
      let wraps = false
      const rl = a0lits()
      for (let i = 0; i < a0.length; i++) {
        if (rl.some((r) => i >= r.pos && i < r.end)) continue
        const c = a0[i]!
        if (c === '(') d++
        else if (c === ')') {
          d--
          if (d === 0) {
            wraps = i === a0.length - 1
            break
          }
        }
      }
      if (!wraps) break
      a0 = a0.slice(1, -1).trim()
    }
    if (!a0) return
    // The literal must cover the WHOLE arg - `'a' + 'b'` starts and ends
    // on quotes but is a concat, not a bound name.
    const rl = a0lits()
    if (rl.length === 1 && rl[0]!.pos === 0 && rl[0]!.end === a0.length) {
      const q = a0[0]!
      const inner = a0.slice(1, -1)
      if (q === '`' && inner.includes('${')) {
        NONLITERAL_EMITS.push(`${file.fromSrc} -> ${callee}(${a0.slice(0, 40)}...) (computed name)`)
      } else if (/^[a-z_0-9]+$/.test(inner)) {
        EMITTED.add(inner)
      }
      // Other literal shapes ('CamelCase', 'a b') can never be bound
      // bus names - inert, matching the old `[a-z_0-9]+` literal arm.
      return
    }
    // `emit({type: 'x'})` names the event through an object key - flag a
    // computed `[expr]` key or a non-literal `type` value at the head of
    // the object (a literal `type` with computed data keys stays data).
    if (a0.startsWith('{')) {
      if (/^\{\s*(?:\[\s*[^\]]+\]|type\s*:\s*[^\s,'"`)}\n]+)/.test(a0)) {
        NONLITERAL_EMITS.push(`${file.fromSrc} -> ${callee}(${a0.slice(0, 40)}...) (computed event key)`)
      }
      return
    }
    // Forwarded values are indistinguishable from smuggling: a bare
    // ident / member / element chain (`x`, `entry.event`, `x[k]`,
    // `x?.y`) reads a name computed elsewhere - never flagged.
    if (/^[\w$]+(?:\s*\??\.\s*[\w$]+|\s*\??\.?\s*\[[^\]]*\])*$/.test(a0)) return
    // A whole-arg single call `emit(factory())` is the payload-emit
    // convention - indistinguishable from a name-returning call. With a
    // second arg or any continuation it is a computed name.
    const callM = /^(?:new\s+)?[\w$]+(?:\s*\??\.\s*[\w$]+)*\s*\(/.exec(a0)
    if (callM) {
      const rl = literalRanges(a0, file.fromSrc)
      let d = 0
      let callEnd = -1
      for (let i = callM[0].length - 1; i < a0.length; i++) {
        if (rl.some((r) => i >= r.pos && i < r.end)) continue
        const c = a0[i]!
        if (c === '(') d++
        else if (c === ')') {
          d--
          if (d === 0) {
            callEnd = i
            break
          }
        }
      }
      if (callEnd >= 0 && a0.slice(callEnd + 1).trim() === '' && !hasMore) return
    }
    NONLITERAL_EMITS.push(`${file.fromSrc} -> ${callee}(${a0.slice(0, 40)}...) (computed head arg)`)
  }
  {
    // Every `emit` invocation: bare, member-qualified, optional-call
    // `emit?.(`, generic `emit<T>(`, paren-wrapped `(bus.emit)(x)`. The
    // `\)*` run peels a callee paren-wrap the way the old `\(*` peeled
    // arg wraps.
    // Emit-call scans run on the type-masked text: declarations inside
    // interface/type/declare spans are blanks there, so a signature's
    // `emit(e: T)` never reaches the classifier as a fake call.
    for (const m of noTypes.matchAll(
      /\bemit\s*!?\s*(?:\?\s*\.)?\s*(?:<[\s\S]{0,2000}?(?<!=)>)?\s*!?\s*(?:\?\s*\.)?\s*\)*\s*\(/g,
    )) {
      if (emitExempt(m.index ?? 0)) continue
      if (inLit(m.index ?? 0)) continue
      classifyEmit('emit', m.index! + m[0].length)
    }
    // Aliased emitter calls run the same classification, plus the
    // indirect (`r.call`) and bare value (`forEach(r)`) forms - the
    // generic group uses `[\s\S]` like the main arm since whitespace
    // inside `r<T extends X>(` is legal.
    for (const alias of emitAliases) {
      const re = new RegExp(`\\b${alias}\\s*!?\\s*(?:\\?\\s*\\.)?\\s*(?:<[\\s\\S]{0,2000}?(?<!=)>)?\\s*!?\\s*(?:\\?\\s*\\.)?\\s*\\(`, 'g')
      for (const m of noTypes.matchAll(re)) {
        if (inLit(m.index ?? 0)) continue
        classifyEmit(alias, m.index! + m[0].length)
      }
      const reIndirect = new RegExp(`\\b${alias}\\s*[?!]*\\s*\\.\\s*(?:call|apply|bind)\\s*(?:\\?\\s*\\.)?\\s*\\(`, 'g')
      for (const m of noTypes.matchAll(reIndirect)) {
        if (inLit(m.index ?? 0)) continue
        NONLITERAL_EMITS.push(`${file.fromSrc} -> ${m[0].slice(0, 60)} (alias emit indirect)`)
      }
      // `r['call'](x)` - bracket member on the alias invokes the same
      // binding; decode the quoted segment like the `bus['emit']` arm.
      const reAliasBracketCall = new RegExp(`\\b${alias}\\s*[?!]*\\s*\\.?\\s*\\[\\s*([^\\]]*)\\]\\s*\\(`, 'g')
      for (const m of noTypes.matchAll(reAliasBracketCall)) {
        if (inLit(m.index ?? 0)) continue
        const bsegs = [...m[1]!.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)].map(
          (sm) => decodeBracketSeg(sm[1] ?? sm[2] ?? sm[3]!),
        )
        if (/^(?:call|apply|bind)$/.test(bsegs.join(''))) {
          NONLITERAL_EMITS.push(`${file.fromSrc} -> ${m[0].slice(0, 60)} (alias emit bracket indirect)`)
        }
      }
      // `cond ? alias : alt` - the `:` ternary tail reads as a property
      // key to the bare arm; mirror the bare-emit `\? emit :` arm.
      // An optional member tail (`? r.prop :`) still reads the binding.
      const reAliasTernary = new RegExp(`\\?\\s*${alias}(?:\\s*[?!]*\\s*(?:\\.[\\w$]+|\\[[^\\]\\n]*\\]))*\\s*:`, 'g')
      for (const m of noTypes.matchAll(reAliasTernary)) {
        if (inLit(m.index ?? 0)) continue
        NONLITERAL_EMITS.push(`${file.fromSrc} -> ${m[0].slice(0, 60)} (bare alias ternary)`)
      }
      // `` alias`tag` `` - a tagged template on the alias bypasses the
      // call arm the same way `emit`tag`` does.
      const reAliasTag = new RegExp(`\\b${alias}\\s*\``, 'g')
      for (const m of noTypes.matchAll(reAliasTag)) {
        if (inLit(m.index ?? 0)) continue
        NONLITERAL_EMITS.push(`${file.fromSrc} -> ${m[0].slice(0, 60)} (alias emit tag)`)
      }
      // `:` stays OUT of the lookahead tail set: an object-literal
      // property key (`{q: 1}`, `{emit: handler}`) is a name, not a value
      // read - the `case ALIAS:` label is covered by its own arm below.
      // (`:` remains a FENCE: `cond ? x : emit` still reads the alias.)
      const reBare = new RegExp(`(?:[(,=\\[:;{!&|?:+\\-*\\/%^~<>]|=>|\\b(?:return|yield|await|typeof|void|in|of|instanceof|new|delete)\\s)\\s*${alias}\\s*(?=[,)\\]};])`, 'g')
      for (const m of noTypes.matchAll(reBare)) {
        if (inLit(m.index ?? 0)) continue
        // The alias DECL's own binding (`{emit: r} = bus`) sits inside a
        // destructuring pattern span - binding position, not a use.
        if (patternSpans.some(([a, b]) => m.index! >= a && m.index! < b)) continue
        NONLITERAL_EMITS.push(`${file.fromSrc} -> ${m[0].slice(0, 60)} (bare alias value)`)
      }
      // `case ALIAS:` - a switch case reads the binding as a value; the
      // colon here is the case label, not a property key. `case ALIAS + 1:`
      // / `case ALIAS.member:` keep the name in the label expression -
      // any tail up to the case colon still reads it.
      // `case ALIAS\n:` - a line-broken label still reads the binding.
      const reCase = new RegExp(`\\bcase\\s+${alias}\\b[^:]*?:`, 'g')
      for (const m of noTypes.matchAll(reCase)) {
        if (inLit(m.index ?? 0)) continue
        NONLITERAL_EMITS.push(`${file.fromSrc} -> ${m[0].slice(0, 60)} (bare alias case)`)
      }
    }
    // Bracket-member emit `bus['emit'](x)` / `bus['em'+'it'](x)` /
    // `` bus[`emit`]() `` - decode+join the quoted segments so concat
    // spellings can't slip; never the plain literal shape so flag. A
    // receiver-qualified member is never exempt.
    for (const m of noTypes.matchAll(/\[\s*([^\]]*)\]\s*(?:\?\s*\.)?\s*\(/g)) {
      if (inLit(m.index ?? 0)) continue
      const segs = [...m[1]!.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)].map(
        (sm) => decodeBracketSeg(sm[1] ?? sm[2] ?? sm[3]!),
      )
      if (segs.length === 0 || segs.join('') !== 'emit') continue
      NONLITERAL_EMITS.push(`${file.fromSrc} -> ${m[0].slice(0, 60)} (bracket-member emit)`)
    }
    // Bare emit indirect/value forms - `emit.call(...)`, `emit?.call`,
    // `(emit).call`, `(emit)?.(`, `` emit`tag` ``, and bare `emit` in
    // value position (`forEach(emit)`, `const f = emit`, `...emit`).
    // None carry a `.` before `emit` so the value-ref arm can't see them.
    for (const m of noTypes.matchAll(/\bemit\s*[?!]*\s*\.\s*(?:call|apply|bind)\s*(?:\?\s*\.)?\s*\(/g)) {
      if (inLit(m.index ?? 0) || emitExempt(m.index ?? 0)) continue
      NONLITERAL_EMITS.push(`${file.fromSrc} -> ${m[0].slice(0, 60)} (bare emit indirect)`)
    }
    // `emit['call'](x)` - bracket member spelling of the same indirect
    // invocation; decode+join like the `bus['emit']` arm.
    for (const m of noTypes.matchAll(/\bemit\s*[?!]*\s*\.?\s*\[\s*([^\]]*)\]\s*\(/g)) {
      if (inLit(m.index ?? 0) || emitExempt(m.index ?? 0)) continue
      const bsegs = [...m[1]!.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)].map(
        (sm) => decodeBracketSeg(sm[1] ?? sm[2] ?? sm[3]!),
      )
      if (/^(?:call|apply|bind)$/.test(bsegs.join(''))) {
        NONLITERAL_EMITS.push(`${file.fromSrc} -> ${m[0].slice(0, 60)} (bare emit bracket indirect)`)
      }
    }
    // Paren-callee spans are collected first so the bare-value arm below
    // skips the `(emit` inside `(emit).call(` - the paren arm owns that
    // shape and a second report for the same site is noise.
    // `((emit))` double-wraps and `(emit as <complex>)(x)` /
    // `(emit as (n:string)=>void).call(` carry complex cast types; alias
    // names ride the same paren-callee shape (`(r as F)(x)`).
    const parenEmitRe = new RegExp(
      `\\(\\s*\\(*\\s*(emit${emitAliases.size ? '|' + [...emitAliases].join('|') : ''})(?:\\s+as\\s+[\\w$.<>\\[\\]|&()\\s,:?'"=]*?)?\\s*\\)*\\s*\\)\\s*(?:\\?\\s*\\.|\\.)?\\s*(?:(?:call|apply|bind)\\s*(?:\\?\\s*\\.)?\\s*)?\\(`,
      'g',
    )
    const parenEmitSpans: Array<[number, number]> = []
    for (const m of noTypes.matchAll(parenEmitRe)) {
      if (inLit(m.index ?? 0) || emitExempt(m.index ?? 0)) continue
      parenEmitSpans.push([m.index!, m.index! + m[0].length])
      NONLITERAL_EMITS.push(`${file.fromSrc} -> ${m[0].slice(0, 60)} (paren emit callee)`)
    }
    for (const m of noTypes.matchAll(/(?:[(,=\[:;{!&|?:+\-*\/%^~<>]|\.\.\.|\b(?:return|yield|await|typeof|void|in|of|instanceof|new|delete)\b|=>)\s*emit\b(?!\s*(?:\?\s*)?[.:<(]|\s*as\b|\s*=>)/g)) {
      if (inLit(m.index ?? 0) || emitExempt(m.index ?? 0)) continue
      // The `(emit` inside a paren-callee match is owned by that arm -
      // a second `(bare emit value)` line for the same site double-reports.
      if (parenEmitSpans.some(([a, b]) => m.index! >= a && m.index! < b)) continue
      // `emit` inside a binding pattern (`const {a, emit} =`, `f(x,
      // emit)`, `const [emit] =`) is a BINDING name, not a value use -
      // but only for the bind fences `(`/`[`/`{`/`,`: `const {x = emit}`
      // or `f(a = emit)` is a real default-value USE and still flags.
      if (
        '([{,'.includes(m[0][0]!) &&
        patternSpans.some(([a, b]) => m.index! >= a && m.index! < b)
      ) continue
      NONLITERAL_EMITS.push(`${file.fromSrc} -> ${m[0].slice(0, 60)} (bare emit value)`)
    }
    // `case emit:` reads the emitter as a value - the case colon is a
    // label, not a property key, and no fence precedes it in the arm
    // above. `case emit + 1:` / `case emit.foo:` share the label
    // expression shape - everything after `emit` up to the `:` is still
    // part of the read.
    for (const m of noTypes.matchAll(/\bcase\s+emit\b[^:]*?:/g)) {
      if (inLit(m.index ?? 0) || emitExempt(m.index ?? 0)) continue
      NONLITERAL_EMITS.push(`${file.fromSrc} -> ${m[0].slice(0, 60)} (bare emit case)`)
    }
    // `cond ? emit : alt` - the `:` after a ternary mid-arm reads as a
    // property-name to the arm above, so a separate pair-scan owns it.
    for (const m of noTypes.matchAll(/\?\s*emit\b\s*:/g)) {
      if (inLit(m.index ?? 0) || emitExempt(m.index ?? 0)) continue
      NONLITERAL_EMITS.push(`${file.fromSrc} -> ${m[0].slice(0, 60)} (bare emit ternary)`)
    }
    for (const m of noTypes.matchAll(/\bemit\s*`/g)) {
      if (inLit(m.index ?? 0) || emitExempt(m.index ?? 0)) continue
      NONLITERAL_EMITS.push(`${file.fromSrc} -> ${m[0]} (emit tag)`)
    }
    // Indirect invocation and value-refs: `bus.emit.call(...)`,
    // `bus.emit.apply/bind`, `forEach(bus.emit)`, `const r = bus.emit` -
    // a `.emit` reference NOT followed by `(` hands the emitter around
    // as a value where no literal name can be bound at this site.
    for (const m of noTypes.matchAll(/(?:\?\s*)?\.\s*emit\b/g)) {
      if (inLit(m.index ?? 0)) continue
      // `typeof bus.emit` queries the member as a TYPE - the binding
      // rules govern call sites, not type queries.
      if (/\btypeof\s*[\w$]*(?:\s*\.\s*[\w$]+)*\s*$/.test(noTypes.slice(Math.max(0, m.index! - 64), m.index!))) continue
      const after = noTypes.slice(m.index! + m[0].length)
      if (/^\s*(?:<[\s\S]{0,2000}?(?<!=)>)?\s*!?\s*(?:\?\s*\.)?\s*\)*\s*\(/.test(after)) continue
      // `{emit: r}` inside a binding pattern - the alias arm owns the
      // rename. `cond ? bus.emit : alt` puts `.emit` in a ternary mid-arm
      // where the `:` is a value fence, not a rename marker.
      if (
        /^\s*:/.test(after) &&
        patternSpans.some(([a, b]) => m.index! >= a && m.index! < b)
      ) continue
      // `const r = bus.emit` is owned by the alias arm (r registers and
      // its calls classify) - flagging the decl itself would make the
      // alias branch dead and disagree with the `bus['emit']` verdict.
      if (
        /\b(?:const\s+|let\s+|var\s+)?[\w$]+\s*=\s*[\w$]+(?:\s*\.\s*[\w$]+)*$/.test(
          noTypes.slice(0, m.index!),
        )
      ) continue
      // `.emit.call/.apply/.bind(` is owned by the bare-indirect arm -
      // a value-ref line here double-reports the same invocation.
      if (/^\s*[?!]*\s*\.\s*(?:call|apply|bind)\s*(?:\?\s*\.)?\s*\(/.test(after)) continue
      NONLITERAL_EMITS.push(`${file.fromSrc} -> ${m[0]} (emit value-ref)`)
    }
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
      // A domain-typo (`combt.damage` vs `combat.damage`) escapes the
      // first-segment gate but is exactly the defect this pin exists for:
      // flag a dotted literal whose post-first-segment tail matches a
      // real manifest key's tail under a different domain.
      const manifestTails = new Set(
        Object.keys(AUDIO_CUES).map((k) => k.split('.').slice(1).join('.')),
      )
      const bad: string[] = []
      for (const f of bindingFiles) {
        const text = uncommented(f.text, f.fromSrc)
        for (const r of literalRanges(text, f.fromSrc)) {
          const lit = text.slice(r.pos + 1, r.end - 1)
          if (!/^[a-z_0-9]+(\.[a-z_0-9]+)+$/.test(lit)) continue
          if (lit in AUDIO_CUES) continue
          if (cueDomains.has(lit.split('.')[0]!)) {
            bad.push(`${f.fromSrc} -> ${lit}`)
            continue
          }
          const tail = lit.split('.').slice(1).join('.')
          if (manifestTails.has(tail)) bad.push(`${f.fromSrc} -> ${lit} (domain-typo shape)`)
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
      // Audio-seam receiver idiom shared by every cue arm: `useAudioStore()`,
      // `store`, `audioStore`, `audioMgr`, `audioManager`, `audio`, `am` and
      // member tails on them (`store.self.cue`). Defined once here so the
      // call arm's `.cue(` path and the value-ref arms scope identically.
      // `*AudioStore`/`*AudioMgr`/`*AudioManager` suffix idents
      // (`myAudioStore`, `battleAudioMgr`) name the same store instance -
      // the suffix alternative covers them with an optional call tail.
      // Member tails may chain `?.`/`!.`/bracket members (`store?.k.cue`,
      // `store['k'].cue`) and call args may nest one paren level
      // (`useAudioStore(f(g()))`, `audioStore()`); `this` and
      // `AudioManager.getInstance()` are the same seam inside/through the
      // manager class.
      const RECV_CALL = '\\s*\\([^()]*(?:\\([^()]*\\)[^()]*)*\\)'
      const RECEIVER =
        `(?:(?:useAudioStore|AudioManager\\s*\\.\\s*getInstance)${RECV_CALL}|(?:audioStore|store|audioMgr|audioManager|audio|am|this|[A-Za-z_$][\\w$]*(?:AudioStore|AudioMgr|AudioManager))(?:${RECV_CALL})?)(?:\\s*[?!]?\\s*(?:\\.\\s*[\\w$]+|\\.?\\s*\\[\\s*[^\\]]*\\]))*`
      const CALL =
        // `)*` before `(` peels a callee paren-wrap the way the emit arm
        // does - `(audio.cue)('x')` is a call, not a value-ref.
        /(?:^|[^\w])(?:cue|playCue)\s*!?\s*(?:\?\s*\.\s*)?\s*(?:<[\s\S]{0,2000}?(?<!=)>)?\s*!?\s*(?:\?\.\s*)?\)*\s*\(([^)]*)\)/g
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
      const checkLiteral = (violations: Set<string>, fromSrc: string, literal: string, offset?: number): void => {
        // The offset keeps a violation in a big file navigable - callers
        // pass their best-known absolute index (or omit it).
        const at = offset === undefined ? '' : ` at offset ${offset}`
        if (literal.includes('${')) {
          const prefix = literal.replace(/\.\$\{[^}]+\}$/, '')
          // The static prefix resolves itself OR covers concrete rows
          // beneath it (`combat.element.${element}` -> combat.element.*).
          const covered = Object.keys(AUDIO_CUES).some((k) => k.startsWith(prefix + '.'))
          if (resolveAudioCue(prefix) === undefined && !covered) {
            violations.add(`${fromSrc} -> ${literal}${at}`)
          }
          return
        }
        // Undotted literals are never manifest ids either - `cue('bogus')`
        // must flag just like `cue('bogus.id')`.
        if (resolveAudioCue(literal) === undefined) {
          violations.add(`${fromSrc} -> ${literal}${at}`)
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
        // keeps them from producing false violations. The shared
        // templateExprText helper covers every directive value (`v-on=`
        // object syntax, `v-if`/`v-for`/bound attrs) and {{ }} bodies
        // with a string-aware capture (a `}}` inside a quoted string
        // does not truncate the interpolation).
        const templateText = file.fromSrc.endsWith('.vue')
          ? templateExprText(file.text)
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
        // `const s = useAudioStore(...)` renames the whole seam - calls on
        // the alias are store calls on a renamed receiver, so it joins
        // the receiver alternation for every gate below.
        const storeAliases = new Set<string>()
        for (const sm of text.matchAll(
          /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*useAudioStore\s*\(/g,
        )) {
          if (!inLit(sm.index ?? 0)) storeAliases.add(sm[1]!)
        }
        // `s = useAudioStore()` without a decl keyword mints the same
        // alias; `obj.s =` member-assigns are excluded by lookbehind.
        for (const sm of text.matchAll(
          /(?<![\w$.])([A-Za-z_$][\w$]*)\s*=\s*useAudioStore\s*\(/g,
        )) {
          if (!inLit(sm.index ?? 0)) storeAliases.add(sm[1]!)
        }
        // `const s = store` / `const s2 = s` rebind the seam receiver -
        // the alias set follows ident hops (bounded worklist; plain
        // reassignments stay out since only decl forms mint).
        const RECV_IDENTS = 'audioStore|store|audioMgr|audioManager|audio|am'
        for (let hop = 0; hop < 4; hop++) {
          const srcAlt = `${RECV_IDENTS}|[A-Za-z_$][\w$]*(?:AudioStore|AudioMgr|AudioManager)${storeAliases.size ? '|' + [...storeAliases].join('|') : ''}`
          let added = false
          for (const rm of text.matchAll(
            new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:${srcAlt})\\s*(?=[;,\n)]|$)`, 'g'),
          )) {
            if (!inLit(rm.index ?? 0) && !storeAliases.has(rm[1]!) && rm[1] !== 'store') {
              storeAliases.add(rm[1]!)
              added = true
            }
          }
          if (!added) break
        }
        // The receiver idiom is word-BOUNDED: an unanchored suffix match
        // lets `mystore.cue`/`team.playCue`/`stores` pose as the seam.
        const RECV_ALT = storeAliases.size
          ? `(?:${RECEIVER}|${[...storeAliases].join('|')}(?:\\.[\\w$]+)*)`
          : RECEIVER
        // Imported local names: `import { importedCueId } from ...` -
        // an imported ident fed to cue() is a cross-file smuggle lane.
        const importedIdents = new Set<string>()
        // Capture the whole import clause (up to `from`/newline), then
        // pull each specifier form out of it: `import{a}from'x'` (no
        // whitespace), `import def, {a}` and `import def, * as ns` mixed
        // forms drop the tail under an either/or alternation.
        // The clause may span newlines - prettier emits `import {\n  a,\n} from 'x'` -
        // so `\n` is legal inside it; `from`, `;`, or line end still terminate.
        // `;import {x} from 'y'` mid-line is a legal statement boundary -
        // anchoring at `^` alone misses it.
        for (const im of text.matchAll(/(?:^|;)\s*import\s*(?:type\s+)?([^'";]*?)\s*(?:\bfrom\b|;|$)/gm)) {
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
        const constDestructureSpans: Array<[number, number]> = []
        // `for ({cue: q} of seam)` has no decl keyword and `({cue: q} =
        // seam)` is an ASSIGNMENT destructure wrapped in parens - both
        // mint the same alias; the `=|of|in` RHS gate below still
        // filters call-argument object literals (`f({cue: fn})`).
        for (const dm of noLit.matchAll(/\b(?:const|let|var)\s*[{[]|\bfor\s*\(\s*[{[]|\(\s*[{[]/g)) {
          const openIdx = (dm.index ?? 0) + dm[0].length - 1
          const openCh = noLit[openIdx]!
          const closeCh = openCh === '{' ? '}' : ']'
          let depth = 0
          let end = -1
          for (let i = openIdx; i < noLit.length; i++) {
            if (noLit[i] === openCh) depth++
            else if (noLit[i] === closeCh) {
              depth--
              if (depth === 0) {
                end = i
                break
              }
            }
          }
          if (end < 0) continue
          // `(`-led shapes mint a pattern only when the brace closes
          // into `=`/`of`/`in` - `f({cue:q})` is a call-argument literal
          // and must not hide the names inside from the bare arms.
          if (dm[0][0] === '(' && !/^\s*(?:=|of|in)\s/.test(noLit.slice(end + 1))) continue
          constDestructureSpans.push([openIdx, end + 1])
          // Only a destructure FROM the seam renames the store's cue -
          // `const { cue: q } = { cue: localFn }` is a domain-local and
          // its calls must stay exempt (same RHS rule as seamDeclared).
          const afterBrace = noLit.slice(end + 1, end + 1 + 2000)
          // `=` for const-decl destructures; `of`/`in` for `for (const
          // {cue: q} of seam)` / for-in loops - all rename the seam.
          // The RHS may wrap the seam (`of [store]`, `= getStore()`)
          // - it is a seam destructure when a receiver idiom appears
          // anywhere in the expression head.
          // The RHS window may span lines (`of [\n store]`) but must
          // not cross a `;` - a later statement's receiver would mint an
          // alias off an unrelated expression.
          if (
            !new RegExp(
              `^\\s*(?:=|of|in)\\s*(?:\\(\\s*|\\[\\s*)*${RECV_ALT}`,
            ).test(afterBrace)
          ) {
            continue
          }
          const body = noLit.slice(openIdx, end + 1)
          for (const am of body.matchAll(/\b(?:cue|playCue)\s*:\s*([A-Za-z_]\w*)/g)) {
            if (am[1] !== 'cue' && am[1] !== 'playCue') aliases.push(am[1]!)
          }
        }
        // Parameter destructuring `function f({cue: q})` / `f(a, {cue:q})`
        // renames the seam inside the call - collect those aliases too.
        // A `{` is a PARAM pattern only when the enclosing `)` is
        // followed by `=>`/`{`/`:` (body or return type): a call argument
        // `f({cue: fn})` is an object literal and must not mint an alias.
        // Every `{` at any depth inside the paren is scanned (non-leading
        // params), and the spans are kept for the bare-ref arm to exclude.
        const destructureSpans: Array<[number, number]> = []
        // A `(` opened by a control keyword or `?` (`while ({cue:q})`,
        // `for ({cue:q} of x)`, `cond ? ({cue:q}) : y`) is an expression
        // paren, never a parameter list - only an `=>` after `)` can
        // still make it an arrow signature (`return ({cue:q}) => x`).
        // `catch (e)` is deliberately absent: `catch ({cue:q})` is a
        // binding position (catch clause param), not an expression
        // paren - excluding it would let a catch-bound seam alias pass
        // unminted.
        const CONTROL_PAREN_CUE =
          /(?:\b(?:if|for|while|switch|with|return|typeof|case|throw|new|in|of|do|else|yield|await|delete|void|instanceof)|\?)\s*$/
        for (const pm of noLit.matchAll(/[(,]\s*\{/g)) {
          const isParenLed = pm[0].startsWith('(')
          const ctrlParen =
            isParenLed && CONTROL_PAREN_CUE.test(noLit.slice(0, pm.index!))
          const braceIdx = noLit.indexOf('{', pm.index!)
          let bDepth = 0
          let braceEnd = -1
          for (let i = braceIdx; i < noLit.length; i++) {
            if (noLit[i] === '{') bDepth++
            else if (noLit[i] === '}') {
              bDepth--
              if (bDepth === 0) {
                braceEnd = i
                break
              }
            }
          }
          if (braceEnd < 0) continue
          let pDepth = 0
          let parenEnd = -1
          for (let i = braceEnd + 1; i < noLit.length; i++) {
            if (noLit[i] === '(') pDepth++
            else if (noLit[i] === ')') {
              if (pDepth === 0) {
                parenEnd = i
                break
              }
              pDepth--
            }
          }
          if (parenEnd < 0) continue
          const afterParen = noLit.slice(parenEnd + 1)
          // `case f({cue: q}):` closes the paren on the case colon - the
          // `:` satisfies the signature gate while `{cue: q}` is a call
          // argument, not a param destructure. The lookback runs to the
          // enclosing statement (`;`/`{`/`}` boundary), so a line-broken
          // `case\n  f({cue:q})\n:` is caught the same way.
          if (/^\s*:/.test(afterParen)) {
            const stmtStart =
              Math.max(
                noLit.lastIndexOf(';', pm.index!),
                noLit.lastIndexOf('{', pm.index!),
                noLit.lastIndexOf('}', pm.index!),
              ) + 1
            if (/\b(?:case|default)\b[^:]*$/.test(noLit.slice(stmtStart, pm.index!))) continue
          }
          if (ctrlParen ? !/^\s*=>/.test(afterParen) : !/^\s*(?:=>|\{|:)/.test(afterParen)) continue
          destructureSpans.push([braceIdx, braceEnd + 1])
          const body = noLit.slice(braceIdx, braceEnd + 1)
          for (const am of body.matchAll(/\b(?:cue|playCue)\s*:\s*([A-Za-z_]\w*)/g)) {
            if (am[1] !== 'cue' && am[1] !== 'playCue') aliases.push(am[1]!)
          }
        }
        // `const q = store['cue']` extracts through a bracket read the
        // same way `const q = store.cue` does - mint the LHS alias.
        for (const bm of text.matchAll(
          new RegExp(
            `\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${RECV_ALT}\\s*[?!]*\\s*\\.?\\s*\\[\\s*(['"\`])(cue|playCue)\\2\\s*\\]`,
            'g',
          ),
        )) {
          if (!inLit(bm.index ?? 0)) aliases.push(bm[1]!)
        }
        // `const q = store.cue` is the dotted twin of the bracket read -
        // the emit side mints `bus.emit` the same way; a cast tail on the
        // member (`store.cue as F`) still names the seam.
        for (const bm of text.matchAll(
          new RegExp(
            `\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${RECV_ALT}\\s*(?:\\?\\s*\\.|!\\s*\\.|\\.)\\s*(cue|playCue)\\b(?!\\s*\\()`,
            'g',
          ),
        )) {
          if (!inLit(bm.index ?? 0)) aliases.push(bm[1]!)
        }
        // `import { cue as q }` from the store module renames the seam
        // without a destructure - collect those aliases too. Capital
        // targets included: `cue as Q` is a rename, and a cast like
        // `x as Foo` never appears on the seam names themselves.
        for (const im of text.matchAll(/\bimport\s*(?:type\s+)?\{[^}]*\}/g)) {
          if (inLit(im.index ?? 0)) continue
          for (const am of im[0]!.matchAll(/\b(?:cue|playCue)\s+as\s+([A-Za-z_$][\w$]*)/g)) {
            if (am[1] !== 'cue' && am[1] !== 'playCue') aliases.push(am[1]!)
          }
        }
        // The alias arm must mirror CALL's token order exactly (leading
        // `\s*!?` included): dropping it meant `cue !<T>(x)` - a legal
        // non-null assertion BEFORE the generic list - escaped whenever
        // any alias existed in the file.
        const callRe =
          aliases.length === 0
            ? CALL
            : new RegExp(
                `(?:^|[^\\w])(?:cue|playCue|${aliases.join('|')})\\s*!?\\s*(?:\\?\\s*\\.\\s*)?\\s*(?:<[\\s\\S]{0,2000}?(?<!=)>)?\\s*!?\\s*(?:\\?\\.\\s*)?\\(([^)]*)\\)`,
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
          } else {
            // `.cue(`/`.playCue(` on a non-seam receiver (SkillCue or a
            // domain cue API) is not the store seam - restrict the
            // dotted path to the audio-seam receiver idiom, matching
            // the value-ref arm's deliberate scoping.
            if (
              !new RegExp(`(?<![\\w$])(?:\\(\\s*)?${RECV_ALT}\\s*[?!]*\\s*\\)?\\s*$`).test(
                text.slice(0, namePos - 1),
              )
            )
              continue
          }
          const argText = m[1]!
          // Only DEPTH-0 literals are bound to the seam call - a literal
          // inside `cue(f('x'))` or `cue(MAP['x'])` is the callee's/key's
          // argument, not the cue id. An arg shape with no depth-0
          // literal but a nested call/computed head carries an
          // unresolvable id - flag the shape itself.
          {
            const depthAt = (idx: number) => {
              let d = 0
              for (let i = 0; i < idx; i++) {
                const c = argText[i]!
                if (c === '(' || c === '[' || c === '{') d++
                else if (c === ')' || c === ']' || c === '}') d--
              }
              return d
            }
            let sawDepth0Lit = false
            let litViolationCount = 0
            const argBase = (m.index ?? 0) + m[0].length - argText.length
            for (const lit of argText.matchAll(LITERAL)) {
              if (depthAt(lit.index ?? 0) !== 0) continue
              sawDepth0Lit = true
              const vBefore = violations.size
              checkLiteral(violations, file.fromSrc, lit[2]!, argBase + (lit.index ?? 0))
              if (violations.size > vBefore) litViolationCount++
            }
            // `cue(KIND_SOUND[kind])` is a map-index arg, not a computed
            // head - the ident arm below resolves `KIND_SOUND`'s map
            // values and checks those literals. `MAP?.[k]`/`MAP![k]`
            // reach the index through optional/non-null tails.
            const headMapIndex = /^\s*[A-Za-z_]\w*\s*(?:[?!]\s*\.?\s*)?\[/.test(argText)
            if (!sawDepth0Lit && /[(\[{]/.test(argText) && !headMapIndex) {
              // `cue(...['lit'])` spreads an array literal - the `...`
              // prefix reads as an operator and the bracket's depth-1
              // literals are the bound ids, so resolve them like the
              // depth-0 arm instead of flagging the whole head.
              if (/^\s*\.\.\.\s*\[/.test(argText)) {
                for (const lit of argText.matchAll(LITERAL)) {
                  checkLiteral(violations, file.fromSrc, lit[2]!, argBase + (lit.index ?? 0))
                }
              } else {
                violations.add(`${file.fromSrc} -> ${m[0].slice(0, 60)} (computed head arg)`)
              }
              continue
            }
            // `cue('a' + b)` - an arithmetic concat at depth 0 joins an
            // id the manifest check cannot resolve statically (emit's
            // `computed head arg` classification, mirrored for cue).
            const argMasked = argText.split('')
            for (const lit of argText.matchAll(LITERAL)) {
              for (let i = lit.index!; i < lit.index! + lit[0].length; i++) {
                argMasked[i] = ' '
              }
            }
            {
              let d = 0
              let hadOp = false
              for (let i = 0; i < argMasked.length; i++) {
                const c = argMasked[i]!
                if (c === '(' || c === '[' || c === '{') d++
                else if (c === ')' || c === ']' || c === '}') d--
                else if (d === 0 && /[+\-*/%]/.test(c)) {
                  hadOp = true
                  break
                }
              }
              if (hadOp) {
                // A depth-0 literal that already flagged owns this call's
                // report - adding the call-level line would double-count
                // one arg. `cue('ui.click' + n)` keeps the flag because
                // `n` is what the literal check can't see.
                if (litViolationCount === 0) {
                  violations.add(`${file.fromSrc} -> ${m[0].slice(0, 60)} (computed head arg)`)
                }
                continue
              }
            }
          }
          // Identifier/expression args (`cue(KIND_SOUND[kind])`,
          // `cue(cueId)`): resolve the name to literals in the same file -
          // `NAME = 'lit'`, `NAME: 'lit'`, flat map values `NAME = {k: 'lit'}`,
          // and parameter defaults `NAME = 'lit'`. `a ?? 'x'` / `a || b` /
          // `a && 'x'` split at depth 0 - EVERY alternative binds an id, so
          // each segment's head ident is resolved, not only arg-0's.
          // Unary prefixes (`!x`, `~x`, `void x`, `...x`) wrap a binding;
          // they are not the name itself.
          const headInfo: Array<{ ident: string; namePos: boolean }> = []
          {
            let d = 0
            let segStart = 0
            const masked = argText.split('')
            for (const lit of argText.matchAll(LITERAL)) {
              for (let i = lit.index!; i < lit.index! + lit[0].length; i++) masked[i] = ' '
            }
            // `namePos` marks an ident that occupies name position - it
            // reaches the arg's end bare (`cue(COND)`) or carries a
            // member/call tail (`cue(MAP.hit)`, `cue(a?.b)`). Idents in
            // CONDITION position (`cue(COND ? 'a' : 'b')`,
            // `cue(!COND)`, `cue(x && COND)`'s left half) head a
            // condition expression and must not scream-flag.
            const flush = (end: number) => {
              const seg = argText.slice(segStart, end)
              const stripped = seg.replace(
                /^\s*(?:\.\.\.|typeof\s+|void\s+|delete\s+|new\s+|await\s+|yield\s+|in\s+|of\s+|instanceof\s+|!|~|\+|-)+/,
                '',
              )
              const hadPrefix = stripped !== seg
              const head = stripped.match(/^\s*([A-Za-z_]\w*)/)
              if (head) {
                const tail = stripped.slice(head[0].length)
                // `FOO!.hit`/`FOO![k]` carry the member through a
                // non-null bridge the way `?.` does; `FOO as T`/
                // `FOO satisfies T` casts keep the ident in name
                // position (the cast tail is not a different name).
                headInfo.push({
                  ident: head[1]!,
                  namePos:
                    /^\s*(?:[.([]|\?\.|!+|as\b|satisfies\b)/.test(tail) ||
                    (end === masked.length && tail.trim() === '' && !hadPrefix),
                })
              }
            }
            for (let i = 0; i < masked.length; i++) {
              const c = masked[i]!
              if (c === '(' || c === '[' || c === '{') d++
              else if (c === ')' || c === ']' || c === '}') d--
              else if (
                d === 0 &&
                ((c === '?' && masked[i + 1] === '?') ||
                  (c === '|' && masked[i + 1] === '|') ||
                  (c === '&' && masked[i + 1] === '&'))
              ) {
                flush(i)
                segStart = i + 2
                i++
              } else if (
                d === 0 &&
                c === '?' &&
                masked[i + 1] !== '?' &&
                masked[i + 1] !== '.'
              ) {
                // `cond ? A : B` - each BRANCH head is a separate value
                // binding, not a tail of the condition ident.
                flush(i)
                segStart = i + 1
              } else if (d === 0 && c === ':') {
                flush(i)
                segStart = i + 1
              }
            }
            flush(masked.length)
          }
          if (headInfo.length === 0) continue
          // `const k = otherId` rebinds the arg's name - resolve the
          // target's declarations as a next hop (bounded worklist;
          // `seen` also kills `a = b; b = a` cycles).
          const resolvedIdents = new Set<string>()
          const pending = [...new Set(headInfo.map((h) => h.ident))]
          const seen = new Set<string>()
          for (let pi = 0; pi < pending.length && seen.size < 8; pi++) {
            const ident = pending[pi]!
            if (seen.has(ident)) continue
            seen.add(ident)
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
            // Decl scans run on scriptText only - a literal inside Vue
            // template attr text must not mint a "resolved" decl for a
            // script-domain ident.
            for (const dm of scriptText.matchAll(new RegExp(decl, 'g'))) {
              resolvedIdents.add(ident)
              const tail = scriptText.slice(dm.index! + dm[0].length)
              // If the declaration ended on `{` it opened a flat
              // `{k: 'lit', k2: 'lit2'}` map - sweep its string VALUES.
              // A quoted KEY (`{'ui.click': handler}`) sits at `lit:`
              // position and is never a bound id.
              const arr = dm[0].endsWith('[') ? tail.match(/^[^\]]*\]/) : null
              const obj = dm[0].endsWith('{') ? tail.match(/^[^}]*\}/) : null
              if (arr) {
                for (const lit of arr[0].matchAll(LITERAL)) {
                  checkLiteral(violations, file.fromSrc, lit[2]!, dm.index! + dm[0].length + (lit.index ?? 0))
                }
              } else if (obj) {
                for (const lit of obj[0].matchAll(LITERAL)) {
                  if (/^\s*:/.test(obj[0].slice(lit.index! + lit[0].length))) continue
                  checkLiteral(violations, file.fromSrc, lit[2]!, dm.index! + dm[0].length + (lit.index ?? 0))
                }
              } else {
                const first = LITERAL.exec(tail)
                LITERAL.lastIndex = 0
                if (first && first.index < 8) {
                  checkLiteral(violations, file.fromSrc, first[2]!, dm.index! + dm[0].length + first.index)
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
                    checkLiteral(violations, file.fromSrc, nxt[2]!, dm.index! + dm[0].length + cursor)
                    cursor += nxt[0].length
                  }
                }
              }
            }
            // `const [id] = [...]` / `const {id} = {...}` bind the name
            // through a destructure pattern - the RHS literals still
            // resolve to the bound ids.
            for (const dm of scriptText.matchAll(new RegExp(`\\b(?:const|let|var)\\s*[\\[{][^\\]}\n]*\\b${ident}\\b[^;\n]*?=\\s*`, 'g'))) {
              resolvedIdents.add(ident)
              const tail = scriptText.slice(dm.index! + dm[0].length)
              const arr = tail.match(/^\[[^\]]*\]/)
              const obj = tail.match(/^\{[^}]*\}/)
              if (arr) {
                for (const lit of arr[0].matchAll(LITERAL)) {
                  checkLiteral(violations, file.fromSrc, lit[2]!, dm.index! + dm[0].length + (lit.index ?? 0))
                }
              } else if (obj) {
                for (const lit of obj[0].matchAll(LITERAL)) {
                  if (/^\s*:/.test(obj[0].slice(lit.index! + lit[0].length))) continue
                  checkLiteral(violations, file.fromSrc, lit[2]!, dm.index! + dm[0].length + (lit.index ?? 0))
                }
              } else {
                const first = LITERAL.exec(tail)
                LITERAL.lastIndex = 0
                if (first && first.index < 8) {
                  checkLiteral(violations, file.fromSrc, first[2]!, dm.index! + dm[0].length + first.index)
                }
              }
            }
            // `k = otherId` (bare-ident RHS) rebinds the arg's id -
            // queue the target's declarations for the next hop.
            for (const rm of scriptText.matchAll(new RegExp(`\\b${ident}\\s*=(?!=)\\s*([A-Za-z_]\\w*)\\s*(?=;|\\n|$)`, 'g'))) {
              if (!seen.has(rm[1]!) && rm[1] !== ident) pending.push(rm[1]!)
            }
          }
          // A bare CONSTANT-style identifier arg that resolves to no
          // in-file literal is a cross-file lane: `cue(SOME_IMPORTED)`
          // smuggles any id through an import this scan cannot read.
          // (Locals/params are lowercase idiomatically; screaming idents
          // are const-table names.) Imported names are the cross-file
          // lane regardless of casing.
          for (const ident of seen) {
            if (resolvedIdents.has(ident)) continue
            // Imported names are the cross-file lane in ANY position -
            // a screaming-case LOCAL only flags when it sits in name
            // position (member/call tail or terminal bare arg); a
            // screaming ident heading a `?`/unary/`&&` condition is a
            // gate, not an id.
            const inNamePos = headInfo.find((h) => h.ident === ident)?.namePos
            if (importedIdents.has(ident) || (inNamePos && /^[A-Z_][A-Z0-9_]*$/.test(ident))) {
              violations.add(`${file.fromSrc} -> unresolved cross-file ident ${ident}`)
            }
          }
        }
        // Alias indirect forms: `const {cue: q} = store; q.call(this, x)`
        // - callRe only sees `q(`, so `q.call|apply|bind` escapes the
        // literal check on ANY receiver.
        for (const alias of aliases) {
          const reIndirect = new RegExp(
            `\\b${alias}\\s*[?!]*\\s*\\.\\s*(?:call|apply|bind)\\s*(?:\\?\\s*\\.)?\\s*\\(`,
            'g',
          )
          for (const vm of text.matchAll(reIndirect)) {
            if (localNames.has(alias)) continue
            if (inLit(vm.index ?? 0)) continue
            violations.add(`${file.fromSrc} -> indirect ${vm[0]} at offset ${vm.index}`)
          }
        }
        // `.cue`/`.playCue` on an audio-seam receiver referenced as a
        // VALUE (callback passing like arr.forEach(store.cue), alias
        // RHS) is not a call shape and would escape CALL entirely - flag
        // it. Receiver names are restricted to audio-seam idiom so the
        // VFX domain's own `cue` property (SkillCue) is not flagged.
        // `useAudioStore(pinia)` is the real Pinia signature - args are
        // allowed; member tails (`store.self.cue`) keep the seam.
        for (const vm of text.matchAll(
          // `[?!]*` before the dot keeps `store?.cue` and `store!.cue`
          // on the receiver arm.
          new RegExp(
            `\\b${RECV_ALT}\\s*[?!]*\\s*\\.\\s*(cue|playCue)\\b(?!\\s*!?\\s*(?:\\?\\s*\\.\\s*)?\\s*(?:<[\\s\\S]{0,2000}?(?<!=)>)?\\s*!?\\s*(?:\\?\\.\\s*)?\\(|\\s*[?!]*\\s*\\.\\s*(?:call|apply|bind)\\s*(?:\\?\\s*\\.\\s*)?\\s*\\()`,
            'g',
          ),
        )) {
          // `typeof store.cue` queries the member as a TYPE - the binding
          // rules govern call sites, not type queries.
          if (/\btypeof\s*$/.test(text.slice(Math.max(0, vm.index! - 64), vm.index!))) continue
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
          [...noLit.matchAll(/\b(?:const|let|var)\s*[{[]|\bfor\s*\(\s*(?:const|let|var)?\s*[{[]|\(\s*[{[]/g)].some((dm) => {
            const openIdx = (dm.index ?? 0) + dm[0].length - 1
            const openCh = noLit[openIdx]!
            const closeCh = openCh === '{' ? '}' : ']'
            let depth = 0
            let end = -1
            for (let i = openIdx; i < noLit.length; i++) {
              if (noLit[i] === openCh) depth++
              else if (noLit[i] === closeCh) {
                depth--
                if (depth === 0) {
                  end = i
                  break
                }
              }
            }
            if (end < 0) return false
            if (!/\b(?:cue|playCue)\b/.test(noLit.slice(openIdx, end + 1))) return false
            // `=` for destructures, `of`/`in` for for-loops - same gate
            // as the alias arm; `(`-led shapes also require the binding
            // tail so `f({cue})` call arguments stay out.
            return new RegExp(`^\\s*(?:=|of|in)\\s*(?:\\(\\s*|\\[\\s*)*${RECV_ALT}(?![\\w$.])`).test(noLit.slice(end + 1))
          }) ||
          new RegExp(
            `\\b(?:const|let|var)\\s+(?:cue|playCue)\\s*=\\s*${RECV_ALT}\\s*[?!]*\\s*\\.\\s*(?:cue|playCue)\\b`,
          ).test(text)
        // `((cue))` double-wraps, `(cue as <complex>)(x)` carries
        // complex cast types, and alias names ride the same paren-
        // callee shape (`(q as F)(x)`).
        const cueParenRe = new RegExp(
          `\\(\\s*\\(*\\s*(cue|playCue${aliases.length ? '|' + aliases.join('|') : ''})(?:\\s+as\\s+[\\w$.<>\\[\\]|&()\\s,:?'"=]*?)?\\s*\\)*\\s*\\)\\s*(?:\\?\\s*\\.|\\.)?\\s*(?:(?:call|apply|bind)\\s*(?:\\?\\s*\\.)?\\s*)?\\(`,
          'g',
        )
        if (seamDeclared) {
          // The `(cue` inside a paren-callee call (`(cue)(x)`) is owned
          // by the paren-callee arm below - flagging it here too
          // double-reports one site.
          const parenCueSpans: Array<[number, number]> = []
          for (const pm of text.matchAll(cueParenRe)) {
            parenCueSpans.push([pm.index!, pm.index! + pm[0].length])
          }
          // Value-position fences, not only `(`/`,`/`]`: `cue` handed
          // around as a VALUE reads `[cue]`, `= cue`, `{k: cue}`,
          // `...cue`, `x ? cue : y`, `return cue`, `cue &&`, `cue =>`.
          // Property names (`cue:`), callees (`cue(`), member tails
          // (`.cue`), declarations and the destructure bindings
          // themselves are owned by other arms or the destructure spans.
          for (const vm of text.matchAll(/\b(cue|playCue)\b/g)) {
            if (localNames.has(vm[1]!)) continue
            const pos = vm.index ?? 0
            if (inLit(pos)) continue
            if (
              destructureSpans.some(([a, b]) => pos >= a && pos < b) ||
              constDestructureSpans.some(([a, b]) => pos >= a && pos < b) ||
              parenCueSpans.some(([a, b]) => pos >= a && pos < b)
            ) continue
            const before = text.slice(Math.max(0, pos - 10), pos)
            const after = text.slice(pos + vm[0].length)
            if (!/(?:[\(,=\[:;{!&|?:+\-*\/%^~<>]|\.\.\.|\b(?:return|yield|await|typeof|void|in|of|instanceof|new|delete)\b|=>)\s*$/.test(before)) continue
            // `cond ? cue : alt` - the `:` is a ternary end, not a
            // property name, only when the left fence was the `?`.
            const ternaryTail = /\?\s*$/.test(before) && /^\s*:/.test(after)
            if (
              !ternaryTail &&
              !/^\s*(?:[,)\]};&|+\-*\/<>!]|=>|==(?!=)|!(?!=)|\?(?!\s*:))/.test(after)
            )
              continue
            violations.add(`${file.fromSrc} -> bare-ref ${vm[1]} at offset ${vm.index}`)
          }
          // `case cue:` / `case playCue:` reads the seam name in a label
          // position - `case` is no fence so the bare-ref arm can't see
          // it. `case cue + 1:` / `case cue.foo:` share the label shape.
          for (const vm of text.matchAll(/\bcase\s+(cue|playCue)\b[^:]*?:/g)) {
            if (inLit(vm.index ?? 0)) continue
            violations.add(`${file.fromSrc} -> bare-ref case ${vm[0].slice(0, 40)} at offset ${vm.index}`)
          }
        }
        // Cue aliases read as VALUES (`forEach(q)`, `const f = q`,
        // `{handler: q}`, `cond ? q : alt`, `case q:`) bypass the call arm
        // the same way emit aliases do - mirror its bare/case/ternary
        // arms over the collected alias list.
        for (const alias of aliases) {
          if (localNames.has(alias)) continue
          const reBareAlias = new RegExp(
            `(?:[(,=\\[:;{!&|?:+\\-*\\/%^~<>]|\\.\\.\\.|\\b(?:return|yield|await|typeof|void|in|of|instanceof|new|delete)\\s)\\s*${alias}\\s*(?=[,)\\]};])`,
            'g',
          )
          for (const m of text.matchAll(reBareAlias)) {
            if (inLit(m.index ?? 0)) continue
            // The alias DECL's own binding sits inside a destructuring
            // pattern span - binding position, not a use.
            if (
              destructureSpans.some(([a, b]) => m.index! >= a && m.index! < b) ||
              constDestructureSpans.some(([a, b]) => m.index! >= a && m.index! < b)
            ) continue
            violations.add(`${file.fromSrc} -> ${m[0].slice(0, 60)} (bare alias value)`)
          }
          const reAliasCase = new RegExp(`\\bcase\\s+${alias}\\b[^:]*?:`, 'g')
          for (const m of text.matchAll(reAliasCase)) {
            if (inLit(m.index ?? 0)) continue
            violations.add(`${file.fromSrc} -> ${m[0].slice(0, 60)} (bare alias case)`)
          }
          const reAliasTernary = new RegExp(`\\?\\s*${alias}(?:\\s*[?!]*\\s*(?:\\.[\\w$]+|\\[[^\\]\\n]*\\]))*\\s*:`, 'g')
          for (const m of text.matchAll(reAliasTernary)) {
            if (inLit(m.index ?? 0)) continue
            violations.add(`${file.fromSrc} -> ${m[0].slice(0, 60)} (bare alias ternary)`)
          }
          // `q['call'](x)` - bracket member on the alias invokes the
          // seam binding through a shape the dotted arm cannot see.
          const reCueAliasBracketCall = new RegExp(`\\b${alias}\\s*[?!]*\\s*\\.?\\s*\\[\\s*([^\\]]*)\\]\\s*\\(`, 'g')
          for (const m of text.matchAll(reCueAliasBracketCall)) {
            if (inLit(m.index ?? 0)) continue
            const bsegs = [...m[1]!.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)].map(
              (sm) =>
                (sm[1] ?? sm[2] ?? sm[3]!)
                  .replace(/\\x([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
                  .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
                  .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16))),
            )
            if (/^(?:call|apply|bind)$/.test(bsegs.join(''))) {
              violations.add(`${file.fromSrc} -> indirect ${m[0].slice(0, 60)} at offset ${m.index}`)
            }
          }
        }
        // Indirect invocation escapes the dotted value-ref arm:
        // `store.cue.call(this, x)`, `.apply`, `.bind`, and the bare
        // destructured `cue.call(...)` form.
        for (const vm of text.matchAll(
          new RegExp(
            `\\b${RECV_ALT}\\s*[?!]*\\s*\\.\\s*(?:cue|playCue)\\s*[?!]*\\s*\\.\\s*(?:call|apply|bind)\\s*(?:\\?\\s*\\.)?\\s*\\(`,
            'g',
          ),
        )) {
          violations.add(`${file.fromSrc} -> indirect ${vm[0]} at offset ${vm.index}`)
        }
        // `cue?.call(x)` / `cue!.call(x)` - the nullish/non-null marker
        // sits between the name and the member dot.
        for (const vm of text.matchAll(/\b(cue|playCue)\s*[?!]*\s*\.\s*(?:call|apply|bind)\s*(?:\?\s*\.)?\s*\(/g)) {
          if (localNames.has(vm[1]!)) continue
          if (inLit(vm.index ?? 0)) continue
          // `store.cue.call(` already flags under the receiver arm above
          // - skip only when the dotted receiver IS the seam idiom;
          // `foo.cue.call` on a non-seam name is still an unverifiable
          // indirect lane (a wider lookback: member tails may chain).
          if (
            new RegExp(`${RECV_ALT}\\s*\\.\\s*$`).test(
              text.slice(Math.max(0, vm.index! - 80), vm.index!),
            )
          ) continue
          violations.add(`${file.fromSrc} -> indirect ${vm[0]} at offset ${vm.index}`)
        }
        // `cue['call'](x)` - bracket member spelling of the same
        // indirect invocation; decode+join like `store['cue']` does.
        const decodeSeg = (seg: string): string =>
          seg
            .replace(/\\x([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
            .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
            .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
        for (const vm of text.matchAll(/\b(cue|playCue)\s*[?!]*\s*\.?\s*\[\s*([^\]]*)\]\s*\(/g)) {
          if (localNames.has(vm[1]!)) continue
          if (inLit(vm.index ?? 0)) continue
          const bsegs = [...vm[2]!.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)].map(
            (sm) => decodeSeg(sm[1] ?? sm[2] ?? sm[3]!),
          )
          if (/^(?:call|apply|bind)$/.test(bsegs.join(''))) {
            violations.add(`${file.fromSrc} -> indirect ${vm[0]} at offset ${vm.index}`)
          }
        }
        // `(cue)?.(x)` / `(cue)(x)` / `(cue as F)(x)` - a paren-wrapped
        // callee still runs the bare name.
        // An ident arg resolves through the same literal pipeline as the
        // call arm (`(cue)(goodId)` where `goodId = 'ui.click'` is
        // resolvable; `(cue)(hop)` -> bogus stays flagged but named).
        const resolveArgIdent = (ident: string): boolean => {
          let resolved = false
          const pending = [ident]
          const seen = new Set<string>()
          for (let pi = 0; pi < pending.length && seen.size < 8; pi++) {
            const id = pending[pi]!
            if (seen.has(id)) continue
            seen.add(id)
            const decl =
              `\\b${id}\\s*(?::[^=\\n]+)?(?:\\?\\?=|\\|\\|=|&&=|\\+=|=)\\s*` +
              `(?:\\(*\\s*(?=['"\`])|[\\[{]|\\w+\\s*\\(\\s*(?=['"\`])|[^;="'\`\\n]*?\\?\\s*(?=['"\`])|[^;="'\`\\n]*?(?:&&|\\|\\|)\\s*(?=['"\`]))` +
              `|\\b${id}\\s*:\\s*(?=['"\`])`
            // Same scriptText-only rule as the main ident arm.
            for (const dm of scriptText.matchAll(new RegExp(decl, 'g'))) {
              resolved = true
              const tail = scriptText.slice(dm.index! + dm[0].length)
              const arr = dm[0].endsWith('[') ? tail.match(/^[^\]]*\]/) : null
              const obj = dm[0].endsWith('{') ? tail.match(/^[^}]*\}/) : null
              if (arr) {
                for (const lit of arr[0].matchAll(LITERAL)) {
                  checkLiteral(violations, file.fromSrc, lit[2]!, dm.index! + dm[0].length + (lit.index ?? 0))
                }
              } else if (obj) {
                for (const lit of obj[0].matchAll(LITERAL)) {
                  if (/^\s*:/.test(obj[0].slice(lit.index! + lit[0].length))) continue
                  checkLiteral(violations, file.fromSrc, lit[2]!, dm.index! + dm[0].length + (lit.index ?? 0))
                }
              } else {
                const first = LITERAL.exec(tail)
                LITERAL.lastIndex = 0
                if (first && first.index < 8) {
                  checkLiteral(violations, file.fromSrc, first[2]!, dm.index! + dm[0].length + first.index)
                  let cursor = first.index + first[0].length
                  for (;;) {
                    const plus = /^\s*[:+]\s*/.exec(tail.slice(cursor))
                    if (!plus) break
                    cursor += plus[0].length
                    const nxt = /^(['"`])([^'"`\n]*)\1/.exec(tail.slice(cursor))
                    if (!nxt) break
                    checkLiteral(violations, file.fromSrc, nxt[2]!, dm.index! + dm[0].length + cursor)
                    cursor += nxt[0].length
                  }
                }
              }
            }
            // `const [id] =`/`const {id} =` bind through a pattern.
            for (const dm of scriptText.matchAll(new RegExp(`\\b(?:const|let|var)\\s*[\\[{][^\\]}\n]*\\b${id}\\b[^;\n]*?=\\s*`, 'g'))) {
              resolved = true
              const tail = scriptText.slice(dm.index! + dm[0].length)
              const arr = tail.match(/^\[[^\]]*\]/)
              const obj = tail.match(/^\{[^}]*\}/)
              if (arr) {
                for (const lit of arr[0].matchAll(LITERAL)) {
                  checkLiteral(violations, file.fromSrc, lit[2]!, dm.index! + dm[0].length + (lit.index ?? 0))
                }
              } else if (obj) {
                for (const lit of obj[0].matchAll(LITERAL)) {
                  if (/^\s*:/.test(obj[0].slice(lit.index! + lit[0].length))) continue
                  checkLiteral(violations, file.fromSrc, lit[2]!, dm.index! + dm[0].length + (lit.index ?? 0))
                }
              } else {
                const first = LITERAL.exec(tail)
                LITERAL.lastIndex = 0
                if (first && first.index < 8) {
                  checkLiteral(violations, file.fromSrc, first[2]!, dm.index! + dm[0].length + first.index)
                }
              }
            }
            for (const rm of scriptText.matchAll(new RegExp(`\\b${id}\\s*=(?!=)\\s*([A-Za-z_]\\w*)\\s*(?=;|\\n|$)`, 'g'))) {
              if (!seen.has(rm[1]!) && rm[1] !== id) pending.push(rm[1]!)
            }
          }
          return resolved
        }
        for (const vm of text.matchAll(
          // `(cue).call(x)` - a plain `.` bridge after the paren is the
          // same indirect invocation as `?.`.
          cueParenRe,
        )) {
          if (localNames.has(vm[1]!)) continue
          if (inLit(vm.index ?? 0)) continue
          const inner = text.slice(vm.index! + vm[0].length)
          const argM = /^(['"`])([^'"`\n]*)\1/.exec(inner)
          if (argM) {
            checkLiteral(violations, file.fromSrc, argM[2]!)
          } else {
            const argIdent =
              /^\s*(?:\.{3}\s*|[!~+\-]\s*|void\s+|typeof\s+|new\s+|await\s+|yield\s+|in\s+|of\s+|instanceof\s+|delete\s+)*([A-Za-z_$][\w$]*)/.exec(
                inner,
              )
            if (!(argIdent && resolveArgIdent(argIdent[1]!))) {
              violations.add(`${file.fromSrc} -> paren-callee ${vm[0]} at offset ${vm.index}`)
            }
          }
        }
        // `(cue)` + tagged template - a paren-wrapped callee still tags.
        for (const vm of text.matchAll(new RegExp(
          `\\(\\s*\\(*\\s*(cue|playCue${aliases.length ? '|' + aliases.join('|') : ''})(?:\\s+as\\s+[\\w$.<>\\[\\]|&()\\s,:?'"=]*?)?\\s*\\)*\\s*\\)\\s*\``,
          'g',
        ))) {
          if (localNames.has(vm[1]!)) continue
          if (inLit(vm.index ?? 0)) continue
          violations.add(`${file.fromSrc} -> paren-callee tag ${vm[0]} at offset ${vm.index}`)
        }
        // Bracket access computing the cue name from quoted segments
        // (`['cue']`, `['cu'+'e']`, `['c'+'ue']`, `['c\x75e']`,
        // `['play'+'Cue']`) is indirect invocation on ANY receiver -
        // `obj['cue'](x)` is not idiomatic member access. A trailing
        // `(` is required - a bare read `const f = obj['cue']` is data
        // flow, not invocation. Escapes inside segments are decoded
        // before the join is compared.
        // The receiver may be a call result or a parenthesized expr too:
        // `useAudioStore()['cue'](x)` / `(store)['cue'](x)` must not
        // evade (an ident-only chain never saw the `()` tail).
        // `store?.['cue'](x)` / `store!.['cue'](x)` / `store.['cue'](x)` -
        // the nullish/non-null/dotted bridge before the bracket was
        // invisible to an ident-only receiver.
        for (const vm of text.matchAll(/(?:\b[A-Za-z_$][\w$]*(?:\.[\w$]+)*(?:\s*\([^()]*\))?|\([^()]*\))\s*(?:\?\s*)?(?:\.|!)?\s*\[\s*([^\]]*)\]\s*\(/g)) {
          const segs = [...vm[1]!.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)].map(
            (sm) => decodeSeg(sm[1] ?? sm[2] ?? sm[3]!),
          )
          if (segs.length === 0) continue
          if (segs.join('') === 'cue' || segs.join('') === 'playCue') {
            violations.add(`${file.fromSrc} -> indirect ${vm[0]} at offset ${vm.index}`)
          }
        }
        // A bracket READ of the seam member (`const f = store['cue']`)
        // on an audio-seam receiver is the same extraction the dotted
        // value-ref arm flags - the `]`-then-`(` requirement above only
        // covers invocation, so flag reads on seam receivers outright.
        for (const vm of text.matchAll(
          new RegExp(`(?:\\b${RECV_ALT}|\\([^()]*\\))\\s*(?:\\?\\s*)?(?:\\.|!)?\\s*\\[\\s*([^\\]]*)\\]`, 'g'),
        )) {
          // `(store)['cue'](x)` is invocation - the invoke arm owns it;
          // allow a `(...)` member tail between `]` and `(` too.
          if (/^\s*\([^()]*\)|^\s*\(/.test(text.slice(vm.index! + vm[0].length))) continue
          const segs = [...vm[1]!.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)].map(
            (sm) => decodeSeg(sm[1] ?? sm[2] ?? sm[3]!),
          )
          if (segs.length === 0) continue
          if (segs.join('') === 'cue' || segs.join('') === 'playCue') {
            violations.add(`${file.fromSrc} -> bracket-read ${vm[0].trim()} at offset ${vm.index}`)
          }
        }
        // `store.cu\u0065(...)` spells the seam through a unicode escape -
        // flag escapes embedded in identifier-ish text. (A `\uXXXX` inside
        // a plain string literal is not matched because a word char must
        // sit immediately before the backslash.)
        // `\u0063ue('x')` at statement start has no word char before the
        // backslash - the prefix class is optional so both the embedded
        // form (`store.cu\u0065`) and the leading form flag.
        for (const vm of text.matchAll(
          /(^|[^\\])(?:\\u(?:[0-9a-fA-F]{4}|\{[0-9a-fA-F]+\})|\\x[0-9a-fA-F]{2})/gm,
        )) {
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
      }
      expect([...violations].sort()).toEqual([])
    },
    SCAN_TIMEOUT,
  )
})
