# Sound coverage audit — COMBAT + LOOT (tutienidle, branch devin/1791567361-ornate-dialog-art)

Scope: every place in the battle/loot pipeline where a sound should play.
Columns: moment | file:line | current sound | gap | suggested cue.

Legend for "current sound":
- **AUDIBLE** = cue emits AND the manifest row has a synthFallback → real sound today.
- **BOUND-SILENT** = cue emits, but its manifest row has `src:''` and no synthFallback → resolves, plays nothing.
- **SILENT** = no cue emits at all (no binding row, or no emit exists).
- All expanded qualifier rows (`combat.cast.*`, `combat.impact.*`, `combat.reaction.*`, `combat.kiem.combo.*`, `music.home.*`) have `src:''` + no synthFallback → they are armed-reserved: resolve to a real row, play nothing until assets drop.

---

## A. Battle lifecycle (intro → countdown → spawn → fighting → victory/defeat → exit)

| # | Moment | file:line | Current sound | Gap | Suggested cue |
|---|--------|-----------|---------------|-----|---------------|
| A1 | Combat session starts | GameManagerTurnBattleOps.ts:2286 & :2606 → `presentation_session_started{kind:'combat'}` → binding PAYLOAD → `combat.start` | **AUDIBLE** (battleStart, duck 0.3) | — | — |
| A2 | Intro phase (curtain before countdown) | TurnBattleSystem.ts:1177 `tickIntro`; stepped at GameManagerTurnBattleOps.ts:668-673 | **SILENT** — no emit; arguably covered by A1 | Dedicated intro cue missing entirely | `combat.start` already fires; a distinct `combat.intro` would be a new row |
| A3 | Countdown 3-2-1 ticks | TurnBattleSystem.ts:1201 `tickCountdown`; `countdownProgress` rides the entity snapshot (TurnActionPresentationEvents.ts:188-191) | **SILENT** — no per-tick emit | **armed-reserved fits**: `combat.countdown.tick` (manifest:323, marked P2 "no tick emit exists") | `combat.countdown.tick` — needs a tick emit (or snapshot-diff hook) |
| A4 | Enemy spawn telegraph appears | pendingEnemySpawns pushed at TurnBattleSystem.ts:1282; consumed via snapshot by combat-vfx-spawner.ts:446 `reconcileSpawnVfx` | **SILENT** — snapshot-reconciled, no emit | **armed-reserved fits**: `combat.spawn` / `.elite` / `.boss` (manifest:288-290, documented "no cue hook yet") | `combat.spawn.*` — needs emit on telegraph start |
| A5 | Enemy materializes (pending→enemies) | TurnBattleSystem.ts:1249-1250; scene side `markMaterializing` at combat-vfx-spawner.ts:486 | **SILENT** — no emit | Same armed rows; boss materialize is the biggest unvoiced beat | `combat.spawn.boss` (has duck 0.4) / `.elite` / base |
| A6 | New wave queued (batch telegraph) | TurnBattleSystem.ts:1260-1287 `shouldStartNextWave` branch | **SILENT** | Same armed rows | `combat.spawn` |
| A7 | Victory | GameManagerBattleRewardOps.ts:57 `battle_end{state:'victory'}` → `combat.victory` | **AUDIBLE** (battleVictory, duck 0.7) | — | — |
| A8 | Defeat | same site, `state:'defeat'` → `combat.defeat` | **AUDIBLE** (battleDefeat, duck 0.7) | — | — |
| A9 | Abandon/exit combat | useBattleActions.ts:111 `combat_scene_exit` → STATIC → `combat.exit` | **AUDIBLE** (uiCancel) | — | — |
| A10 | Exit-confirm modal opens | CombatTopBar.vue:61 & CombatScene.ts:2017 `combat_exit_request` → **unbound** | **SILENT** on the event itself | Indirectly covered: CombatExitConfirmModal.vue:77 plays `ui.modal.open` | none needed (modal cue covers) |
| A11 | Combat music bed | ambientAudioDriver.ts:37 ROUTE_MUSIC `combat→music.combat` — routed | **BOUND-SILENT** (music rows never get fallback; src:'') | Expected armed-reserved until audio assets land | `music.combat` row exists |

## B. Turn flow & skill cast

