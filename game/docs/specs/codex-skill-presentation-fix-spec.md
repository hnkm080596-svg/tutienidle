# codex/skill-presentation-runtime — conformance audit + fix plan (v2, plan-gate amended)

Scope: delta `fee85ba0` vs parent `48962aaa` only (the Ngự Kiếm chain below is QA-closed separately).
Design authority: `game/docs/design/skill-presentation-runtime-design.txt` (tip `b0b78088`).
Plan discipline: this document is audit + plan only; no production edits were made.
Revision: v2 incorporates plan-gate verdict — validator-phase-bound fix in W1, mandatory `shape` field on new cues, `getCombatVfxPreset`/`spawnActionImpactVfx` deadness, `freezeCombat('tab-hidden')` correction, resolved OQ2c/OQ4/OQ6, comment-hygiene nits (CombatScene.ts:46 import, GameManager.ts:1285, GameManagerTurnBattlePresentationOps.ts:166), 11-preset screenShake count, and scoped-down impulse claim.

Verification evidence (this worktree, node@22, `game/`):
- `npm run type-check` → exit 0.
- `npx vitest run src/presentation/skills src/game/support/skill-vfx src/data/vfx src/game/scenes/CombatScene.skillPresentation.test.ts src/game/scenes/CombatScene.actionPlayback.test.ts src/core/game/GameManagerTurnBattleOps.presentationReceipt.test.ts src/core/battle/turn/TurnBattleSystem.skillPlan.test.ts src/core/battle/turn/TurnBattleSystem.hoIntercept.test.ts` → 11 files / 83 tests, all pass.

The delta is internally consistent and well-tested; the defects below are wiring/design-conformance gaps, not runtime bugs.

---

## 1. AUDIT — design vs code, per surface

Classification: **real gap** (violates a design contract or silently drops shipped behavior) / **intentional** (sanctioned by design text or a documented migration trade-off) / **nit** (cosmetic/lying-comment/incomplete-scope polish).

### 1.1 Facts emission (`SkillPresentationFacts.ts`, `TurnBattleSystem.applyActionImpact*`, `PlanPresentationCollector`)

Verdict: **conformant.**

- `skill_presentation_cast` emitted at declare on both paths — auto flow `CombatAnimationRuntime.ts:249`, manual `submitTurnChoice` `:404` — before any ACK; payload `freezePresentation`-deep-frozen.
- `skill_presentation_resolved` emitted inside `acknowledgeActionImpact` at `:338`, after `stepCompletionSink.onImpact()` — sealed single batch, no second resolver call (collector piggybacks `onOperationWillSettle`/`onOperationSettled`/`onPlanCompleted` in `TurnSkillPlanRuntime.ts`), matching design §4.
- `PlaybackRef = {sessionId, requestId, token}`; `requestId` minted once (`skill-request-N`), survives resume (`preparePresentationResume` re-freezes with rotated token, same requestId) — design §4/§5 satisfied.
- Group sealing (`groupId = ${requestId}:group:${index}`, outcome ordinals, role primary/composite/combo, `reason` on synthesized primary) conformant; provenance pinned by `TurnBattleSystem.skillPlan.test.ts` / `hoIntercept.test.ts` additions.
- Watch item (not a gap): when a `routed` primary group already exists, outcomes accumulated in the shared legacy `outcomes` array are silently skipped (`TurnBattleSystem.ts` unshift guarded on no-'primary'-role). Reachability analysis: legacy lanes are guarded on `routed === null`, so no outcome appears to be droppable today — the two lanes are structurally mutually exclusive. Plan adds a test pin anyway (see W7).

### 1.2 Recipe auto-migration of legacy presets (`data/vfx/SkillPresentationRecipes.ts:16-34`)

Verdict: **deviating — two real gaps.**

