# Sound System Spec — real-asset audio slots (W1..W10)

Scope: turn the synth-only MVP into a slot-driven audio system that accepts a
real asset drop with **zero code edits** — every cue fires today, slots with no
file play nothing and throw nothing.

Authority chain:

- Audit + inventory: `game/docs/design/sound-system-audit.md` (master @
  `0f1d84d1`, committed on this branch) — every trigger site, cue-id, and gap
  referenced below is enumerated there; this spec does not re-audit.
- Style brief: `game/docs/audio/DESIGN_BRIEF.md` — "Tân Quốc phong nhẹ nhàng",
  mandatory per-channel volume.
- Feel plan: `game/docs/audio-game-feel-plan.md` — placeholder-silence rule
  ("registry entry but no file → `play()` no-op, không lỗi"), licensing rule
  (CC0/self-made only, `public/assets/audio/CREDITS.md`).
- Rules: `AGENTS.md` A6/A7/P17 (presentation observes, never determines),
  `coreImportDirection.test.ts` precedent for the seam guard.

This document is spec only; it authorizes no production edit by itself. All
paths relative to `game/`.

---

## 0. Decisions taken (audit open questions → resolved here)

| # | Audit question | Decision |
|---|---|---|
| Q1 | Asset format | `src` is `string \| string[]`; loader tries each entry in order and keeps the first that decodes — author `ogg` first, `mp3` fallback. Manifest authors never handle codec selection. |
| Q2 | Hosting | `public/assets/audio/{music,sfx,ui}/...` shipped in the bundle — matches sprites/backgrounds, keeps Electron offline intact. No CDN. |
| Q3 | Playback engine | **Tone.js `Tone.Player` fed by decoded `AudioBuffer`s** (§4 comparison). Synth recipes stay as `synthFallback` per cue. Phaser `scene.sound` and raw `AudioBufferSourceNode` rejected. |
| Q4 | Looping rules | Single-file seamless loops (`loop: true` on `Tone.Player`). Intro+body two-file pattern deferred until a real asset needs it (manifest gets `introSrc` then, not now). |
| Q5 | Bundle strategy | **Separate lazy `audio-*` bundles**, requested only after `unlock()` && `enabled` — a muted player pays zero download cost, and no route transition ever blocks on audio (audio descriptors are fail-soft by contract). |
| Q6 | Placeholder policy | `src: ''` → **silent no-op** (not a shared `silence.ogg`). A dev-mode `console.debug` logs the first miss per cue-id so wired sites remain verifiable in dev. The audit's soft-tick alternative is rejected: a placeholder that makes sound is a placeholder that ships to production. |
| Q7 | Volume defaults | `master 0.7` (unchanged); `music 0.5`, `sfx 0.8`, `ui 0.7`. Lands as defaults in the v2 store; user adjusts in Settings. |
| Q8 | Combat density | Per-cue `cooldownMs` (default `MIN_GAP_MS = 60`) + `variants[]` round-robin. High-rate rows (`combat.hit`, `combat.hurt`, `combat.element.*`) ship `cooldownMs: 80`. |
| Q9 | Gap emits | Both lanes used, chosen per site (§6): trace-executions drain where the data already lands in `scheduler.trace` (reflect, on-hit proc); direct domain emit where only the caller holds the outcome (reactive-proc, perfect-clear, hidden-window, hộ-thể absorb, farm cycle). Core never imports audio; emits are presentation-observation events. |
| Q10 | Boot music | Accepted: silent until first gesture (autoplay policy). `unlock()` already exists; `ambientAudioDriver` starts `music.menu`/`music.home` inside the unlock continuation. |

Additional decisions folded into the design:

- **Id migration: single sweep to dot-notation.** `SoundId` (camelCase union) becomes `SynthSoundId` (internal recipe keys only); all call sites switch to cue-ids in the same mission (~3 call-site files). No alias layer — the codebase has ~10 audio call sites total.
- **`stinger.victory`/`stinger.defeat` merge into `combat.victory`/`combat.defeat`.** The audit listed both; one `battle_end` event firing two cues is a double-trigger. The single cue carries `duckMusic` so the "jingle over music" behavior survives. `stinger.*` namespace remains for announce/offline moments.
- **`mutedChannels[]` dropped.** Channel volume `0` is the mute; one slider per channel is simpler than two control surfaces for the same state.
- **`worldAnnouncement.show()` gains optional `cueId`.** One emit point for all big moments; callers pass their specific cue (`progress.breakthrough`, `progress.path_choose`), default `stinger.announce`. Prevents announce+specific double-fire.

## 0b. User resolutions (2026-09-27 — close the remaining open questions)

| # | Question | Decision |
|---|---|---|
| OQ-A | Music source while `music.*` rows are empty | **RESOLVED — silent until real files.** No Tone.js ambient-synthesis fallback ships; `music.*`/`ambient.*` rows carry NO `synthFallback`. The slot machinery (unlock, crossfade, duck, visibility pause) still lands fully so a file drop is the only remaining step. |
| OQ-B | `combat.ward` discrimination | Open — unchanged: binding filters on `entity_vitals_changed` `wardBefore`/`wardAfter` delta sign (fields confirmed present in the emit). |
| OQ-C | Per-skill / per-reaction qualifier scope | **RESOLVED — FULL coverage.** Every qualifier cue in the audit inventory is a real slot the user will fill: the manifest enumerates one row per concrete catalog id (every castable `skillId`, every `reactionId`, every `presetId`, all 38 `kiem_combo_*` combos, both `ungthe` triggers, all 4 `music.home.<time>` variants). Nothing rides "signature content only". |
| OQ-D | Reduced screen-shake toggle | **RESOLVED — in scope as W10.** `reducedShake` flag joins the v2 settings blob; SettingsPanel toggle (i18n en+vi); the two camera-shake sites (`combat-vfx-spawner` `cameras.main.shake`, `TribulationScene.strikeLightning`) scale through a presentation policy module. |

