import { chromium } from 'playwright'
import { bootToGuestHome, createCharacterThroughUi, enterHome } from '../../tests/e2e/helpers.ts'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, baseURL: 'http://127.0.0.1:5840' })
await context.addInitScript(() => {
  window.audioIntegrationEvidence = { starts: 0, buffers: [], sampleRate: 48000 }
  window.audioBufferSignature = buffer => {
    const channel = buffer.getChannelData(0)
    const bytes = new Uint8Array(channel.buffer, channel.byteOffset, channel.byteLength)
    let hash = 2166136261
    for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619) >>> 0
    return [buffer.numberOfChannels, buffer.length, buffer.sampleRate, hash].join(':')
  }
  const original = AudioBufferSourceNode.prototype.start
  AudioBufferSourceNode.prototype.start = function (...args) {
    window.audioIntegrationEvidence.starts++
    if (this.buffer) {
      window.audioIntegrationEvidence.sampleRate = this.buffer.sampleRate
      window.audioIntegrationEvidence.buffers.push(window.audioBufferSignature(this.buffer))
    }
    return original.apply(this, args)
  }
})
const page = await context.newPage()
const errors = []
const waves = new Set()
page.on('pageerror', error => errors.push(error.message))
page.on('response', response => { if (response.ok() && /\/assets\/audio\/ui\/.*\.wav/.test(response.url())) waves.add(response.url()) })
await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }))
try {
  await bootToGuestHome(page)
  await createCharacterThroughUi(page, 'Quest Sound QA')
  await enterHome(page)
  const toggle = page.getByRole('button', { name: 'Mở thanh điều hướng', exact: true })
  if (await toggle.isVisible()) await toggle.click()
  await page.waitForFunction(async () => {
    const { AudioManager } = await import('/src/core/audio/AudioManager.ts')
    return AudioManager.getInstance().hasDecodedBuffer('/assets/audio/ui/ui_panel_open.wav')
  }, undefined, { timeout: 30000 })
  const expectedPanelBuffer = await page.evaluate(async () => {
    const bytes = await fetch('/assets/audio/ui/ui_panel_open.wav').then(response => response.arrayBuffer())
    const decoder = new OfflineAudioContext(2, 1, window.audioIntegrationEvidence.sampleRate)
    return window.audioBufferSignature(await decoder.decodeAudioData(bytes))
  })
  const before = await page.evaluate(() => window.audioIntegrationEvidence.buffers.length)
  await page.getByRole('button', { name: 'Nhiệm Vụ', exact: true }).click()
  await page.waitForFunction(({ previous, signature }) => window.audioIntegrationEvidence.buffers.slice(previous).includes(signature), { previous: before, signature: expectedPanelBuffer })
  await page.locator('.quest-scene').waitFor({ state: 'visible' })
  await page.screenshot({ path: 'docs/qa/quest-sound-live-2026-10-15.png' })
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(JSON.stringify({ wavResponses: waves.size, startedSources: await page.evaluate(() => window.audioIntegrationEvidence.starts), panelWavPlayed: true, questVisible: true, pageErrors: errors }))
} catch (error) {
  await page.screenshot({ path: 'docs/qa/quest-sound-runtime-failure-2026-10-15.png' })
  throw error
} finally {
  await context.close()
  await browser.close()
}
