# Sound System Audit + Design Proposal

> Auditor session (2026-09-27, master @ `0f1d84d1`). Input material for the
> real-asset sound system: every place audio belongs, the architecture seam it
> must ride, and the code sites that will fire cue ids.
> Scope rule honored: read-only for production code; this doc is the only write.
>
> Prior art already in repo: `docs/audio-game-feel-plan.md` (Phase 2 plan,
> verified 0 audio files, authored the Tone.js interim system) and
> `docs/audio/DESIGN_BRIEF.md` (style brief — "Tân Quốc phong nhẹ nhàng",
> mandates per-channel volume controls).

---

## 0. Current state (what already exists)

| Piece | Where | Notes |
|---|---|---|
| `AudioManager` | `src/core/audio/AudioManager.ts` | Tone.js **synthesis** singleton — `SOUND_LIBRARY` (17 recipe ids, lines 79-229), `play()` (line 417) with per-id 60 ms anti-spam (`MIN_GAP_MS` line 236), autoplay `unlock()` (line 329), master Gain→Filter→Reverb chain (lines 371-382). **No sample/file playback, no channel split (music/sfx/ui), no per-cue assets.** |
| Combat audio binding | `src/presentation/audio/combatAudioBinding.ts` | `COMBAT_EVENT_SOUNDS` map (lines 14-21) + `bindCombatAudio(eventBus)` (line 32) — observes domain events, plays synth ids. Bound in `App.vue:193`, unbound `App.vue:673`. |
| UI click SFX | `src/components/common/GameButton.vue:42-46` | `audio.unlock()` + `play('uiClick')` on every GameButton click (prop `sound` default true). |
| Toast SFX | `src/components/common/ToastContainer.vue:14-31` | `KIND_SOUND` map — plays at toast visibility, not queue time. |
| Settings UI | `src/components/panels/SettingsPanel.vue:187-215` | Enabled toggle + master volume slider, i18n keys `panels.settings.audio.*` already in `src/locales/en.json:607-613` and `vi.json:607-613`. |
| Settings persistence | `src/stores/audio.ts` | Pinia mirror; localStorage key `tutienidle.audio.v1` (line 12), `{enabled, masterVolume}` — **device-scope, NOT inside GameSave** (same pattern as `src/stores/uiFlagsPersistence.ts:14`). |
| Autoplay unlock | `src/App.vue:197` | One-shot `pointerdown` listener → `useAudioStore().unlock()`. |
| Unused ids | `SOUND_LIBRARY` | `uiConfirm`, `uiCancel` are authored but have **zero call sites**. |
| Phaser sound | — | `this.sound` / `scene.sound` never used anywhere (grep-verified). Phaser audio pipeline is untouched. |
| Audio files | — | Still **0** `.mp3/.ogg/.wav` under `src/`, `public/`, `asset-drop/` (grep + find verified). |

**Verdict:** the plumbing skeleton exists and works, but it is a synth-only MVP. The
real-asset system must add: a cue manifest (id → file + defaults), named channels
with separate volumes, music/ambient loops with crossfade, a much wider trigger
surface, and an asset-loading path.

---

## 1. Touchpoint inventory

Legend: **P0** = must ship first (core feel), **P1** = high-value coverage,
**P2** = polish/depth. `cue-id` convention: `<domain>.<verb>[.<qualifier>]`
(dot-namespaced strings replace the current camelCase `SoundId` union so the
manifest scales to hundreds of cues without a union type edit).

### 1a. Combat — action events (already emitted on `eventBus`)