---

## 1. AudioCueManifest

### 1.1 Format — `src/core/audio/AudioCueManifest.ts` (new, data-only)

No Tone/Vue/Phaser imports — importable in any test (the completeness guard
loads it under jsdom where no `AudioContext` exists).

```ts
import type { SynthSoundId } from './AudioManager'   // renamed SoundId union
import type { AudioChannelId } from './AudioChannels'

export interface AudioCueDef {
  /** Asset URL(s) relative to public/ ('assets/audio/...'). '' = reserved
      slot: resolves, plays nothing, never throws. Array = codec fallback,
      first decodable wins. */
  src: string | readonly string[]
  channel: AudioChannelId
  volume?: number          // 0..1 cue-local trim, default 1
  loop?: boolean           // music/ambient beds only
  cooldownMs?: number      // anti-spam gap; default MIN_GAP_MS (60)
  duckMusic?: number       // 0..1 — drop music bus by this fraction for the cue's duration
  synthFallback?: SynthSoundId  // interim synth recipe until a file lands
}

export const AUDIO_CUES: Record<string, AudioCueDef> = { /* §1.2 */ }
```

**Cue-id convention:** `domain.verb[.qualifier]` (audit §1 legend).

**Resolution — `resolveAudioCue(id)`:** exact match → strip one trailing
qualifier segment and retry until a row matches → `undefined` (silent no-op +
dev `console.debug` once per id). So `combat.cast.<skillId>`,
`combat.impact.<presetId>`, `combat.reaction.<reactionId>`,
`combat.element.<x>`, `ui.toast.<kind>`, `combat.ungthe.<trigger>` all land on
their family row until a specific row exists. Adding a qualified row later is a
manifest-only edit — never a code edit.

**OQ-C full coverage:** those qualifier families are not wildcards — the
manifest expands each into one row per concrete catalog id (every castable
`skillId`, every `reactionId`, every `CombatVfxPresetId`, all 38 Kiem Pho combo
ids, both `ungthe` triggers, all four `music.home.<time>` variants). The family
anchor rows below stay as the fallback for ids the catalogs don't know yet;
the expanded rows sit beside them so the user can fill one specific
skill/reaction/preset without touching code. Every cue the bindings can emit
has its own manifest row.

### 1.2 Slot table (every manifest row, `src: ''` unless noted)

`synthFallback` = existing `SOUND_LIBRARY` recipe played until a file drops.
`duck` = `duckMusic` value. P2 rows ship in the same table — slots are free —
but are excluded from the "P0+P1 wired first" acceptance gate. Per OQ-A, no
`music.*`/`ambient.*` row carries a `synthFallback` — those channels stay
silent until real files land.

