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
          const reAssign = new RegExp(`\\b${name}\\s*(?:=(?!=)|\\+\\+|--)`, 'g')
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
          if (!/[\w$\)\]?!]\s*$/.test(text.slice(0, i))) continue
          if (
            /^(?:of|in|new|return|typeof|delete|void|instanceof|yield|await|case|do|else|throw|const|let|var|import|export|from|function|class|extends|if|for|while|switch|catch|with)$/.test(
              prevWord,
            )
          ) continue
          // `[...x, 'lit']` is an array literal with a spread element,
          // not a computed member.
          if (/^\[\s*\.\.\./.test(m[0])) continue
          const segs = [...m[0].matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)].map(
            (sm) => decodeSeg(sm[1] ?? sm[2] ?? sm[3]!),
          )
          if (segs.length === 0) {
            // `cam[key]` with a bare identifier key resolves against the
            // file's own `const KEY = '...'` map; anything else is the
            // documented residual of static analysis.
            const ident = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(
              m[0].slice(1, -1),
            )?.[1]
            if (ident && identLit.get(ident) === 'shake') {
              offenders.push(`${file.fromSrc}:${i} (ident-key ${ident})`)
            }
            continue
          }
          if (segs.join('') === 'shake') {
            offenders.push(`${file.fromSrc}:${i}`)
            continue
          }
          // `cam['sh' + k]` mixes a quoted segment with a dynamic key -
          // flag only when the static half is a substring of `shake` (a
          // concat that could actually spell it); `cam['icon' + kind]`
          // is a resolvable-enough shape to stay silent.
          const rest = m[0].replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '')
          const joined = segs.join('')
          if (
            segs.length > 0 &&
            /[A-Za-z_$]/.test(rest) &&
            (joined.length > 0 ? 'shake'.includes(joined) : rest.includes('+'))
          ) {
            offenders.push(`${file.fromSrc}:${i} (mixed concat member)`)
          }
        }
        // Only `shake` in KEY position is an extraction:
        // `{shake}` / `{shake: s}` / `{shake = d}` / `{...shake}` flag,
        // `{a: shake}` binds a local to `cam.a` and is benign. Returns
        // the LOCAL names the extraction binds - `{shake: s}` binds `s`,
        // shorthand `{shake}` binds `shake` itself.
        const shakeBoundNames = (openIdx: number, endIdx: number): string[] => {
          const inner = text.slice(openIdx + 1, endIdx)
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
            const keyM = /^\s*(?:\.\.\.\s*)?shake\b/.exec(seg)
            if (!keyM) continue
            const rest = seg.slice(keyM[0].length)
            if (!/^\s*(?::|=|,?\s*$)/.test(rest)) continue
            const boundM = /^\s*:\s*([\w$]+)\s*$/.exec(rest)
            bound.push(boundM?.[1] ?? 'shake')
          }
          return bound
        }
        const flagBoundCalls = (names: string[]) => {
          for (const name of new Set(names)) {
            for (const sm of text.matchAll(
              new RegExp(`\\b${name}\\s*!?\\s*\\(`, 'g'),
            )) {
              if (inLit(sm.index ?? 0)) continue
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
        for (const dm of text.matchAll(/(?:\b(?:const|let|var)|,)\s*\{/g)) {
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
        const CONTROL_PAREN =
          /(?:\b(?:if|for|while|switch|catch|with|return|typeof|case|throw|new|in|of|do|else|yield|await|delete|void|instanceof)|\?)\s*$/
        for (const pm of text.matchAll(/\(/g)) {
          if (inLit(pm.index ?? 0)) continue
          if (CONTROL_PAREN.test(text.slice(0, pm.index!))) continue
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
          if (!/^\s*(?:=>|\{|:)/.test(text.slice(end + 1))) continue
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
