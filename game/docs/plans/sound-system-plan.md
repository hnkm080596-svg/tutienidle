# Sound System — Implementation Plan

Companion to `game/docs/specs/sound-system-spec.md` (the spec owns the *what*;
this owns the *order*, the file map, and the test plan). Implementing agent
works the items top-down; each lands green on its own.

Constraint carried from the spec: **zero behavior the player can hear until
assets drop** — W1-W10 ship the wiring; manifest `src` fields stay `''`. The
mission succeeds when dropping `assets/audio/**/*.ogg` into `public/` is the
only step left.

---

## 1. Implementation order

| Order | Item | Depends on | Why here |
|---|---|---|---|
| 1 | **W1** manifest + channel types | — | Pure data; unblocks everything |
| 2 | **W2** AudioManager engine (channels, `playCue`, Player path, duck) | W1 | The one risky edit — do it while nothing calls the new API yet |
| 3 | **W3** store v2 + SettingsPanel + i18n | W2 | Needs `setChannelVolume` to exist |
| 4 | **W4** `dom-audio` lane + audio bundles | W1, W2 | Loader feeds `attachEncodedBuffer`; inert while all `src` are `''` |
| 5 | **W5** combatAudioBinding table | W2, W1 | First real trigger surface; validate cue resolution end-to-end |
| 6 | **W6** gap emits + drain generalization | W5 | The only core-surface work; land it when the binding is ready to consume |
| 7 | **W7** UI wiring (Chip/MenuButton/uiAudioBinding + call sites) | W2, W3 | Mechanical sweep; biggest file count, lowest risk |
| 8 | **W8** ambientAudioDriver | W4, W5, W3 | Needs lazy audio bundles + music controls + route subscription |
| 9 | **W9** seam guards + completeness test | all | Guards are authored last so they pin the final shape, not a moving target |
| 10 | **W10** reduced-shake toggle (OQ-D) | W3 | `reducedShake` rides the same v2 store + panel pass; shake choke point is one presentation module + 2 call sites |

Suggested commit granularity: one commit per W (matches how the audit commit
+ codex spec waves landed on this repo).

## 2. File map

**New files**

```
src/core/audio/AudioCueManifest.ts              # W1 — cue table + resolve
src/core/audio/AudioChannels.ts                 # W1 — channel ids + defaults
src/presentation/audio/uiAudioBinding.ts        # W7 — Pinia $subscribe transitions
src/presentation/audio/ambientAudioDriver.ts    # W8 — route music/crossfade/duck
src/presentation/audio/audioAssetWiring.ts      # W4 — ensureAudioForRoute helper
src/core/audio/AudioCueManifest.test.ts         # W1
src/presentation/audio/uiAudioBinding.test.ts   # W7
src/presentation/audio/ambientAudioDriver.test.ts # W8
tests/architecture/audioBoundary.test.ts        # W9
tests/architecture/audioManifestCompleteness.test.ts # W9
src/presentation/vfx/screenShakePolicy.ts       # W10
src/presentation/vfx/screenShakePolicy.test.ts  # W10
```

**Modified files**

```
src/core/audio/AudioManager.ts                  # W2 — channels, playCue, Player, duck
src/stores/audio.ts                             # W3 — v2 key, channel volumes, cue()
src/components/panels/SettingsPanel.vue         # W3 — 3 sliders
src/locales/en.json + vi.json                   # W3 — audio.volume keys
src/presentation/assets/AssetBundleCatalog.ts   # W4 — dom-audio descriptor + audio-* bundles
src/presentation/assets/AssetBundleManager.ts   # W4 — domAudioLoader + fail-soft lane
src/presentation/audio/combatAudioBinding.ts    # W5 — full event→cue table
src/core/game/GameManagerTurnBattleOps.ts       # W6 — drainPresentationEvents + exec cursor
src/core/game/GameManagerBattleRewardOps.ts     # W6 — perfect_clear emit
src/core/game/HiddenBeastSystem.ts              # W6 — onEnemyDefeated returns opened[]
src/core/game/BattleLootSystem.ts               # W6 — hidden_window_opened emit
src/core/combat/CombatSystem.ts                 # W6 — hothe_absorb emit at DR site
src/core/game/GameManagerAutoFarmOps.ts         # W6 — farm_cycle emit (P2)
src/core/battle/turn/TurnBattleSystem.ts        # W6 — reactive_proc emit at wrapper
src/components/common/primitives/Chip.vue       # W7 — ui.tab
src/components/menu/MenuButton.vue              # W7 — ui.click
src/components/common/GameButton.vue            # W7 — id migration uiClick→ui.click
src/components/common/ToastContainer.vue        # W7 — toastX→ui.toast.<kind>
src/stores/worldAnnouncement.ts                 # W7 — show(cueId?)
src/composables/useBreakthrough.ts              # W7 — pass progress.breakthrough
+ the one-line call sites listed in spec W7.5   # W7 — cue() in existing handlers
src/App.vue                                     # W8 — bindAmbientAudio + unbind; W10 — watch reducedShake → policy
src/game/scenes/combat/combat-vfx-spawner.ts    # W10 — shake via applyScreenShake
src/game/scenes/TribulationScene.ts             # W10 — shake via applyScreenShake
```

