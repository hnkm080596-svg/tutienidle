# Audio Cue ⇔ Emit Coverage Matrix

Branch: `devin/1791567361-ornate-dialog-art` · 2026-10-10
Scope: `AUDIO_CUES` rows (226 total) × emit sites across the codebase.

## Emit→cue mechanism (verified)

| Pipe | How a cue id is reached |
|---|---|
| `bindCombatAudio` (STATIC_CUES ×17, PAYLOAD_CUES ×18, farm_cycle) | `GameManager.eventBus` emits → `playCue(cueId)` |
| `bindUiAudio` | `uiStore.$subscribe` diff → `ui.panel.*`, `ui.wheel.open/close` |
| `bindAmbientAudio` ROUTE_MUSIC | route commit → `crossfadeMusic('music.*')` |
| Direct `useAudioStore().cue(id)` / `playCue(id)` | Vue components, `worldAnnouncement.show(cueId)` |
| `resolveAudioCue` | exact → strip trailing qualifier → family anchor (combat.cast / combat.impact / combat.reaction / combat.kiem.combo / music.home) |

## Status legend

- **BOUND** — a real emit (bus event, store transition, route, or direct call) reaches the row.
- **ARMED-RESERVED** — row exists for a producer that does not emit yet (manifest-marked or forward-slot).
- **DEAD** — row's producer does not exist / can never fire.

---

## BOUND — 203 rows

### UI direct calls (all `ui.*` rows bound)

| Cue | Producer |
|---|---|
| `ui.click` | `GameButton.vue:46` |
| `ui.tab` | `Chip.vue:37` |
| `ui.toast.{loot,craft,upgrade,save,warning,error}` | `ToastContainer.vue` KIND_SOUND × all 6 `NotificationKind`s |
| `ui.confirm` | ConfirmModal, GuestAbandonDialog, OfflineSummaryModal, BetaCompletionModal, CombatExitConfirmModal |
| `ui.cancel` | ConfirmModal, GuestAbandonDialog, LoreCodexModal, CombatExitConfirmModal, AlchemySurface |
| `ui.modal.open` | ConfirmModal, CombatExitConfirmModal |
| `ui.modal.close` | ConfirmModal, LoreCodexModal, CombatExitConfirmModal, OfflineSummaryModal, BetaCompletionModal |
| `ui.panel.open/close` | `uiAudioBinding` (leftPanel/standalone/overlay signature) |
| `ui.wheel.open/close` | `uiAudioBinding` |
| `ui.wheel.select` | `DongFuStage.vue` ×2 |
| `ui.purchase` | `VendorPanel.vue:134` |
| `ui.equip` | `EquipmentPaperdoll.vue:242` |
| `ui.error` | useTurnCombatManual, ExplorationSurface, AlchemySurface, QuanKhiPanel, CharacterCreationScreen |

### Combat — event-bus bound

| Cue | Emit |
|---|---|
| `combat.cast` | `attack` (TurnBattleSystem:2425) — see double-voice finding F1 |
| `combat.cast.<id>` ×50 | `turn_cast_start {skillId}` (TurnActionPresentationEvents:39). All ids are real skill/basic ids in `src/data/skill/*` — except `tam_muoi_potency` (see DEAD) |
| `combat.hit` | `hit` when targetId ≠ player (CombatSystem) |
| `combat.crit` | `critical` |
| `combat.dodge` / `combat.block` / `combat.death` | same-name emits (CombatSystem) |
| `combat.hurt` | `damage` when targetId = player (covers DoT ticks) |
| `combat.survive_lethal` | `talent_survive_lethal` |
| `combat.heal` | `heal` (EntityVitalsSystem:143) |
| `combat.turn_ready` | `turn_ready` |
| `combat.impact` | `action_impact` fallback / unqualified |
| `combat.impact.<p>` ×27 bound | `action_impact {presetId}` — presets assigned in skill defs / Companions / enemy `attackPresetId`+`specialAttacks` / stage rosters: slash, claw, bite, arcane_impact, fire_burst, water_surge, earth_shockwave, metal_slash, wood_spikes, wind_blade, holy_radiance, kiem_orb_dam, kiem_orb_chem, ngu_kiem_flight, hoa_cau_comet, thuy_tien_dart, doc_chuong_palm, diem_kim_point, tho_cau_boulder, tram_slash, linh_bao_burst, huy_quyen_strike, tam_muoi_aura, bite_multi, ram, stomp, slash_multi |
| `combat.buff.apply` / `.debuff.apply` / `.dot.apply` | `status_vfx_attached` (polarity / periodicDamage split) |
| `combat.buff.expire` | `status_vfx_removed` |
| `combat.reaction` + `.<id>` ×10 | `reaction_resolved {reactionId}` (GameManagerTurnBattleOps:851); all 10 reaction ids |
| `combat.loot` / `combat.essence` | `reward_particle {kind}` |
| `combat.boss.slam` | `action_impact presetId='boss_ground_slam'` (Companions:155, FoundationEnemies:317) |
| `combat.kiem.combo` + `.<id>` ×37 | `action_impact presetId='kiem_combo_<id>'` — KiemPhoCombos:57 builds `presetId: \`kiem_combo_${id}\`` for all 37 combos |
| `combat.thetu.reflect` | `proc_reflect` |
| `combat.ungthe` / `.intercept` / `.counter` | `reactive_proc {success, mechanic}` (TurnBattleSystem:3484) |
| `combat.phaptu.proc` | `proc_on_hit` |
| `combat.hothe.absorb` | `hothe_absorb` |
| `combat.ward` / `.grant` / `.break` | `entity_vitals_changed` (wardBefore/After + reason filter) |
| `combat.exit` | `combat_scene_exit` (useBattleActions:111) |
| `combat.start` | `presentation_session_started kind='combat'` |
| `combat.victory` / `combat.defeat` | `battle_end {state}` |
| `combat.select` | `TurnCombatSkillBar.vue` ×2 |

