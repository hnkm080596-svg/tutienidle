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
        for (const m of text.matchAll(/\.\s*shake\s*\(|\[\s*['"]shake['"]\s*\]/g)) {
          const i = m.index ?? 0
          if (inLit(i)) continue
          // The policy file is the only place `camera.shake` may appear;
          // anywhere else (scenes, vfx helpers, bindings) bypasses the
          // reducedShake scale.
          offenders.push(`${file.fromSrc}:${i}`)
        }
      }
      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )
})