| # | Moment | file:line | Current sound | Gap | Suggested cue |
|---|--------|-----------|---------------|-----|---------------|
| B1 | Actor's turn ready (flourish) | CombatAnimationRuntime.ts:487 & :518 `emitTurnReady` → `turn_ready` → STATIC → `combat.turn_ready` | **AUDIBLE** (uiConfirm) | — | — |
| B2 | Manual-mode pause (AWAITING_INPUT, skill bar offered) | GameManagerTurnBattleOps.ts:708-712; snapshot emit only | **SILENT** per se | Covered by B1 (turn_ready fires for manual actors too) | `combat.turn_ready` |
| B3 | Skill cast declared | CombatAnimationRuntime.ts:293 `emitTurnCastStart` → `turn_cast_start{skillId}` → PAYLOAD → `combat.cast.<skillId>` | **BOUND-SILENT for all 51 known skill ids** (expanded rows have no fallback). **AUDIBLE only when skillId empty/unknown** (resolves `combat.cast` → combatAttack) | **Inverted coverage**: real named casts are silent; CC-blocked / DoT-dead / sealed-NULL turns carry `skillId:''` (TurnBattleSystem.ts:1693, :2052) → bare `combat.cast` whoosh on turns where nothing happens | Fill per-skill rows on asset drop; gate empty-skillId emits (binding or producer) so blocked/dead turns don't whoosh |
| B4 | Action commits (the "swing") | TurnBattleSystem.ts:2425 `attack` emit → STATIC → `combat.cast` | **AUDIBLE** (combatAttack). Skipped when `castBlocked` (:2424) | Same event family as B3 → two emit sites voicing "cast" (see notes) | — |
| B5 | Impact frame (VFX lands) | CombatAnimationRuntime.ts:354 `emitTurnActionImpact` → `action_impact{presetId}` → `cueForActionImpact` | Preset-routed: known presets → `combat.impact.<preset>` **BOUND-SILENT**; `kiem_combo_*` → `combat.kiem.combo.<id>` **BOUND-SILENT**; `tu_luc` → `combat.kiem.tu_luc` **BOUND-SILENT**; `boss_ground_slam` → `combat.boss.slam` **AUDIBLE** (combatCritical, duck 0.5); missing/unknown preset → `combat.impact` **AUDIBLE** (combatHit) | 36 known impact presets + 37 kiem combos silent until assets | expanded rows armed — fill on asset drop |
| B6 | Extra combo impacts (kiem provider) | CombatAnimationRuntime.ts:381-407 — each emits own `action_impact` | Same routing as B5 → **BOUND-SILENT** | same | same |
| B7 | Cast VFX actually plays on screen | CombatAnimationRuntime.ts:317 `skill_presentation_cast` (publishPendingCast) → **unbound** | **SILENT** | Timing divergence: cast audio uses declare-time `turn_cast_start` (B3), the scene's real cast beat is `skill_presentation_cast` (impact-time). Audio leads visuals by the ready→impact ack gap | Optionally bind `combat.cast.*` to `skill_presentation_cast` for audio/visual sync |
| B8 | Cast resolution sealed | CombatAnimationRuntime.ts:410 `skill_presentation_resolved` → **unbound** | **SILENT** | bookkeeping event; reasonable to stay silent | none |
| B9 | Turn tail (standby complete) | CombatAnimationRuntime.ts:443 `emitTurnStandbyComplete` → **unbound** | **SILENT** | No manifest row exists — cue missing entirely | none (low value) or a soft tick row |
| B10 | Manual skill pick accepted | TurnCombatSkillBar.vue:154 & :161 → `combat.select` direct cue | **AUDIBLE** (uiClick) | — | — |
| B11 | Manual pick rejected (cooldown/illegal) | useTurnCombatManual.ts:87 & :116 → `ui.error` | **AUDIBLE** (toastError) | — | — |

## C. Hit resolution & vitals (CombatSystem emits)