| Surface | Trigger site (file:line) | Suggested cue-id | Priority |
|---|---|---|---|
| Attack declared (any cast commit) | `src/core/battle/turn/TurnBattleSystem.ts:2326` (`emit('attack')`) | `combat.cast` | P0 |
| Hit lands | `src/core/combat/CombatSystem.ts:434` (`emit('hit')`) | `combat.hit` | P0 |
| Critical | `src/core/combat/CombatSystem.ts:415` | `combat.crit` | P0 |
| Dodge (whiff) | `src/core/combat/CombatSystem.ts:352` | `combat.dodge` | P0 |
| Block | `src/core/combat/CombatSystem.ts:425` | `combat.block` | P0 |
| Damage number (generic, fires with hit — currently deliberately unbound, see `combatAudioBinding.ts:13`) | `src/core/combat/CombatSystem.ts:514,613` | `combat.hurt` (player-target variant only; filter `targetId===PLAYER_ID`) | P1 |
| Death | `src/core/combat/CombatSystem.ts:750` | `combat.death` | P0 |
| Kill credit | `src/core/combat/CombatSystem.ts:758` | `combat.kill` | P0 |
| Talent survive-lethal | `src/core/combat/CombatSystem.ts:722` | `combat.survive_lethal` | P1 |
| Heal applied | `src/core/combat/EntityVitalsSystem.ts:143` (`emit('heal')`, only healing/leech, actual>0) | `combat.heal` | P1 |
| Vitals ceiling change (ward/shield shifts) | `src/core/combat/EntityVitalsSystem.ts:225` (`entity_vitals_changed`) | `combat.ward` (needs payload discrimination — see open Q) | P2 |
| Turn ready flourish (player input window in manual mode) | `src/core/battle/turn/TurnActionPresentationEvents.ts:26` (`turn_ready`) | `combat.turn_ready` | P1 |
| Cast start / lunge | `src/core/battle/turn/TurnActionPresentationEvents.ts:35` (`turn_cast_start`, carries `skillId`) | `combat.cast.<skillId>` fallback `combat.cast` | P0 — key for per-skill cues |
| Action impact (VFX anchor + `presetId` + `hitCount`) | `src/core/battle/turn/TurnActionPresentationEvents.ts:67` (`action_impact`) | `combat.impact.<presetId>` fallback `combat.impact` | P0 — richest audio seam: presetId maps to element |
| Turn standby complete | `src/core/battle/turn/TurnActionPresentationEvents.ts:84` | `combat.turn_end` | P2 |
| Enemy spawn telegraph (enemy/elite/boss presets) | snapshot-driven: `TurnActionPresentationEvents.ts:126-146` (`pendingEnemySpawns[].presetId`), consumed `combat-vfx-spawner.ts:491-534` | `combat.spawn` / `combat.spawn.elite` / `combat.spawn.boss` | P1 |
| Entity snapshot (materialize transitions) | `TurnActionPresentationEvents.ts:186` (`turn_battle_entity_snapshot`) | — no cue (reconcile-only) | — |
| Status attached (buff/debuff icon lands; carries `dotType`, `polarity`, `permanent`) | `src/core/battle/turn/TurnStatusPresentationEvents.ts:97` | `combat.buff.apply` / `combat.debuff.apply` / `combat.dot.apply` | P1 |
| Status updated (stack change) | `TurnStatusPresentationEvents.ts:114` | `combat.buff.stack` | P2 |
| Status removed/expire | `TurnStatusPresentationEvents.ts:133` | `combat.buff.expire` | P1 |
| Reaction resolved (element reaction VFX; carries `reactionId`, `relation`) | `src/core/game/GameManagerTurnBattleOps.ts:677` | `combat.reaction.<reactionId>` | P1 |
| Reaction skipped | `GameManagerTurnBattleOps.ts:687` | — none (silent skip is correct) | — |
| Reward particle → gourd/essence stream | `src/core/game/BattleLootSystem.ts:720` (`reward_particle`, `kind` field) + arrival event `src/game/scenes/CombatScene.ts:1554,1567` (`essence_stream_arrival`) | `combat.loot` / `combat.essence` | P1 |
| Battle end victory/defeat | `src/core/game/GameManagerBattleRewardOps.ts:57` (`battle_end`, `state` field) | `combat.victory` / `combat.defeat` | P0 |
| Combat session begins | `src/core/game/GameManagerTurnBattleOps.ts:1906,2188` (`presentation_session_started`, `kind`) | `combat.start` (tribulation sessions silent here - `tribulation_started` owns the start cue) | P0 |
| Combat exit (canvas request → confirm modal) | `src/game/scenes/CombatScene.ts:1704` (`combat_exit_request`) | `ui.modal.open` | P1 |
| Scene exit committed | `src/composables/useBattleActions.ts:111` (`combat_scene_exit`) | `combat.exit` | P2 |
| Pause overlay open/close | `src/components/game/combat/CombatPauseOverlay.vue:40` (`continue` emit) + open site | `ui.modal.open` / `ui.modal.close` | P2 |
| Countdown ticks (3s intro) | phase `countdown` in snapshot (`countdownProgress`), `CombatCountdownOverlay.vue` | `combat.countdown.tick` | P2 |
| Charge start (chargeTurns>0 skill declared) | `src/core/battle/turn/TurnBattleSystem.ts:1896-1902` (charge init) | `combat.charge` | P1 |
| Charge release (self-resolve at 0) | `TurnBattleSystem.ts:1484-1537` (charging tick → resolve) | `combat.release` | P1 |
| Auto-farm cycle completes (online tick pays cycle) | `src/core/game/GameManagerAutoFarmOps.ts:251` (`tickAutoFarm`), offline settle ~`225-243` | `farm.cycle` (very soft; ticks fire off-screen — consider suppressing unless Home visible) | P2 |