### Progression / tribulation / craft / stingers

| Cue | Producer |
|---|---|
| `progress.path_choose` | QuanKhiPanel ×2 |
| `progress.breakthrough` | `useBreakthrough` → `worldAnnouncement.show(cueId)` |
| `progress.talent_pick` | TalentEntitlementModal |
| `progress.reroll` / `progress.create` | CharacterCreationScreen |
| `progress.perfect` | `perfect_clear` |
| `progress.hidden_open` | `hidden_window_opened` |
| `tribulation.begin` | `tribulation_started` |
| `tribulation.thunder` | `tribulation_lightning` |
| `tribulation.chapter` | `tribulation_chapter_changed` |
| `tribulation.answer.ok` / `.fail` | `mind_question_result {correct}` |
| `tribulation.victory` / `.fail` | `tribulation_outcome` AND `worldAnnouncement.show` — see F2 |
| `craft.start` | AlchemySurface:387 |
| `farm.arm` / `farm.stop` | ExplorationSurface |
| `farm.cycle` | `farm_cycle` emit, route-gated to 'home' |
| `stinger.announce` | `worldAnnouncement.show` default + BetaCompletionModal |
| `stinger.offline` | OfflineSummaryModal |
| `ambient.cultivate.on` / `.off` | `cultivation_changed {isCultivating}` (useBattleActions) |
| `music.menu` | ROUTE_MUSIC: boot/auth/character/error |
| `music.home` | ROUTE_MUSIC: home |
| `music.combat` / `music.tribulation` | ROUTE_MUSIC |

## ARMED-RESERVED — 21 rows

### Manifest-marked (14)

| Cue | Waited-on emit |
|---|---|
| `combat.spawn`, `.elite`, `.boss` | spawn rides `pendingEnemySpawns` inside `turn_battle_entity_snapshot`; no cue hook (manifest comment) |
| `combat.buff.stack` | `status_vfx_updated` emits (TurnStatusPresentationEvents) but binding doesn't consume — design defer per comment |
| `combat.charge`, `combat.release` | charge init/release have no emit (TurnBattleSystem silent) |
| `combat.countdown.tick` | `countdownProgress` is a snapshot field, no tick emit (spec P2) |
| `combat.turn_end` | 'turn_end' is a **proc trigger name** (SkillDefinitionRegistry:202), not a bus event — weakest row: no producer can exist without new plumbing |
| `progress.quan_the` | no producer passes this id; QuanKhiPanel uses `progress.path_choose` |
| `music.home.{morning,noon,evening,night}` | ROUTE_MUSIC emits bare `music.home` only; needs time-of-day driver |
| `combat.kill` | `kill` **is** emitted (CombatSystem ×5, fires with `death`) but binding maps it to `undefined` — deliberate; kept for a distinct kill-confirm asset |

### Unmarked forward slots (7) — qualifier is legal but never produced

| Cue | Why silent |
|---|---|
| `combat.impact.lightning_strike` | union member; element route deleted ("wind/lightning da xoa cung element"); no `presetId` assignment |
| `combat.impact.shadow_burst` | reachable only via `element:'primordial'` — exists only as `damageType`, never as skill element; no assignment |
| `combat.impact.ram_multi` | in union + VFX sheet registry only — no enemy/skill/stage assigns it |
| `combat.impact.stomp_multi` | same |
| `combat.impact.slash_vertical` | same |
| `combat.impact.slash_horizontal` | same |
| `combat.kiem.tu_luc` | union member, never assigned (manifest footer acknowledges forward slot) |

