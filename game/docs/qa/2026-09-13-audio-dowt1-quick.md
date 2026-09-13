# QA Review: Audio system đợt-1 — Tone.js AudioManager + wiring

- Date: 2026-09-13
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/core/audio/AudioManager.ts` + `.test.ts` (pre-existing WIP, P15 comment pass)
  - `game/src/presentation/audio/combatAudioBinding.ts` + `.test.ts` (new)
  - `game/src/stores/audio.ts` + `.test.ts` (persistence added)
  - `game/src/components/common/GameButton.vue` (uiClick + unlock)
  - `game/src/components/common/ToastContainer.vue` (toast sounds)
  - `game/src/components/panels/SettingsPanel.vue` (audio section)
  - `game/src/App.vue` (bind + global unlock)
  - `game/src/locales/{vi,en}.json` (audio keys)
  - `game/package.json` + lock (`tone ^15.1.22`)
  - `game/docs/audio/DESIGN_BRIEF.md`

## Scope and Risk Map

Mapper returned all-unmapped (new subsystem). Manually routed: every touch
is presentation-side feedback — the binding observes events the battle
domain already emits for presentation consumers; the notification store is
untouched (sounds play in ToastContainer on visibility). No domain state,
economy, save, or clock semantics change. Not a deep candidate: the only
system boundary is AudioManager→Tone, fully unit-mocked and tested.

## Invariant Ledger

| ID | State/owner | Transition | Invariant | Oracle | Layer |
| --- | --- | --- | --- | --- | --- |
| INV-AU-1 | AudioManager unlockState | play() before/without gesture | Never throws; silent no-op until ready | `play()` guards `unlockState!=='ready'` | Vitest (AudioManager.test.ts) |
| INV-AU-2 | unlock() vs dispose() | dispose during pending unlock | Generation check: partial chain disposed, ready never set on dead instance | race test holds Reverb.ready pending | Vitest |
| INV-AU-3 | synth creation | initChain throws mid-build | Partial nodes disposed; retry allowed (B5/B6) | failCreateAfter=2 mock | Vitest |
| INV-AU-4 | per-id cooldown | same SoundId twice <60ms | Fires once (noise-wall guard) | fake timers | Vitest |
| INV-AU-5 | AudioContext suspended | play() while suspended | ctx.resume() attempted, no throw | ctx.state mock | Vitest |
| INV-AU-6 | eventBus subscription | combat events emitted | Each domain event maps to exactly one SoundId; `damage`/`kill` deliberately unmapped (double-fire with `hit`/`death`) | binding test | Vitest |
| INV-AU-7 | session start | presentation_session_started | battleStart only when kind==='combat' (tribulation excluded) | binding test | Vitest |
| INV-AU-8 | battle_end | { state } payload | victory→battleVictory, defeat→battleDefeat | binding test | Vitest |
| INV-AU-9 | unbind | teardown | All handlers detached (HMR/test safety) | binding test | Vitest |
| INV-AU-10 | audio store | enabled/volume set | Persisted to localStorage; malformed payload ignored; volume clamped [0,1] | store tests incl. malformed-payload case | Vitest |
| INV-AU-11 | Pinia-free components | GameButton/ToastContainer mount | Use AudioManager directly — mountable without active Pinia | code inspection + existing component tests green | Vitest |

## Verification Evidence

| Command or observation | Result |
| --- | --- |
| `npx vitest run audio combatAudioBinding notification` | 45/45 pass |
| `npm run type-check` | clean |
| `npm run build` | built, 852.50 kB main chunk (gzip 236.5 kB) — pre-existing >500kB warning; tone adds ~15% |
| `npx vitest run` (full) | 539 files / 3751 tests, all green |
| `tests/architecture/i18nKeyParity` | passes with new audio keys (vi+en) |
| `import('tone')` in node | resolves — no import-time crash in test env |

## Findings

No `Confirmed` defects. Notes:

- `battle_end` fires per auto-repeat cycle during auto-farm → `battleVictory`
  dings on every farm cycle. Honest feedback (each cycle IS a victory);
  low volume. Revisit if users find it repetitive — an "auto-farm quiet"
  policy would be a product decision, not a defect.
- `tone` is eagerly bundled into the main chunk (+~100KB gzip estimate).
  Acceptable for đợt-1; lazy `import('tone')` inside unlock() is the
  documented đợt-2 optimization if boot weight matters.
- `combatKill` plays on ANY death event (both player and enemy deaths) —
  per brief intent ("chuông trầm — kết thúc").

## New or Changed QA Tests

- `combatAudioBinding.test.ts`: event→sound map, session-kind filter,
  victory/defeat routing, unbind completeness.
- `audio.test.ts` (store): +persistence round-trip and malformed-payload
  guard cases; MemoryStorage polyfill for node env.

## Pre-existing Failures

None.

---

*Live-browser follow-up (main checkout, Edge 140, localhost:5196): guest boot → character creation → settings panel — "Âm Thanh" section renders; toggle off→on works (volume slider disables when off); `settings-audio-volume` fill(30) → `localStorage["tutienidle.audio.v1"] = {"enabled":true,"masterVolume":0.3}`; 0 console errors. Audible output not verifiable headlessly — residual is perceptual QA on a real user machine.*

*Verdict updated: PASS WITH GAPS (UI wiring + persistence live-verified; audible output check deferred to real-device play). Suggested next stage: live play with audio on, then the final P6 adversarial deep QA at release-readiness.*