| # | Moment | file:line | Current sound | Gap | Suggested cue |
|---|--------|-----------|---------------|-----|---------------|
| C1 | Dodge/miss | CombatSystem.ts:377 `dodge` → `combat.dodge` | **AUDIBLE** | — | — |
| C2 | Critical hit | CombatSystem.ts:455 `critical` → `combat.crit` | **AUDIBLE** (duck 0.3) | — | — |
| C3 | Block | CombatSystem.ts:465 `block` → `combat.block` | **AUDIBLE** | — | — |
| C4 | Hit lands on non-player | CombatSystem.ts:474 `hit` → PAYLOAD → `combat.hit` (targetId ≠ player) | **AUDIBLE** | — | — |
| C5 | Damage packet (incl. DoT) | CombatSystem.ts:554 & :653 `damage` → PAYLOAD → `combat.hurt` (player target only; enemies silent by design) | **AUDIBLE** on player | — | — |
| C6 | Heal (incl. heal-on-kill via BattleLootSystem.ts:269→applyHealing) | EntityVitalsSystem.ts:143 `heal` → STATIC → `combat.heal` | **AUDIBLE** (toastSave) | — | — |
| C7 | Entity death (player OR enemy) | CombatSystem.ts:790 `death` → `combat.death` | **AUDIBLE** (combatKill) | Player death shares the generic kill sound | `combat.defeat` follows via A8; a distinct player-death cue would need a new row |
| C8 | Kill confirm | CombatSystem.ts:798 `kill` → binding returns **undefined** (deliberate, documented) | **SILENT** | **armed-reserved fits**: `combat.kill` (manifest:278 "armed for a distinct kill-confirm asset") | `combat.kill` — rebind when asset lands |
| C9 | Survive lethal (talent save) | CombatSystem.ts:762 `talent_survive_lethal` → `combat.survive_lethal` | **AUDIBLE** (combatBlock, duck 0.4) | — | — |
| C10 | Ward granted | EntityVitalsSystem.ts:225 `entity_vitals_changed{reason:'ward_grant', after>before}` → `combat.ward.grant` | **AUDIBLE** (toastSave) | — | — |
| C11 | Ward break (→0 under damage reason) | same emit, damage-family reason + before>0,after=0 → `combat.ward.break` | **AUDIBLE** (combatBlock) | — | — |
| C12 | Ward partially absorbs (decline, not break) | same emit, damage reason + after<before → `combat.ward` | **BOUND-SILENT** (manifest:318 no fallback) | Row exists, plays nothing until asset | `combat.ward` — fill or give fallback |
| C13 | Ho The absorbs a hit | CombatSystem.ts:445 `hothe_absorb` → `combat.hothe.absorb` | **AUDIBLE** (combatBlock) | — | — |
| C14 | Regen / stat_refresh / ward_spend vitals | EntityVitalsSystem.ts:225 → binding returns **undefined** for non-damage reasons | **SILENT** | Deliberate bookkeeping silence | none |

## D. Charge mechanic (The→Tram channeling)

| # | Moment | file:line | Current sound | Gap | Suggested cue |
|---|--------|-----------|---------------|-----|---------------|
| D1 | Charge INIT (chargingTurnsRemaining set) | TurnBattleSystem.ts:1959-1967 | **BOUND-SILENT** — emits `turn_cast_start{skillId}` like any cast → `combat.cast.<id>` (silent for known ids). Manifest:306 comment "no emit exists for either" is **stale** — generic coverage exists | No dedicated charge-start emit | `combat.charge` (armed) — needs dedicated emit if a distinct sound is wanted |
| D2 | Each mid-charge tick | TurnBattleSystem.ts:1539-1595 → declare each tick → `turn_cast_start{pendingChargedSkillId}` | **BOUND-SILENT** today; **would replay the cast cue every channel tick** if fallback were added | Per-tick cast-cue repeat is arguably wrong — a channel wants a sustained/charging sound, not re-triggered cast | `combat.charge` armed; consider suppressing `combat.cast.*` on `isCharging` ticks when a dedicated emit lands |
| D3 | Charge resolve/release (hits land) | TurnBattleSystem.ts:2176+ | **Generic coverage**: `turn_cast_start` + `attack` + `action_impact` + per-target hit/damage emits | No dedicated release emit | `combat.release` (armed, duck 0.3) for a distinct release stinger |

## E. Status effects (buffs / debuffs / DoT)

