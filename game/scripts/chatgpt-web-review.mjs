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
const printChatUrl = hasFlag('--print-chat-url')

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

// Assistant turns differ between modes: logged-in chats mark turns with
// [data-message-author-role="assistant"] wrapped in
// section[data-testid^="conversation-turn"] (which also holds the action row);
// anonymous chats expose ol[aria-label="Conversation"] > li whose heading
// reads "ChatGPT said:". Resolve both; the "Copy response" button only
// renders once a turn finishes streaming. NOTE: this string is injected into
// page.evaluate calls — the helper must exist browser-side.
const TURNS_FN = `function __turns() {
  // All turns in DOM order (both modes).
  let all = Array.from(document.querySelectorAll('[data-message-author-role]'))
  let mode = 'role'
  if (!all.length) {
    const items = Array.from(document.querySelectorAll('ol[aria-label="Conversation"] > li'))
    all = items
    mode = 'ol'
  }
  const assistants = mode === 'role'
    ? all.filter((el) => el.getAttribute('data-message-author-role') === 'assistant')
    : all.filter((li) => /ChatGPT said/i.test(li.innerText))
  const lastEl = all[all.length - 1]
  const lastIsAssistant = lastEl
    ? (mode === 'role' ? lastEl.getAttribute('data-message-author-role') === 'assistant' : /ChatGPT said/i.test(lastEl.innerText))
    : false
  return { assistants, lastIsAssistant }
}`

async function assistantState(page) {
  return await page.evaluate(`(() => { ${TURNS_FN}
    const { assistants, lastIsAssistant } = __turns()
    const last = assistants[assistants.length - 1]
    const stop = document.querySelector('button[aria-label*="Stop"], button[data-testid="stop-button"]')
    const err = document.querySelector('[data-testid="toast"], .text-token-text-error')
    if (!last) return { count: assistants.length, complete: false, streaming: !!stop, error: !!err, tail: '' }
    const section = last.closest('section[data-testid^="conversation-turn"]') ?? last
    const copy = section.querySelector('button[aria-label="Copy response"], button[aria-label="Copy"]')
    return {
      count: assistants.length,
      lastIsAssistant,
      complete: !!copy && !stop,
      streaming: !!stop,
      error: !!err,
      tail: (last.innerText || '').slice(-200),
    }
  })()`)
}

async function extractLastAssistant(page) {
  return await page.evaluate(`(() => { ${TURNS_FN}
    const { assistants } = __turns()
    let last = assistants[assistants.length - 1]
    if (!last) {
      const items = Array.from(document.querySelectorAll('ol[aria-label="Conversation"] > li'))
      last = items[items.length - 1]
    }
    if (!last) return ''
    const clone = last.cloneNode(true)
    clone.querySelectorAll('button, [aria-label="Response actions"], h4').forEach((n) => n.remove())
    return clone.innerText.trim()
  })()`)
}