| cue-id | ch | loop | cooldown | duck | synthFallback | priority |
|---|---|---|---|---|---|---|
| ui.click | ui | | | | uiClick | P0 (exists) |
| ui.tab | ui | | | | uiClick | P0 (Chip/tab blanket) |
| ui.toast.loot | ui | | | | toastLoot | P0 (exists) |
| ui.toast.craft | ui | | | | toastCraft | P0 (exists) |
| ui.toast.upgrade | ui | | | | toastUpgrade | P0 (exists) |
| ui.toast.save | ui | | | | toastSave | P0 (exists) |
| ui.toast.warning | ui | | | | toastWarning | P0 (exists) |
| ui.toast.error | ui | | | | toastError | P0 (exists) |
| ui.confirm | ui | | | | uiConfirm | P1 (dormant → wired) |
| ui.cancel | ui | | | | uiCancel | P1 (dormant → wired) |
| ui.modal.open | ui | | | | — | P1 |
| ui.modal.close | ui | | | | — | P1 |
| ui.panel.open | ui | | | | uiClick | P1 |
| ui.panel.close | ui | | | | uiCancel | P1 |
| ui.wheel.open | ui | | | | uiClick | P1 |
| ui.wheel.close | ui | | | | uiCancel | P1 |
| ui.wheel.select | ui | | | | uiConfirm | P1 |
| ui.purchase | ui | | | | toastLoot | P1 |
| ui.equip | ui | | | | uiClick | P1 |
| ui.error | ui | | | | toastError | P1 |
| combat.cast | sfx | | 80 | | combatAttack | P0 |
| combat.cast.<skillId> | sfx | | 80 | | — | open qualifier slots |
| combat.hit | sfx | | 80 | | combatHit | P0 |
| combat.crit | sfx | | 120 | 0.3 | combatCritical | P0 |
| combat.dodge | sfx | | | | combatDodge | P0 |
| combat.block | sfx | | | | combatBlock | P0 |
| combat.death | sfx | | | | combatKill | P0 |
| combat.kill | sfx | | | | combatKill | P0 |
| combat.hurt | sfx | | 80 | | combatHit | P1 (player-target only) |
| combat.survive_lethal | sfx | | | 0.4 | combatBlock | P1 |
| combat.heal | sfx | | 100 | | toastSave | P1 |
| combat.turn_ready | sfx | | | | uiConfirm | P1 |
| combat.impact | sfx | | 80 | | combatHit | P0 (preset fallback row) |
| combat.impact.<presetId> | sfx | | 80 | | — | open qualifier slots |
| combat.element.kim | sfx | | 80 | | combatHit | P1 |
| combat.element.thuy | sfx | | 80 | | combatHit | P1 |
| combat.element.moc | sfx | | 80 | | combatHit | P1 |
| combat.element.hoa | sfx | | 80 | | combatCritical | P1 |
| combat.element.tho | sfx | | 80 | | combatBlock | P1 |
| combat.spawn | sfx | | 120 | | toastWarning | P1 |
| combat.spawn.elite | sfx | | 120 | | toastWarning | P1 |
| combat.spawn.boss | sfx | | | 0.4 | battleStart | P1 |
| combat.buff.apply | sfx | | 120 | | toastSave | P1 |
| combat.debuff.apply | sfx | | 120 | | toastWarning | P1 |
| combat.dot.apply | sfx | | 120 | | toastWarning | P1 |
| combat.buff.expire | sfx | | 120 | | — | P1 |
| combat.buff.stack | sfx | | 120 | | — | P2 |
| combat.reaction | sfx | | | 0.4 | combatCritical | P1 |
| combat.reaction.<reactionId> | sfx | | | 0.4 | — | open qualifier slots |
| combat.loot | sfx | | 120 | | toastLoot | P1 |
| combat.essence | sfx | | 80 | | toastCraft | P1 |
| combat.charge | sfx | | | | combatAttack | P1 |
| combat.release | sfx | | | 0.3 | combatCritical | P1 |
| combat.boss.slam | sfx | | | 0.5 | combatCritical | P1 |
| combat.kiem.combo | sfx | | 80 | | combatHit | P1 |
| combat.kiem.combo.<id> | sfx | | | 0.3 | — | open qualifier slots |
| combat.kiem.tu_luc | sfx | | 120 | | — | P2 |
| combat.thetu.reflect | sfx | | | | combatBlock | P1 |
| combat.ungthe | sfx | | | | combatAttack | P1 (generic fallback) |
| combat.ungthe.intercept | sfx | | | | combatDodge | P1 |
| combat.ungthe.counter | sfx | | | | combatHit | P1 |
| combat.phaptu.proc | sfx | | 120 | | — | P2 |
| combat.hothe.absorb | sfx | | 120 | | combatBlock | P1 |
| combat.ward | sfx | | 120 | | — | P2 (unclassified vitals ward shift) |
| combat.ward.grant | sfx | | | | toastSave | P2 |
| combat.ward.break | sfx | | | | combatBlock | P2 |
| combat.countdown.tick | ui | | | | uiClick | P2 |
| combat.turn_end | sfx | | | | — | P2 |
| combat.exit | ui | | | | uiCancel | P2 |
| combat.start | sfx | | | 0.3 | battleStart | P0 |
| combat.victory | sfx | | | 0.7 | battleVictory | P0 (absorbs stinger.victory) |
| combat.defeat | sfx | | | 0.7 | battleDefeat | P0 (absorbs stinger.defeat) |
| combat.select | ui | | | | uiClick | P0 (manual input feedback) |
| progress.node_unlock | sfx | | | | toastUpgrade | P0 |
| progress.path_choose | sfx | | | 0.4 | uiConfirm | P0 |
| progress.breakthrough | sfx | | | 0.7 | battleVictory | P0 |
| progress.talent_pick | sfx | | | | uiConfirm | P1 |
| progress.reroll | ui | | | | uiClick | P1 |
| progress.create | sfx | | | | uiConfirm | P1 |
| progress.perfect | sfx | | | 0.5 | toastUpgrade | P1 |
| progress.hidden_open | sfx | | | 0.5 | toastWarning | P1 |
| progress.quan_the | sfx | | | | toastSave | P2 |
| tribulation.start | sfx | | | 0.3 | battleStart | P0 |
| tribulation.begin | sfx | | | 0.5 | battleStart | P0 |
| tribulation.thunder | sfx | | 150 | 0.4 | combatCritical | P0 |
| tribulation.chapter | sfx | | | | toastWarning | P1 |
| tribulation.answer.ok | ui | | | | uiConfirm | P1 |
| tribulation.answer.fail | ui | | | | toastError | P1 |
| tribulation.victory | sfx | | | 0.7 | battleVictory | P0 |
| tribulation.fail | sfx | | | 0.7 | battleDefeat | P0 |
| craft.start | sfx | | | | toastCraft | P1 |
| farm.arm | ui | | | | uiConfirm | P2 |
| farm.stop | ui | | | | uiCancel | P2 |
| farm.cycle | sfx | | | | — | P2 (suppressed unless Home visible) |
| stinger.announce | sfx | | | 0.6 | battleStart | P1 |
| stinger.offline | sfx | | | 0.6 | toastSave | P2 |
| ambient.cultivate.on | music | | | | — | P2 |
| ambient.cultivate.off | music | | | | — | P2 |
| music.menu | music | ✓ | | | — | P1 |
| music.home | music | ✓ | | | — | P0 |
| music.combat | music | ✓ | | | — | P0 |
| music.tribulation | music | ✓ | | | — | P0 |
| music.home.<time> | music | ✓ | | | — | P2 (optional variants) |

Count: ~85 rows covering every audit cue + qualifier-family anchors.

---

## 2. Channels & settings

**`src/core/audio/AudioChannels.ts`** (new): `AudioChannelId = 'music' |
'sfx' | 'ui'` + `DEFAULT_CHANNEL_VOLUMES = { music: 0.5, sfx: 0.8, ui: 0.7 }`.

**Routing** (inside `AudioManager.buildChain`):

```
sfx/ui sources → channelGain → reverb → lowpass → master → destination
music sources  → musicGain   →          lowpass → master → destination
```

Music bypasses reverb (bed track must stay clean); both paths ride the
existing lowpass + master. Per-cue `duckMusic` ramps `musicGain` down by that
fraction for the cue duration, then ramps back (one active duck tracked as
max, not summed).

**`src/stores/audio.ts`** — `PersistedAudioSettings` → `{enabled,
masterVolume, musicVolume, sfxVolume, uiVolume, reducedShake}`; storage key
bumps to `tutienidle.audio.v2`; `loadPersisted` falls back to the v1 key
(carry `enabled`/`masterVolume` forward, default the rest). Device-scope
localStorage — **no `saveVersion.ts` bump, no GameSave field** (same decision
as `uiFlagsPersistence.ts:6-10`).