| # | Moment | file:line | Current sound | Gap | Suggested cue |
|---|--------|-----------|---------------|-----|---------------|
| E1 | Buff attached | TurnStatusPresentationEvents.ts:102 `status_vfx_attached{polarity:'buff'}` → `combat.buff.apply` | **AUDIBLE** (toastSave) | — | — |
| E2 | Debuff attached | same emit `{polarity:'debuff'}` → `combat.debuff.apply` | **AUDIBLE** (toastWarning) | — | — |
| E3 | DoT attached | same emit `{periodicDamage:true}` → `combat.dot.apply` | **AUDIBLE** (toastWarning) | — | — |
| E4 | Stack/refresh change | TurnStatusPresentationEvents.ts:120 `status_vfx_updated` → **unbound** | **SILENT** | **armed-reserved fits**: `combat.buff.stack` (manifest:299 — documented "audio binding does not consume it; deferred to asset time"). Emit EXISTS — wireable today | `combat.buff.stack` — needs a binding row |
| E5 | Status expires / target dies | TurnStatusPresentationEvents.ts:139 `status_vfx_removed` → STATIC → `combat.buff.expire` | **BOUND-SILENT** (manifest:294 no fallback) | Bound but silent until asset | `combat.buff.expire` — fill or give fallback |

## F. Procs & reactions

| # | Moment | file:line | Current sound | Gap | Suggested cue |
|---|--------|-----------|---------------|-----|---------------|
| F1 | Ung The reactive — generic | TurnBattleSystem.ts:3484 `reactive_proc{success:true}` → `combat.ungthe` | **AUDIBLE** (combatAttack) | — | — |
| F2 | Ung The — intercept | same emit `{mechanic:'intercept'}` → `combat.ungthe.intercept` | **AUDIBLE** (combatDodge) | — | — |
| F3 | Ung The — counter | same emit `{mechanic:'counter'}` → `combat.ungthe.counter` | **AUDIBLE** (combatHit) | — | — |
| F4 | Failed reactive roll | `reactive_proc{success:false}` → binding returns undefined | **SILENT** | Deliberate per spec | — |
| F5 | The Tu reflect proc | GameManagerTurnBattleOps.ts:888 `proc_reflect` (drained from scheduler trace) → `combat.thetu.reflect` | **AUDIBLE** (combatBlock) | — | — |
| F6 | Phap Tu on-hit proc | GameManagerTurnBattleOps.ts:895 `proc_on_hit` → `combat.phaptu.proc` | **BOUND-SILENT** (manifest:316 no fallback) | Bound but silent until asset | `combat.phaptu.proc` — fill or give fallback |
| F7 | Elemental reaction resolves (sinh/khac) | GameManagerTurnBattleOps.ts:851 `reaction_resolved{reactionId}` → `combat.reaction.<id>` | **BOUND-SILENT for all 10 known reactions** (expanded rows no fallback); unknown id → `combat.reaction` **AUDIBLE** (combatCritical, duck 0.4) | All named reactions silent until assets | expanded rows armed — fill on asset drop |
| F8 | Reaction skipped (window consumed w/o payoff) | GameManagerTurnBattleOps.ts:861 `reaction_skipped` → **unbound** | **SILENT** | No manifest row; a skip makes no noise — arguably intended | none (or a muted fizzle row — design call) |

## G. Loot pipeline (drops → particles → toasts → rewards)

| # | Moment | file:line | Current sound | Gap | Suggested cue |
|---|--------|-----------|---------------|-----|---------------|
| G1 | Spirit stone gain | BattleLootSystem.ts:375 `emitRewardParticle('currency')` → `reward_particle{kind:'currency'}` → `combat.loot` | **AUDIBLE** (toastLoot) + toast also plays `ui.toast.loot` (G7) → **double-voice per drop** | One drop = two layered chimes (particle + toast). Possibly intended layering; flagging as awareness | — |
| G2 | Material drop | BattleLootSystem.ts:653 `emitRewardParticle('item')` → `combat.loot` + `ui.toast.loot` toast | **AUDIBLE** ×2 (same double-voice) | same | — |
| G3 | Physique-essence material drop | BattleLootSystem.ts:651 `emitRewardParticle('essence')` → `combat.essence` | **AUDIBLE** (toastCraft) + `ui.toast.loot` toast → double | same | — |
| G4 | Equipment drop | BattleLootSystem.ts:576 `emitRewardParticle('item')` → `combat.loot` + toast | **AUDIBLE** ×2 | same | — |
| G5 | Pill drop | BattleLootSystem.ts:694 `emitRewardParticle('item')` → `combat.loot` + toast | **AUDIBLE** ×2 | same | — |
| G6 | Technique-mastery insight flush | BattleLootSystem.ts:220 `emitRewardParticle('insight')` → kind ≠ 'essence' → `combat.loot` | **AUDIBLE** (toastLoot) | `insight` shares the generic loot chime; a distinct cue would need a new row | optionally `combat.insight` (new row) |
| G7 | Loot toast becomes visible | ToastContainer.vue:19-36 — watch fires `ui.toast.<kind>` per toast kind (loot/craft/upgrade/save/warning/error) | **AUDIBLE** | — | — |
| G8 | Essence mote lands on player (stream end) | CombatScene.ts:1866 & :1879 `essence_stream_arrival` → binding returns **undefined** (deliberate, documented) | **SILENT** | By design: drop already chimed via G3 | none |
| G9 | Bag overflow ("Túi đầy") | BattleLootSystem.ts:735-743 warning notification → `ui.toast.warning` | **AUDIBLE** | — | — |
| G10 | Auto-dissolve batch (equipment→Tinh Hoa) | BattleLootSystem.ts:812 loot notification → `ui.toast.loot` | **AUDIBLE** | — | — |
| G11 | Hidden-beast window opens | BattleLootSystem.ts:489 `hidden_window_opened` → STATIC → `progress.hidden_open` | **AUDIBLE** (toastWarning, duck 0.5) | — | — |
| G12 | Perfect clear | GameManagerBattleRewardOps.ts:244 `perfect_clear` → `progress.perfect` | **AUDIBLE** (toastUpgrade, duck 0.5) | — | — |

