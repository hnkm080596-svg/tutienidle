# Supplemental runtime evidence — 2026-09-14

Baseline: f2846064a4b15d4d20a94540855b6194b77eb21c. Audit worktree only.

## Edge UI reproduction (ARCH-005 and ARCH-004 corroboration)

This is the exact diagnostic that was executed from game/ while Vite was running at its printed localhost:5984 URL. It used an isolated browser context, existing real UI helpers and the installed msedge channel. Domain/component internals were read only for observation after UI interaction; no gameplay state was injected. The script succeeded, emitted audit-edge-evidence.json, and closed browser/context in finally.

For replay, place the snippet temporarily under game/docs/qa/ and execute with the same Node runtime; the helper import is relative to that location. Start the dev server and substitute its actual port if different. The executable diagnostic file was removed after the audit; this document preserves the method.

`controls` counts .turn-combat-skill-bar roots, not all buttons on the page. sceneSessionId was undefined and therefore omitted by JSON serialization. Component setupState confirmed isBattleFighting=false and visible=false for TurnCombatSkillBar while the domain was fighting at turn 3. logLength was undefined because the diagnostic looked for log rather than logEntries; it provides no independent quantitative proof of stale BattleLogPanel data.

```js
import { chromium } from '@playwright/test'
import { bootToGuestHome, createCharacterThroughUi, enterHome } from '../../tests/e2e/helpers.ts'
import { writeFileSync } from 'node:fs'

const browser = await chromium.launch({ channel: 'msedge', headless: true, timeout: 20000 })
const context = await browser.newContext({ baseURL: 'http://localhost:5984', viewport: { width: 1600, height: 900 } })
const page = await context.newPage()
const evidence = { requestsFailed: [], errors: [] }
page.on('requestfailed', request => {
  const url = new URL(request.url())
  evidence.requestsFailed.push({ url: url.origin + url.pathname, error: request.failure()?.errorText })
})
page.on('pageerror', error => evidence.errors.push(error.message))
try {
  await bootToGuestHome(page)
  await createCharacterThroughUi(page, 'Audit Runtime')
  await enterHome(page)
  await page.screenshot({ path: 'docs/qa/audit-edge-home.png' })
  await page.keyboard.press('Tab')
  await page.locator('[data-wheel-slot="teleport_array"]').click()
  await page.getByTestId('stage-start-button').click()
  await page.waitForFunction(() => {
    const gm = window.__tutienPhaserGame?.registry.get('gameManager')
    const battle = gm?.getTurnBattle()
    return battle?.state === 'fighting' && battle.totalTurnsElapsed >= 3
  }, null, { timeout: 90000 })
  evidence.runtime = await page.evaluate(() => {
    const game = window.__tutienPhaserGame
    const gm = game.registry.get('gameManager')
    const battle = gm.getTurnBattle()
    const dock = document.querySelector('.combat-skill-dock-panel')
    const found = []
    const visited = new Set()
    const visit = vnode => {
      if (!vnode || typeof vnode !== 'object' || visited.has(vnode)) return
      visited.add(vnode)
      if (vnode.component) {
        const component = vnode.component
        if (/TurnCombatSkillBar|BattleLogPanel/.test(component.type?.__name ?? '')) found.push({ name: component.type.__name, keys: Object.keys(component.setupState), isBattleFighting: component.setupState.isBattleFighting, visible: component.setupState.visible, logLength: component.setupState.log?.length })
        visit(component.subTree)
      }
      if (Array.isArray(vnode.children)) vnode.children.forEach(visit)
    }
    visit(document.querySelector('#app').__vue_app__._instance.subTree)
    return { state: battle.state, turns: battle.totalTurnsElapsed, rounds: battle.roundsElapsed, sceneActive: game.scene.isActive('CombatScene'), mainActive: game.scene.isActive('MainScene'), sceneSessionId: game.scene.getScene('CombatScene').initSessionId, domainSession: gm.getCurrentPresentationSession(), dockText: dock?.textContent?.trim(), controls: document.querySelectorAll('.turn-combat-skill-bar').length, components: found }
  })
  await page.screenshot({ path: 'docs/qa/audit-edge-combat.png' })
} catch (error) {
  evidence.failure = String(error)
  await page.screenshot({ path: 'docs/qa/audit-edge-failed.png' }).catch(() => {})
  process.exitCode = 1
} finally {
  writeFileSync('docs/qa/audit-edge-evidence.json', JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify(evidence, null, 2))
  await context.close()
  await browser.close()
}

```

## Evidence files

- [Edge runtime JSON](audit-edge-evidence.json)
- [Home](audit-edge-home.png)
- [Combat and empty skill dock](audit-edge-combat.png)
- [Full E2E output](audit-playwright.json)
- [Production diagnostics for save/tribulation](2026-09-14-audit-lifecycle-review.md)

The parent independently replayed the save and lethal tribulation diagnostics: pills-only identity equality=true; snapshot skill 1 -> 11 with shared reference; empty skills restore retained one; defense105 final strike produced defeat then victory with HP0. Saved output is audit-parent-domain.log.
