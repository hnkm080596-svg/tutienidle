/**
 * Screen-shake authority guard - `screenShakePolicy.ts` claims to be the
 * sole shake surface (it scales by `audio.reducedShake`). Nothing prevents
 * a future `cameras.main.shake(` from bypassing that policy silently, so
 * this sweep pins every shake call shape to the policy module.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { SCAN_TIMEOUT, srcCorpus, isTestFile } from './helpers/scanTs'
import { literalRanges, uncommented, templateExprText } from './helpers/commentStrip'

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
        const lits = literalRanges(text, file.fromSrc)
        const inLit = (i: number) =>
          lits.some((r) => i >= r.pos && i < r.end)
        // Single-ident constants the bracket arm can resolve statically:
        // `const KEY = 'shake'` then `cam[KEY]` - unresolvable idents are
        // a documented residual (dynamic keys stay silent).
        const identLit = new Map<string, string>()
        for (const cm of text.matchAll(
          /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*'([^'\n]*)'|\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"\n]*)"|\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*`([^`\n]*)`/g,
        )) {
          identLit.set(cm[1] ?? cm[3] ?? cm[5]!, cm[2] ?? cm[4] ?? cm[6]!)
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
          }
        }
        // `const { shake } = cam` / `for (const { shake: s } of ...)`
        // detaches the member from its receiver - flag the extraction.
        // `of`/`in` cover the for-of/in spellings.
        for (const dm of text.matchAll(/\b(?:const|let|var)\s*\{/g)) {
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
          if (!/^\s*(?:=|of|in)/.test(text.slice(end + 1, end + 1 + 2000))) continue
          const sm = /\bshake\b/.exec(text.slice(openIdx, end + 1))
          if (sm) {
            offenders.push(`${file.fromSrc}:${openIdx + sm.index} (destructure)`)
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
          if (decodeSeg(`${before}${m[0]}${after}`) === 'shake') {
            offenders.push(`${file.fromSrc}:${i}`)
          }
        }
      }
      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )
})
