/**
 * Guard — the Khi Duong (equipment hall) `qi-hall__*` layout vocabulary has
 * exactly one owner: `src/components/panels/equipment-hall/qi-hall.css`.
 *
 * Source of authority:
 * - docs/roadmap.md Phase R11 "Khi Duong 3-tab layout defect" — the
 *   user-reported bug: Enhance/Wash/Refine tabs rendered an invisible item
 *   grid because the shell's scoped `.qi-hall__body { flex-direction: column }`
 *   and each tab's scoped `.qi-hall__split { flex-direction: row }` share
 *   specificity (0,2,0) on the tab root element, so bundle injection order
 *   decided the layout. Splitting the monolith (330b9feb) flipped that order.
 *
 * What this polices (style definitions only — template class= usage is not
 * a definition and is never scanned):
 *   1. Every `.qi-hall__*` selector is defined in qi-hall.css only. The two
 *      shell-owned selectors are the exception: `.qi-hall` (root) and
 *      `.qi-hall__tabs` may additionally be defined in EquipmentHallPanel.vue.
 *   2. `.qi-hall` itself is defined ONLY by the shell (it is shell-private
 *      structure: nine-slice stacking context), never in the shared sheet —
 *      a second definition would re-open the same specificity war.
 *   3. The shell actually imports the shared sheet (P13 wiring check — a
 *      vocabulary file nobody imports silently styles nothing).
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { listVue, SCAN_TIMEOUT } from './helpers/scanTs'

const SRC_DIR = join(process.cwd(), 'src')
const SHARED_SHEET = 'components/panels/equipment-hall/qi-hall.css'
const SHELL = 'components/panels/EquipmentHallPanel.vue'

/** Tokens the shell is allowed to define in its own scoped block. */
const SHELL_TOKENS = new Set(['.qi-hall', '.qi-hall__tabs'])

function listCss(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...listCss(full))
    } else if (entry.endsWith('.css')) {
      out.push(full)
    }
  }
  return out
}

function stripComments(raw: string): string {
  return raw.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Style content of one file: <style> blocks for .vue, whole file for .css. */
function styleText(path: string, raw: string): string {
  if (path.endsWith('.css')) {
    return raw
  }

  return [...raw.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1] ?? '').join('\n')
}

function definedTokens() {
  const files = [...listVue(SRC_DIR), ...listCss(SRC_DIR)]

  return files.flatMap((path) => {
    const fromSrc = relative(SRC_DIR, path).split(sep).join('/')
    const css = stripComments(styleText(path, readFileSync(path, 'utf8')))

    const tokens = new Set<string>()
    for (const match of css.matchAll(/\.qi-hall(?:__[\w-]+)?/g)) {
      tokens.add(match[0])
    }

    return [...tokens].map((token) => ({ fromSrc, token }))
  })
}

describe('qi-hall layout vocabulary ownership', () => {
  it('.qi-hall__* selectors are defined only in qi-hall.css; shell owns .qi-hall/.qi-hall__tabs', { timeout: SCAN_TIMEOUT }, () => {
    const violations: string[] = []

    for (const { fromSrc, token } of definedTokens()) {
      if (fromSrc === SHARED_SHEET) {
        if (token === '.qi-hall') {
          violations.push(`${SHARED_SHEET} must not define ${token} — the root stays scoped in the shell`)
        }
        continue
      }

      if (fromSrc === SHELL) {
        if (!SHELL_TOKENS.has(token)) {
          violations.push(`${SHELL} defines ${token} — tab-body vocabulary belongs to qi-hall.css`)
        }
        continue
      }

      violations.push(`${fromSrc} defines ${token} — qi-hall__* selectors have one owner: ${SHARED_SHEET}`)
    }

    expect(violations, violations.join('\n')).toEqual([])
  })

  it('the shared sheet exists and the shell imports it', () => {
    const sheetPath = join(SRC_DIR, 'components', 'panels', 'equipment-hall', 'qi-hall.css')
    expect(existsSync(sheetPath), `${SHARED_SHEET} is missing`).toBe(true)

    const shell = readFileSync(join(SRC_DIR, 'components', 'panels', 'EquipmentHallPanel.vue'), 'utf8')
    expect(
      /import\s+['"]\.\/equipment-hall\/qi-hall\.css['"]/.test(shell),
      'EquipmentHallPanel.vue must import ./equipment-hall/qi-hall.css',
    ).toBe(true)
  })
})
