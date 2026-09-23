/**
 * Guard - M-UI-SYSTEM boundary contract (spec 2.2/2.4, plan Task 8).
 *
 * The "xuyen khong he thong" skin is a PARALLEL theme, opt-in only. This
 * test polices mechanically:
 *
 *   1. Canonical `--sys-*` tokens are defined at `:root` in
 *      `src/assets/system-theme.css`, each exactly once. No other file may
 *      declare a canonical `--sys-*` token - scoped re-assignments inside
 *      `.sys-`/`--system`-anchored selectors (or inline styles on opted-in
 *      elements) are permitted re-tints, not redefinitions.
 *   2. `system-theme.css` never declares a left-hand definition of a
 *      non-sys token (`--ink-`, `--gold-`, `--paper-`, `--surface-`,
 *      `--chrome-`, `--frame-`, `--fx-`, `--scrim`, `--text-`, `--rank-`,
 *      `--grade-`, `--el-`, `--bar-`).
 *   3. Every ordinary style-rule selector in `system-theme.css` carries a
 *      `.sys-` or `--system` anchor. At-rule allowlist: `:root` (restricted
 *      to `--sys-*` definitions anyway), `@property`, `@keyframes`,
 *      `@font-face`, `@import`, `@media`, `@supports`. Rules nested inside
 *      `@media`/`@supports` are still ordinary rules and need the anchor;
 *      `@keyframes` percentage frames are not style rules and are exempt.
 *   4. `src/main.ts` still imports `theme.css` before `system-theme.css`
 *      (the sys layer wins ties by order only where it intentionally
 *      overrides).
 *
 * Same source-scanning convention as inkDrawerSurface.test.ts - guards
 * never import app code, they read files.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { srcCorpus, SCAN_TIMEOUT } from './helpers/scanTs'

const SRC_DIR = join(process.cwd(), 'src')
const SYS_THEME = join(SRC_DIR, 'assets/system-theme.css')
const MAIN_TS = join(SRC_DIR, 'main.ts')

/** Non-sys token families the system layer must never define (LHS). */
const FORBIDDEN_LHS =
  /--(ink|gold|paper|surface|chrome|frame|fx|scrim|text|rank|grade|el|bar)-[a-z0-9-]*\s*:|--scrim\s*:/

/** A `--sys-*` custom-property DEFINITION (left-hand side).
 * Two flavors: `SYS_LHS` for matchAll (global), `SYS_LHS_ONCE` for test()
 * - a global regex fed to .test() leaks lastIndex between calls. */
const SYS_LHS = /--sys-[a-z0-9-]+\s*:/g
const SYS_LHS_ONCE = /--sys-[a-z0-9-]+\s*:/

const ANCHOR = /\.sys-|--system/

interface CssRule {
  /** Header text immediately before `{` (trimmed). */
  header: string
  /** True when the header is an at-rule (@media, @keyframes, ...). */
  isAtRule: boolean
  /** All `{`-delimited bodies that belong to this rule's own block. */
  body: string
}

/** Recursively list .css files under a directory. */
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

/**
 * Minimal CSS block walker: yields every rule's header plus its block body.
 * Comments and the SFC non-style parts must already be stripped by the
 * caller. `@keyframes` frames (from/to/%) are reported with `isAtRule` on
 * their parent so callers can exempt them - percentage steps are not
 * selectors and carry no anchor requirement.
 */
function* cssRules(css: string): Generator<CssRule> {
  const stack: Array<{ header: string; isAtRule: boolean; body: string[] }> = []
  let buf = ''
  for (const ch of css) {
    if (ch === '{') {
      const header = buf.trim()
      buf = ''
      stack.push({ header, isAtRule: header.startsWith('@'), body: [] })
    } else if (ch === '}') {
      const done = stack.pop()
      // Flush a declaration that ends without ';' (last one in the block).
      const tail = buf.trim()
      if (done && tail) done.body.push(tail)
      buf = ''
      if (done) {
        yield { header: done.header, isAtRule: done.isAtRule, body: done.body.join('') }
      }
    } else if (ch === ';') {
      stack.at(-1)?.body.push(buf, ';')
      buf = ''
    } else {
      buf += ch
    }
  }
}

/** Split a selector list on ',' but never inside ()/[]/quotes (:is() etc). */
function splitSelectorList(sel: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim()) out.push(cur)
  return out
}