**`SettingsPanel.vue:187-215`** — add three sliders (Music / SFX / UI) beside
the existing master slider, same `range 0-100` + disabled-when-off pattern,
plus the W10 `reducedShake` toggle (OQ-D). i18n keys under
`panels.settings.audio.*` in both `src/locales/en.json` and `vi.json`
(`musicVolume`, `sfxVolume`, `uiVolume`, `reducedShake`) — parity enforced by
the existing `i18nKeyParity.test.ts` guard.

---

## 3. Work items

Ordered so each lands green independently. W1 is pure data; W2 is the engine;
W3+ hang surfaces off it.

### W1 — Manifest + channel types (data foundation, zero behavior change)

1. `src/core/audio/AudioChannels.ts` (new): `AudioChannelId`,
   `DEFAULT_CHANNEL_VOLUMES`, `AUDIO_CHANNELS` readonly tuple.
2. `src/core/audio/AudioCueManifest.ts` (new): `AudioCueDef`, `AUDIO_CUES`
   (full §1.2 table), `resolveAudioCue(id)` — exact → qualifier-strip →
   undefined.
3. `src/core/audio/AudioManager.ts`: rename `SoundId` → `SynthSoundId`
   (type-only rename; `play()` still takes it — `playCue` arrives in W2).
4. Tests: `AudioCueManifest.test.ts` — every row's `channel` valid,
   `volume/cooldownMs/duckMusic` in range, every `synthFallback` exists in
   `SOUND_LIBRARY`, resolve strips qualifiers (`combat.cast.foo` →
   `combat.cast`), unknown id → undefined, duplicate-scan: no two rows share
   (channel, id-prefix) ambiguity.

**Acceptance:** manifest imports under jsdom with no Tone instantiation;
`resolveAudioCue('combat.hit')` returns the row; `resolveAudioCue('bogus.x.y')`
→ `undefined`; type-check green.

### W2 — Playback engine upgrade (`AudioManager`)

1. Channel buses: `buildChain()` creates `Record<AudioChannelId, Tone.Gain>`
   inserted per §2 routing; `setChannelVolume(ch, v)` → `gain.rampTo`.
2. `playCue(id: string): void` — resolve → cooldown check → dispatch:
   - `src` non-empty AND decoded buffer cached → `Tone.Player(buffer)`
     → `channelGain`, apply `volume`, `loop`, `duckMusic`; `onstop` dispose.
   - else `synthFallback` → existing `triggerSynth` path (synths connect to
     their channel bus instead of `reverb` directly).
   - else silent no-op (+ dev-mode `console.debug` once per id).
   Never throws; keeps the existing `try/catch` jsdom-safe contract.
3. Variants: `src: string[]` resolves to first *decoded* buffer (round-robin
   over decoded set when several cached — per-cue `variantCursor`).
4. `playMusic(id)` / `stopMusic(fadeMs)` / `crossfadeMusic(id, fadeMs)` —
   dedicated loop slot (at most one current music Player); duck bookkeeping
   lives here (`applyDuck(amount, durationMs)`).
5. Buffer intake: `attachDecodedBuffer(key, AudioBuffer)` and
   `attachEncodedBuffer(key, ArrayBuffer)` (decodes when context ready;
   queues while not). Keys equal manifest `src` strings.
6. `dispose()` extends to channel gains, players, buffer queue; generation
   guard unchanged.
7. Keep `play(SynthSoundId)` as a thin `playCue`-internal alias for W5/W7's
   migration — call sites convert in the same mission, alias may be dropped
   at the end of W7.
8. Tests: cue with `src:''` + no fallback → returns, no throw, no synth
   built; cooldown gates second call; `synthFallback` fires the mapped
   recipe; channel volume setters clamp; `playCue` without unlock no-ops;
   dispose mid-playback safe.

**Acceptance:** all existing `AudioManager` tests still pass after synths
re-route through channel gains; new tests above green; `npm run type-check`
green.

### W3 — Settings store v2 + SettingsPanel sliders + i18n

1. `src/stores/audio.ts`: `PersistedAudioSettings` v2 shape; `STORAGE_KEY =
   'tutienidle.audio.v2'`; v1 fallback read; state adds
   `musicVolume/sfxVolume/uiVolume`; actions `setChannelVolume(ch, v)` push to
   `AudioManager.setChannelVolume`; `unlock()` pushes all three channel gains
   alongside master; `cue(id: string)` action replaces `play(SoundId)`.
2. `SettingsPanel.vue`: three range inputs wired to
   `audio.setChannelVolume('music'|'sfx'|'ui')`, `:disabled="!audio.enabled"`,
   same markup pattern as the master slider.
3. `src/locales/en.json` + `vi.json`: `panels.settings.audio.musicVolume`,
   `.sfxVolume`, `.uiVolume` (en: "Music" / "Effects" / "Interface"; vi:
   "Nhạc nền" / "Hiệu ứng" / "Giao diện").
4. Tests: store test — v2 round-trip persist; v1 blob migrates
   enabled/master and defaults the rest; channel setters clamp + persist.

**Acceptance:** reload keeps volumes; muting `sfx` silences a `combat.hit`
cue but not `music.*`; i18n parity guard green.

### W4 — Asset loading: `dom-audio` lane + lazy audio bundles

1. `src/presentation/assets/AssetBundleCatalog.ts`:
   - `DomAudioResourceDescriptor { kind:'dom-audio'; key; urls: string[];
     optional: true }` added to `AssetResourceDescriptor`.
   - `descriptorsMatch` arm for `dom-audio` (compare `urls` arrays).
   - New bundle ids `'audio-core' | 'audio-combat' | 'audio-tribulation'`
     built **from the manifest**: `audioDescriptorsFor(channels/routes)`
     enumerates `AUDIO_CUES` rows with non-empty `src` for the route's cue
     domains. Bundles return `[]` until assets land — zero-cost now.
   - `getBundlesForRoute` **unchanged** — audio never gates a transition.
