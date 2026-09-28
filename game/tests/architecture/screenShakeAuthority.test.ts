/**
 * Screen-shake authority guard - `screenShakePolicy.ts` claims to be the
 * sole shake surface (it scales by `audio.reducedShake`). Nothing prevents
 * a future `cameras.main.shake(` from bypassing that policy silently, so
 * this sweep pins every shake call shape to the policy module.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { SCAN_TIMEOUT, srcCorpus, isTestFile } from './helpers/scanTs'
import { literalRanges, uncommented } from './helpers/commentStrip'

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
        const text = uncommented(file.text, file.fromSrc)
        const lits = literalRanges(text, file.fromSrc)
        const inLit = (i: number) =>
          lits.some((r) => i >= r.pos && i < r.end)
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
          if (segs.length === 0) continue
          if (segs.join('').includes('shake')) {
            offenders.push(`${file.fromSrc}:${i}`)
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
          if (decodeSeg(`'${before}${m[0]}${after}'`).includes('shake')) {
            offenders.push(`${file.fromSrc}:${i}`)
          }
        }
      }
      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )
})