### 1b. Combat — path/element riders (VFX preset ids are the key)

`action_impact` carries `presetId: CombatVfxPresetId` → element-tinted impact
cues without new engine events. Preset table: `src/data/vfx/CombatVfxPresets.ts:29+`.

| Rider | Data | Suggested cue-id | Priority |
|---|---|---|---|
| Kim (metal) | preset `metal_slash` | `combat.impact.metal_slash` | P1 |
| Thủy (water) | preset `water_surge` | `combat.impact.water_surge` | P1 |
| Mộc (wood) | preset `wood_spikes` | `combat.impact.wood_spikes` | P1 |
| Hỏa (fire) | preset `fire_burst` | `combat.impact.fire_burst` | P1 |
| Thổ (earth) | preset `earth_shockwave` | `combat.impact.earth_shockwave` | P1 |
| Generic/lightning/wind/holy/shadow | `lightning_strike`, `wind_blade`, `holy_radiance`, `shadow_burst`, `slash`, `claw`, `arcane_impact` | `combat.impact.<presetId>` rows (fall back to `combat.impact`) | P2 |
| Boss slam | `boss_ground_slam` (has `screenShake`) | `combat.boss.slam` | P1 |
| Kiếm Phổ combo land (37-combo table, presetId `kiem_combo_*`) | `src/data/skill/KiemPhoCombos.ts:69-105` | `combat.kiem.combo` (+ per-capstone `combat.kiem.combo.<id>` for the 6 beta combos) | P1 |
| Tứ Lực channel tick | preset `tu_luc` (`CombatVfxPresets.ts:112`) | `combat.kiem.tu_luc` | P2 |
| Thể Tu sacrifice / reflect (action-end reflection op) | `src/core/proc/CombatProcSystem.ts` `flushReflects` ~`228-280` (one `'reflection'` op per entry) — currently **no eventBus emit**; needs a presentation event or bind via op-trace drain like `reaction_resolved` | `combat.thetu.reflect` | P1 |
| Ứng Thể intercept/counter/follow-up (reactive_proc window) | `CombatProcSystem.ts` `resolveReactiveProcs` ~`305-340`; attempt results `{attempts, queuedFollowUps}` — **no eventBus emit today** | `combat.ungthe.intercept` / `combat.ungthe.counter` | P1 |
| Pháp Tu Thể-proc (on_hit_proc lane) | `CombatProcSystem.ts:106-167` — same gap: ops emitted to scheduler, not eventBus | `combat.phaptu.proc` | P2 |
| Hộ Thể mana-shield absorb (Linh Lực Hộ Thể DR) | `src/core/combat/hoTheDamageReduction.ts` + live bridge `src/presentation/bridges/hoTheBridge.ts` (tooltip readout only today) | `combat.hothe.absorb` (needs emit at DR application site in damage path) | P1 |
| ExternalWard grant/consume (Sơn Nhạc Hộ Thể) | `TurnBattleSystem.ts:704` (grant write), `:3702` (reconcile/expiry) | `combat.ward.grant` / `combat.ward.break` | P2 |

> **Note — the three "no eventBus emit" riders:** reflect/reactive-proc/on-hit-proc
> currently settle silently inside `CombatProcSystem`. The audit recommends
> draining them the same way `reaction_resolved`/`reaction_skipped` are drained
> from `scheduler.trace.events` at `GameManagerTurnBattleOps.ts:660-694` — an
> observation-only cursor, zero gameplay reach.

### 1c. UI surfaces

