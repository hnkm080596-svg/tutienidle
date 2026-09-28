---
name: combat-ui-audit-capture
description: Reach a live turn battle in tutienidle and capture exact-size UI screenshots with Playwright — includes runtime pokes for victory/defeat/locale/Thế pips/cast-blocked that the UI alone cannot reach quickly.
---

# Combat UI screenshot capture (tutienidle)

Use when asked to (re)screenshot combat HUD/overlay states for UI audits. Dev server:
`cd game && npm run dev` — port is per-checkout (see `scripts/dev-port.ts`; for this checkout ≈ 5864, printed in vite output). Playwright + chromium are already in `game/node_modules`.

**Drive headed** (`chromium.launch({headless:false})`) so screen recordings show the flow; `page.screenshot({type:'jpeg'})` yields exact-viewport jpgs regardless of monitor size. Stub fonts: `context.route('https://fonts.googleapis.com/**', r => r.fulfill({status:200, contentType:'text/css', body:''}))`.

## Reach a stage battle (verified `tests/e2e/helpers.ts`)
`goto('/')` → `data-testid=auth-guest-button` → creation: `creation-name-input` fill → first `[data-testid^=creation-talent-]` click → `creation-skill-tram` (Kiếm Tu) → `creation-finish` → wait `.game-root` + `[data-testid=presentation-overlay]` `data-phase=idle`+`data-curtain=opened` → dismiss `.tutorial-overlay` via "Bỏ Qua" → `page.keyboard.press('Tab')` → `[data-wheel-slot=teleport_array]` → `stage-start-button` (Bắt Đầu).

Battle handle: `window.__tutienPhaserGame.registry.get('gameManager').getTurnBattle()` — has `.state` (`intro|countdown|fighting|victory|defeat`), `.players[]`, `.enemies[]`, `.wave.pendingEnemySpawns`. Manual mode: check `.turn-combat-skill-bar__mode-toggle input`; player-turn pause = `.turn-combat-skill-bar__awaiting` visible.

## Runtime pokes (page.evaluate)
- **Victory**: loop every ~250ms — `enemies.forEach(e => {e.alive=false; e.entity.alive=false; e.entity.currentHp=0})` until `state==='victory'` (waves respawn; keep killing).
- **Defeat**: `players.forEach(p => p.entity.currentHp = 1)` then let a boar hit. MUST uncheck manual first — manual awaiting freezes enemy turns, boars never act.
- **Exit modal**: click `.combat-top-bar__exit`, or `gm.eventBus.emit('combat_exit_request', undefined)`.
- **Locale**: `__vue_app__` is NOT exposed — use `const m = await import('/src/i18n/index.ts'); m.i18n.global.locale.value = 'en'` (vite serves the singleton the app uses).
- **Thế pips (PlayerHudLayer)**: needs path capability — poke `const {usePlayerStore} = await import('/src/stores/player.ts'); p.cultivationPath='body'; p.cultivationWay='hidden_body_pathway'` (grants `body.essence_economy`), then `battle.players[0].entity.maxThe=5; entity.currentThe=4` — dot row renders bottom-left.
- **Cast-blocked tint**: char must have a slotted skill with cost — plant `players[0].special = {skill:{id,name,icon,resourceType:'the',resourceCost:999,cooldownTurns:0}, remainingCooldownTurns:0}` while awaiting choice → `.is-insufficient` + crimson cost.

## Gotchas
- Chrome translate popup can cover the topbar in the headed window (does NOT appear in `page.screenshot`, but may swallow clicks — dismiss with Escape).
- Defeat panel auto-returns home after 10s — screenshot fast, click "Tái Chiến" (`.combat-defeat-panel__retry`) within the window to keep the session.
- `updateEnvironmentConfig` blueprint already covers npm ci + playwright install; nothing extra needed.
