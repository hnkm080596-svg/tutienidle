---
name: chatgpt-web-review
description: Run an external code review or C2C protocol round by driving ChatGPT web (chatgpt.com) in the Devin browser via CDP — send prompts/control lines, wait for responses, validate [C2C] verdict markers, extract replies. Use as the external-review step after local gates (P3/P18/P13/P14/P4/P5), or for named C2C review/debug rounds against a dedicated ChatGPT conversation.
---

# ChatGPT Web Review — external review automation

Drives **ChatGPT web in the live browser** (no API key, no provider config) via Playwright CDP. The host agent builds the review prompt (diff + rules context), the script submits it to chatgpt.com, waits for the streamed answer, and prints the response text for the host to triage.

This automates the "user assigns an external reviewer" step from `PROJECT_CONTEXT.md`: it does NOT replace P3/P18/P13/P14/P4/P5 — it is an extra second-opinion gate on the task diff, and findings feed back through the P5 loop like any other review finding.

## Prerequisites

- Devin's Chrome is running with CDP at `http://localhost:29229` (default; override with `CHATGPT_CDP`).
- ChatGPT works **anonymously** (free, rate-limited, no conversation history). Logging in once on the VM's browser and persisting the profile raises limits and unlocks tools — recommended but optional.
- `playwright-core` resolves from `game/node_modules` automatically — the script anchors `createRequire` to `game/package.json`, so it runs from any cwd.

## Usage

```bash
# 1. Build the review prompt (diff + instructions) into a file
git diff <base>...<head> -- <paths> > /tmp/task.diff
# prepend the review instructions (template below) -> /tmp/chatgpt-prompt.md

# 2. Run
node game/scripts/chatgpt-web-review.mjs --prompt-file /tmp/chatgpt-prompt.md \
  --timeout 420 --out /tmp/chatgpt-review.md
```

- `--prompt-file` (required): the full prompt text to send. Include the diff inline — anonymous ChatGPT cannot reliably fetch URLs, so paste code, not just a PR link.
- `--timeout` seconds: default 420. Large diffs on free tier stream slowly.
- `--out`: also write the extracted response to a file.
- Exit codes: `0` ok · `2` prompt/input problem · `3` response timeout · `4` page/site failure (Cloudflare, login wall, error toast). Non-zero = environment/tooling gap — report it like a P14/P18 blocker; never claim an external review that did not run.

## Prompt template

```text
You are an external code reviewer for the TutienIdle project (Vue 3 + TypeScript + Vite + Pinia + Phaser game).
Review the diff below for correctness bugs and regressions only — not style.
Start your reply with one line: "VERDICT: PASS" or "VERDICT: FAIL".
Then list findings as: path:line | severity (Critical/High/Medium/Low/Nit) | defect + evidence.
Plain text only — no interactive elements.

<context>one-paragraph task intent + which gates already ran (P3/P18/P13/P14/P4/P5)</context>
<diff>the task diff</diff>
```

Map findings onto the P5 severity ladder; validate each Medium-or-higher against the real code before fixing (same evidence standard as P18 findings — reject false positives only with a recorded reason).

## C2C mode — named rounds on a dedicated chat

Full protocol: `game/docs/c2c/c2c-protocol.md`; ChatGPT-side instruction:
`game/docs/c2c/standing-instruction.md`. Mailbox: `.c2c/mailbox/` (gitignored);
dedicated conversation URL in `.c2c/chat-url.txt` (requires a logged-in profile
— anonymous chats have no persistent URLs).

```bash
# Doorbell — send the control line, never wait inline (exit right after send)
node game/scripts/chatgpt-web-review.mjs \
  --send "[C2C] go <name> · ROUND <n> — <task summary> · <PR url>" \
  --send-only --chat-url "$(cat .c2c/chat-url.txt)"

# Poll — wait for the reply, validate STATE/END markers, materialize inbox
node game/scripts/chatgpt-web-review.mjs \
  --read --expect-state --expect-round <n> --timeout 600 \
  --chat-url "$(cat .c2c/chat-url.txt)" \
  --out .c2c/mailbox/inbox-<name>.md
```

- `--send "<text>"` / `--prompt-file`: what to send; `--send-only` exits after
  the click (pure doorbell).
- `--read`: sends nothing; waits for the last assistant turn to finish and
  extracts it. Round-correlation is enforced by `--expect-round <n>` — a stale
  earlier verdict exits 5, not a false accept.
- `--expect-state`: first line must be `[C2C] STATE <S> [ · ROUND <n>]`, last
  non-empty line `[C2C] END`. Exit `5` on violation — the text still prints.
- `go <name>` = new task; `continue <name>` = resume an interrupted round
  (BLOCKED/timeout). Never repeat `go` on an interrupted round — the STALE
  guard fires.
- Completion detection is baseline-aware: it requires a NEW assistant turn
  (count grew / tail changed since the send) with its own Copy-response button,
  so earlier completed turns in a long C2C chat do not false-trigger.
- Update `.c2c/state.json` per round (`status: sent|done`); on resume, poll
  first — a verdict may already be waiting. Never resend before confirming
  stuck.

## Failure modes / limitations

- **Rate limits**: anonymous free tier caps messages; hit it and the script exits 4 → wait or use a logged-in profile.
- **Interactive widgets**: ChatGPT may emit an "Interactive contentDetails could not be loaded" card — expected noise; the extractor only reads the conversation `<ol>` assistant turns.
- **Large diffs**: huge prompts can exceed input limits — trim to the task diff plus minimal context; split by file if needed.
- **UI drift**: chatgpt.com markup changes over time. Symptoms: textarea never appears (exit 4), completion never detected (exit 3), or garbage extraction. Re-probe the DOM and update selectors in the script.
- **Login expiry**: a saved profile can lapse; if the run hits a login wall, re-login on the VM browser and re-save the profile.