| Surface | Trigger site (file:line) | Suggested cue-id | Priority |
|---|---|---|---|
| Primary button click | `src/components/common/GameButton.vue:44` (already wired → `uiClick`) | `ui.click` | P0 (exists) |
| **Chip / tab / mode-pill click (SILENT TODAY)** | `src/components/common/primitives/Chip.vue` — plain `<button>`, no audio; used for all tab bars, filters, run-mode chips (`StageSelectPanel.vue:337-343`), settings toggles | `ui.tab` | P0 — biggest UI gap |
| **MenuButton (SILENT TODAY)** | `src/components/menu/MenuButton.vue:26` — pre-game/menu screens | `ui.click` | P1 |
| Panel open (left drawer) | `src/stores/ui.ts:201` `toggleLeft` | `ui.panel.open` | P1 |
| Panel close (toggle-off → null) | `src/stores/ui.ts:201,316` | `ui.panel.close` | P1 |
| Standalone panel open (wheel-driven) | `src/stores/ui.ts:231` `openStandalonePanel`, `:316` `toggleStandalonePanel` | `ui.panel.open` | P1 |
| Character detail drawer | `src/stores/ui.ts:237` `toggleCharacterDetail` | `ui.panel.open` | P2 |
| Command wheel open/close | `src/stores/ui.ts:251` `toggleCommandWheel`; open site `src/components/game/DongFuScene.vue:255` | `ui.wheel.open` / `ui.wheel.close` | P1 |
| Wheel slot activate | `src/components/game/DongFuCommandWheel.vue:371` `activate(slot)` | `ui.wheel.select` | P1 |
| Modal open (exit confirm) | `src/components/game/combat/CombatExitConfirmModal.vue:52,64` | `ui.modal.open` | P1 |
| Modal confirm / cancel | `CombatExitConfirmModal.vue:70-71`; `OfflineSummaryModal.vue:63`; `LoreCodexModal.vue` | `ui.confirm` / `ui.cancel` (unlocks the two dormant ids) | P1 |
| Purchase/commit success — vendor sell | `src/components/panels/VendorPanel.vue:84` `sellAll` | `ui.purchase` | P1 |
| Alchemy brew start / cancel | `src/components/panels/AlchemyView.vue:288,355,372` (`selectRecipe`/`startJob`/`cancelJob`) | `craft.start` / `ui.cancel` | P1 |
| Node purchase + unlock animation | `src/components/panels/SkillPathPanel.vue:121-136` (`unlockTrigger`), `:373` `@unlocked`, branch tabs `:313,333,341` | `progress.node_unlock` | P0 — signature unlock moment |
| Skill slot tap (manual combat input) | `src/components/game/combat/hud/TurnCombatSkillBar.vue:182` `tapSlot`, `:147` `chooseDynamicBasic` (Kiếm Tử orb pick); `CombatSkillSlot.vue:137` | `combat.select` (+ `ui.error` when not tappable) | P0 — manual mode needs input feedback |
| Talent entitlement decide | `src/components/common/TalentEntitlementModal.vue:121,141` | `progress.talent_pick` | P1 |
| Path commit (Quán Khí choose) | `src/components/panels/QuanKhiPanel.vue:243-263` `choosePath` | `progress.path_choose` | P0 — build-defining click |
| Equipment slot click | `src/components/panels/EquipmentPaperdoll.vue:219` `onSlotClick` | `ui.equip` | P1 |
| Toast kinds (already wired) | `src/components/common/ToastContainer.vue:14-21` | `ui.toast.<kind>` (loot/craft/upgrade/save/warning/error — keep per-kind) | P0 (exists) |
| Stage select / zone / chapter | `src/components/panels/StageSelectPanel.vue:253,266,292` | `ui.tab` | P2 |
| Stage start commit | `StageSelectPanel.vue:354` → `useBattleActions.ts:128` `startSelectedStage` | `combat.start` (covered by session event too) | P0 |
| Auto-farm arm / stop | `StageSelectPanel.vue:224,307`; `src/components/game/AutoFarmIndicator.vue:35` | `farm.arm` / `farm.stop` | P2 |
| Auth submit / guest | `src/components/onboarding/AuthEntryScreen.vue:80,90,121,127` | `ui.click` / `ui.confirm` | P2 |
| Character creation picks | `src/components/onboarding/CharacterCreationScreen.vue:125` (talent), `:129` (reroll), `:136` (skill), `:145` (finish) | `ui.tab`, `progress.reroll`, `progress.create` | P1 |
| Settings save / export / import | `src/components/panels/SettingsPanel.vue:57,63,89,125`; `src/composables/useElectronBridge.ts:85-89` | `ui.toast.save` / `ui.toast.error` (already via toast) | P1 |
| UI error (disabled/invalid action) | — no dedicated site; fire on rejected clicks (`canStart` false, blocked node, etc.) | `ui.error` | P1 |