- Mechanically faithful shape: loops `COMBAT_VFX_PRESETS` directly (not `getCombatVfxPreset`), `upright→stroke 'slash'`, `ground_projected`/`screen→ground-shape 'ring'`, `hybrid→burst 'sparks'`, `holy_radiance→aura`, all with `aura` cast cue, `recovery: []`, `impactMs = preset.durationMs`, `castMs` = 180/220/260 by preset class (`:22`), `'slash'` fallback resolver, authored `PHI_KIEM_RECIPE` for `ngu_kiem_flight` (cast370/impact80/recovery170, blade trajectory + stroke + sparks + recall — matches design §8 timing table).
- **GAP-A (real gap, High): no emitted recipe uses `actor-impulse`.** The primitive exists in the schema (`SkillPresentationRecipe.ts:4,46`) but is referenced nowhere else. Auto-migration therefore cannot express the design §9 melee row: `"Cận chiến/Đâm/Chém | actor impulse + signature stroke"`. Because `presetId ?? 'arcane_impact'` is the default at `TurnBattleSystem.ts:1960`, even **basic attacks** map to a burst recipe — the per-cast lunge (`combatConstants.ts:10-11`, tuned 2026-09-07 playtest) is gone for every skill, not only melee.
- **GAP-B (real gap, Medium): `preset.screenShake` is dropped silently.** 11 presets carry it — `boss_ground_slam` (`CombatVfxPresets.ts:94`) + ten `screen`-space `kiem_combo_*` finishers (`:305-377`). The only consumer was `vfxSpawner.onActionImpact` (`combat-vfx-spawner.ts:142-143`), now unreachable in production (see F3). Side note: `screen`-space presets migrating to `ground-shape 'ring'` is a double regression (wrong space + lost shake).
- Nit: `recovery: []` on every migrated recipe means the resolved phase ends at `impactMs` — acceptable, but the design's recovery channel is exercised only by the authored Phi Kiem recipe.
- Nit: cast-phase `aura` shows for `blocked`/`empty`/`charge-tick` dispositions — whiff-by-absence is fine for impact, but a generic aura on a blocked cast is arguably a false cue. Low.

### 1.3 Runner state machine (`SkillPresentationRunner.ts`)

Verdict: **conformant** — this is the faithful part.

- `waiting` set **before** `port.acknowledgeActionImpact` (`:96`/`:99`); inbox drain runs **after** the ACK call returns (`:100`) and on subsequent ticks (`:88`) — exactly design §5 "inbox drain sau khi call stack ACK kết thúc".
- `resolve()` only accepts while `phase==='waiting'`, sealed, deduped (`:73-76`); per-tick token staleness `getPendingPlaybackToken() !== ref.token → cancel()` (`:86`); start token-gate (`:60`); complete-ACK at end of resolved duration = `max(impactMs + recoveryMs)` across groups (`:103`) — matches design's group barrier.
- No complete-ACK inside the resolved-publish callstack: runtime-side `publishingImpact`/`deferredCompleteToken` (`CombatAnimationRuntime.ts:117-118,275,340-348`) defers it; pinned by `GameManagerTurnBattleOps.presentationReceipt.test.ts` (synchronous complete via `action_impact` observer does not corrupt state).
- `resumeResolved` (`:78-82`) — two deviations, both **gate-resolved** (see W8): (a) `cancel()` runs before the token check, so a stale resume call can kill a healthy in-flight playback — ordering swap is trivially correct; (b) the tail is an empty 120 ms wait — design §5 says post-impact resume "phát đoạn recovery ngắn tối đa 120 ms", i.e. a recovery **cue segment** capped at 120 ms, not silence.

### 1.4 `VfxPool.ts` / `trajectory.ts` / `PhaserSkillVfxDriver.ts`

Verdict: **conformant with one lying primitive.**

- Pool: bounded slots, generation-guarded release, `reset()` for reuse vs `destroy()` for teardown with first-error rethrow (`VfxPool.ts:37-58`) — matches the design resource-cap contract. Lifecycle wording note: battle-start should *reset* (reuse), scene teardown should *destroy*; scene usage is correct (see 1.5) — keep this distinction exact in code comments and this plan.
- Trajectory: cubic Bézier + `atan2` tangent, `flightProgress` release/cruise/accel — matches §8 flight model; trajectory suppressed for non-`'action'`/`'charge-release'` dispositions (`PhaserSkillVfxDriver.ts:48`) ✓.
- **Lying surface (nit→Medium if ever used):** `accent()` routes every non-stroke/non-burst primitive — including `actor-impulse` — into an ellipse ring at the anchor (`:177-182`). If a recipe ever adds `actor-impulse` without driver support, it renders a wrong-looking ring at the *target* instead of moving the *actor*. The plan makes it explicit rather than silent.
- Deviation (Medium): camera impulse wired only on `group.role==='primary' && cue.primitive==='stroke' && outcome.crit` (`:68-70`). Design says the camera cue fires "tối đa một lần/action khi có landed hit" — at most once per action on a **landed hit**, not crit-gated — and "Camera shake không áp ở reduced motion" (design lines ~276/319). Combined with GAP-B, camera feedback now exists only for critical slashes, and authored shakes are lost entirely.

