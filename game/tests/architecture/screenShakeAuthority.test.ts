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
        // a documented residual (dynamic keys stay silent). `let`/`var`
        // names join only when never reassigned in the file - a rebound
        // name's literal evidence is stale.
        const identLit = new Map<string, string>()
        const declKind = new Map<string, string>()
        for (const cm of text.matchAll(
          /\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`)/g,
        )) {
          identLit.set(cm[2]!, cm[3] ?? cm[4] ?? cm[5]!)
          declKind.set(cm[2]!, cm[1]!)
        }
        for (const [name, kind] of declKind) {
          if (kind === 'const') continue
          // Compound/logical assigns (`+=`, `??=`, `&&=`...) rebind the
          // name exactly like `=` - a stale literal on a rebound name is
          // the same false evidence.
          const reAssign = new RegExp(
            `\\b${name}\\s*(?:=(?!=)|\\+\\+|--|<<=|>>>=|>>=|\\+=|-=|\\*=|/=|%=|&=|\\|=|\\^=|\\?\\?=|&&=|\\|\\|=)`,
            'g',
          )
          if ([...text.matchAll(reAssign)].length > 1) identLit.delete(name)
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
            const segMatches = [...alt.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)]
            // `''+k` - an empty literal launders the dynamic concat (the
            // segs.length===0 path skips it); drop empty segs before the
            // count check so the dynamic remainder still flags.
            const segs = segMatches
              .map((sm) => decodeSeg(sm[1] ?? sm[2] ?? sm[3]!))
              .filter((s) => s !== '')
            if (segs.length === 0) {
              // `''+k` - quoted segments existed but all decoded empty;
              // the dynamic remainder is unverifiable and flags. A
              // quote-free computed key (`[k]`, `[k.prop]`) is ordinary
              // member access and stays on the ident lane below.
              const leftover = alt.replace(/'[^']*'|"[^"]*"|`[^`]*`|[\s+]/g, '')
              if (segMatches.length > 0 && /[A-Za-z_$]/.test(leftover)) {
                offenders.push(`${file.fromSrc}:${i} (mixed concat member: ${alt.slice(0, 60)})`)
                flaggedBracket = true
                continue
              }
            }
            if (segs.length === 0) {
              // `cam[key]` / `cam[k ? KEY : 'x']` with a bare identifier
              // key resolves against the file's own `const KEY = '...'`
              // map; anything else is the documented residual.
              const ident = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(alt)?.[1]
              if (ident && identLit.get(ident) === 'shake') {
                offenders.push(`${file.fromSrc}:${i} (ident-key ${ident})`)
                flaggedBracket = true
              }
              continue
            }
            const joined = segs.join('')
            if (joined === 'shake') {
              offenders.push(`${file.fromSrc}:${i}`)
              flaggedBracket = true
              break
            }
            // `cam['sh' + k]` mixes a quoted segment with a dynamic key -
            // flag only when the static parts can actually SPELL 'shake'
            // with some fill for the dynamic gaps: the first quoted seg
            // must be a PREFIX unless a dynamic precedes it, the last a
            // SUFFIX unless one follows, and interior segs keep order -
            // an ordered `seg.*seg` pattern anchored by the dynamic
            // positions tests all of that at once. `'sh' + k + 'e'` and
            // `k + 'ake'` spell; `'ke' + x` and `'' + x` cannot.
            const rest = alt.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '')
            const leadDyn = /[A-Za-z_$]/.test(alt.slice(0, segMatches[0]!.index))
            const trailDyn = /[A-Za-z_$]/.test(
              alt.slice(segMatches[segMatches.length - 1]!.index! + segMatches[segMatches.length - 1]![0].length),
            )
            const spellPattern = new RegExp(
              `^${leadDyn ? '.*' : ''}${segs
                .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                .join('.*')}${trailDyn ? '.*' : ''}$`,
            )
            if (joined.length > 0 && /[A-Za-z_$]/.test(rest) && spellPattern.test('shake')) {
              offenders.push(`${file.fromSrc}:${i} (mixed concat member)`)
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
        const flagBoundCalls = (names: string[]) => {
          for (const name of new Set(names)) {
            // A signature paren rebinding `name` shadows the extracted
            // member inside its body - `function g(s) { s(1) }` calls
            // the param, not `cam.shake`.
            const shadowSpans: Array<[number, number]> = []
            for (const pm of text.matchAll(/\(([^()]*)\)\s*(=>|\{)/g)) {
              if (inLit(pm.index ?? 0)) continue
              if (!new RegExp(`\\b${name}\\b`).test(pm[1]!)) continue
              const gateIdx = pm.index! + pm[0].length - pm[2]!.length
              if (pm[2] === '=>') {
                // expression body to a depth-0 `,`/`;`/`)`/`]`/`}`
                let d = 0
                let be = pm.index! + pm[0].length
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
              } else {
                let d = 0
                let be = -1
                for (let i = gateIdx; i < text.length; i++) {
                  if (inLit(i)) continue
                  if (text[i] === '{') d++
                  else if (text[i] === '}') {
                    d--
                    if (d === 0) {
                      be = i + 1
                      break
                    }
                  }
                }
                if (be >= 0) shadowSpans.push([gateIdx, be])
              }
            }
            for (const sm of text.matchAll(
              // `(?<![\w$.])` keeps `obj.s(` (member call) out when `s`
              // is the bound name; `s?.(`/`s.call|apply|bind(` invoke
              // the same binding through another shape. `s['call'](x)`
              // is the bracket spelling of the same indirect call.
              // `(s)(x)` is the paren-wrapped callee; bare-value fences
              // cover `forEach(s)`, `hand = s`, `{go: s}`, `cond ? s :`
              // reads; `case s:` is the label-position read.
              new RegExp(
                `(?<![\\w$.])${name}\\s*!?\\s*\\(|\\b${name}\\s*[?!]*\\s*\\.\\s*(?:call|apply|bind)\\s*(?:\\?\\s*\\.)?\\s*\\(|\\b${name}\\s*[?!]*\\s*\\.?\\s*\\[\\s*['"\`](?:call|apply|bind)['"\`]\\s*\\]\\s*\\(|(?<![\\w$.])${name}\\s*\\?\\.\\s*\\(|\\(\\s*${name}\\s*\\)\\s*(?:\\?\\s*\\.)?\\s*\\(|(?:[(,=\\[:;{!&|?:+\\-*\\/%^~<>]|\\.\\.\\.|\\b(?:return|yield|await|typeof|void|in|of|instanceof|new|delete)\\s)\\s*${name}\\s*(?=[,)\\]};])|\\bcase\\s+${name}\\b[^:]*:|\\?\\s*${name}\\s*:`,
                'g',
              ),
            )) {
              if (inLit(sm.index ?? 0)) continue
              if (shadowSpans.some(([a, b]) => sm.index! >= a && sm.index! < b)) continue
              offenders.push(`${file.fromSrc}:${sm.index} (destructure-bound call)`)
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
          if (!/^\s*(?::\s*[\s\S]{0,200}?)?(?:=|of|in)/.test(text.slice(end + 1, end + 1 + 2000))) continue
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
          if (/^\s*:/.test(afterParen)) {
            // Statement-boundary lookback (`;`/`{`/`}`), not the line:
            // `x = f(); case f({shake}):` splits on a mid-line case.
            const stmtStart =
              Math.max(
                text.lastIndexOf(';', pm.index!),
                text.lastIndexOf('{', pm.index!),
                text.lastIndexOf('}', pm.index!),
              ) + 1
            if (/\b(?:case|default)\b[^:]*$/.test(text.slice(stmtStart, pm.index!))) continue
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