### 1d. Progression stingers & world moments

| Surface | Trigger site (file:line) | Suggested cue-id | Priority |
|---|---|---|---|
| Realm breakthrough success (major realm announce) | `src/composables/useBreakthrough.ts:32-50` → `BreakthroughOutcomeService.ts:83` (`player.breakthrough()`), announcement `worldAnnouncement.show` | `progress.breakthrough` | P0 — the signature stinger |
| Tribulation begin | `src/core/tribulation/TribulationDirector.ts:293` (`tribulation_started`) | `tribulation.begin` | P0 |
| Tribulation lightning strike | `TribulationDirector.ts:544` (`tribulation_lightning`) → `TribulationScene.ts:144` `strikeLightning()` | `tribulation.thunder` | P0 |
| Tribulation chapter change | `TribulationDirector.ts:650` | `tribulation.chapter` | P1 |
| Mind question answered (correct/wrong) | `TribulationDirector.ts:451,454` (`mind_question_result`) + answers `TribulationSceneOverlay.vue:56-63` | `tribulation.answer.ok` / `.fail` | P1 |
| Tribulation outcome | `TribulationDirector.ts:621` (`tribulation_outcome`) | `tribulation.victory` / `tribulation.fail` | P0 |
| Stage perfect-clear recorded | `src/core/game/GameManagerBattleRewardOps.ts:196-218` (records `perfectClearStageIds`, `perfectClearSeconds`) — **fires inside battle_end path; needs event or notification hook** | `progress.perfect` | P1 |
| Hidden battle window opens | `src/core/game/HiddenBeastSystem.ts:32` `isWindowOpen` (kill-threshold crossing at `:88-90`) — passive check today; needs a "window opened" emit at threshold | `progress.hidden_open` | P1 |
| Quán Thể diversion progress | `hiddenPerfection` `quan_the` payload (saveVersion v83); progress tracked in `src/data/realm/HiddenBodyRealms.ts` consumers | `progress.quan_the` | P2 |
| World announcement show (generic big moment) | `src/stores/worldAnnouncement.ts` `show()` — used by breakthrough/tribulation/path-choice gateways | `stinger.announce` | P1 |
| Cultivation start/stop (idle pose toggle) | `src/App.vue:456` (`cultivation_changed` emit, `isCultivating` flag); tick `App.vue:463` `player.cultivate` | `ambient.cultivate.on` / `.off` | P2 |
| Offline gains summary shown | `src/components/common/OfflineSummaryModal.vue` mount (`GameRoot.vue:34`) | `stinger.offline` | P2 |

### 1e. Ambient / music

Routes are the natural granularity (`Route` union, `src/presentation/PresentationContracts.ts:7`). The coordinator (`src/presentation/GamePresentationCoordinator.ts`) owns route transitions — the audio driver should subscribe to committed-route changes, not scenes directly.

| Surface | Where | Suggested cue-id | Priority |
|---|---|---|---|
| Home / Động Phủ (cultivation idle) | route `home` → `MainScene` + `DongFuScene.vue` | `music.home` (loop, calm) | P0 |
| Combat | route `combat` → `CombatScene` | `music.combat` (loop, tenser) | P0 |
| Tribulation | route `tribulation` → `TribulationScene` | `music.tribulation` (loop, ominous) | P0 |
| Boot / auth / character creation | routes `boot`/`auth`/`character` | `music.menu` (loop) | P1 |
| Victory jingle (over combat music duck) | `battle_end` victory | `stinger.victory` | P1 |
| Defeat jingle | `battle_end` defeat | `stinger.defeat` | P1 |
| Tran Pháp preview scene | `TranPhapCombatPreviewScene.ts` | reuse `music.combat` | P2 |
| Night/day variant (modular Động Phủ times exist: `public/assets/backgrounds/dong-fu/modular/times/*`) | `peekThanhVanVariant()` | `music.home.<time>` (optional variants) | P2 |

---

## 2. Architecture fit

### 2a. The seam that already exists (and why it is the right one)

The presentation layer never reaches into gameplay; it **observes**:

- Domain emits presentation events on `GameManager.eventBus`
  (`src/core/events/EventBus.ts` — emit is fire-and-forget, listeners
  wrapped in try/catch, lines 33-56).