### 1.5 Scene wiring / resume / lifecycle (`CombatScene.ts`)

Verdict: **conformant.**

- Bindings at `:629-630` map `skill_presentation_cast`/`resolved` → `onSkillCast`/`onSkillResolved`; `turn_cast_start`/`action_impact` bindings removed; `update()` pumps `_skillPlayback?.update(delta)` (`:885`); `onBattleStart` cancels + resets, `clearSceneState` cancels the runner + destroys the driver (`:1419-1420`) — reset-vs-destroy split correct.
- `applyResumePlayback` (`:1942` area) routes `ready→onTurnReady`, `cast→onSkillCast`, `complete→resumeResolved` — replaces the old 50 ms `delayedCall` ACK; pinned by `CombatScene.skillPresentation.test.ts` (resume does not replay damage feedback).
- `skillVfxDebug` exposes runner snapshot + pool stats (`:613-614`) — the intended observability seam.
- Nit: `CombatScene.ts:46` imports `spawnActionImpactVfx`/`toVector2Points` — already unused at HEAD (only a stale comment at `:1960` mentions it); dead import to remove in W3.

### 1.6 `awaitStep` fallback (`GameManagerTurnBattleOps.ts:758-773`)

Verdict: **deviating — intentional fix with residual risk.**

- Re-arming `setTimeout(fallback, ANIMATION_FALLBACK_MS)` while `session.isBlocking()` correctly fixes the pre-existing "held-past-4s pipeline" defect (the test `held-pipeline-beyond-watchdog` pins the new behavior). `isBlocking` is a coordinator hold — deliberate — and tab-hidden freezes the combat clock upstream via `freezeCombat('tab-hidden')` (`useCombatPause.ts:4`, `GameManagerTurnBattleOps.ts:414`), so no background-stall hazard exists. (This corrects v1's misframed OQ3.)
- Residual risk (Medium, narrows to W4 scope): the re-arm is **unbounded** — a permanently blocking session parks the step forever with no diagnostic; and when `driveStepWork` runs on a rejected ACK, `done()` never fires for that signal (the stale `pendingStepDone` entry survives until `clearPendingSteps`).

### 1.7 Dev lab (`dev/skill-vfx.html`, `src/dev/skill-vfx.ts`, locales)

Verdict: **mostly conformant, minor spec deltas (nits).**

- DEV-gated, own `Phaser.Game`, fake port counts ACKs, `window.__skillVfxLab` hook, 4 presets covering phi-kiếm/melee/AoE/heal, i18n parity en/vi — matches design §11 shape.
- Deltas vs §11/§10: speed options `{1×, 0.35×}` vs required `{0.25, 1, 2}`; missing required fixture cases `intercept` and `source-death` (has hit/miss/multi/combo/empty); phase readout is a static list rather than live phase markers; the fake surface will need an `actorImpulse`/`cameraImpulse` stub once W1/W2 land (folded into W6). All nits.

### 1.8 E2E (`tests/e2e/skill-vfx.spec.ts`)

Verdict: **real gap (Medium).**

- The shipped spec exercises only the dev lab page (advance/pool/localStorage/reduced-motion). Design §11: "E2E thứ hai bắt buộc đi game thật" — a second e2e through the real game path is **mandatory** and is missing entirely.

### 1.9 Doc/comment hygiene

- `TurnActionPresentationEvents.ts:8-20` header still describes the old contract ("SOLE listener … ack responsibilities") — now false; CombatScene is *a* listener, ACK authority moved to the runner. **Lying comment.**
- `TurnSkillAction.ts:185` comment "VFX preset for action_impact" is stale — `presetId` now resolves recipes.
- `combat-action-feedback.ts` header still claims `action_impact` VFX-completion-ACK responsibility (stale).
- `GameManager.ts:1285` and `GameManagerTurnBattlePresentationOps.ts:166` still say "declare action, phát 'attack'" — stale event name (the flow now publishes `turn_cast_start`/`skill_presentation_cast`); fold into W3 comment fixes.
- ~23 k-line `manifest.json` + QA run dir committed under `game/docs/qa/runs/skill-presentation-runtime-2026-09-25/` — sanctioned artifact location per repo QA protocol; note only.

---

## 2. FINDINGS

### F1 — Actor lunge lost for every skill (real gap, High)

Evidence chain:
- Design §9 melee row requires `actor impulse + signature stroke` for melee; the same lunge previously fired for **every** cast via `onAttack` (`playHorizontalImpulse` on `sprite.offsetX`, `combat-vfx-spawner.ts:400`, `ATTACK_LUNGE_PX=8`/`350 ms`, combatConstants `:10-11`).
- New bindings remove `turn_cast_start` → `CombatScene.onAttack` (`:1696-1697`) → `actionFeedback.onAttack` (`combat-action-feedback.ts:28-34`) → unreachable in production. `rg` census: `onAttack` referenced only by `CombatScene.ts:1696`, `combat-action-feedback.ts`, and tests.
- No recipe emits `actor-impulse` (`actor-impulse` occurs only at `SkillPresentationRecipe.ts:4,46`); the driver would render it as an ellipse anyway (`PhaserSkillVfxDriver.ts:177-182`).
- Net: **zero skills show the lunge** — not just melee. Basic attacks (`presetId ?? 'arcane_impact'`, `TurnBattleSystem.ts:1960`) and all upright presets (`slash`, `claw`, `metal_slash`, `lightning_strike`, `wind_blade`) migrated to stroke/burst recipes with no actor motion.
- Test coverage gap: `CombatScene.actionPlayback.test.ts` pins "legacy attack lunge cannot acknowledge impact" — proves non-acknowledgement but not lunge *presence*, so the regression is unpinned.

### F2 — `screenShake` silently dropped (real gap, Medium)

- **11** presets declare `screenShake` (`CombatVfxPresets.ts:94,305-377`); the only applier is `CombatVfxSpawner.onActionImpact` → `cameras.main.shake` (`combat-vfx-spawner.ts:142-143`), unreachable now. Design has a `camera-cue` primitive category; the schema ships 6 of the listed primitives and `camera-cue` is absent. Boss slam and the ten `screen`-space kiếm finisher combos lost their hit-confirm shake.

### F3 — Dead emits and dead surface (sanctioned feed vs lying surface)

- `turn_cast_start` emitted `CombatAnimationRuntime.ts:246,403` (`TurnActionPresentationEvents.ts:35`). Production subscribers: **zero**. Test subscribers: `GameManager.actionPlayback.test.ts:152`, `CombatAnimationRuntime.test.ts:101`, `TurnActionPresentationEvents.test.ts:54`. Gate-resolved (was OQ4): **keep** as a documented observation feed per design §12.
- `action_impact` emitted `:285` (primary) and `:317` (extra impacts) (`TurnActionPresentationEvents.ts:67`). Production subscribers: zero. Design §12 explicitly allows it to remain as a migration observation feed, and `presentationReceipt.test.ts` uses it to exercise a synchronous re-entrant complete — sanctioned feed, but its header comments lie (see 1.9).
- Dead surface: `CombatScene.onAttack` `:1696`, `CombatScene.onActionImpact` `:1973-1974`, `CombatActionFeedback.onAttack` (`:28-34`), `CombatActionFeedback.onActionImpact` (`:110-113`), `vfxSpawner.onActionImpact`/`spawnActionImpactVfx` (`combat-vfx-spawner.ts:115-143`), `getCombatVfxPreset` (sole live-looking caller `combat-vfx-spawner.ts:125`; recipe migration loops `COMBAT_VFX_PRESETS` directly — dead after W3), `ActionImpactVfx` production usage, and the dead import `CombatScene.ts:46`. All unreachable from production events; kept alive only by tests asserting non-authoritativeness.

### F4 — `awaitStep` watchdog weakened (deviation, Medium)

See 1.6: fallback now defers indefinitely while `session.isBlocking()` and silently parks on a rejected `driveStepWork`. The re-arm fix is directionally right (unblocks legitimate >4 s holds) but lost the hard bound and the failure diagnostic. The tab-hidden concern from v1 was misframed — `freezeCombat('tab-hidden')` deliberately freezes the combat clock; no correction needed there.

### F5 — Production-path e2e missing (real gap, Medium)

Design §11 mandatory; only the dev-lab e2e exists.

### Secondary nits (defer OK, list for the record)

- Camera cue gated to crit-only instead of ≤1/action-on-landed-hit (1.4); whiff communicates by absence of visuals — relies on the separate dodge event, acceptable.
- Composite group identity uses `compositePicks[0]` provenance (documented, pinned).
- Dev-lab deltas (1.7). `screen`-space presets → `ring` mapping (1.2). Stale comments + dead import (1.9).

---

## 3. PLAN — concrete file map

All paths relative to `game/`. Ordered so each work item lands green independently; W1 is the required fix, W2-W8 close the remaining gaps.

### W1 — Restore actor impulse (F1) — required

1. `src/presentation/skills/SkillPresentationRecipe.ts`
   - Extend `SkillCue` with `impulsePx?: number` (validate `0 < impulsePx <= 64`).
   - Add `'impulse'` to the `cue.shape` whitelist (`:56-57` currently `['blade','orb','slash','ring','sparks','rune']`) — `shape` is **mandatory** on every cue; a distinct `impulse` shape keeps the one-shot cue honest instead of borrowing a draw-shape it never renders. Anchor stays `'source'`.
   - No validator exemption for one-shot cues — keep the `offsetMs + durationMs <= phaseMs` bound for all cues (see W1.2).
2. `src/data/vfx/SkillPresentationRecipes.ts`
   - Auto-migration: add a **cast-phase `actor-impulse` cue** to every migrated recipe whose preset is `space === 'upright'` **and** to the `arcane_impact` fallback recipe (covers basic attacks / unpinned `presetId` at `TurnBattleSystem.ts:1960`). Scoped to upright+arcane_impact only until OQ1 resolves the hybrid/ground question.
   - Cue shape: `{ primitive: 'actor-impulse', anchor: 'source', shape: 'impulse', offsetMs: 0, durationMs: Math.min(ATTACK_LUNGE_DURATION_MS, castMs), impulsePx: 8 }`. **durationMs must be clamped to the phase bound** — the validator throws `'Invalid skill recipe cue'` when `offsetMs + durationMs > phaseMs` (`SkillPresentationRecipe.ts:56-57`), and migrated `castMs` is 180/220/260 (`SkillPresentationRecipes.ts:22`), so a raw 350 fails. The clamped duration is passed to the surface hook; a 180–260 ms lunge is acceptable vs the tuned 350 ms original (impulse is bounded by the cast window anyway — the alternative of exempting one-shot cues from the phase bound is rejected: it weakens the only recipe sanity check for every other cue type).
   - `ngu_kiem_flight` keeps its authored recipe untouched (design authored it without actor motion).
3. `src/game/support/skill-vfx/PhaserSkillVfxDriver.ts`
   - Handle `actor-impulse` explicitly **before** the `accent` dispatch: on cue open (elapsed ≥ offset), call `surface.actorImpulse(fact, durationMs, impulsePx)` for the **source** anchor fact once, then return `quietHandle`. Same disposition gate as trajectory (`:48`): fire only for `'action'`/`'charge-release'`.
   - `actor-impulse` must never reach `accent()` — add a defensive `console.warn` + `quietHandle` if it does (removes the silent ellipse misrender).
4. `src/game/scenes/CombatScene.ts`
   - `SkillVfxSurface` gains `actorImpulse?(fact, durationMs, px)`; scene implements via `spriteFor(fact.entityId)` → `vfxSpawner.playHorizontalImpulse(sprite, dx, durationMs)` — the `offsetX` channel, so it does not fight per-frame `positionSprite`/interpolation.
   - Direction: sign of `anchor(targets[0]).x − anchor(source).x` from the cast's declared facts (per design: facing from anchor vector, not `sourceId === PLAYER_ID`); fallback to side-based sign only when no usable target anchor exists.
5. `src/game/scenes/combat/combat-action-feedback.ts` — delete `onAttack` (superseded by W1.3/W1.4).
6. Tests: driver test (cue → `surface.actorImpulse` once, source fact, no ellipse handle; disposition-gated); recipe test (upright + `arcane_impact` contain the cast-phase cue with `durationMs <= castMs`, `shape:'impulse'`; `ngu_kiem_flight` does not); scene test (melee cast drives `actorImpulse` toward declared target; reduced-motion still fires it — impulse is the "who acted" signal, not decoration); update the `actionPlayback` non-ack pins to the new path.

### W2 — Restore `screenShake` via `camera-cue` + fix generic camera gating (F2)

1. `SkillPresentationRecipe.ts`: add `'camera-cue'` to `SkillPrimitive` + primitive set; add `'camera'` to the shape whitelist; add `intensity?: number` (validated `0 < intensity <= 0.01`).
2. `SkillPresentationRecipes.ts`: migrate `preset.screenShake` → impact-phase `{ primitive: 'camera-cue', anchor: 'source', shape: 'camera', offsetMs: 0, durationMs: screenShake.durationMs, intensity: screenShake.intensity }` (phase-bound: shake durations 120–140 ms < any `impactMs`, always valid).
3. `PhaserSkillVfxDriver.ts`: `camera-cue` on open → `surface.cameraImpulse(durationMs, intensity)`, then `quietHandle`. Enforce the design cap **≤1 camera cue per action** with a per-playback latch in the runner context (first camera trigger wins — authored cue beats the generic impulse). Disposition gate identical to W1.
4. `CombatScene.ts`: widen `cameraImpulse(durationMs, intensity)` to take cue params (currently fixed 45 ms/0.001 at `:~600`).
5. Fix the generic camera impulse gating (`:68-70`): design fires on **landed hit** (any primary-group outcome with `landed: true`), not crit-only — and suppress entirely under `reducedMotion` (design: "Camera shake không áp ở reduced motion"; resolves former OQ2c). Scene's cameraImpulse call stays suppressed when reduced-motion.
6. Optionally re-map `space==='screen'` presets off `ground-shape 'ring'` (a screen-space burst/flash cue, or keep ring + shake) — OQ2b stays open.
7. Tests: recipe pins shake→cue migration for `boss_ground_slam` + one `kiem_combo_*`; driver pins `cameraImpulse` once per playback (latch), landed-hit gating, reduced-motion suppression.

### W3 — Dead emits and dead surface (F3) — keep feeds, remove dead code, fix comments

1. **Keep** `action_impact` (`CombatAnimationRuntime.ts:285,317`) and `turn_cast_start` (`:246,403`) as documented observation feeds — gate-resolved: design §12 sanctions feeds during migration; tests pin both. Fix the lying comments instead: `TurnActionPresentationEvents.ts:8-20` header rewrite (runner owns ACK authority; these are observation events with no production subscribers), `TurnSkillAction.ts:185`, `combat-action-feedback.ts` header, `GameManager.ts:1285` + `GameManagerTurnBattlePresentationOps.ts:166` (stale "phát 'attack'" wording). `BattleEvents.ts` type entries stay, annotated "observation feed — no production subscribers".
2. Delete dead surface: `CombatScene.onAttack` (`:1696-1697`), `CombatScene.onActionImpact` (`:1973-1974`), the dead import `CombatScene.ts:46` + stale comment `:1960`, `CombatActionFeedback.onAttack`/`onActionImpact`, `vfxSpawner.onActionImpact`/`spawnActionImpactVfx` (`combat-vfx-spawner.ts:115-143`), `getCombatVfxPreset` (`CombatVfxPresets.ts:381` — dead once the spawner path is gone; the recipe migration never calls it), and `ActionImpactVfx` code reachable only through them.
   - Keep `playHorizontalImpulse` (reused by W1), `COMBAT_VFX_PRESETS` (drives recipe migration), damage numbers / hit flash / death paths.
   - Migrate tests that instantiate the deleted chain (spawner/ActionImpactVfx tests either move to the recipe path or stay as pure component tests).

### W4 — Bound the `awaitStep` fallback (F4)

- `GameManagerTurnBattleOps.ts:758-773`: keep the `isBlocking()` re-arm; add a bound — cumulative deferral cap (~30 s or N re-arms) then force-drive once with a `console.warn` diagnostic; on rejected `driveStepWork`, log + drop the stale `pendingStepDone` entry so a later turn's ACK can't fire it. No API changes. Background-tab stall is **not** in scope — `freezeCombat('tab-hidden')` already freezes the combat clock deliberately.
- New test: blocking session → bounded re-arms → forced settle; rejected-ACK path clears the pending entry.

### W5 — Production-path e2e (F5)

- Add `tests/e2e/skill-presentation-production.spec.ts`: boot real game → battle → cast a melee skill and `ngu_kiem_thuat` → assert via `skillVfxDebug` snapshot: cast started → impact ACK once → resolved phase → complete; HP change landed once; next turn reachable; cancel/exit path clean. Reuse existing e2e helpers (`combat-vertical-slice`, cultivation-path-ritual). Design-§11 mandatory second e2e.

### W6 — Dev-lab conformance nits (one commit)

- Speed options → `{0.25, 1, 2}`; add `intercept` + `source-death` fixtures; upgrade phase readout to live markers if cheap; add `actorImpulse`/`cameraImpulse` stubs to the lab's fake port/surface so the new cues are exercised in preview. en/vi strings already exist or need two keys.

### W7 — Invariant pins (the regression contract this plan must leave behind)

- Impact ACK exactly once, at cast-duration end, before any resolved cue (existing runner tests — keep).
- Complete ACK once, only after the longest group ends, never inside the `skill_presentation_resolved` emit callstack (existing — keep).
- `actorImpulse` fires once per cast for impulse-bearing recipes, targets the **source** sprite, never produces/consumes an ACK.
- Disposition pin: `actor-impulse`/`camera-cue`/`trajectory` one-shots open only for `'action'`/`'charge-release'` — a blocked/charge-tick/empty cast shows the aura cast cue only (mirrors `PhaserSkillVfxDriver.ts:48`).
- A recipe with `actor-impulse` never reaches `accent()` — driver unit test.
- Camera cue ≤ 1 per action on landed hit, suppressed under reduced-motion (new pin; resolves OQ2c by design text).
- No legacy-lane outcome is dropped when a routed primary group exists (structural pin for the 1.1 watch item).
- Headless/no-scene parity: sealed batches identical with and without the scene bound (existing receipt tests — keep).

### W8 — Runner resume nits (gate-resolved)

- `SkillPresentationRunner.ts:78-82`: check `port.getPendingPlaybackToken()` **before** `cancel()`; make the ≤120 ms tail play the recipe's `recovery` cues (cue segment truncated at 120 ms) instead of an empty wait — per design §5's "phát đoạn recovery ngắn tối đa 120 ms". Tests: stale-token resume leaves a healthy active playback untouched; resume tail opens recovery cues and still completes within 120 ms.

### Explicitly untouched

- `SkillPresentationFacts.ts` types/collector/seal, runner state-machine core beyond W8 (`SkillPresentationRunner.ts`), `VfxPool.ts`, `trajectory.ts`, `TurnBattleSystem`/`TurnSkillPlanRuntime` collector wiring, `CombatAnimationRuntime` publish/deferred-ACK seam, dev-lab mechanics beyond W6, `applyResumePlayback` flow, all gameplay/damage logic, authored `PHI_KIEM_RECIPE`.

---

## Open questions

Still open — do not guess in implementation:

- **OQ1 — Impulse scope beyond upright + `arcane_impact`.** The old code lunged *every* cast (including hybrid/ground presets); design §9 only *requires* impulse for melee. Default plan restores it for `upright` + `arcane_impact` (basic attacks) — extending to hybrid/ground needs a decision, and there is no `melee`/`ranged` field on `TurnSkillDefinition` to classify by. Sub-question: do `lightning_strike`/`wind_blade` (upright but ranged-feel) keep the impulse?
- **OQ2b — `screen`-space presets.** Re-map off `ground-shape 'ring'` (they lost both their screen-space identity and their shake), or accept ring + restored shake?
- **OQ5 — Production e2e now or follow-up?** Design §11 calls it mandatory; flagging because it may deserve its own task scope.

Resolved by the plan gate (folded into plan, no longer open):

- **OQ2c** — reduced-motion: suppress camera shake (design: "Camera shake không áp ở reduced motion") → W2.5.
- **OQ3** — background-tab stall: misframed; `freezeCombat('tab-hidden')` deliberately freezes the combat clock and `isBlocking` is a coordinator hold → residual already covered by W4's bound.
- **OQ4** — `turn_cast_start`: keep as documented observation feed (design §12; tests pin it) → W3.1.
- **OQ6** — `resumeResolved`: swap token-check before `cancel()`; 120 ms tail = recipe recovery cue segment per §5 → W8.
