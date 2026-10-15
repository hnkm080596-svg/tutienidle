import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC_ROOT = resolve(__dirname, '../../src')

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * Yields ordinary top-level rule headers inside the main @scope block
 * (excluding @media / @keyframes nested rules).
 */
function collectScopedRuleHeaders(css: string): string[] {
  const cleaned = stripComments(css)
  const headers: string[] = []
  const stack: string[] = []
  let buf = ''

  for (const ch of cleaned) {
    if (ch === '{') {
      const header = buf.trim().replace(/\s+/g, ' ')
      buf = ''
      const parent = stack[stack.length - 1] ?? ''
      if (
        !header.startsWith('@') &&
        !parent.toLowerCase().startsWith('@media') &&
        !parent.toLowerCase().startsWith('@keyframes')
      ) {
        headers.push(header)
      }
      stack.push(header)
    } else if (ch === '}') {
      stack.pop()
      buf = ''
    } else if (ch === ';') {
      buf = ''
    } else {
      buf += ch
    }
  }
  return headers
}

describe('Phase 3 Slice 3.7: CSS Cascade Layer Consolidation (V6)', () => {
  it('assigns single stylesheet ownership for .tran-phap-panel* to tien-hiep-auxiliary.css', () => {
    const uiCss = stripComments(readFileSync(join(SRC_ROOT, 'assets/tien-hiep-ui.css'), 'utf8'))
    const secondaryCss = stripComments(
      readFileSync(join(SRC_ROOT, 'assets/tien-hiep-secondary-ui.css'), 'utf8'),
    )
    const auxiliaryCss = stripComments(
      readFileSync(join(SRC_ROOT, 'assets/tien-hiep-auxiliary.css'), 'utf8'),
    )

    expect(uiCss).not.toMatch(/\.tran-phap-panel|\.queue-stand/)
    expect(secondaryCss).not.toMatch(/\.tran-phap-panel|\.queue-stand/)
    expect(auxiliaryCss).toMatch(/\.tran-phap-panel\b/)
    expect(auxiliaryCss).toMatch(/\.queue-stand__label\b/)
  })

  it('assigns global .game-button chrome overrides to pc-paper-production.css without tien-hiep-ui.css duplication', () => {
    const uiCss = stripComments(readFileSync(join(SRC_ROOT, 'assets/tien-hiep-ui.css'), 'utf8'))
    const pcPaperCss = stripComments(
      readFileSync(join(SRC_ROOT, 'assets/pc-paper-production.css'), 'utf8'),
    )

    expect(uiCss).not.toMatch(/\.game-button/)
    expect(pcPaperCss).toMatch(/\.game-button\.game-button\b/)
    expect(pcPaperCss).toMatch(/\.game-button:focus-visible\b/)
  })

  it('forbids duplicate .combat-scene-overlay__* selectors in CombatSceneOverlay.vue scoped styles', () => {
    const sfc = readFileSync(
      join(SRC_ROOT, 'components/game/combat/CombatSceneOverlay.vue'),
      'utf8',
    )
    const styleMatch = sfc.match(/<style[^>]*>([\s\S]*?)<\/style>/)
    expect(styleMatch).not.toBeNull()

    const headers = collectScopedRuleHeaders(styleMatch![1]!)
    const seen = new Set<string>()
    const duplicates: string[] = []
    for (const h of headers) {
      if (seen.has(h)) duplicates.push(h)
      seen.add(h)
    }

    expect(duplicates).toEqual([])
  })

  it('forbids duplicate same-selector blocks within each consolidated global stylesheet', () => {
    const sheets = [
      'assets/tien-hiep-ui.css',
      'assets/tien-hiep-secondary-ui.css',
      'assets/tien-hiep-auxiliary.css',
      'assets/pc-paper-production.css',
    ]

    const duplicates: string[] = []
    for (const relPath of sheets) {
      const css = readFileSync(join(SRC_ROOT, relPath), 'utf8')
      const headers = collectScopedRuleHeaders(css)
      const seen = new Set<string>()
      for (const h of headers) {
        if (seen.has(h)) {
          duplicates.push(`${relPath} :: ${h}`)
        }
        seen.add(h)
      }
    }

    expect(duplicates).toEqual([])
  })
})