- `combatAudioBinding.ts` already proves the audio seam: a binding module that
  maps `eventType → soundId`, bound once in `App.vue`, returns an unbind fn.
- `CombatScene.getCombatEventBindings()` (`src/game/scenes/CombatScene.ts:582+`)
  is the equivalent VFX/driver table — VFX preset playback is receipt-driven
  off the same events (`action_impact.presetId` → `getCombatVfxPreset` →
  `spawnActionImpactVfx` at `combat-vfx-spawner.ts:130-171`).
- Ack-driven pacing exists (`turn_ready` → `acknowledgeTurnReady`,
  `action_impact` → `acknowledgeActionComplete`) — audio does **not** join the
  ack protocol; it is a passive listener only.

**Design:** keep this exact shape, generalize it.

### 2b. Proposed modules

```
src/core/audio/
  AudioManager.ts            # keep — becomes the low-level output engine
  AudioCueManifest.ts        # NEW — cue-id → {file, channel, volume, loop,
                           #      variants[], cooldownMs, duckMusic}
  AudioChannels.ts           # NEW — channel enum + per-channel gain routing
src/presentation/audio/
  combatAudioBinding.ts      # extend: same table shape, richer maps
  uiAudioBinding.ts          # NEW — DOM/UI cue wiring (or composable useAudioCue)
  ambientAudioDriver.ts      # NEW — subscribes coordinator route state →
                           #       music loop start/stop/crossfade
  cueEvents.ts               # NEW — optional: drains proc/reflect op-trace
                           #       events → cues (mirror of reaction drain)
src/presentation/assets/
  AssetBundleCatalog.ts      # extend: new descriptor kind 'audio'
```

