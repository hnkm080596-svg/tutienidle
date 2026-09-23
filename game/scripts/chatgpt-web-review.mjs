#!/usr/bin/env node
// Drive ChatGPT web (chatgpt.com) in the already-running Devin Chrome via CDP.
// Replaces the local awehitch doorbell: CDP talks to the Chrome process
// directly, so no OS-level UI automation (focus/coordinate races) is involved.
// Login state comes from the browser profile — anonymous works (rate-limited,
// no persistent chat URLs), a logged-in profile raises limits and enables a
// dedicated C2C conversation via --chat-url.
//
// Modes:
//   one-shot review (default): paste prompt, send, wait for response, print it.
//   --send-only:               doorbell only — send and exit, never read DOM.
//   --read:                    send nothing; wait for the last assistant turn
//                              to finish and extract it (resume/poll mode).
//   --chat-url <url>:          bind to an existing conversation (the dedicated
//                              C2C chat) instead of starting a fresh one.
//
// Marker validation (--expect-state [--expect-round <n>]):
//   first non-empty line must be `[C2C] STATE <S> [ · ROUND <n>]` and the last
//   non-empty line must be `[C2C] END`. Exit 5 when markers are missing/wrong
//   — the extracted text is still printed for diagnosis.
//
// Usage:
//   node game/scripts/chatgpt-web-review.mjs --prompt-file p.md
//   node game/scripts/chatgpt-web-review.mjs --send "[C2C] go mdsim-r3" --send-only \
//     --chat-url https://chatgpt.com/c/<id>
//   node game/scripts/chatgpt-web-review.mjs --read --expect-state --expect-round 3 \
//     --chat-url https://chatgpt.com/c/<id> --out .c2c/mailbox/inbox-mdsim-r3.md
//
// Exit codes: 0 ok · 2 input failure · 3 timeout · 4 page/site failure
//             5 marker validation failed (--expect-state).

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
const hasFlag = (f) => args.includes(f)

const promptFile = argValue('--prompt-file')
const sendText = argValue('--send')
const sendOnly = hasFlag('--send-only')
const readMode = hasFlag('--read')
const chatUrl = argValue('--chat-url')
const outFile = argValue('--out')
const timeoutSec = Number(argValue('--timeout') ?? 420)
const expectState = hasFlag('--expect-state')
const expectRound = argValue('--expect-round')

function log(msg) {
  console.error(`[chatgpt-web-review] ${msg}`)
}

let prompt = sendText
if (promptFile) prompt = readFileSync(promptFile, 'utf8')
if (!readMode) {
  if (!prompt || !prompt.trim()) {
    console.error('nothing to send — pass --prompt-file <path> or --send "<text>" (or use --read)')
    process.exit(2)
  }
}

// Last-assistant-turn state for completion detection. The "Copy response"
// button only renders once a turn finishes streaming, and it lives inside that
// turn's <li> — so a prior completed turn in a long C2C chat does not produce
// a false positive: we require a NEW assistant turn (count grew or its tail
// text changed vs the pre-send baseline) that has its own Copy button.
async function assistantState(page) {
  return await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('ol[aria-label="Conversation"] > li'))
    const assistant = items.filter((li) => /ChatGPT said/i.test(li.innerText))
    const last = assistant[assistant.length - 1]
    const stop = document.querySelector('button[aria-label*="Stop"], button[data-testid="stop-button"]')
    const err = document.querySelector('[data-testid="toast"], .text-token-text-error')
    if (!last) return { count: assistant.length, complete: false, streaming: !!stop, error: !!err, tail: '' }
    const copy = last.querySelector('button[aria-label="Copy response"], button[aria-label="Copy"]')
    return {
      count: assistant.length,
      complete: !!copy && !stop,
      streaming: !!stop,
      error: !!err,
      tail: (last.innerText || '').slice(-200),
    }
  })
}

async function extractLastAssistant(page) {
  return await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('ol[aria-label="Conversation"] > li'))
    const assistant = items.filter((li) => /ChatGPT said/i.test(li.innerText))
    const last = assistant[assistant.length - 1] ?? items[items.length - 1]
    if (!last) return ''
    const clone = last.cloneNode(true)
    clone.querySelectorAll('button, [aria-label="Response actions"], h4').forEach((n) => n.remove())
    return clone.innerText.trim()
  })
}

function validateMarkers(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const m = lines[0]?.match(/^\[C2C\] STATE ([A-Z]+)(?:\s*·\s*ROUND\s+(\d+))?/)
  const endOk = lines[lines.length - 1] === '[C2C] END'
  if (!m || !endOk) return { ok: false, state: m?.[1] ?? null, round: m?.[2] ?? null }
  if (expectRound != null && m[2] !== String(expectRound)) {
    return { ok: false, state: m[1], round: m[2] ?? null }
  }
  return { ok: true, state: m[1], round: m[2] ?? null }
}

async function waitForNewTurn(page, baseline) {
  const deadline = Date.now() + timeoutSec * 1000
  while (Date.now() < deadline) {
    const s = await assistantState(page)
    if (s.error) {
      log('ChatGPT reported an error (toast visible)')
      process.exit(4)
    }
    const newTurn = s.count > baseline.count || (s.tail && s.tail !== baseline.tail)
    if (newTurn && s.complete && !s.streaming) return true
    await page.waitForTimeout(2000)
  }
  return false
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
    const target = chatUrl ?? `${BASE}/`
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // Baseline BEFORE any send: count + tail of the existing last turn so the
    // completion check only fires on a genuinely new assistant turn.
    const baseline = await assistantState(page).catch(() => ({ count: 0, tail: '' }))

    if (!readMode) {
      // Absence of the textarea within 20s means a real block (Cloudflare
      // check, login wall, dead chat URL), not just slow load.
      const textarea = page.locator('textarea#prompt-textarea, textarea[name="prompt"]')
      try {
        await textarea.first().waitFor({ state: 'visible', timeout: 20_000 })
      } catch {
        log(`no prompt textarea (url: ${page.url()}) — possible Cloudflare check or login wall`)
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
      log('sent — ' + (sendOnly ? 'send-only mode, exiting' : 'waiting for response'))
    } else {
      log('read mode — waiting for the last assistant turn to finish')
    }

    if (sendOnly && !readMode) process.exit(0)

    // In read mode the "new turn" is the last one regardless of baseline.
    const base = readMode ? { count: baseline.count - 1, tail: '' } : baseline
    const done = await waitForNewTurn(page, base)
    if (!done) {
      log(`response not complete after ${timeoutSec}s`)
      process.exit(3)
    }

    const text = await extractLastAssistant(page)
    if (outFile) writeFileSync(outFile, text + '\n', 'utf8')
    process.stdout.write(text + '\n')

    if (expectState) {
      const v = validateMarkers(text)
      if (!v.ok) {
        log(`marker validation failed (state=${v.state}, round=${v.round}, want round=${expectRound ?? 'any'})`)
        process.exit(5)
      }
      log(`verdict OK: STATE ${v.state}${v.round ? ` · ROUND ${v.round}` : ''}`)
    }
  } finally {
    await page.close().catch(() => {})
    await browser.close().catch(() => {})
  }
}

main().catch((e) => {
  log(`fatal: ${e.message}`)
  process.exit(4)
})
