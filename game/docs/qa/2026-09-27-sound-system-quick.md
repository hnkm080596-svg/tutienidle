# Adversarial QA (quick) — sound-system W1-W10

Date: 2026-09-27 · Scope: branch `devin/1790536865-sound-system-audit` diff
b1992253..HEAD (75 files, +3583/-252) · Mode: quick.

## Inputs

- Mapper: `changed-risk-map.mjs` on all task-owned paths → 0 domains, all
  `unmappedPaths`, `deepAuditCandidate: false`.
- Manual routing (unmapped → domain): pinia-phaser-sync (App.vue bindings,
  uiStore `$subscribe`, scene shake gate, eventBus listeners), ui-input-
  lifecycle (Chip/MenuButton/GameButton/ConfirmModal/wheel/settings),
  combat-and-tribulation (TurnBattleSystem reactive_proc, CombatSystem
  hothe_absorb, GameManagerTurnBattleOps proc drain), save boundary
  (localStorage v1→v2 settings migration, device-scope not cloud save).
- Ledger rows consulted: QA-2026-09-09-RR7 (cardinality), QA-2026-09-12-010
  (flag restore on exit paths), QA-2026-09-13-001 (production call
  signature), QA-2026-09-13-002 (numeric guards on persisted values).

## Invariant ledger + hypotheses

| # | Hypothesis | Result |
|---|-----------|--------|
| H1 | Binding/listener leaks on App unmount or double-bind | Rejected: `unbindCombatAudio`/`unbindUiAudio`/`unbindAmbientAudio` returned teardowns all called in `onUnmounted`; wheel/panel subscription is a single `$subscribe` handle |
| H2 | `readyListeners` leak across `AudioManager.dispose()` | **Confirmed (static)** → fixed: `dispose()` now clears `readyListeners` |
| H3 | Cue spam per tick (hit/damage storms) | Rejected: per-cue-id `cueCooldownAt` with `MIN_GAP_MS`/`cooldownMs` |
| H4 | `enabled=false` then `true` strands music | Rejected: `stopMusic` clears desired, but driver's enabled-watch re-arms `crossfadeMusic(ROUTE_MUSIC[route])` on re-enable |
| H5 | Duck overlapping → summed attenuation | Rejected: max-active semantics (`duck.amount = max`), single expiry timer, restores to channel volume |
| H6 | v1→v2 settings migration loses enabled/masterVolume | Rejected: `loadPersisted` falls back to `tutienidle.audio.v1` blob; covered by `stores/audio.test.ts` |
| H7 | `farm_cycle` sounds off-home | Rejected: routeProvider gate, default-permissive only when no provider (tests) |
| H8 | Shake sites bypass the gate | Rejected: `applyScreenShake` is the only call path; grep shows zero direct `cameras.main.shake` left |
| H9 | `ui.modal.open` skipped for mount-open modals | Coverage gap accepted: ConfirmModal consumers mount closed; CombatExitConfirmModal gates on its own open watch |
| H10 | `ensureAudioForRoute` never invoked (dead pipeline) | **Confirmed (static, P18 pass)** → fixed: ambientAudioDriver calls it gated on `isUnlocked() && enabled`, re-fired on `onReady`; new driver test covers all four gates |
| H11 | Per-attempt `reactive_proc` cardinality | Rejected: emit sits inside `if (attempt.rolled)` — once per rolled attempt (QA-2026-09-09-RR7 applied) |
| H12 | Proc drain double-emit across battles | Rejected: `procExecutionCursor` + `procPresentationBattle` identity guard, reset in `clearPendingSteps` twin site |

## Findings

- F1 (Confirmed→fixed): dead `ensureAudioForRoute` — lazy `audio-*` bundles
  would never be fetched after a real asset drop. Repair landed in
  `bcc95cb9` (onReady hook + driver wiring + ambientAudioDriver.test.ts).
- F2 (Confirmed→fixed): `readyListeners` not cleared in `dispose()` —
  post-dispose unlock would re-fire stale listeners. Repair: `dispose()`
  clears the set.
- Deferred Low/Nit:
  - `variantCursor` first pick indexes `decoded[1]` not `[0]` (round-robin
    ordering quirk; full set still cycles — safe to defer).
  - `attachEncodedBuffer` accepts srcs outside the manifest (orphan buffer
    memory); current only-caller (audio lane) only loads manifest srcs —
    harmless today.
  - Audio store `cue()` action is currently unused (documented adapter
    surface; components call `AudioManager` directly per W7 sanction).

## Evidence

- `npm run verify`: type-check clean, vite build clean, vitest 795 files /
  ~7049 tests green; 2 pre-existing env failures (`spawnSync magick ENOENT`
  — ImageMagick missing on this VM; `src/assets/dongFu*Pipeline.test.ts`
  untouched by this diff).
- `npx playwright test tests/e2e/sound-system.spec.ts`: 1 passed (17.7s) —
  real browser: unlock → cue attempts → combat event probe → slider/shake
  persistence across reload → zero console errors.

Verdict: PASS WITH EVIDENCE (quick gate; P5 sequential review still runs).
