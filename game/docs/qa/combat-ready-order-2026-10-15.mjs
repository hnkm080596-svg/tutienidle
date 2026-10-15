import { chromium } from 'playwright'
import { bootToGuestHome, createCharacterThroughUi, enterHome, waitForPresentationIdle } from '../../tests/e2e/helpers.ts'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, baseURL: 'http://127.0.0.1:5837' })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }))
try {
  await bootToGuestHome(page)
  await createCharacterThroughUi(page, 'Ready Order QA')
  await enterHome(page)
  await page.evaluate(async () => {
    const { GAME_MANAGER_KEY } = await import('/src/composables/useGameState.ts')
    const manager = [...document.querySelectorAll('*')].map(node => node.__vueParentComponent?.provides?.[GAME_MANAGER_KEY]).find(Boolean)
    if (!manager) throw new Error('Public injected GameManager unavailable')
    const ready = new Set()
    const evidence = window.combatReadyEvidence = { casts: [], assets: [], errors: [] }
    manager.eventBus.on('turn_ready', event => ready.add(event.actorId))
    manager.eventBus.on('skill_presentation_cast', event => {
      if (!ready.delete(event.source.entityId)) return
      const marker = [...document.querySelectorAll('[data-actor-id]')].find(node => node.dataset.actorId === event.source.entityId)
      evidence.casts.push({ actorId: event.source.entityId, progress: marker ? Number(marker.dataset.progress) : null })
    })
    let previous
    const observe = () => {
      const battle = manager.getTurnBattle()
      const pending = manager.getFreezeReasons().includes('ui-assets')
      const remaining = battle?.countdownTurnsRemaining
      if (pending) evidence.assets.push({ phase: battle?.state, remaining })
      if (pending && previous?.pending && remaining !== previous.remaining) evidence.errors.push('Countdown advanced during UI loading')
      previous = { pending, remaining }
      requestAnimationFrame(observe)
    }
    requestAnimationFrame(observe)
  })
  const toggle = page.getByRole('button', { name: 'Mở thanh điều hướng', exact: true })
  if (await toggle.isVisible()) await toggle.click()
  await page.getByRole('button', { name: 'Sơn Hà Đồ', exact: true }).click()
  await page.getByRole('button', { name: 'Bắt Đầu', exact: true }).click()
  await waitForPresentationIdle(page)
  await page.waitForFunction(() => window.combatReadyEvidence?.casts.length >= 4, { timeout: 30000 })
  const evidence = await page.evaluate(() => window.combatReadyEvidence)
  if (evidence.casts.some(cast => cast.progress === null || cast.progress < 99.9)) throw new Error(`Early cast: ${JSON.stringify(evidence.casts)}`)
  if (evidence.errors.length) throw new Error(evidence.errors.join('; '))
  if (await page.locator('.combat-initiative-track header, .combat-initiative-track text').count()) throw new Error('Line still contains labels')
  if (await page.locator('.battle-card .combat-skill-slot__caption').count()) throw new Error('Skill captions still visible')
  await page.locator('.combat-top-bar__pause').click()
  await page.locator('.battle-card .combat-skill-slot').first().hover()
  await page.locator('.tooltip--technique').waitFor({ state: 'visible', timeout: 5000 })
  await page.screenshot({ path: 'docs/qa/combat-ready-order-2026-10-15.png' })
  if (await page.locator('.combat-auto-glow').count() !== 1) throw new Error('Auto SVG glow missing')
  await page.locator('.combat-top-bar__speed').click()
  const selected = await page.locator('.combat-top-bar__speed').innerText()
  const preferencePage = await context.newPage()
  await preferencePage.goto('/docs/qa/combat-vfx-preview-2026-10-15.html')
  const persisted = await preferencePage.evaluate(async () => (await import('/src/presentation/combat/CombatPlaybackSpeed.ts')).getCombatPlaybackSpeed())
  if (!selected.includes(String(persisted))) throw new Error('Playback preference did not survive a fresh page')
  console.log(JSON.stringify({ casts: evidence.casts, loadingSamples: evidence.assets.length, persisted, pageErrors: errors }))
  if (errors.length) throw new Error('Page exceptions occurred')
} catch (error) {
  await page.screenshot({ path: 'docs/qa/combat-ready-order-failure-2026-10-15.png' })
  throw error
} finally { await context.close(); await browser.close() }