2. `src/presentation/assets/AssetBundleManager.ts`:
   - `domAudioLoader` option (`defaultDomAudioLoader`: `fetch(url)` →
     `res.ok ? res.arrayBuffer() : reject`, tries `urls` in order).
   - `loadSingleDomAudio` mirroring `loadSingleDomImage`: dedupe +
     `inFlightLoads` + **fail-soft** — a 404/decode failure marks the key
     `missing` and resolves (`optional` contract; audio must never reject a
     bundle the way a missing texture would).
   - Buffers hand to `AudioManager.attachEncodedBuffer(key, ab)` — the
     manager owns the decode cache (`Map<key, AudioBuffer>`), not the bundle
     manager (it stays DOM-side like the image cache argument).
3. `src/presentation/audio/audioAssetWiring.ts` (new, small):
   `ensureAudioForRoute(route)` → `ensureLoaded(['audio-'+route])`; called by
   the ambient driver (W8) after `isUnlocked() && enabled`. Muted/disabled →
   skip entirely (Q5).
4. Tests: catalog — audio descriptors enumerate only manifest rows with
   `src`, `descriptorsMatch` arm; manager — 404 marks missing + resolves,
   dedupe, abort; jsdom safe.

**Acceptance:** route transitions identical with audio enabled/disabled;
absent files produce a marked-missing key and a resolved promise, never a
rejected transition.

### W5 — `combatAudioBinding` → full P0/P1 bus-event table

`src/presentation/audio/combatAudioBinding.ts` — the table generalizes from
`eventType → SoundId` to `eventType → cue-id | (event) => cue-id | undefined`
(payload-discriminated rows). Same bind/unbind contract from `App.vue`.

| eventBus event | cue | discriminator |
|---|---|---|
| `attack` | `combat.cast` | — |
| `hit` | `combat.hit` | — |
| `critical` | `combat.crit` | — |
| `dodge` | `combat.dodge` | — |
| `block` | `combat.block` | — |
| `damage` | `combat.hurt` | `targetId === PLAYER_ID` only |
| `death` | `combat.death` | — |
| `kill` | `combat.kill` | — |
| `heal` | `combat.heal` | `actual > 0` already gated at emit |
| `talent_survive_lethal` | `combat.survive_lethal` | — |
| `entity_vitals_changed` | `combat.ward.grant`/`combat.ward.break`/`combat.ward` | `wardBefore`/`wardAfter` delta sign (P2 rows; OQ-B) |
| `turn_ready` | `combat.turn_ready` | manual input window |
| `turn_cast_start` | `combat.cast.<skillId>` → `combat.cast` | manifest resolve chain |
| `action_impact` | `combat.impact.<presetId>` → `combat.element.*` map → `combat.impact` | preset→element table lives in binding, not core |
| `status_vfx_attached` | `combat.buff.apply`/`combat.debuff.apply`/`combat.dot.apply` | `polarity` + `dotType` |
| `status_vfx_removed` | `combat.buff.expire` | — |
| `reward_particle` | `combat.loot` | `kind` |
| `essence_stream_arrival` | `combat.essence` | — |
| `battle_end` | `combat.victory`/`combat.defeat` | `state` |
| `presentation_session_started` | `combat.start`/`tribulation.start` | `session.kind` |
| `combat_exit_request` | `ui.modal.open` | — |
| `combat_scene_exit` | `combat.exit` | P2 |
| `tribulation_started` | `tribulation.begin` | — |
| `tribulation_lightning` | `tribulation.thunder` | — |
| `tribulation_chapter_changed` | `tribulation.chapter` | — |
| `tribulation_outcome` | `tribulation.victory`/`tribulation.fail` | `state` |
| `mind_question_result` | `tribulation.answer.ok`/`.fail` | `correct` |
| `cultivation_changed` | `ambient.cultivate.on`/`.off` | `isCultivating` (P2) |
| plus W6's new emits | `combat.thetu.reflect`, `combat.ungthe.*`, `combat.phaptu.proc`, `combat.hothe.absorb`, `progress.perfect`, `progress.hidden_open`, `farm.cycle` | per §6 |

Notes: `turn_cast_start` and `action_impact` are documented observation feeds
(no ACK role) — audio is a passive listener, never joins the ack protocol.
`combat.countdown.tick` keys off `countdownProgress` transitions inside the
existing snapshot consumer, not a new emit.

**Acceptance:** binding table is a pure map (unit-testable: fake eventBus,
spy `cue()`); every emitted event name in the table is emitted by real core
code (completeness guard W9 cross-checks); unbind removes all handlers.

### W6 — The five gap emits + generalize the drain (core, observation-only)

The drain `GameManagerTurnBattleOps.drainReactionVfxEvents` (:662-697) becomes
`drainPresentationEvents` and gains a **second cursor over
`scheduler.trace.executions`** (`procExecutionCursor`, reset on battle
identity exactly like `reactionEventCursor`/`statusVfxBattle`).

1. **Reflect (Thể Tu)** — drain executions: `record.operation.origin?.kind
   === 'proc' && origin.originId.startsWith('proc.reflect.')` → emit
   `proc_reflect { holderId: origin.sourceId, attackerId:
   operation.payload.targetId, coefficient }` once per settled reflect op.
   Zero `CombatProcSystem` edits — the op identity is already authored
   (`origin()` :397-405, op emit :268-280).
2. **On-hit proc (Pháp Tu, P2)** — same drain, prefix `proc.onhit.` → emit
   `proc_on_hit { attackerId, targetId, buffId }`. (Reactive-trigger buff
   ops `proc.reactive.*` ride the same arm if a cue is wanted later — row
   exists as `combat.phaptu.proc`.)