## H. Dead-wired & bound-but-silent inventory

**H1 — Cue rows with no producer (emit doesn't exist). All are documented armed-reserved in the manifest — none are accidental:**
| Cue | Manifest | Status |
|-----|----------|--------|
| `combat.spawn` / `.elite` / `.boss` | :288-290 | no spawn emit — snapshot-only (A4-A6); documented |
| `combat.charge` / `combat.release` | :306-307 | no dedicated emit — generic cast/impact cues DO cover the moments (stale "silent" comment) |
| `combat.countdown.tick` | :323 | no tick emit — snapshot field only; documented P2 |
| `combat.turn_end` | :326 | no `turn_end` emit anywhere — documented ("skill-trigger name, not an event") |
| `combat.buff.stack` | :299 | `status_vfx_updated` emit EXISTS (E4) — only the binding is missing → wireable today |
| `combat.kill` | :278 | `kill` emit exists (C8) — binding deliberately returns undefined; forward slot |
| `progress.quan_the` | :344 | no producer — documented |

**H2 — Bound rows that play nothing today (no synthFallback, src:''):**
- `combat.buff.expire` (E5), `combat.ward` (C12), `combat.phaptu.proc` (F6), `combat.kiem.tu_luc` (B5), `ambient.cultivate.on/off` (bound via `cultivation_changed`, out of combat scope), `farm.cycle` (bound, out of scope), plus ALL expanded qualifier rows: `combat.cast.*` (B3), `combat.impact.*` (B5), `combat.reaction.*` (F7), `combat.kiem.combo.*` (B5/B6), `music.home.*`.

**H3 — Emits that are deliberately silenced in the binding (documented, correct):**
- `kill` → undefined (C8), `essence_stream_arrival` → undefined (G8), `damage` → undefined for enemy targets (C5), `hit` → undefined for player targets, `entity_vitals_changed` → undefined for regen/stat_refresh/sacrifice/ward_spend (C14).

**H4 — Notable design quirks found:**
1. **Inverted cast coverage (B3)**: `combat.cast.<skillId>` expanded rows are silent, so a *named* skill cast makes no declare-time sound — but a turn with `skillId:''` (CC-blocked, actor died to DoT, sealed NULL_ACTION) resolves to the bare `combat.cast` row and **plays the whoosh on a turn where nothing happened**. Two emit sites also both voice "cast": `turn_cast_start` (declare) + `attack` (impact-time).
2. **Cast audio/visual divergence (B7)**: `turn_cast_start` fires at declare; the scene's cast beat is `skill_presentation_cast` at impact. If the design wants the cast sound on the visual cast, bind `combat.cast.*` to `skill_presentation_cast`.
3. **Double-voice loot (G1-G5)**: every drop plays `combat.loot`/`combat.essence` at grant AND `ui.toast.loot` when the toast renders — layered by design but worth knowing before mixing gains.
4. **Charge ticks re-emit cast (D2)**: `turn_cast_start` fires per charge tick with `pendingChargedSkillId` — today silent; if per-skill rows get fallbacks the channel re-triggers the cast sound each tick.
