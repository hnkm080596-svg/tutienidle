/**
 * Screen-shake authority guard - `screenShakePolicy.ts` claims to be the
 * sole shake surface (it scales by `audio.reducedShake`). Nothing prevents
 * a future `cameras.main.shake(` from bypassing that policy silently, so
 * this sweep pins every shake call shape to the policy module.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { SCAN_TIMEOUT, srcCorpus, isTestFile } from './helpers/scanTs'
import { literalRanges, uncommented, templateExprText, usesJsxBlocks } from './helpers/commentStrip'

const SRC_DIR = join(process.cwd(), 'src')
const POLICY_FILE = 'presentation/vfx/screenShakePolicy.ts'

const decodeSeg = (seg: string): string =>
  seg
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))

describe('screen shake authority', () => {
  it(
    'every shake call routes through applyScreenShake',
    () => {
      const offenders: string[] = []
      for (const file of srcCorpus(SRC_DIR)) {
        if (file.fromSrc === POLICY_FILE || isTestFile(file.fromSrc)) continue
        // For .vue, sweep template expression text too - `@click=` and
        // `{{ }}` values compile to real call sites, and a `cam.shake()`
        // inside a quoted attribute is a literal span in script text.
        const templateText = file.fromSrc.endsWith('.vue')
          ? templateExprText(file.text)
          : ''
        const text = uncommented(file.text, file.fromSrc) + '\n' + templateText
        const lits = literalRanges(text, file.fromSrc, usesJsxBlocks(file.text, file.fromSrc))
        const inLit = (i: number) =>
          lits.some((r) => i >= r.pos && i < r.end)
        // Single-ident constants the bracket arm can resolve statically:
        // `const KEY = 'shake'` then `cam[KEY]` - unresolvable idents are
        // a documented residual (dynamic keys stay silent). Literal
        // evidence is POSITIONAL: a name resolves to the nearest literal
        // assign before the use site, not the file's last write (`const
        // K='shake'` in one scope must not be clobbered by `K='x'` in
        // another). A non-literal reassign (`K = expr`) kills earlier
        // evidence for uses after it; literal and ident-RHS assigns are
        // decl entries themselves (a `B = A` hop resolves A at B's own
        // position).
        const litDecls = new Map<string, Array<{ pos: number; lit: string; kind: string }>>()
        const litKills = new Map<string, number[]>()
        const pushLitDecl = (name: string, pos: number, lit: string, kind: string) => {
          const arr = litDecls.get(name) ?? []
          arr.push({ pos, lit, kind })
          litDecls.set(name, arr)
        }
        for (const cm of text.matchAll(
          /\b(?:(const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*=(?!=)\s*(?:'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`)/g,
        )) {
          pushLitDecl(cm[2]!, cm.index!, cm[3] ?? cm[4] ?? cm[5]!, cm[1] ?? 'let')
        }
        // Compound/logical assigns and non-literal `=` rebinds invalidate
        // earlier evidence; literal (`K = 'x'`) and ident (`B = A`) RHS
        // assigns mint entries above instead.
        for (const km of text.matchAll(
          /\b(?:const\s+|let\s+|var\s+)?([A-Za-z_$][\w$]*)\s*(=(?!=)|\+\+|--|<<=|>>>=|>>=|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|\?\?=|&&=|\|\|=)/g,
        )) {
          if (km[2] === '=') {
            const rhs = text.slice(km.index! + km[0].length)
            if (/^\s*['"`]/.test(rhs)) continue
            if (/^\s*[A-Za-z_$][\w$]*\s*(?=[;,\n)]|$)/.test(rhs)) continue
          }
          const arr = litKills.get(km[1]!) ?? []
          arr.push(km.index!)
          litKills.set(km[1]!, arr)
        }
        const resolveLitAt = (name: string, usePos: number): string | undefined => {
          const decls = litDecls.get(name)
          if (!decls) return undefined
          let best: { pos: number; lit: string; kind: string } | undefined
          for (const d of decls) {
            if (d.pos < usePos && (!best || d.pos > best.pos)) best = d
          }
          if (!best) return undefined
          if (best.kind !== 'const') {
            const kills = litKills.get(name) ?? []
            if (kills.some((k) => k > best!.pos && k <= usePos)) return undefined
          }
          return best.lit
        }
        for (const rm of text.matchAll(
          /\b(?:(const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*=(?!=)\s*([A-Za-z_$][\w$]*)\s*(?=[;,\n)]|$)/g,
        )) {
          // Runs after literals + kills: the hop's value is whatever the
          // source resolves to at the hop's own position.
          const src = resolveLitAt(rm[3]!, rm.index!)
          if (src !== undefined) pushLitDecl(rm[2]!, rm.index!, src, rm[1] ?? 'let')
        }
        // Rebuilds a bracket key expression into ordered literal pieces
        // plus dynamic gaps: quoted segs decode (escapes unescaped), bare
        // idents resolve through resolveLitAt (a resolved ident joins the
        // literal run), a `${x}` interpolation inside a backtick seg is
        // an unverifiable hole inside the literal, and any other
        // dynamic/op text is an unverifiable gap between pieces.
        const rebuildKey = (
          keyText: string,
          at: number,
        ): { flat: string; lits: string[]; leadDyn: boolean; trailDyn: boolean; unres: boolean; hadQuoted: boolean } => {
          const segMatches = [...keyText.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)]
          // Backtick segs may embed `${x}` holes - split them into the
          // static pieces so the spell test keeps their order.
          const segPieces: string[][] = []
          let unres = false
          for (const sm of segMatches) {
            const raw = sm[1] ?? sm[2] ?? sm[3]!
            const decoded = raw
              .replace(/\\x([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
              .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
              .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
            if (sm[3] !== undefined && decoded.includes('${')) {
              unres = true
              segPieces.push(decoded.split(/\$\{[^}]*\}/).filter((p) => p !== ''))
            } else {
              segPieces.push([decoded])
            }
          }
          let si = 0
          const tmp = keyText.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, () => `\x01${si++}\x01`)
          // Resolved idents mint \x02 markers; unresolved mint \x03 - the
          // token walk below reads them in order.
          const resolvedLits: string[] = []
          let ri = 0
          const marked = tmp.replace(/[A-Za-z_$][\w$]*/g, (id) => {
            const v = resolveLitAt(id, at)
            if (v === undefined) return '\x03'
            resolvedLits.push(v)
            return `\x02${ri++}\x02`
          })
          const tokens: Array<{ lit: string } | 'dyn'> = []
          for (const tm of marked.matchAll(/\x01\d+\x01|\x02\d+\x02|\x03+|[^\x01\x02\x03]+/g)) {
            const t = tm[0]
            if (t.startsWith('\x01')) {
              const pieces = segPieces[+t.slice(1, -1)]!
              if (pieces.length === 0) {
                tokens.push('dyn')
              } else {
                for (let pi = 0; pi < pieces.length; pi++) {
                  if (pi > 0) tokens.push('dyn')
                  tokens.push({ lit: pieces[pi]! })
                }
              }
            } else if (t.startsWith('\x02')) {
              tokens.push({ lit: resolvedLits[+t.slice(1, -1)]! })
            } else {
              // `+`/whitespace are connectors; `\x03` (unresolved ident)
              // or any other text is a dynamic gap.
              if (t.includes('\x03') || /[^\s+]/.test(t)) tokens.push('dyn')
            }
          }
          const lits = tokens.filter((t): t is { lit: string } => t !== 'dyn').map((t) => t.lit)
          return {
            flat: lits.join(''),
            lits,
            leadDyn: tokens[0] === 'dyn',
            trailDyn: tokens.length > 0 && tokens[tokens.length - 1] === 'dyn',
            unres: unres || tokens.includes('dyn'),
            hadQuoted: segMatches.length > 0,
          }
        }
        // Member-position `shake` in ANY invocation shape is the policy
        // bypass surface: `cam.shake(...)`, `cam?.shake(...)`,
        // `cam.shake.call/apply/bind(...)`, `(x.shake)(...)`, and the
        // value-ref `const s = cam.shake` all reach the same camera API
        // without the reducedShake scale.
        for (const m of text.matchAll(/(?:\?\s*)?\.\s*shake\b/g)) {
          const i = m.index ?? 0
          if (inLit(i)) continue
          offenders.push(`${file.fromSrc}:${i}`)
        }
        // Computed bracket members: `cam['shake'](...)`, `cam['sh'+'ake']`,
        // `` cam[`shake`]() ``, `cam['sh\u0061ke'](...)` - quoted segments
        // are escape-decoded then concatenated before the name compare.
        for (const m of text.matchAll(/\[\s*[^\]]*\]/g)) {
          const i = m.index ?? 0
          if (inLit(i)) continue
          // `['shake']` opening an array literal (`const a = ['shake']`)
          // is data, not member access - require a receiver before the
          // bracket. A keyword tail (`of [...x]`, `return [...]`) reads
          // as an identifier but starts an expression, not a member.
          const prevWord = /[\w$]*$/.exec(text.slice(0, i))![0]
          // `.` qualifies as a receiver tail: `cam?.['shake']` and
          // `cam.['shake']` end the receiver on the optional/plain dot.
          if (!/[\w$\)\]?!.]\s*$/.test(text.slice(0, i))) continue
          if (
            /^(?:of|in|new|return|typeof|delete|void|instanceof|yield|await|case|do|else|throw|const|let|var|import|export|from|function|class|extends|if|for|while|switch|catch|with)$/.test(
              prevWord,
            )
          ) continue
          // `[...x, 'lit']` is an array literal with a spread element,
          // not a computed member.
          if (/^\[\s*\.\.\./.test(m[0])) continue
          // Alternatives inside the bracket (`cam[k ? 'shake' : 'x']`,
          // `cam[a, 'shake']`) are depth-0 `,`/`?`/`:`-separated - each
          // alternative spells its own member, so decode per
          // alternative instead of joining the whole bracket.
          const inner = m[0].slice(1, -1)
          const alts: string[] = []
          {
            let ad = 0
            let cur = ''
            for (const ch of inner) {
              if (ch === '(' || ch === '[' || ch === '{') ad++
              else if (ch === ')' || ch === ']' || ch === '}') ad--
              if (ad === 0 && ch === '?') {
                // A depth-0 `?` opens a ternary - everything before it
                // is the CONDITION (`cam[k === 'shake' ? 'a' : 'b']`),
                // not a member alternative; only `:`/`,` arms carry
                // key text.
                cur = ''
                continue
              }
              if (ad === 0 && (ch === ',' || ch === ':')) {
                alts.push(cur)
                cur = ''
                continue
              }
              cur += ch
            }
            alts.push(cur)
          }
          let flaggedBracket = false
          for (const alt of alts) {
            const { flat, lits, leadDyn, trailDyn, unres, hadQuoted } = rebuildKey(alt, i)
            if (!hadQuoted) {
              // `cam[key]` / `cam[k ? KEY : 'x']` with a bare identifier
              // key resolves against in-file literal decls; anything
              // else is the documented residual.
              const ident = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(alt)?.[1]
              if (ident && resolveLitAt(ident, i) === 'shake') {
                offenders.push(`${file.fromSrc}:${i} (ident-key ${ident})`)
                flaggedBracket = true
              }
              continue
            }
            // Resolved flat keys compare exactly (`cam[''+VOL]` where
            // VOL='volume' is benign and stays silent; `cam[''+KSH]`
            // where KSH='shake' flags).
            if (!unres && flat === 'shake') {
              offenders.push(`${file.fromSrc}:${i}`)
              flaggedBracket = true
              break
            }
            if (!unres) continue
            // An all-dynamic key (`${prefix}${id}`) carries no literal
            // evidence of 'shake' - same residual as a bare identifier.
            if (lits.length === 0) continue
            // Dynamic key with a quoted part: flag only when the known
            // literal pieces can still SPELL 'shake' with the gaps
            // filled - leading/trailing gaps widen the pattern at the
            // ends, interior literals keep order ('sha'+k, k+'ake',
            // ''+k+'e', `s${k}` all still flag). Resolved-benign keys
            // (VOL='volume') are not 'shake'-spellable and stay silent.
            const pattern = new RegExp(
              `^${leadDyn ? '.*' : ''}${lits
                .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                .join('.*')}${trailDyn ? '.*' : ''}$`,
            )
            if (pattern.test('shake')) {
              offenders.push(`${file.fromSrc}:${i} (mixed concat member: ${alt.slice(0, 60)})`)
              flaggedBracket = true
              break
            }
          }
          if (flaggedBracket) continue
        }
        // Only `shake` in KEY position is an extraction:
        // `{shake}` / `{shake: s}` / `{shake = d}` / `{...shake}` flag,
        // `{a: shake}` binds a local to `cam.a` and is benign. Returns
        // the LOCAL names the extraction binds - `{shake: s}` binds `s`,
        // shorthand `{shake}` binds `shake` itself.
        const collectShakeBound = (inner: string): string[] => {
          const segs: string[] = []
          let d = 0
          let cur = ''
          for (const ch of inner) {
            if (ch === '{' || ch === '[' || ch === '(') d++
            else if (ch === '}' || ch === ']' || ch === ')') d--
            if (d === 0 && ch === ',') {
              segs.push(cur)
              cur = ''
              continue
            }
            cur += ch
          }
          segs.push(cur)
          const bound: string[] = []
          for (const seg of segs) {
            // Quoted keys (`{'shake': s}`) and computed literal keys
            // (`{['shake']: s}`) extract the member the same way.
            const keyM = /^\s*(?:\.\.\.\s*)?(?:shake\b|'shake'|"shake"|\['shake'\]|\["shake"\])/.exec(seg)
            if (keyM) {
              const rest = seg.slice(keyM[0].length)
              if (/^\s*:\s*[{[]/.test(rest)) {
                // `{shake: {s}}` / `{shake: [s]}` - a nested pattern
                // binds `shake.s`/`shake[0]` to `s`; collect every
                // local the inner pattern binds.
                bound.push(...collectAnyBound(rest))
              } else if (/^\s*(?::|=|,?\s*$)/.test(rest)) {
                // The bound name is the first ident after `:` (a
                // `{shake: s = d}` default still binds `s`).
                const boundM = /^\s*:\s*([\w$]+)/.exec(rest)
                bound.push(boundM?.[1] ?? 'shake')
              }
            }
            // Nested object patterns (`{a: {b: {shake}}}`) hide the key
            // below depth 0 - recurse into every brace span.
            for (const bm of seg.matchAll(/\{/g)) {
              let dd = 0
              let be = -1
              for (let j = bm.index!; j < seg.length; j++) {
                if (seg[j] === '{') dd++
                else if (seg[j] === '}') {
                  dd--
                  if (dd === 0) {
                    be = j
                    break
                  }
                }
              }
              if (be > bm.index!) bound.push(...collectShakeBound(seg.slice(bm.index! + 1, be)))
            }
          }
          return bound
        }
        const shakeBoundNames = (openIdx: number, endIdx: number): string[] =>
          collectShakeBound(text.slice(openIdx + 1, endIdx))
        // Every local name an arbitrary destructure pattern binds:
        // `s`, `a: b`, `{x: {y}}`, `[x]`, `s = d`, `...rest` - used for
        // nested patterns under a `shake` key where ANY position can
        // hold the extracted binding.
        const collectAnyBound = (inner: string): string[] => {
          const names: string[] = []
          let depth = 0
          let cur = ''
          const segs: string[] = []
          // First bracket wins: `[s, {shake}]` prefers '[' over the
          // later '{' - a `{`-preferred opener misframes the pattern.
          const open = inner.search(/[{[]/)
          for (let i = open + 1; i < inner.length; i++) {
            const c = inner[i]!
            if (c === '{' || c === '[') depth++
            else if (c === '}' || c === ']') {
              if (depth === 0) break
              depth--
            }
            if (depth === 0 && c === ',') {
              segs.push(cur)
              cur = ''
              continue
            }
            cur += c
          }
          segs.push(cur)
          for (const seg of segs) {
            const s = seg.replace(/^\s*\.\.\.\s*/, '').trim()
            if (!s) continue
            const colon = /^[\w$'"\[\]]+\s*:\s*([\s\S]+)$/.exec(s)
            if (colon) {
              const rhs = colon[1]!.trim()
              if (rhs.startsWith('{') || rhs.startsWith('[')) {
                names.push(...collectAnyBound(rhs))
              } else {
                const nm = /^([\w$]+)/.exec(rhs)
                if (nm) names.push(nm[1]!)
              }
            } else if (/^[\w$]+\s*(=\s*[\s\S]+)?$/.test(s)) {
              names.push(/^([\w$]+)/.exec(s)![1]!)
            } else if (s.startsWith('{') || s.startsWith('[')) {
              names.push(...collectAnyBound(s))
            }
          }
          return names
        }
        // Names bound by a param list: depth-0 `,` segments; `{...}` /
        // `[...]` segments bind via collectAnyBound, `...name`, `name =
        // x` and `name: T` bind `name`; a `for`/`catch` head's LHS
        // before `of`/`in` binds the loop/catch variable.
        const paramBoundNames = (inner: string): string[] => {
          const names: string[] = []
          const segs: string[] = []
          let d = 0
          let cur = ''
          for (const ch of inner) {
            if (ch === '(' || ch === '[' || ch === '{') d++
            else if (ch === ')' || ch === ']' || ch === '}') d--
            if (d === 0 && ch === ',') {
              segs.push(cur)
              cur = ''
              continue
            }
            cur += ch
          }
          segs.push(cur)
          for (const sRaw of segs) {
            // `for (const s of x)` / `for (s of x)` - LHS before a
            // depth-0 `of`/`in` is the bound side.
            const lhs =
              /\s(of|in)\s/.test(sRaw) && /^[^=]*\s(?:of|in)\s/.test(sRaw)
                ? sRaw.slice(0, Math.max(...[' of ', ' in '].map((k) => sRaw.indexOf(k))))
                : sRaw
            const s = lhs
              .replace(/^\s*(?:const|let|var)\s+/, '')
              .replace(/^\.\.\./, '')
              .trim()
            if (s.startsWith('{') || s.startsWith('[')) {
              names.push(...collectAnyBound(s))
              continue
            }
            const head = /^([\w$]+)/.exec(s.replace(/(=[\s\S]*$)|(:\s*[^=]*)$/, ''))
            if (head && !/^(?:of|in|const|let|var)$/.test(head[1]!)) names.push(head[1]!)
          }
          return names
        }
        const flagBoundCalls = (names: string[]) => {
          for (const name of new Set(names)) {
            // A binding that rebinds `name` shadows the extracted member
            // inside its scope - `function g(s) { s(1) }` calls the
            // param, `catch (s) { s(1) }` calls the caught value,
            // `for (const s of x) s()` calls the item. Signature parens
            // are BALANCED so nested params (`fn(a, (x, s) => s(1))`)
            // still cover `s` for the arrow body. A `catch ({x: s})`
            // destructure rebinding s to something OTHER than shake
            // shadows; `catch ({shake: s})` mints through the param arm
            // instead and must not shadow.
            const shadowSpans: Array<[number, number]> = []
            const braceBlockEnd = (from: number): number => {
              let d = 0
              for (let i = from; i < text.length; i++) {
                if (inLit(i)) continue
                if (text[i] === '{') d++
                else if (text[i] === '}') {
                  d--
                  if (d === 0) return i + 1
                }
              }
              return -1
            }
            for (const pm of text.matchAll(/\(/g)) {
              if (inLit(pm.index ?? 0)) continue
              let depth = 0
              let end = -1
              for (let i = pm.index!; i < text.length; i++) {
                if (inLit(i)) continue
                const c = text[i]!
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
              const inner = text.slice(pm.index! + 1, end)
              const afterParen = text.slice(end + 1)
              const headWord = /(\w+)\s*$/.exec(text.slice(0, pm.index!))?.[1]
              if (headWord === 'for' || headWord === 'catch') {
                // Loop/catch head binds names for the body block (or the
                // single statement it guards).
                if (!paramBoundNames(inner).includes(name)) continue
                if (/\{|\[/.test(inner)) {
                  // A for/catch destructure whose `shake` key rebinds
                  // `name` is the member rebinding itself - its calls
                  // flag, so no shadow. Any other destructure shadows.
                  const bOpen = pm.index! + 1 + inner.indexOf('{')
                  const bEnd = braceBlockEnd(bOpen) - 1
                  if (bEnd >= bOpen && shakeBoundNames(bOpen, bEnd).includes(name)) continue
                }
                const bodyMatch = /^\s*\{/.test(afterParen)
                let be: number
                if (bodyMatch) {
                  be = braceBlockEnd(end + 1 + afterParen.indexOf('{'))
                } else {
                  be = afterParen.indexOf(';')
                  be = be < 0 ? -1 : end + 2 + be
                }
                if (be > 0) shadowSpans.push([pm.index!, be])
                continue
              }
              const gate = /^\s*(=>|\{|:)/.exec(afterParen)?.[1]
              if (!gate) continue
              if (!paramBoundNames(inner).includes(name)) continue
              const gateIdx = end + 1 + afterParen.indexOf(gate)
              if (gate === '=>') {
                // expression body to a depth-0 `,`/`;`/`)`/`]`/`}` -
                // or a `{` block for block bodies.
                const rest = text.slice(gateIdx + 2)
                if (/^\s*\{/.test(rest)) {
                  const bs = gateIdx + 2 + rest.indexOf('{')
                  const be = braceBlockEnd(bs)
                  if (be > 0) shadowSpans.push([gateIdx, be])
                  continue
                }
                let d = 0
                let be = gateIdx + 2
                for (let i = be; i < text.length; i++) {
                  if (inLit(i)) continue
                  const c = text[i]!
                  if (c === '(' || c === '[' || c === '{') d++
                  else if (c === ')' || c === ']' || c === '}') {
                    if (d === 0) break
                    d--
                  } else if (d === 0 && (c === ',' || c === ';')) break
                  be = i + 1
                }
                shadowSpans.push([gateIdx, be])
              } else if (gate === '{') {
                const be = braceBlockEnd(gateIdx)
                if (be > 0) shadowSpans.push([gateIdx, be])
              } else {
                // `:` annotation then a `{` body.
                const am = /^\s*:[^){}\n]*?(\{)/.exec(afterParen)
                if (!am) continue
                const bs = end + 1 + am.index + am[0].length - 1
                const be = braceBlockEnd(bs)
                if (be > 0) shadowSpans.push([gateIdx, be])
              }
            }
            // `function name` / `class name` declarations shadow uses of
            // `name` after the decl point.
            const declShadow: number[] = []
            for (const dm of text.matchAll(
              new RegExp(`\\b(?:function\\s*\\*?\\s*|class\\s+)${name}\\b`, 'g'),
            )) {
              if (!inLit(dm.index ?? 0)) declShadow.push(dm.index!)
            }
            // `name {...}` / `name?.{...}` binding-pattern spans mask
            // bound-call detection inside them - the `name` token there
            // is the destructured key, not a call.
            const bindingMask: Array<[number, number]> = []
            for (const bm of text.matchAll(new RegExp(`\\b${name}\\s*[?!]*\\s*\\.?\\s*\\{`, 'g'))) {
              const bStart = bm.index! + bm[0].length - 1
              const be = braceBlockEnd(bStart)
              if (be > 0) bindingMask.push([bm.index!, be])
            }
            for (const sm of text.matchAll(
              // `(?<![\w$.])` keeps `obj.s(` (member call) out when `s`
              // is the bound name; `s?.(`/`s.call|apply|bind(` invoke
              // the same binding through another shape. `s['call'](x)`
              // is the bracket spelling of the same indirect call.
              // `(s)(x)` is the paren-wrapped callee; bare-value fences
              // cover `forEach(s)`, `hand = s`, `{go: s}`, `cond ? s :`
              // reads; `case s:` is the label-position read. A ternary
              // member tail (`cond ? s. :`) reads the same binding.
              new RegExp(
                `(?<![\\w$.])${name}\\s*!?\\s*\\(|\\b${name}\\s*[?!]*\\s*\\.\\s*(?:call|apply|bind)\\s*(?:\\?\\s*\\.)?\\s*\\(|(?<![\\w$.])${name}\\s*\\?\\.\\s*\\(|\\(\\s*${name}\\s*\\)\\s*(?:\\?\\s*\\.)?\\s*\\(|(?:[(,=\\[:;{!&|?:+\\-*\\/%^~<>]|\\.\\.\\.|\\b(?:return|yield|await|typeof|void|in|of|instanceof|new|delete)\\s)\\s*${name}\\s*(?=[,)\\]};])|\\bcase\\s+${name}\\b[^:]*:|\\?\\s*${name}\\s*(?:\\.|\\?\\.|\\[|:)`,
                'g',
              ),
            )) {
              if (inLit(sm.index ?? 0)) continue
              if (shadowSpans.some(([a, b]) => sm.index! >= a && sm.index! < b)) continue
              if (declShadow.some((d) => sm.index! > d)) continue
              if (bindingMask.some(([a, b]) => sm.index! >= a && sm.index! < b)) continue
              offenders.push(`${file.fromSrc}:${sm.index} (destructure-bound call)`)
            }
            // `s['call'](x)` / `s['c'+'all'](x)` / `s[K](x)` - the
            // bracket spelling of the indirect call resolves through
            // rebuildKey the same way `cam['shake']` does.
            for (const bm of text.matchAll(
              new RegExp(`\\b${name}\\s*[?!]*\\s*\\.?\\s*\\[\\s*([^\\]]*)\\]\\s*\\(`, 'g'),
            )) {
              if (inLit(bm.index ?? 0)) continue
              if (shadowSpans.some(([a, b]) => bm.index! >= a && bm.index! < b)) continue
              if (declShadow.some((d) => bm.index! > d)) continue
              const { flat, unres, hadQuoted } = rebuildKey(bm[1]!, bm.index!)
              if (!unres && /^(?:call|apply|bind)$/.test(flat)) {
                offenders.push(`${file.fromSrc}:${bm.index} (destructure-bound bracket call)`)
              } else if (unres && hadQuoted) {
                offenders.push(`${file.fromSrc}:${bm.index} (destructure-bound dynamic bracket)`)
              }
            }
          }
        }
        // `const { shake } = cam` / `for (const { shake: s } of ...)`
        // detaches the member from its receiver - flag the extraction.
        // `of`/`in` cover the for-of/in spellings. The `,` alternative
        // covers multi-declarator extractions (`let a = 1, { shake } =
        // cam`); a `, {` inside an object/array literal fails the
        // `=|of|in` right-hand gate below.
        // `({shake} = cam)` wraps the extraction in parens - the `(`
        // fence plus the post-brace `=`/`of`/`in` gate below separates
        // it from call-argument literals (`f({shake})` fails the gate).
        for (const dm of text.matchAll(/(?:\b(?:const|let|var)|,|\()\s*\{/g)) {
          if (inLit(dm.index ?? 0)) continue
          const openIdx = dm.index! + dm[0].length - 1
          let depth = 0
          let end = -1
          for (let i = openIdx; i < text.length; i++) {
            if (inLit(i)) continue
            const c = text[i]!
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
          // `const { shake }: Cam = cam` - a type annotation may sit
          // between the brace and the `=`/`of`/`in` extraction marker.
          // The annotation may not cross `)`/`;`/`{`/newline - `x =
          // ({y}: T);` ends at `)` before the `=`, so it never mints.
          if (!/^\s*(?::[^)\n;{]*?)?(?:=|of|in)/.test(text.slice(end + 1, end + 1 + 2000))) continue
          const boundNames = shakeBoundNames(openIdx, end)
          if (boundNames.length > 0) {
            offenders.push(`${file.fromSrc}:${openIdx} (destructure)`)
            flagBoundCalls(boundNames)
          }
        }
        // `{shake}` bound through a function PARAMETER is the same
        // extraction channel - `function f({ shake }) { shake(100) }`
        // or `items.map(({ shake }) => ...)`. A `(` whose `)` is
        // followed by `=>`/`{`/`:` is a signature paren; call/arg parens
        // fail the gate, and control-structure parens are excluded.
        // `catch (e)` is deliberately absent: `catch ({shake: s})` is
        // a binding position (catch clause param), not an expression
        // paren.
        const CONTROL_PAREN =
          /(?:\b(?:if|for|while|switch|with|return|typeof|case|throw|new|in|of|do|else|yield|await|delete|void|instanceof)|\?)\s*$/
        for (const pm of text.matchAll(/\(/g)) {
          if (inLit(pm.index ?? 0)) continue
          const ctrlParen = CONTROL_PAREN.test(text.slice(0, pm.index!))
          let depth = 0
          let end = -1
          for (let i = pm.index!; i < text.length; i++) {
            if (inLit(i)) continue
            const c = text[i]!
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
          const afterParen = text.slice(end + 1)
          // `case f({shake}):` - the case colon satisfies the `:` gate
          // while `{shake}` is a call argument, not a param pattern.
          // `cond ? ({shake}: T) : y` - an open `?` in the same segment
          // makes the `:` a ternary colon, not an annotation.
          if (/^\s*:/.test(afterParen)) {
            // Statement/segment-boundary lookback (`;`/`{`/`}`/`,`), not
            // the line: `x = f(); case f({shake}):` splits mid-line.
            const stmtStart =
              Math.max(
                text.lastIndexOf(';', pm.index!),
                text.lastIndexOf('{', pm.index!),
                text.lastIndexOf('}', pm.index!),
                text.lastIndexOf(',', pm.index!),
              ) + 1
            if (/\b(?:case|default)\b[^:]*$/.test(text.slice(stmtStart, pm.index!))) continue
            if (/\?[^?:]*$/.test(text.slice(stmtStart, pm.index!))) continue
          }
          // Control-keyword parens (`return (...)`, `await (...)`) can
          // still hold an arrow signature `({shake}: T) => x` - the `=>`
          // gate alone proves a param list; `{`/`:` after a keyword
          // paren is a block or label.
          if (ctrlParen ? !/^\s*=>/.test(afterParen) : !/^\s*(?:=>|\{|:)/.test(afterParen)) continue
          // Check each `{` inside the signature paren the same way the
          // declaration arm does - `({a: shake})` is value position,
          // `({shake})` / `({shake: s})` are extractions.
          let flagged: string[] | false = false
          for (const bm of text.slice(pm.index!, end).matchAll(/\{/g)) {
            const openIdx = pm.index! + bm.index!
            let bd = 0
            let bEnd = -1
            for (let i = openIdx; i < text.length; i++) {
              if (inLit(i)) continue
              const c = text[i]!
              if (c === '{') bd++
              else if (c === '}') {
                bd--
                if (bd === 0) {
                  bEnd = i
                  break
                }
              }
            }
            if (bEnd < 0 || bEnd > end) continue
            // `x ? {shake: s} : y` inside a param default is a ternary
            // VALUE, not an extraction - a `?` before this `{` in the
            // same comma-segment marks it. A `?` in an earlier segment
            // resets at the depth-0 `,`.
            let ternary = false
            {
              let dd = 0
              for (let ti = pm.index! + 1; ti < openIdx; ti++) {
                if (inLit(ti)) continue
                const c = text[ti]!
                if (c === '(' || c === '[' || c === '{') dd++
                else if (c === ')' || c === ']' || c === '}') dd--
                else if (dd === 0 && c === ',') ternary = false
                else if (dd === 0 && c === '?') ternary = true
              }
            }
            if (ternary) continue
            const boundNames = shakeBoundNames(openIdx, bEnd)
            if (boundNames.length > 0) {
              flagged = boundNames
              break
            }
          }
          if (flagged) {
            offenders.push(`${file.fromSrc}:${pm.index!} (param destructure)`)
            flagBoundCalls(flagged)
          }
        }
        // `cam.shak\u0065(...)` spells the member through an identifier
        // escape - reconstruct the surrounding identifier (word chars +
        // escapes) and check the decoded name. Literal interiors are
        // skipped by inLit.
        for (const m of text.matchAll(/\\u(?:[0-9a-fA-F]{4}|\{[0-9a-fA-F]+\})|\\x[0-9a-fA-F]{2}/g)) {
          const i = m.index ?? 0
          if (inLit(i)) continue
          const before = /[\w$]*$/.exec(text.slice(0, i))![0]
          const after = /^(?:[\w$]|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]+\}|\\x[0-9a-fA-F]{2})*/.exec(
            text.slice(i + m[0].length),
          )![0]
          // `cam\x2eshake` decodes to `cam.shake` - the dot escape splits
          // the span into members, so compare the tail of the decoded
          // ident (`x.shake` flags, `x.xshake` does not).
          const decoded = decodeSeg(`${before}${m[0]}${after}`)
          if (decoded === 'shake' || (decoded.includes('.') && decoded.split('.').pop() === 'shake')) {
            offenders.push(`${file.fromSrc}:${i}`)
          }
        }
      }
      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )
})
