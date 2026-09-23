#!/usr/bin/env node
// Drive ChatGPT web (chatgpt.com) in the already-running Devin Chrome via CDP:
// paste a review prompt, send it, wait for the response to finish streaming,
// print the response to stdout. Login state comes from the browser profile —
// anonymous works (rate-limited), a logged-in profile raises limits.
//
// Usage (from anywhere):
//   node game/scripts/chatgpt-web-review.mjs --prompt-file /tmp/review-prompt.md
//   node game/scripts/chatgpt-web-review.mjs --prompt-file p.md --timeout 600
//   node game/scripts/chatgpt-web-review.mjs --prompt-file p.md --out /tmp/chatgpt-review.md
//
// Exit codes: 0 ok · 2 prompt/input failure · 3 response timeout · 4 page/site failure.

import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'

const require = createRequire(new URL('../package.json', import.meta.url))
const { chromium } = require('playwright-core')

const CDP = process.env.CHATGPT_CDP ?? 'http://localhost:29229'
const BASE = 'https://chatgpt.com'

const args = process.argv.slice(2)
function argValue(flag) {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : undefined
}
const promptFile = argValue('--prompt-file')
const outFile = argValue('--out')
const timeoutSec = Number(argValue('--timeout') ?? 420)
if (!promptFile) {
  console.error('missing --prompt-file <path>')
  process.exit(2)
}
const prompt = readFileSync(promptFile, 'utf8')
if (!prompt.trim()) {
  console.error('prompt file is empty')
  process.exit(2)
}

function log(msg) {
  console.error(`[chatgpt-web-review] ${msg}`)
}

async function main() {
  const browser = await chromium.connectOverCDP(CDP)
  const context = browser.contexts()[0]
  if (!context) {
    log('no browser context found on CDP endpoint')
    process.exit(4)
  }
  const page = await context.newPage()
  try {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // Login wall / captcha detection: anonymous still gets a textarea, so
    // absence of the textarea within 20s means a real block, not just slow load.
    const textarea = page.locator('textarea#prompt-textarea, textarea[name="prompt"]')
    try {
      await textarea.first().waitFor({ state: 'visible', timeout: 20_000 })
    } catch {
      const url = page.url()
      log(`no prompt textarea (url: ${url}) — possible Cloudflare check or login wall`)
      process.exit(4)
    }

    // Fill via the native setter so React's controlled textarea registers it.
    await textarea.first().evaluate((el, text) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      setter.call(el, text)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, prompt)

    const send = page.locator('button[aria-label="Send message"], button[data-testid="send-button"]')
    await send.first().click()

    log('prompt sent — waiting for response to finish')
    // Streaming finished when the message action row (Copy response) appears on
    // the last assistant turn. Also bail early on an error toast/regenerate UI.
    const deadline = Date.now() + timeoutSec * 1000
    let done = false
    while (Date.now() < deadline) {
      const state = await page.evaluate(() => {
        const stop = document.querySelector('button[aria-label*="Stop"], button[data-testid="stop-button"]')
        const err = document.querySelector('[data-testid="toast"], .text-token-text-error')
        // The "Copy response" action button only renders once streaming ends.
        // It is not inside the <article>, so check it globally.
        const copy = document.querySelector('button[aria-label="Copy response"], button[aria-label="Copy"]')
        return { streaming: !!stop, error: !!err, complete: !!copy }
      })
      if (state.error) {
        log('ChatGPT reported an error (toast visible)')
        process.exit(4)
      }
      if (state.complete && !state.streaming) {
        done = true
        break
      }
      await page.waitForTimeout(2000)
    }
    if (!done) {
      log(`response not complete after ${timeoutSec}s`)
      process.exit(3)
    }

    const text = await page.evaluate(() => {
      // Assistant turns are the <li> items under the conversation <ol> whose
      // heading reads "ChatGPT said:". data-message-author-role is absent in
      // anonymous mode and <article> is an unrelated interactive widget.
      const items = Array.from(document.querySelectorAll('ol[aria-label="Conversation"] > li'))
      const assistant = items.filter((li) => /ChatGPT said/i.test(li.innerText))
      const last = assistant[assistant.length - 1] ?? items[items.length - 1]
      if (!last) return ''
      const clone = last.cloneNode(true)
      clone.querySelectorAll('button, [aria-label="Response actions"], h4').forEach((n) => n.remove())
      return clone.innerText.trim()
    })

    if (outFile) writeFileSync(outFile, text, 'utf8')
    process.stdout.write(text + '\n')
  } finally {
    await page.close().catch(() => {})
    await browser.close().catch(() => {})
  }
}

main().catch((e) => {
  log(`fatal: ${e.message}`)
  process.exit(4)
})
