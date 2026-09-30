import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HUYEN_KIM_TOKENS, hkVarName } from '@/ui/tokens'

// Spec §54: Vue and Phaser must consume the same semantic tokens. The CSS
// file is the Vue surface; tokens.ts is the Phaser surface. This test pins
// the parity contract: every token must exist in BOTH with the same value.
const CSS = readFileSync(join(process.cwd(), 'src/assets/huyen-kim.tokens.css'), 'utf8')
// Value comparison is whitespace-insensitive: CSS authors may space rgba()/font
// lists differently than the TS literal while meaning the same thing.
const COMPACT_CSS = CSS.replace(/\s/g, '')
const toCssValue = (v: string | number) => (typeof v === 'number' ? `${v}px` : String(v).replace(/\s/g, ''))

describe('Huyen Kim token parity (Vue CSS vs Phaser TS)', () => {
  it('every token in tokens.ts is declared in huyen-kim.tokens.css with the same value', () => {
    for (const [key, value] of Object.entries(HUYEN_KIM_TOKENS)) {
      const varName = hkVarName(key as keyof typeof HUYEN_KIM_TOKENS)
      const expected = `${varName}:${toCssValue(value)};`
      expect(COMPACT_CSS, `missing or mismatched ${varName}`).toContain(expected)
    }
  })

  it('no --hk-* var exists in CSS without a tokens.ts counterpart', () => {
    const declared = [...CSS.matchAll(/--hk-[a-z0-9-]+\s*:/g)].map((m) => m[0].slice(0, -1).trim())
    const keys: Set<string> = new Set(
      (Object.keys(HUYEN_KIM_TOKENS) as (keyof typeof HUYEN_KIM_TOKENS)[]).map((k) => hkVarName(k)),
    )
    for (const varName of declared) {
      expect(keys.has(varName), `CSS declares ${varName} but tokens.ts has no ${varName} token`).toBe(true)
    }
  })
})