/** Ordinary style rules = non-@ headers whose parent is not @keyframes. */
function* ordinarySelectors(css: string): Generator<string> {
  const stack: string[] = []
  let buf = ''
  for (const ch of css) {
    if (ch === '{') {
      const header = buf.trim()
      buf = ''
      const parent = stack[stack.length - 1] ?? ''
      if (!header.startsWith('@') && !parent.toLowerCase().startsWith('@keyframes')) {
        yield header
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
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Extract the text of every <style> block in a .vue SFC. */
function* styleBlocks(sfc: string): Generator<string> {
  const re = /<style[^>]*>([\s\S]*?)<\/style>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(sfc))) yield m[1]!
}

describe('system theme boundary (M-UI-SYSTEM)', () => {
  const css = stripComments(readFileSync(SYS_THEME, 'utf8'))

  it('defines each canonical --sys-* token exactly once at :root', () => {
    const rootBodies: string[] = []
    for (const sel of ordinarySelectors(css)) {
      if (splitSelectorList(sel).some((s) => s.trim() === ':root')) rootBodies.push(sel)
    }
    // Collect all --sys-* definitions inside :root blocks and count them.
    const counts = new Map<string, number>()
    const walk = cssRules(css)
    for (const rule of walk) {
      if (!splitSelectorList(rule.header).some((s) => s.trim() === ':root')) continue
      // :root is allowlisted - but its body may contain ONLY --sys-* defs.
      for (const m of rule.body.matchAll(/--([a-z0-9-]+)\s*:/g)) {
        expect(m[1]!.startsWith('sys-')).toBe(true)
      }
      for (const m of rule.body.matchAll(SYS_LHS)) {
        const name = m[0].replace(/[\s:]/g, '')
        counts.set(name, (counts.get(name) ?? 0) + 1)
      }
    }
    expect(rootBodies.length).toBeGreaterThan(0)
    const dupes = [...counts.entries()].filter(([, c]) => c > 1)
    expect(dupes).toEqual([])
  })

  it('no other file declares a canonical --sys-* token at :root', () => {
    const offenders: string[] = []
    const files = [
      ...listCss(SRC_DIR),
      ...listVueFiles(SRC_DIR),
    ]
    for (const file of files) {
      if (file === SYS_THEME) continue
      const text = file.endsWith('.vue')
        ? [...styleBlocks(stripComments(readFileSync(file, 'utf8')))].join('\n')
        : stripComments(readFileSync(file, 'utf8'))
      for (const rule of cssRules(text)) {
        const isRoot = splitSelectorList(rule.header).some((s) => s.trim() === ':root')
        if (isRoot && SYS_LHS_ONCE.test(rule.body)) offenders.push(file)
      }
    }
    expect(offenders).toEqual([])
  }, SCAN_TIMEOUT)

  it('system-theme.css defines no non-sys token (LHS scan)', () => {
    const hits: string[] = []
    for (const rule of cssRules(css)) {
      for (const m of rule.body.matchAll(new RegExp(FORBIDDEN_LHS.source, 'g'))) {
        hits.push(`${rule.header} :: ${m[0]}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('every ordinary style rule in system-theme.css carries a .sys-/--system anchor', () => {
    const offenders: string[] = []
    for (const sel of ordinarySelectors(css)) {
      for (const part of splitSelectorList(sel)) {
        const s = part.trim()
        if (!s) continue
        if (s === ':root') continue // allowlisted - restricted to --sys-* defs above
        if (!ANCHOR.test(s)) offenders.push(s)
      }
    }
    expect(offenders).toEqual([])
  })

  it('scoped --sys-* re-assignments outside system-theme.css stay under anchored selectors', () => {
    const offenders: string[] = []
    for (const file of srcCorpus(SRC_DIR)) {
      if (!file.fromSrc.endsWith('.vue')) continue
      for (const style of styleBlocks(stripComments(file.text))) {
        for (const rule of cssRules(style)) {
          if (rule.isAtRule) continue
          if (!SYS_LHS_ONCE.test(rule.body)) continue
          const anchored = splitSelectorList(rule.header)
            .every((s) => s.trim() === '' || ANCHOR.test(s))
          if (!anchored) offenders.push(`${file.fromSrc} :: ${rule.header}`)
        }
      }
    }
    expect(offenders).toEqual([])
  }, SCAN_TIMEOUT)

  // M-UI-OVERHAUL Task 2 Step 1 — the v2 grammar contract: every utility the
  // plan wires into primitives/shared chrome must exist as a real rule in
  // system-theme.css (existence), and the generic anchor test above already
  // guarantees each is .sys-anchored (no unanchored leakage possible).
  it('v2 grammar utilities exist as anchored rules', () => {
    const V2_UTILITIES = [
      '.sys-chamfer',
      '.sys-boot',
      '.sys-trace',
      '.sys-rail',
      '.sys-energy',
      '.sys-snap',
      '.sys-widget',
      '.sys-ephemeral',
      '.sys-btn',
      '.sys-tabs',
      '.sys-seg',
      '.sys-marker',
      '.sys-veil',
      '.sys-pop',
      '.sys-domain--azure',
      '.sys-domain--jade',
      '.sys-domain--violet',
      '.sys-domain--danger',
    ]
    const selectors = [...ordinarySelectors(css)]
    const missing = V2_UTILITIES.filter(
      (util) => !selectors.some((sel) => splitSelectorList(sel).some((s) => s.includes(util))),
    )
    expect(missing).toEqual([])
  })

  // M-UI-OVERHAUL Task 10 - surface-contract guards added by the overhaul.
  it('InkNineSlice is only consumed by ink-ceremony and dormant-fallback paths', () => {
    // Every remaining consumer is either the still-painted victory/defeat
    // ceremony or an intentionally dormant ink variant/fallback branch
    // (OverlayPanel variant="ink", GameButton non-system variants). Any new
    // consumer outside this list means a surface re-adopted ink chrome.
    const ALLOWLIST = new Set([
      'components/game/combat/CombatVictoryPanel.vue',
      'components/game/combat/CombatDefeatPanel.vue',
      'components/common/OverlayPanel.vue',
      'components/common/GameButton.vue',
      'components/common/primitives/InkNineSlice.vue',
    ])
    const offenders: string[] = []
    for (const file of srcCorpus(SRC_DIR)) {
      if (!file.fromSrc.endsWith('.vue')) continue
      if (ALLOWLIST.has(file.fromSrc)) continue
      // Actual consumption = import or template tag; comments don't count.
      if (/import\s+InkNineSlice|<InkNineSlice\b/.test(file.text)) offenders.push(file.fromSrc)
    }
    expect(offenders).toEqual([])
  }, SCAN_TIMEOUT)

  it('every OverlayPanel mount requests the system variant', () => {
    const offenders: string[] = []
    for (const file of srcCorpus(SRC_DIR)) {
      if (!file.fromSrc.endsWith('.vue')) continue
      if (file.fromSrc === 'components/common/OverlayPanel.vue') continue
      // Scan each <OverlayPanel ...> opening tag for the system opt-in.
      for (const m of file.text.matchAll(/<OverlayPanel\b[\s\S]*?>/g)) {
        if (!m[0].includes('variant="system"')) {
          offenders.push(`${file.fromSrc} :: ${m[0].slice(0, 80)}`)
        }
      }
    }
    expect(offenders).toEqual([])
  }, SCAN_TIMEOUT)

  it('low-fx kill-switch exists and is wired before mount', () => {
    expect([...ordinarySelectors(css)].some((sel) => sel.includes('sys-fx-low'))).toBe(true)
    const main = readFileSync(MAIN_TS, 'utf8')
    expect(main).toContain('initSysFxLow')
    // The initializer must run before app.mount so first paint already
    // carries the reduced-effects class.
    expect(main.indexOf('initSysFxLow()')).toBeLessThan(main.indexOf('.mount('))
  })

  it('main.ts imports theme.css before system-theme.css', () => {
    const main = readFileSync(MAIN_TS, 'utf8')
    const inkAt = main.indexOf("import './assets/theme.css'")
    const sysAt = main.indexOf("import './assets/system-theme.css'")
    expect(inkAt).toBeGreaterThanOrEqual(0)
    expect(sysAt).toBeGreaterThanOrEqual(0)
    expect(inkAt).toBeLessThan(sysAt)
  })
})

/** .vue files via scanTs helpers (kept next to listCss for readability). */
function listVueFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...listVueFiles(full))
    } else if (entry.endsWith('.vue')) {
      out.push(full)
    }
  }
  return out
}