**Channel model** (matches DESIGN_BRIEF's mandatory split):
`music` | `sfx` | `ui` — each a `Tone.Gain` (or `GainNode`) feeding the existing
`master → lowpass → reverb → destination` chain. SFX keeps the per-id
`MIN_GAP_MS` anti-spam; music uses long crossfade (1-2 s) on route change;
`duckMusic` cues (victory/defeat/breakthrough stingers) briefly sidechain the
music gain.

**Manifest sketch** (data-only, like `CombatVfxPresets.ts`):

```ts
export interface AudioCue {
  id: string                    // 'combat.hit', 'music.home'
  src: string                   // 'assets/audio/sfx/combat/hit.ogg'
  channel: 'sfx' | 'music' | 'ui'
  volume?: number               // 0..1, default 1
  loop?: boolean                // music/ambient
  variants?: string[]           // round-robin files to avoid machine-gun feel
  cooldownMs?: number           // overrides MIN_GAP_MS per cue
  duckMusic?: number            // 0..1 amount to duck while playing
  missing?: 'silent'            // placeholder slots: cue exists, file absent → no-op
}
export const AUDIO_CUES: Record<string, AudioCue> = { ... }
```

Empty-slot rule (from the mission brief): **every cue-id in the tables above
gets a manifest entry at build time; entries with no file yet carry
`missing:'silent'` (or point at a `silence.ogg`) and `play()` no-ops.** The
trigger sites ship first; dropping real assets in later requires zero code
edits — only manifest `src` fields.

### 2c. Asset loading — how audio slots in

Today's pipeline: `AssetBundleCatalog` enumerates descriptors per bundle id
(`'core-ui'|'home'|'combat'|'tribulation'`, line 48) → `getBundlesForRoute`
(308-322) → `AssetBundleManager.ensureLoaded` dedupes/dedup-persists
(`AssetBundleManager.ts:141-184`) → `AssetLoaderScene.loadDescriptors` runs a
serialized `Phaser.Loader` batch (`AssetLoaderScene.ts:47-166`, switch at
144-161 handles image/spritesheet/atlas/multiatlas).

Two options:

1. **Phaser-native**: add `AudioResourceDescriptor {kind:'audio', key, url[]}` to
   the catalog; `AssetLoaderScene` gains a `case 'audio': this.load.audio(key, urls)`;
   verification uses `this.cache.audio.exists(key)` (mirror `isTextureLoaded`
   line 37). Playback via `scene.sound` — but that couples audio to Phaser
   scenes that may not exist yet (Vue-only routes) and abandons the working
   Tone chain.
2. **WebAudio-native (recommended)**: keep `AudioManager`/Tone as the engine.
   Add a `'dom-audio'` descriptor lane beside `'dom-image'` — loaded via
   `fetch → AudioContext.decodeAudioData` in `AssetBundleManager` (the
   `defaultDomImageLoader` pattern at lines 27-62 ports directly), cached in a
   `Map<key, AudioBuffer>` owned by the audio module. Route-gating and dedup
   come free; no Phaser dependency; music can start on Vue-only screens.
   `AssetLoaderScene` stays texture-only.

Either way the catalog gains per-route audio bundles (`audio-core`,
`audio-combat`, `audio-tribulation` merged into existing bundle lists or kept
separate so a muted player pays no download cost — see open questions).

### 2d. Settings & persistence

- Store: extend `src/stores/audio.ts` `PersistedAudioSettings` →
  `{enabled, masterVolume, musicVolume, sfxVolume, uiVolume, mutedChannels[]}`
  (bump key to `tutienidle.audio.v2` or version the JSON; the loader already
  tolerates unknown/missing fields, lines 19-30).
- Keep it **device-scope localStorage** — same decision as
  `uiFlagsPersistence.ts:6-10` ("tuỳ chọn THIẾT BỊ, không thuộc tiến trình nhân
  vật — không bump CURRENT_SAVE_VERSION, không đụng cloud save"). **No
  `saveVersion.ts` bump.** Only if the user later wants cross-device audio sync
  does it move into GameSave.
- SettingsPanel section exists (`187-215`); extend with per-channel sliders;
  i18n keys live under `panels.settings.audio.*` — add
  `music`/`sfx`/`ui`/`muteAll` strings to both locale files.
- Also add a "reduce screen shake" toggle? (the feel-plan flagged it — it
  belongs in this same settings section, adjacent to audio.)

### 2e. Determinism — where sound hooks must NOT reach

- **A7 / P17** (`AGENTS.md`): presentation renders/acknowledges, never
  determines outcomes. `combatAudioBinding.ts:5-6` already declares this.
- Sound hooks attach ONLY at: `eventBus` observation bindings, Vue component
  event handlers, Pinia store actions, route-change subscription. They must
  **never** be called from `src/core/**` resolvers (`TurnBattleSystem`,
  `CombatSystem`, `CombatProcSystem`, `BuffPeriodicResolver`,
  `CombatOperationExecutor`, `CombatScheduler`), never read `CombatRng`, and
  never run inside the fixed-step tick.
- Core-side "missing emits" (reflect, reactive-proc, perfect-clear, hidden
  window, Hộ Thể absorb) must be added as **domain presentation events on the
  eventBus** (the established pattern — `emitTurnActionImpact`,
  `drainReactionVfxEvents`), not as audio calls inside core. Audio binds;
  core never imports audio.
- Singleton import direction today: `src/core/audio/AudioManager.ts` is imported
  **upward** by presentation/components only — keep it Vue/Phaser-free so core
  unit tests never touch WebAudio (existing `play()` already no-ops without an
  AudioContext — jsdom-safe by design, line 440).

---

## 3. Integration plan — every site that fires a cue

**Already wired (keep):** `App.vue:193` (combat binding), `App.vue:197`
(gesture unlock), `GameButton.vue:44` (click), `ToastContainer.vue:23-31`
(toast kinds), `SettingsPanel.vue:187-215` (volume UI).

**New eventBus bindings** (extend `combatAudioBinding.ts` table — no new core
code): `turn_ready`, `turn_cast_start` (per-skill), `action_impact` (per-preset
→ element cues), `status_vfx_attached/updated/removed`, `heal`,
`talent_survive_lethal`, `entity_vitals_changed`, `reward_particle`,
`essence_stream_arrival`, `combat_exit_request`, `tribulation_*` (5 events),
`mind_question_result`, `combat_scene_exit`, `cultivation_changed`,
`presentation_session_started` (kind-discriminated).

**New domain presentation events needed first** (core emits → bus, mirroring
existing emitters; audio then binds): reflect flush (`CombatProcSystem`
action-end), reactive-proc attempt outcome (`resolveReactiveProcs`), perfect
clear (`GameManagerBattleRewardOps.ts:217`), hidden-channel window open
(`HiddenBeastSystem.ts:88-90` threshold crossing), Hộ Thể absorb application,
auto-farm cycle completion (`GameManagerAutoFarmOps.tickAutoFarm`).

**Vue/DOM sites to wire** (`uiAudioBinding` or `useAudioCue()` composable):
`Chip.vue` (blanket fix — gives every tab/mode click sound), `MenuButton.vue`,
`stores/ui.ts` panel toggles (`201/231/237/251/316`), `DongFuScene.vue:255` +
`DongFuCommandWheel.vue:371`, `CombatExitConfirmModal.vue`, `VendorPanel.vue:84`,
`AlchemyView.vue:288/355/372`, `SkillPathPanel.vue:136/373`, `QuanKhiPanel.vue:243-263`,
`TalentEntitlementModal.vue:121/141`, `EquipmentPaperdoll.vue:219`,
`TurnCombatSkillBar.vue:147/182`, `CombatSkillSlot.vue:137`,
`StageSelectPanel.vue:224/253/266/292/307/354`, `AuthEntryScreen.vue`,
`CharacterCreationScreen.vue:125/129/136/145`, `OfflineSummaryModal.vue`,
`useBreakthrough.ts:45` (stinger alongside announcement),
`useTribulation.ts:98/116`, `useBattleActions.ts:128` (stage-start commit).

**Music driver:** `ambientAudioDriver.ts` subscribes coordinator snapshot
(`GAME_PRESENTATION_KEY` / coordinator state) → on committed-route change,
crossfade to `music.<route>`; duck on `stinger.*` cues; stop on tab-hidden
(`document.visibilitychange`) or when `enabled=false`.

---

## 4. Open questions for the user

1. **Asset format** — `.ogg` (small, gapless loops, Safari <18 needs `.mp3`
   fallback) vs `.mp3` (universal) vs both (manifest `src: string[]`). Recommend
   `src: string[]` with ogg-first; loader picks `canPlayType`.
2. **Hosting** — `public/assets/audio/...` shipped in the bundle (matches VFX
   sprites/backgrounds today), or CDN? Electron build ships local files either
   way; CDN saves app size but breaks offline.
3. **Engine** — keep Tone.js chain and add `Tone.Player`/`Players` for samples
   (reverb/lowpass chain already built), or plain `AudioBufferSourceNode` into
   the same Gain chain (less dependency surface)? Both preserve current API.
4. **Looping rules** — seamless-loop assets required (music ends must be
   authored to loop); does the drop include intros+loop bodies (two-file
   pattern) or single-loop files?
5. **Bundle strategy** — separate `audio-*` bundles (muted players skip the
   download) vs merged into existing route bundles (simpler, wastes bandwidth)?
   Lean: separate, loaded lazily only after `unlock()` + `enabled`.
6. **Placeholder policy** — manifest entries with `missing:'silent'` vs pointing
   at a shared `silence.ogg`/`soft-tick.ogg`? (Silent is cheaper; a soft tick
   makes every wired site audibly verifiable during QA.)
7. **Volume defaults** — keep `masterVolume 0.7`? Channel defaults (music
   ~0.5, sfx ~0.8, ui ~0.7) need a design call.
8. **Combat density** — manual mode fires few events; auto mode fires dozens/s.
   Current 60 ms per-id gap is synth-tuned — for real samples, want per-cue
   cooldown + variant pools; confirm we cap `combat.hit`-class cues harder
   (e.g. 80 ms + 3-variant round-robin).
9. **Hộ Thể absorb + reflect emits** — okay to add new domain presentation
   events (listed in §3), or must the audio system consume the scheduler trace
   directly? (Emitting events is the established pattern; trace-draining works
   too — the drain at `GameManagerTurnBattleOps.ts:660-694` is the template.)
10. **Music on Vue-only routes** — should `music.menu` start on boot before any
    gesture? Autoplay policy blocks it until first pointerdown anyway (the
    `unlock()` path exists); acceptable that boot is silent until first click?

---

## Appendix — naming/migration notes

- `SoundId` union → manifest key strings; migrate existing ids verbatim into
  `AUDIO_CUES` so current call sites keep working while the manifest grows.
- Keep camelCase ids (`combatHit`) as aliases during migration, or do a single
  sweep renaming to dot-notation — decision belongs to the implementing mission.
- `MIN_GAP_MS` stays the default `cooldownMs`; per-cue overrides live in the
  manifest.
- `stores/audio.ts` `unlock()` already pushes enabled+volume into the manager —
  extend it to push per-channel gains too.