## DEAD — 2 rows

| Cue | Why dead |
|---|---|
| `progress.node_unlock` | **No producer, no marker.** No event named node_unlock/* is emitted; no `cue('progress.node_unlock')` call anywhere. Unmarked gap. |
| `combat.cast.tam_muoi_potency` | `tam_muoi_potency` is a **modifier id** inside PhapTuSkills `add_modifier` (channel 'potency'), not a skillId — can never appear on `turn_cast_start`. The completeness test's `id:` regex counts it as a skill id, so the row validates by accident. |

---

## Unmapped events (emitted, no cue reaches)

| Event | Emit site | Note |
|---|---|---|
| `kill` | CombatSystem ×5 | deliberately silenced in PAYLOAD_CUES (would double-fire with `death`) — the armed row awaits a distinct asset |
| `essence_stream_arrival` | CombatScene:1866,1879 | deliberately silenced (progress signal, not a sound trigger) |
| `reaction_skipped` | GameManagerTurnBattleOps:861 | **no binding row at all** — skipped reactions stay silent; probably intentional but undocumented in manifest |
| `skill_presentation_cast` / `skill_presentation_resolved` | CombatAnimationRuntime:317,410 | VFX-facing protocol events; no cue |
| `turn_standby_complete` | TurnActionPresentationEvents:89 | presentation event; no cue |
| `turn_battle_entity_snapshot` | TurnActionPresentationEvents:201 | carries `pendingEnemySpawns` + `countdownProgress` — the future data source for the armed spawn/tick rows |
| `status_vfx_updated` | TurnStatusPresentationEvents | named emit for armed `combat.buff.stack` |
| `combat_exit_request` | CombatTopBar:61, CombatScene:2017 | drives exit-confirm modal; the modal voices `ui.modal.open` itself |

## Findings / gaps

**F1 — double-voice on every turn cast.** A committed cast emits `turn_cast_start` (declare) → `combat.cast.<skillId>` **and** `attack` (commit, TurnBattleSystem:2425) → `combat.cast`. Two different cue ids ⇒ both play (cooldown is per-id). The `attack→combat.cast` static row double-voices every qualified cast — either intentional layering or a missed dedupe; worth a design ruling.

**F2 — `tribulation.victory`/`tribulation.fail` fired twice.** `tribulation_outcome` (TribulationDirector) AND `useTribulation.presentOutcome` → `worldAnnouncement.show('tribulation.victory'|'.fail')` play the same cue the same tick. The 60ms MIN_GAP dedupes it, but the second `playCue` is redundant. (Contrast: `progress.breakthrough` has no event — only the show() call voices it.)

**G1 — no test asserts a row has a producer.** `audioManifestCompleteness` checks spec-doc→manifest direction, catalog sync, and bundle coverage only. `AudioCueManifest.test.ts` checks shape. Nothing catches a DEAD row — `progress.node_unlock` and the 7 unassigned-preset rows all pass today.

**G2 — cast-id check is one-directional AND over-collects.** Rows ⊆ `id:` fields is verified, but (a) new castable skills get no expanded row (silent via anchor), and (b) the `id:` regex counts modifier ids (`tam_muoi_potency`) as skills — dead rows can validate.

**G3 — `ui.toast.*` has no family anchor.** `resolveAudioCue('ui.toast.<new>')` → undefined → silent. Nothing pins `KIND_SOUND`'s values to manifest rows; a new `NotificationKind` or a typo'd cue id fails silently (today's 6 kinds are all covered).

**G4 — reverse direction untested.** Events with no cue (`reaction_skipped`, `skill_presentation_*`, `turn_battle_entity_snapshot`, `turn_standby_complete`, `combat_exit_request`) are invisible to every guard.

**G5 — channel sanity is convention-only.** Channels are valid (test pins `AUDIO_CHANNELS` membership), but nothing checks semantic fit. Current assignments look right: `combat.countdown.tick`/`combat.select`/`tribulation.answer.*`/`farm.arm|stop` on `ui` (gesture/UI beats), `ambient.cultivate.*` on `sfx` as one-shot stingers with duck (comment: "not looped music"), all `music.*` loop on `music` with no synthFallback (OQ-A holds).

**Music coverage.** Emit sites = `ambientAudioDriver` only: `music.menu` (boot/auth/character/error), `music.home`, `music.combat`, `music.tribulation`. `music.home.*` time variants armed (no time-of-day driver). No other `playMusic`/`crossfadeMusic` call sites exist.

**SettingsAudioSection** has no cue emit (volume/toggle UI only) — correct.