3. **Reactive proc (Ứng Thể)** — direct emit: `TurnBattleSystem`'s private
   `resolveReactiveProcs` wrapper (:3235-3260) holds the `{attempts,
   queuedFollowUps}` result; after the call returns, emit
   `reactive_proc { holderId, trigger, success, paid, actionSource? }` per
   rolled attempt on `this.combat.eventBus` — the wrapper is the only place
   the outcome exists (ops see only paid consumes). Binding maps
   `trigger`/actionSource → `combat.ungthe.intercept|.counter` → generic
   `combat.ungthe`; failed rolls may fire a softer qualifier later — ship
   success-only.
4. **Perfect clear** — `GameManagerBattleRewardOps.recordPerfectClearIfEligible`
   (:196-218): after the `perfectClearStageIds.push`, emit
   `perfect_clear { stageId, clearSeconds }` on `deps.eventBus` (already in
   scope — same module emits `battle_end`).
5. **Hidden window open** — `HiddenBeastSystem.onEnemyDefeated` (:76-93)
   gains a return value: `string[]` of channel ids whose kill count crossed
   `killThreshold` this call (compare before/after inside the existing
   increment; reset channels never report). Caller (`BattleLootSystem`,
   owns `deps.eventBus`) emits `hidden_window_opened { channelId }` per id.
   HiddenBeastSystem stays eventBus-free — return value, not a dep.
6. **Hộ Thể absorb** — `CombatSystem.ts` at the DR application (:409 region):
   when `linhLucHoTheDr > 0` and mitigated damage > 0, emit
   `hothe_absorb { targetId, absorbedAmount, dr }`. Same module already emits
   `hit`/`critical` — one more observation emit.
7. **Farm cycle (P2)** — `GameManagerAutoFarmOps.tickAutoFarm`: emit
   `farm_cycle { stageId, cycles }` when a cycle completes. Binding suppresses
   `farm.cycle` unless route === 'home' (audit note: ticks fire off-screen).
8. Cursor contract (exactly-once): both cursors scan only `events[start..]`
   / `executions[start..]`, publish `length` back, reset when
   `this.turnBattle` identity changes — mirror the reaction cursor verbatim.
9. Tests: drain emits each reflect op exactly once (two-step battle, cursor
   continuity); new-battle identity resets the cursor; non-proc ops ignored;
   reflect op payload fields reach the event verbatim;
   `reactive_proc` fires per rolled attempt with success/paid flags;
   `perfect_clear` fires only on first record; `hidden_window_opened` fires
   on threshold crossing and not on reset or non-crossing increments;
   `hothe_absorb` fires only when `dr > 0` and damage was actually reduced.

**Acceptance:** each emit is observation-only (no gameplay read-back, no ack
role); all emits are fire-and-forget through the existing `EventBus.emit`
listener-try/catch path; `npm run type-check` + scoped vitest green.

### W7 — UI wiring (`uiAudioBinding` + direct call sites)

1. `src/presentation/audio/uiAudioBinding.ts` (new):
   `bindUiAudio(uiStore)` subscribes `uiStore.$subscribe` and diffs
   `leftPanelMode`/`standalonePanel`/`characterOverlayOpen`/
   `characterDetailOpen`/`isCommandWheelOpen` transitions → `ui.panel.open`/
   `ui.panel.close`/`ui.wheel.open`/`ui.wheel.close`. **Zero edits to
   `stores/ui.ts`** — the seam is the store subscription, matching the
   eventBus-binding shape.
2. `src/components/common/primitives/Chip.vue` — `@click` →
   `audio.cue('ui.tab')` (+ `audio.unlock()` like GameButton). Blanket fix:
   every tab bar, filter, run-mode chip, settings toggle gets sound.
3. ~~`src/components/menu/MenuButton.vue`~~ — removed on master before this wave landed; menu-era clicks ride the GameButton default.
4. `GameButton.vue` / `ToastContainer.vue` — migrate `uiClick`/`toastX` ids
   to `ui.click`/`ui.toast.<kind>` (the only legacy-id edits; then
   `play(SoundId)` alias retires per W2.7).
5. Remaining P0/P1 component sites (one-line `audio.cue(...)` in the existing
   handler; full site list = audit §3):
   `DongFuCommandWheel.vue:371` (`ui.wheel.select`),
   `CombatExitConfirmModal.vue` (`ui.modal.open`/`.close`/`ui.confirm`/`ui.cancel`),
   `OfflineSummaryModal.vue` + `LoreCodexModal.vue` (`ui.confirm`/`ui.cancel`, `stinger.offline` on mount),
   `VendorPanel.vue:84` (`ui.purchase`), `AlchemyView.vue:288/355/372`
   (`craft.start`/`ui.cancel`), `SkillPathPanel.vue:136/373` (`progress.node_unlock`),
   `QuanKhiPanel.vue:243-263` (`progress.path_choose`),
   `TalentEntitlementModal.vue` (`progress.talent_pick`),
   `EquipmentPaperdoll.vue:219` (`ui.equip`),
   `TurnCombatSkillBar.vue:147/182` + `CombatSkillSlot.vue:137` (`combat.select`, `ui.error` on reject),
   `StageSelectPanel.vue` (`farm.arm`/`farm.stop`, P2),
   `CharacterCreationScreen.vue` (`ui.tab` via Chip already, `progress.reroll`, `progress.create`),
   `AuthEntryScreen.vue` (`ui.click` via MenuButton/GameButton already),
   `useBreakthrough.ts` (`progress.breakthrough` via announcement `cueId`),
   `worldAnnouncement.show(cueId?)` default `stinger.announce`.
6. Tests: Chip emits `ui.tab` on click and nothing when `disabled`;
   uiAudioBinding maps open/close transitions correctly incl. swap
   (panel→panel = close+open); modal confirm/cancel cues fire.