**Explicitly untouched:** `CombatProcSystem` internals (drain reads its op
identities, no edits), `CombatScheduler`/`CombatTrace` (read-only consumer),
`CombatVfxPresets` + VFX pipeline (separate surface), `saveVersion.ts`
(device-scope persistence only), `AssetLoaderScene` (audio never enters the
Phaser loader batch), all gameplay resolvers.

## 3. Test plan

Per-item Vitest coverage is specified inside each W in the spec; this is the
rollup.

**Unit/integration (`npx vitest run <scope>`):**

- `src/core/audio/` — manifest validation, `resolveAudioCue` chain,
  `playCue` silent/missing/fallback paths, cooldown gating, channel gains,
  duck ramp, unlock-before-gesture contract, dispose safety.
- `src/presentation/audio/` — combat binding table maps every listed
  eventBus event to the right cue (fake bus + spy); uiAudioBinding
  open/close/swap transitions; ambient driver route map + visibility +
  unlock-defer.
- `src/presentation/assets/` — `dom-audio` descriptor enumeration is
  manifest-derived; fail-soft on 404; dedupe/abort parity with `dom-image`.
- `src/stores/audio.test.*` — v2 persist round-trip, v1→v2 migration,
  channel clamp.
- `GameManagerTurnBattleOps` + `CombatSystem` + `BattleLootSystem` +
  `HiddenBeastSystem` + `TurnBattleSystem` scoped tests — W6 emit/cursor
  contract (exactly-once, identity reset, payload shape, no gameplay
  reach-back).
- `tests/architecture/` — new audioBoundary + audioManifestCompleteness
  guards; existing `coreImportDirection`, `i18nKeyParity` stay green.

**Verification commands (P3):**

```
cd game
npm run type-check
npx vitest run src/core/audio src/presentation/audio src/presentation/assets src/stores/audio tests/architecture
npm run lint            # if it covers changed files
npm run verify          # full mode before merge-ready (W6 touches core emit paths)
```

**Runtime evidence (P13/P14):** W6/W8 touch `App.vue` wiring + core emit
boundaries → one Playwright run in the worktree: boot → home (expect
`music.home` slot to *attempt* and no-op silently), enter combat (expect
`combat.*` cue attempts, no console errors), open settings + move sliders
(persisted after reload). With zero assets the audible assertion is silence;
assert **absence of errors + correct cue-attempt debug lines**, not sound.

**Docs-only acceptance gate:** the "P0+P1 wired" claim in spec §6.5 is checked
by the W9 completeness scan + the binding table tests — no manual spot-check
needed as a completion criterion.

## 4. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `Tone.Player`/decode path breaks jsdom tests (no AudioContext) | Medium | All decode behind `attachEncodedBuffer` + `unlock`-gated; spec keeps the existing try/catch-no-op contract; W2 tests run buffer-free. |
| Executions-drain cursor misses ops emitted mid-step ordering | Low | Cursor runs at the same post-step boundary as the status/reaction drains (already proven once-per-battle correct); pin with a two-step battle test. |
| W6 emits drift toward gameplay reads over time | Low | W9 guard + spec §5 negative contract; emits carry `type` + display payload only. |
| Chip's blanket `ui.tab` double-fires where a parent already cues | Medium | Audit §3 marks sites whose parent already plays (`GameButton` inside a Chip row etc.); binding rule: leaf-most interactive primitive owns the cue. Implementer checks the ~5 overlap sites by hand. |
| `localStorage` v2 key orphans v1 settings | Low | Spec'd migration read in W3; store test covers it. |
| Music loops from the asset drop aren't seamless | Certain (asset-side) | Spec Q4: single-file `loop:true` only; `introSrc` two-file pattern deferred until needed — document in CREDITS hand-off. |
| Licensed assets creep in | Process | `public/assets/audio/CREDITS.md` required by the feel plan; spec inherits it — the drop checklist lives there, not in code. |
| Crossfade/duck ramps accumulate floating gains | Low | Duck tracked as max-active not summed (spec §2); W2 test pins restore-to-channel-volume. |

## 5. What this plan deliberately does not do

- No real audio content, no `silence.ogg`, no synthesized ambient fallback
  (spec OQ-A — music/ambient rows stay silent until files drop).
- No Howler.js/Phaser-sound adoption (spec §4).
- No GameSave/cloud persistence for audio prefs (device-scope by design).
- No VFX/spritesheet work — that's the feel plan's separate tasks.

(W10 reduced-shake toggle was promoted IN by spec OQ-D — it ships in this
plan's W10.)
