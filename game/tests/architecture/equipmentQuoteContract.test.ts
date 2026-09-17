/**
 * G1 source guard (Mission G re-review, 2026-09-19) - Task 37's locked
 * contract: mainStatRangeQuote is REQUIRED on both the compare context
 * and buildEquipmentTooltip's parameter, so the type system forces
 * every tooltip caller through EquipmentSystem.quoteMainStatRange().
 * The defect class it closed: `| undefined` let a caller skip the
 * authoritative quote and silently render '[—]'.
 *
 * Behavioral coverage lives in useEquipmentTooltip.test.ts. This static
 * guard pins the contract text itself: a drift back to `| undefined`
 * compiles silently, so the required shape is asserted directly.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { readTs } from './helpers/scanTs'

const TOOLTIP_FILE = join(process.cwd(), 'src', 'composables', 'useEquipmentTooltip.ts')

function uncommented(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .replaceAll(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('G1 - mainStatRangeQuote is a required authoritative quote', () => {
  const source = uncommented(readTs(TOOLTIP_FILE))

  it('no mainStatRangeQuote surface accepts undefined', () => {
    const mentions = source.match(/mainStatRangeQuote[^,\n}]*/g) ?? []
    expect(mentions.length).toBeGreaterThan(0)
    for (const mention of mentions) {
      expect(mention).not.toMatch(/undefined/)
    }
  })

  it('the required quote shape is present on the context and the builder param', () => {
    const required = /mainStatRangeQuote:\s*\{\s*min:\s*number;\s*max:\s*number\s*\}/g
    const hits = source.match(required) ?? []
    // EquipmentCompareContext field + buildEquipmentTooltip parameter.
    expect(hits.length).toBeGreaterThanOrEqual(2)
  })
})