**Acceptance:** every audit P0/P1 UI site resolves to a manifest row;
`ui.error` plays on rejected skill taps; no Vue file imports Tone directly
(all audio through `useAudioStore().cue`).

### W8 — `ambientAudioDriver` (route-keyed music + duck + visibility)

`src/presentation/audio/ambientAudioDriver.ts` (new):
`bindAmbientAudio(coordinator, audioStore)` —

1. `coordinator.subscribe(snapshot)` → on `currentRoute` **commit** change,
   `crossfadeMusic(ROUTE_MUSIC[route], 1500)`. Map: `home→music.home`,
   `combat|tribulation→music.combat`/`music.tribulation`,
   `boot|auth|character|error→music.menu`. Same-route re-emit = no-op.
2. Unlock-gated: until `isUnlocked()`, remember desired route-music and start
   it inside the unlock continuation (Q10 — boot silent is accepted).
3. Duck: binding listens for `battle_end` + `stinger`-class plays →
   `applyDuck` — handled inside `playCue` via `duckMusic`; the driver only
   resumes the route loop after a stinger (no code: duck is a gain ramp,
   music loop never stops).
4. `document.visibilitychange` → `suspendMusic()`/`resumeMusic()`; tab-hidden
   combat clock is already frozen upstream (`freezeCombat('tab-hidden')`) —
   audio just stops emitting.
5. `enabled=false` → `stopMusic()`; `enabled=true` → resume current route
   music + kick `ensureAudioForRoute`.
6. Bound in `App.vue` beside `bindCombatAudio`; unbind on teardown.
7. Tests: route map total (every `Route` resolves); crossfade called on
   commit only; hidden→suspend/visible→resume; disabled→stop.

**Acceptance:** `home→combat` crossfades `music.home`→`music.combat` once;
victory stinger ducks and loop continues; disabled store stops everything;
`TranPhapCombatPreviewScene` reuses `music.combat` via the same route map.

### W9 — Seam guards + completeness test

1. `tests/architecture/audioBoundary.test.ts` (new, mirror
   `coreImportDirection.test.ts` helpers):
   - No file under `src/core/**` **except `src/core/audio/**`** may import
     `AudioManager`/`AudioCueManifest`/`AudioChannels` (core never plays
     audio; emits only).
   - `src/core/audio/**` may import only `tone`, `./` siblings, and type-only
     imports (no Vue/Pinia/Phaser/presentation).
   - `src/presentation/audio/**` and `src/stores/audio.ts` are the only
     files allowed to import `AudioManager` (components call
     `useAudioStore().cue`, never the manager directly).
2. `tests/architecture/audioManifestCompleteness.test.ts` (new, mirror
   `i18nKeyParity.test.ts` scanning style): scan `src/**` for string literals
   matching `/^(combat|ui|music|ambient|stinger|progress|tribulation|craft|farm)\.[a-z_]+(\.[a-z_0-9]+)?$/`
   fed to `.cue(`/`playCue(`/`cue:` — every literal must resolve via
   `resolveAudioCue` (exact or qualifier-strip) to a manifest row. Binding
   tables (`COMBAT_EVENT_SOUNDS` successors, `ROUTE_MUSIC`) are scanned too —
   a cue-id that exists nowhere in the manifest is a typo, caught here.
3. Pin: all manifest `synthFallback` values exist in `SOUND_LIBRARY`;
   `enabled=false` → `playCue` returns before touching any buffer/synth.
4. Existing guards keep working unchanged (i18n parity covers new keys;
   `coreImportDirection` already blocks core→presentation).

**Acceptance:** guards fail on a fabricated violation in test fixtures;
full `tests/architecture/` suite green.

### W10 — Reduced screen-shake accessibility toggle (OQ-D)

1. `src/stores/audio.ts`: `reducedShake` joins `PersistedAudioSettings` (v2,
   default `false`) + `setReducedShake(v)` action.
2. `SettingsPanel.vue`: toggle beside the audio sliders, i18n
   `panels.settings.audio.reducedShake` (en "Reduce screen shake" / vi
   "Giảm rung màn hình") — parity via `i18nKeyParity.test.ts`.
3. `src/presentation/vfx/screenShakePolicy.ts` (new): module-level
   `setReducedShakeEnabled(v)` / `screenShakeScale()` /
   `applyScreenShake(camera, durationMs, intensity)` — the single choke
   point for camera impulses. Scale `0.35` when reduced, `1` otherwise.
   Lives in `presentation/` because `src/game/**` may import presentation
   but never `@/stores` (frontendImportDirection guard); `App.vue` binds
   `watch(() => audio.reducedShake, setReducedShakeEnabled, immediate)`.
4. Honor sites — the only `cameras.main.shake` calls in the codebase:
   `src/game/scenes/combat/combat-vfx-spawner.ts:157-158` (preset-driven
   `screenShake`) and `src/game/scenes/TribulationScene.ts:169`
   (`strikeLightning` rumble). Both route through `applyScreenShake`.
   (Spec deviation noted vs OQ-D prompt: `PhaserSkillVfxDriver`/
   `cameraImpulse` do not exist — these are the real sites.)
5. Tests: policy scale defaults `1`, `0.35` when enabled, reset-safe;
   `applyScreenShake` no-ops at scale 0 is NOT used — 0.35 keeps feedback.

**Acceptance:** toggle persists under v2 key; scenes never read the store;
`type-check` green.

---

## 4. Engine choice — comparison record (Q3)

