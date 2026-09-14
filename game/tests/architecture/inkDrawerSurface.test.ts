/**
 * Guard — the two HUD drawers (LeftPanel / RightPanel) share ONE surface
 * owner: the `.ink-drawer` class in `src/assets/theme.css`.
 *
 * Source of authority:
 * - UI art pass 2026-09: the user-supplied drawer art
 *   (public/assets/ui/panel-drawer-ink.png) is applied via native
 *   border-image in `.ink-drawer`, which also remaps paper tokens to the
 *   dark surface palette so every primitive inside renders legibly
 *   without per-component edits.
 * - roadmap R11: one owner per reusable visual rule; primitives own
 *   reusable patterns.
 *
 * What this polices:
 *   1. `.ink-drawer` is DEFINED once, in theme.css only — a second
 *      definition would fork the shared drawer surface.
 *   2. Both drawers apply the class; neither keeps a private drawer
 *      surface class (dark-drawer-fill / paper-drawer-fill).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { listVue, SCAN_TIMEOUT } from './helpers/scanTs'

const SRC_DIR = join(process.cwd(), 'src')
const THEME = join(SRC_DIR, 'assets/theme.css')
const DRAWERS = [
  'components/layout/LeftPanel.vue',
  'components/layout/RightPanel.vue',
]

/** Selector DEFINITION: `.ink-drawer` starting a line or following
 * `}`/`,` (i.e. selector position) — class= attribute usage and comment
 * mentions are mid-line and never match. */
const DEFINITION = /(?:^|[},])\s*\.ink-drawer[\s,{]/m
const DEFINITION_G = /(?:^|[},])\s*\.ink-drawer[\s,{]/gm

describe('ink-drawer surface ownership', () => {
  it('theme.css defines .ink-drawer exactly once', () => {
    const theme = readFileSync(THEME, 'utf8')
    const matches = theme.match(DEFINITION_G) ?? []

    expect(matches.length).toBe(1)
  })

  it('no other stylesheet or SFC style block defines .ink-drawer', () => {
    const offenders: string[] = []

    for (const file of listVue(SRC_DIR)) {
      const text = readFileSync(file, 'utf8')
      if (DEFINITION.test(text)) offenders.push(file)
    }

    expect(offenders).toEqual([])
  }, SCAN_TIMEOUT)

  for (const drawer of DRAWERS) {
    it(`${drawer} applies the shared .ink-drawer surface`, () => {
      const text = readFileSync(join(SRC_DIR, drawer), 'utf8')

      expect(text).toContain('ink-drawer')
      expect(text).not.toContain('dark-drawer-fill')
      expect(text).not.toContain('paper-drawer-fill')
    })
  }
})