function validateMarkers(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const m = lines[0]?.match(/^\[C2C\] STATE (DONE|BLOCKED|FINDINGS|NOTICE|STALE)(?:\s*·\s*ROUND\s+(\d+))?\s*$/)
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
    // Correlation anchor: a verdict is the LAST turn element being an
    // assistant turn. If the latest element is the user message we sent (or
    // polled behind), a prior assistant verdict — even one with matching
    // markers — must not satisfy the wait. count/tail checks additionally
    // cover send+wait mode where the baseline was captured pre-send.
    const newTurn = s.lastIsAssistant
      && (baseline.acceptExisting || baseline.lastWasUser
        || s.count > baseline.count || (s.tail && s.tail !== baseline.tail))
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
  // Reuse an already-open chatgpt.com tab when one exists — repeated C2C
  // rounds must not pile up tabs on the VM desktop. Fall back to a new page
  // only when no ChatGPT tab is open.
  const existing = context.pages().find((pg) => /^https:\/\/([^/]*\.)?chatgpt\.com\//.test(pg.url()))
  const page = existing ?? (await context.newPage())
  const ownPage = !existing
  try {
    const target = chatUrl ?? `${BASE}/`
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // Baseline BEFORE any send: count + tail of the existing last turn so the
    // completion check only fires on a genuinely new assistant turn.
    const baseline = await assistantState(page).catch(() => ({ count: 0, tail: '' }))

    if (!readMode) {
      // Absence of the composer within 20s means a real block (Cloudflare
      // check, login wall, dead chat URL), not just slow load. The composer
      // is a ProseMirror div#prompt-textarea[contenteditable] when logged in
      // and a plain <textarea> in anonymous mode — the id selector covers both.
      const composer = page.locator('#prompt-textarea, textarea[name="prompt"], .ProseMirror[contenteditable]')
      try {
        await composer.first().waitFor({ state: 'visible', timeout: 20_000 })
      } catch {
        log(`no prompt composer (url: ${page.url()}) — possible Cloudflare check or login wall`)
        process.exit(4)
      }

      const compEl = composer.first()
      const isTextarea = await compEl.evaluate((el) => el.tagName === 'TEXTAREA')
      if (isTextarea) {
        // Native setter so React's controlled textarea registers the input.
        await compEl.evaluate((el, text) => {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
          setter.call(el, text)
          el.dispatchEvent(new Event('input', { bubbles: true }))
        }, prompt)
      } else {
        // ProseMirror: focus, clear any leftover draft, then insertText —
        // real input events, handles multiline and long prompts without
        // per-key latency.
        await compEl.click()
        await page.keyboard.press('ControlOrMeta+A')
        await page.keyboard.press('Delete')
        await page.keyboard.insertText(prompt)
      }

      const send = page.locator('button[aria-label="Send message"], button[data-testid="send-button"]')
      await send.first().click()
      log('sent — ' + (sendOnly ? 'send-only mode, exiting' : 'waiting for response'))

      // Bootstrap aid: after the first send into a project page or fresh chat,
      // ChatGPT navigates to the new conversation URL (/c/<id> or
      // /g/g-p-*/project/c/<id>). Capture it for .c2c/chat-url.txt.
      if (printChatUrl) {
        const urlDeadline = Date.now() + 15_000
        while (Date.now() < urlDeadline) {
          const u = page.url()
          if (/\/c\/[0-9a-f-]{8,}/i.test(u)) {
            process.stdout.write(u + '\n')
            break
          }
          await page.waitForTimeout(500)
        }
      }
    } else {
      log('read mode — waiting for the last assistant turn to finish')
    }

    if (sendOnly && !readMode) process.exit(0)

    // Read mode correlation: if the last turn element is a user message, a
    // reply is pending — wait for a NEW assistant turn. If it is already an
    // assistant turn, a verdict is sitting there — accept it immediately
    // (protocol resume rule); stale collisions are guarded by --expect-round
    // on globally-unique round numbers, not by refusing existing turns.
    const base = readMode
      ? { count: baseline.count, tail: baseline.tail, lastWasUser: !baseline.lastIsAssistant, acceptExisting: baseline.lastIsAssistant }
      : { count: baseline.count, tail: baseline.tail, lastWasUser: false, acceptExisting: false }
    const done = await waitForNewTurn(page, base)
    if (!done) {
      log(`response not complete after ${timeoutSec}s`)
      process.exit(3)
    }

    const text = await extractLastAssistant(page)
    process.stdout.write(text + '\n')

    if (expectState) {
      const v = validateMarkers(text)
      if (!v.ok) {
        // Never overwrite the authoritative inbox with an invalid verdict —
        // write it to a sidecar diag file instead.
        const diag = outFile ? outFile + '.invalid' : undefined
        if (diag) writeFileSync(diag, text + '\n', 'utf8')
        log(`marker validation failed (state=${v.state}, round=${v.round}, want round=${expectRound ?? 'any'})${diag ? ` — raw text saved to ${diag}` : ''}`)
        process.exit(5)
      }
      log(`verdict OK: STATE ${v.state}${v.round ? ` · ROUND ${v.round}` : ''}`)
    }
    if (outFile) writeFileSync(outFile, text + '\n', 'utf8')
  } finally {
    // Only close a tab this run created — never the user's reused C2C tab.
    if (ownPage) await page.close().catch(() => {})
    await browser.close().catch(() => {})
  }
}

main().catch((e) => {
  log(`fatal: ${e.message}`)
  process.exit(4)
})