| Option | Verdict | Reason |
|---|---|---|
| `Tone.Player` + decoded `AudioBuffer` cache | **chosen** | Rides the existing Gain→Filter→Reverb chain and the `unlock()`/`generation` lifecycle verbatim; `.loop`, `fadeIn/fadeOut`, `rampTo` ducking are already Tone semantics; buffers arrive via the `dom-audio` lane (fetch is DOM-side, decode is context-side — clean split); jsdom-safe by the same try/catch contract `play()` already honors. |
| Raw `AudioBufferSourceNode` into the same chain | rejected | Functionally identical end-state (Tone's context IS the AudioContext), but re-implements Player's loop/fade/cleanup bookkeeping and needs manual `AudioNode → Tone` interop at every connect. Same dependency, more surface. |
| Phaser `scene.sound` | rejected | Requires a live Phaser scene — `boot`/`auth`/`character` are Vue-only routes with no loader scene, so menu music would be structurally impossible; adds a second mixer + second cache outside the Tone chain; abandons the working unlock/generation machinery. |
| `Tone.Players` (built-in multi-loader) | rejected | Owns its own fetch/load path — bypasses `AssetBundleManager` dedupe, route-gating, and the fail-soft missing-file contract we need for empty slots. We use `Tone.Player` with externally-supplied buffers instead. |
| Howler.js (DESIGN_BRIEF Đợt-3 suggestion) | rejected | Third mixer/context next to Tone; the brief predates the Tone chain. If Tone is ever dropped, revisit — today it doubles the audio surface for no capability gain. |

---

## 5. Determinism & seam declarations (A7/P17 contract)

**Declared seams** — the exhaustive list of places audio may attach:

1. `eventBus.on(...)` observation bindings — `combatAudioBinding` (W5), the
   W6 emits. Fire-and-forget; audio listeners never ack, never feed back.
2. `scheduler.trace.events` + `scheduler.trace.executions` **read-only
   cursors** — the extended `drainPresentationEvents` (W6.1-6.2). A cursor
   can only observe a settled journal; it cannot influence what gets
   journaled.
3. Vue component event handlers + `audio.cue(...)` (W7) — user-gesture call
   sites; they carry input already, audio rides it.
4. `uiStore.$subscribe` state-transition observation (W7.1) — reads
   post-commit state, writes nothing back.
5. `coordinator.subscribe(...)` committed-route observation (W8) — fires
   after the route commits; music cannot gate or delay a transition.
6. `document.visibilitychange` (W8.4) — browser lifecycle only.
7. Pinia `audio` store — the single presentation-side state owner for
   enabled/volumes; device-scope localStorage, never GameSave.

**Negative contract (must never happen):**

- No `src/core/**` file outside `src/core/audio/**` imports or calls
  `AudioManager`, `playCue`, `cue`, or reads `AUDIO_CUES` (W9.1 guard).
- Core emits new events only — it does not check "is audio enabled", does
  not await audio, does not branch gameplay on a cue.
- The new W6 emits are observation events in the same class as
  `reaction_resolved`/`status_vfx_*`: payload = display data, emitted after
  the authoritative write, read by presentation only.
- `CombatRng` is never consulted by anything audio-side; cooldowns use
  wall-clock `Date.now()` (already `MIN_GAP_MS`'s basis) and never tick-time.
- Determinism test consequence: a battle replayed headless emits identical
  domain events whether or not any audio listener is bound (existing
  binding tests already prove the listener is side-effect-free; W9 keeps it
  that way).

---

## 6. Acceptance criteria — mission level

1. **Silent slot contract:** every manifest row with `src: ''` plays nothing
   and throws nothing — in jsdom, in a real browser pre-unlock, and after
   unlock. One `console.debug` per id per session in dev builds only.
2. **Asset drop = zero code:** placing a file at a manifest `src` path and
   reloading is the whole integration; no code edit, no manifest shape
   change, no bundle-list edit (the catalog derives audio descriptors from
   the manifest).
3. **Channel isolation:** `sfxVolume: 0` silences `combat.*`/`progress.*`
   cues while `music.home` keeps playing; `uiVolume: 0` silences clicks while
   combat sounds continue; `enabled: false` silences all three.
4. **Missing file = graceful:** a `src` pointing at a 404 marks the key
   missing, resolves the load, and that cue falls back to `synthFallback`
   or silence — never a rejected `ensureLoaded`, never a blocked route.
5. **Wiring completeness:** every P0 cue-id in the audit tables has both a
   manifest row and a live trigger path after W5+W7; every P1 has a manifest
   row (trigger path may ship un-wired only where its gap emit is deferred
   by priority).
6. **Determinism:** identical event stream with and without bindings
   attached; no new import edge core→audio; guards in W9 green.
7. **Persistence:** volumes + enabled survive reload under
   `tutienidle.audio.v2`; a stale v1 blob migrates forward, not silently
   dropped.
8. **Autoplay:** no `AudioContext` is created before the first gesture;
   `unlock()` failure leaves the retry path open (existing B6 behavior
   preserved).

---

## Open questions — genuinely the user's call (implementation must not guess)

- **OQ-A — Music source.** RESOLVED (§0b): silent until real files — no
  `synthFallback` on `music.*`/`ambient.*` rows. The Tone-synthesized ambient
  loop idea may return later as authored content, never as a fallback.
- **OQ-B — `combat.ward` discrimination.** Open — unchanged: binding filters
  on `wardBefore`/`wardAfter` delta sign (fields confirmed present on the
  `entity_vitals_changed` emit).
- **OQ-C — Per-skill / per-reaction asset scope.** RESOLVED (§0b): FULL
  coverage — every qualifier in the audit inventory gets a real manifest row
  (all castable skills, all reactions, all VFX presets, all 38 kiem combos,
  both ứng-thể triggers, all four Thanh Vân time variants).
- **OQ-D — Reduced-shake toggle.** RESOLVED (§0b): in scope as W10 —
  `reducedShake` in the v2 settings blob + SettingsPanel toggle (i18n en+vi)
  + a presentation policy gate on every `cameras.main.shake` call.
