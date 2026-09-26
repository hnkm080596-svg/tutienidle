# codex/skill-presentation-runtime — conformance audit + fix plan

Scope: delta `fee85ba0` vs parent `48962aaa` only (the Ngự Kiếm chain below is QA-closed separately).
Design authority: `game/docs/design/skill-presentation-runtime-design.txt` (tip `b0b78088`).
Plan discipline: this document is audit + plan only; no production edits were made.

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
- Watch item (not a gap): when a `routed` primary group already exists, outcomes accumulated in the shared legacy `outcomes` array are silently skipped (`TurnBattleSystem.ts` unshift guarded on no-'primary'-role). Reachability analysis: legacy lanes are guarded on `routed === null`, so no outcome appears to be droppable today — the two lanes are structurally mutually exclusive. Plan adds a test pin anyway (see §3 W7).

### 1.2 Recipe auto-migration of legacy presets (`data/vfx/SkillPresentationRecipes.ts:16-34`)

Verdict: **deviating — two real gaps.**

- Mechanically faithful: loops `COMBAT_VFX_PRESETS`, `upright→stroke 'slash'`, `ground_projected`/`screen→ground-shape 'ring'`, `hybrid→burst 'sparks'`, `holy_radiance→aura`, all with `aura` cast cue, `recovery: []`, `impactMs = preset.durationMs`, `'slash'` fallback resolver, authored `PHI_KIEM_RECIPE` for `ngu_kiem_flight` (cast370/impact80/recovery170, blade trajectory + stroke + sparks + recall — matches design §8 timing table).
- **GAP-A (real gap, High): no emitted recipe uses `actor-impulse`.** The primitive exists in the schema (`SkillPresentationRecipe.ts:4,46`) but is referenced nowhere else. Auto-migration therefore cannot express the design §9 melee row: `"Cận chiến/Đâm/Chém | actor impulse + signature stroke"`. Because `presetId ?? 'arcane_impact'` is the default at `TurnBattleSystem.ts:1960`, even **basic attacks** map to a burst recipe — the universal per-cast lunge (`combatConstants.ts:10-11`, tuned 2026-09-07 playtest) is gone for *every* skill, not only melee.
- **GAP-B (real gap, Medium): `preset.screenShake` is dropped silently.** 10 presets carry it — `boss_ground_slam` (`CombatVfxPresets.ts:94`) + nine `screen`-space `kiem_combo_*` finishers (`:305-377`). The only consumer was `vfxSpawner.onActionImpact` (`combat-vfx-spawner.ts:142-143`), now unreachable in production (see F3). Side note: `screen`-space presets migrating to `ground-shape 'ring'` is a double regression (wrong space + lost shake).
- Nit: `recovery: []` on every migrated recipe means the resolved phase ends at `impactMs` — acceptable, but the design's recovery channel is exercised only by the authored Phi Kiem recipe.
- Nit: cast-phase `aura` shows for `blocked`/`empty`/`charge-tick` dispositions — whiff-by-absence is fine for impact, but a generic aura on a blocked cast is arguably a false cue. Low.

### 1.3 Runner state machine (`SkillPresentationRunner.ts`)

Verdict: **conformant** — this is the faithful part.

- `waiting` set **before** `port.acknowledgeActionImpact` (`:96`/`:99`); inbox drain runs **after** the ACK call returns (`:100`) and on subsequent ticks (`:88`) — exactly design §5 "inbox drain sau khi call stack ACK kết thúc".
- `resolve()` only accepts while `phase==='waiting'`, sealed, deduped (`:73-76`); per-tick token staleness `getPendingPlaybackToken() !== ref.token → cancel()` (`:86`); start token-gate (`:60`); complete-ACK at end of resolved duration = `max(impactMs + recoveryMs)` across groups (`:103`); `resumeResolved` = cancel + 120 ms empty tail then complete (`:78-82`) — matches design's post-impact resume rule (no damage replay).
- No complete-ACK inside the resolved-publish callstack: runtime-side `publishingImpact`/`deferredCompleteToken` (`CombatAnimationRuntime.ts:117-118,275,340-348`) defers it; pinned by `GameManagerTurnBattleOps.presentationReceipt.test.ts` (synchronous complete via `action_impact` observer does not corrupt state).
- Nit: `resumeResolved` cancels the active playback **before** its own token check (`:78-82`) — a stale resume call can kill a healthy in-flight presentation. Reorder (check token, then cancel) or document; Low.
- Nit: resume tail plays no cue at all — design says "phát đoạn recovery ngắn tối đa 120 ms". Empty wait is a conservative reading; a minimal recovery cue would match intent better. Low.

### 1.4 `VfxPool.ts` / `trajectory.ts` / `PhaserSkillVfxDriver.ts`

Verdict: **conformant with one lying primitive.**

- Pool: bounded slots, generation-guarded release, reset/destroy with first-error rethrow — matches design resource-cap contract.
- Trajectory: cubic Bézier + `atan2` tangent, `flightProgress` release/cruise/accel — matches §8 flight model; trajectory suppressed for non-action dispositions (`PhaserSkillVfxDriver.ts:48`) ✓.
- **Lying surface (nit→Medium if ever used):** `accent()` routes every non-stroke/non-burst primitive — including `actor-impulse` — into an ellipse ring at the anchor (`:177-182`). If a recipe ever adds `actor-impulse` without driver support, it renders a wrong-looking ring at the *target* instead of moving the *actor*. Silent-misrender is worse than a throw; the plan makes it explicit.
- Deviation (Medium): camera impulse wired only on `group.role==='primary' && cue.primitive==='stroke' && outcome.crit` (`:68-70`). Design wants the camera cue ≤1× per action on a landed hit (crit-independent). Combined with GAP-B, camera feedback now exists only for critical slashes.

### 1.5 Scene wiring / resume / lifecycle (`CombatScene.ts`)

Verdict: **conformant.**

- Bindings at `:629-630` map `skill_presentation_cast`/`resolved` → `onSkillCast`/`onSkillResolved`; `turn_cast_start`/`action_impact` bindings removed; `update()` pumps `_skillPlayback?.update(delta)` (`:885`); battle-start and `clearSceneState` cancel the runner and destroy the driver.
- `applyResumePlayback` (`:1942` area) routes `ready→onTurnReady`, `cast→onSkillCast`, `complete→resumeResolved` — replaces the old 50 ms `delayedCall` ACK; pinned by `CombatScene.skillPresentation.test.ts` (resume does not replay damage feedback).
- `skillVfxDebug` exposes runner snapshot + pool stats (`:613-614`) — the intended observability seam.

### 1.6 `awaitStep` fallback (`GameManagerTurnBattleOps.ts:758-773`)

Verdict: **deviating — intentional fix with residual risk.**

- Re-arming `setTimeout(fallback, ANIMATION_FALLBACK_MS)` while `session.isBlocking()` correctly fixes the pre-existing "held-past-4s pipeline" defect (design keeps the 4 s watchdog as the safety line; the test `held-pipeline-beyond-watchdog` pins the new behavior).
- Residual risk (Medium): the re-arm is **unbounded** — a permanently blocking session parks the step forever, and there is no diagnostic; and when `driveStepWork` runs on a rejected ACK, `done()` never fires for that signal (the stale `pendingStepDone` entry survives into `clearPendingSteps` only). Worst case today is a silently frozen turn instead of a bounded stall. Also see OQ3 on background-tab throttling (`isBlocking` stays true while rAF is paused → auto-combat stalls where the old code would have fallen back).

### 1.7 Dev lab (`dev/skill-vfx.html`, `src/dev/skill-vfx.ts`, locales)

Verdict: **mostly conformant, minor spec deltas (nits).**

- DEV-gated, own `Phaser.Game`, fake port counts ACKs, `window.__skillVfxLab` hook, 4 presets covering phi-kiếm/melee/AoE/heal, i18n parity en/vi — matches design §11 shape.
- Deltas vs §11: speed options `{1×, 0.35×}` vs required `{0.25, 1, 2}`; missing required fixture cases `intercept` and `source-death` (has hit/miss/multi/combo/empty); phase readout is a static list rather than live phase markers. All nits.

### 1.8 E2E (`tests/e2e/skill-vfx.spec.ts`)

Verdict: **real gap (Medium).**

- The shipped spec exercises only the dev lab page (advance/pool/localStorage/reduced-motion). Design §11: "E2E thứ hai bắt buộc đi game thật" — a second e2e through the real game path is **mandatory** and is missing entirely.

### 1.9 Doc/comment hygiene

- `TurnActionPresentationEvents.ts:8-20` header still describes the old contract ("SOLE listener … ack responsibilities") — now false; CombatScene is *a* listener, ACK authority moved to the runner. **Lying comment, Medium-adjacent nit.**
- `TurnSkillAction.ts:185` comment "VFX preset for action_impact" is stale — `presetId` now resolves recipes, not the dead preset-impact path.
- `combat-action-feedback.ts` header still claims `action_impact` VFX-completion-ACK responsibility (stale).
- ~23 k-line `manifest.json` + QA run dir committed under `game/docs/qa/runs/skill-presentation-runtime-2026-09-25/` — sanctioned artifact location per repo QA protocol; note only.

---

## 2. FINDINGS

### F1 — Actor lunge lost for every skill (real gap, High)

Evidence chain:
- Design §9 melee row requires `actor impulse + signature stroke` for melee; the same lunge previously fired for **every** cast via `onAttack` (`playHorizontalImpulse` on `sprite.offsetX`, `combat-vfx-spawner.ts:400`, `ATTACK_LUNGE_PX=8`/`350 ms`, combatConstants `:10-11`).
- New bindings remove `turn_cast_start` → `CombatScene.onAttack` (`:1696-1697`) → `actionFeedback.onAttack` (`combat-action-feedback.ts:28-34`) → unreachable in production. `rg` census: `onAttack` referenced only by `CombatScene.ts:1696`, `combat-action-feedback.ts`, and tests.
- No recipe emits `actor-impulse` (`actor-impulse` occurs only at `SkillPresentationRecipe.ts:4,46`); the driver would render it as an ellipse anyway (`PhaserSkillVfxDriver.ts:177-182`).
- Net: **zero skills show the lunge** — not just melee. Basic attacks (`presetId ?? 'arcane_impact'`, `TurnBattleSystem.ts:1960`) and all upright presets (`slash`, `claw`, `metal_slash`, `lightning_strike`, `wind_blade`) migrated to stroke/burst recipes with no actor motion.
- Test coverage gap: `CombatScene.actionPlayback.test.ts` was rewritten to pin "legacy attack lunge cannot acknowledge impact" — it proves non-acknowledgement but not lunge *presence*, so the regression is unpinned.

### F2 — `screenShake` silently dropped (real gap, Medium)

- 10 presets declare `screenShake` (`CombatVfxPresets.ts:94,305-377`); the only applier is `CombatVfxSpawner.onActionImpact` → `cameras.main.shake` (`combat-vfx-spawner.ts:142-143`), unreachable now. Design has a `camera-cue` primitive category; the schema ships 6 of the listed primitives and `camera-cue` is absent. Boss slam and all 5-stage kiếm finisher combos lost their hit-confirm shake.

### F3 — Dead emits and dead surface (sanctioned feed vs lying surface)

- `turn_cast_start` emitted `CombatAnimationRuntime.ts:246,403` (`TurnActionPresentationEvents.ts:35`). Production subscribers: **zero**. Test subscribers: `GameManager.actionPlayback.test.ts:152`, `CombatAnimationRuntime.test.ts:101`, `TurnActionPresentationEvents.test.ts:54` (emit-shape pins). Not the observation feed design §12 sanctions keeping — it's just dead.
- `action_impact` emitted `:285` (primary) and `:317` (extra impacts) (`TurnActionPresentationEvents.ts:67`). Production subscribers: zero. Design §12 explicitly allows it to remain as a migration observation feed, and `presentationReceipt.test.ts` uses it to exercise a synchronous re-entrant complete — sanctioned feed, but its header comments lie (see 1.9).
- Dead surface: `CombatScene.onAttack` `:1696`, `CombatScene.onActionImpact` `:1973-1974`, `CombatActionFeedback.onAttack` (`:28-34`), `CombatActionFeedback.onActionImpact` (`:110-113`, already commented "not subscribed to production action events"), `vfxSpawner.onActionImpact`/`spawnActionImpactVfx` (`combat-vfx-spawner.ts:115+`), and `ActionImpactVfx` production usage. All unreachable from production events; kept alive only by tests asserting non-authoritativeness.

### F4 — `awaitStep` watchdog weakened (deviation, Medium)

See 1.6: fallback now defers indefinitely while `session.isBlocking()` and silently parks on a rejected `driveStepWork`. Design requires the 4 s watchdog to remain the safety line; the fix is directionally right (it unblocks legitimate >4 s holds) but lost the hard bound and the failure diagnostic.

### F5 — Production-path e2e missing (real gap, Medium)

Design §11 mandatory; only the dev-lab e2e exists.

### Secondary nits (defer OK, list for the record)

- Camera cue gated to crit-only (1.4); whiff communicates by absence of visuals — relies on the separate dodge event, acceptable.
- Composite group identity uses `compositePicks[0]` provenance (documented, pinned).
- Dev-lab deltas (1.7). `screen`-space presets → `ring` mapping (1.2). `resumeResolved` ordering/empty-tail (1.3). Stale comments (1.9).

---

## 3. PLAN — concrete file map

All paths relative to `game/`. Ordered so each work item lands green independently; W1 is the required fix, W2-W6 close the remaining gaps, W7 pins invariants.

### W1 — Restore actor impulse (F1) — required

1. `src/presentation/skills/SkillPresentationRecipe.ts`
   - Extend `SkillCue` with `impulsePx?: number` (validated `0 < impulsePx <= 64` in `validateSkillRecipe`). No other schema change — `actor-impulse` is already a legal primitive.
2. `src/data/vfx/SkillPresentationRecipes.ts`
   - Auto-migration: add a **cast-phase `actor-impulse` cue** (`offsetMs 0`, `durationMs` clamped to the 1500 bound — reuse the `ATTACK_LUNGE_DURATION_MS = 350` contract) to every migrated recipe whose preset is `space === 'upright'` **and** to the `arcane_impact` fallback recipe (covers basic attacks / unpinned `presetId`). This restores the universal per-cast lunge losslessly while upright presets additionally keep their `stroke` signature — satisfying the design melee row without special-casing.
   - `ngu_kiem_flight` keeps its authored recipe untouched (design authored it without actor motion).
   - See OQ1 for the open alternative (restrict impulse to upright-only / an authored melee list).
3. `src/game/support/skill-vfx/PhaserSkillVfxDriver.ts`
   - Handle `actor-impulse` explicitly **before** the `accent` dispatch: on cue open, call `surface.actorImpulse(fact, durationMs, impulsePx)` for the **source** anchor fact, then return `quietHandle` (one-shot tween; nothing to sample). Keep it out of the `stroke/burst/else` branches so it can never render an ellipse.
   - Explicitly reject (or no-op with `console.warn`) `actor-impulse` reaching `accent()` — removes the silent-misrender path.
4. `src/game/scenes/CombatScene.ts`
   - `SkillVfxSurface` gains `actorImpulse?(fact, durationMs, px)`; scene implements it via `spriteFor(fact.entityId)` → `vfxSpawner.playHorizontalImpulse(sprite, dx, durationMs)` — the `offsetX` channel, so it does not fight per-frame `positionSprite`/interpolation.
   - Direction: sign of `anchor(targets[0]).x − anchor(source).x` from the cast's declared facts (per design: facing from anchor vector, not `sourceId === PLAYER_ID`); fallback to side-based sign only when no usable target anchor exists.
5. `src/game/scenes/combat/combat-action-feedback.ts`
   - Delete `onAttack` (superseded by W1.3/W1.4); keep file for `onTurnReady` and remaining feedback.
6. Tests (new/updated):
   - `SkillPresentationRunner`-adjacent or driver test: an `actor-impulse` cast cue calls `surface.actorImpulse` exactly once on cue open with `{entityId: sourceId}` — and draws no ellipse handle.
   - Recipe test: migrated `slash`/`claw`/`metal_slash`/`arcane_impact` recipes contain a cast-phase `actor-impulse` cue; `ngu_kiem_flight` does not.
   - Scene test (extend `CombatScene.skillPresentation.test.ts`): a melee cast drives `actorImpulse` toward the declared target; reduced-motion still fires it (impulse is the "who acted" signal, not decoration — same reasoning as the design's stroke-impulse pairing); the lunge owns **no** ACK authority (existing non-ack tests keep passing).
   - Update `CombatScene.actionPlayback.test.ts` "legacy attack lunge cannot acknowledge impact" pins to reference the new impulse path.

### W2 — Restore `screenShake` via `camera-cue` (F2)

1. `SkillPresentationRecipe.ts`: add `'camera-cue'` to `SkillPrimitive` + validator set; cue fields `{durationMs, intensity}` (reuse existing generic fields where possible; add `intensity?: number` bounded `0 < i <= 0.01`).
2. `SkillPresentationRecipes.ts`: migrate `preset.screenShake` → impact-phase `camera-cue` carrying `{durationMs, intensity}`.
3. `PhaserSkillVfxDriver.ts` + `CombatScene.ts`: `camera-cue` on open → `surface.cameraImpulse(durationMs, intensity)`; widen the existing surface signature (currently fixed 45 ms/0.001 at scene `:~600`) to take the cue's parameters. Keep the existing crit-stroke impulse as the generic hit confirm; decide once whether `camera-cue` supersedes or composes with it (OQ2 — design caps total camera cues at ≤1 per action).
4. Optionally re-map `space==='screen'` presets away from `ground-shape 'ring'` (a `screen`-space burst/flash cue or keep ring + shake; OQ2-b).
5. Tests: recipe test pins shake→cue migration for `boss_ground_slam` + one `kiem_combo_*`; driver test pins `cameraImpulse` called once with authored values, suppressed under reduced-motion only if design requires (design: camera cue once per landed hit — reduced-motion handling listed as OQ2-c).

### W3 — Dead emits and dead surface (F3) — remove/mark, no behavior change

1. **Keep** `action_impact` emission (`CombatAnimationRuntime.ts:285,317`) as the design-sanctioned observation feed — `presentationReceipt.test.ts` + kiếm tests consume it. Fix the lying comments instead: `TurnActionPresentationEvents.ts:8-20` header rewrite (runner owns ACK authority; these are observation events), `TurnSkillAction.ts:185` (presetId → recipe resolution), `combat-action-feedback.ts` header.
2. `turn_cast_start` (`:246,403`): keep as feed **or** remove — tests pin its emission (`actionPlayback.test.ts:147-163`, `CombatAnimationRuntime.test.ts:97-108`, `TurnActionPresentationEvents.test.ts:51-54`). Recommendation: **keep + comment-fix** (removing buys nothing but test churn; it's the only cast-start observation hook). If the reviewer prefers removal, delete emit sites + `emitTurnCastStart` + the three test pins in one commit.
3. Delete dead surface: `CombatScene.onAttack` (`:1696-1697`), `CombatScene.onActionImpact` (`:1973-1974`), `CombatActionFeedback.onAttack`, `CombatActionFeedback.onActionImpact`, `vfxSpawner.onActionImpact`/`spawnActionImpactVfx` (`combat-vfx-spawner.ts:115+`) and any `ActionImpactVfx` code reachable only through them. After W2, nothing production-reachable remains in that chain. Migrate the handful of tests that instantiate them (spawner status-row / ActionImpactVfx unit tests either move to the recipe path or stay as pure component tests).
   - Keep `playHorizontalImpulse` (reused by W1), `getCombatVfxPreset` (used by recipe migration), damage numbers / hit flash / death paths.
4. `BattleEvents.ts` type entries for `turn_cast_start`/`action_impact` stay (the events remain emitted); add "observation feed — no production subscribers" note.

### W4 — Bound the `awaitStep` fallback (F4)

- `GameManagerTurnBattleOps.ts:758-773`: keep the `isBlocking()` re-arm, add a bound — e.g. cumulative deferral cap (~30 s or N re-arms) after which the step force-drives once with a `console.warn` diagnostic; on rejected `driveStepWork`, log + drop the stale `pendingStepDone` entry so a later turn's ACK can't fire it. No API changes.
- New test: blocking session → bounded number of re-arms → forced settle; rejected-ACK path clears the pending entry.

### W5 — Production-path e2e (F5)

- Add `tests/e2e/skill-presentation-production.spec.ts`: boot real game → battle → cast a melee skill and `ngu_kiem_thuat` → assert via `window`/scene `skillVfxDebug` snapshot: cast started → impact ACK once → resolved phase → complete; HP change landed once; next turn reachable; cancel/exit path clean. Reuse existing e2e helpers (`combat-vertical-slice`, cultivation-path-ritual). This is the design-§11 mandatory second e2e.

### W6 — Dev-lab conformance nits (optional, one commit)

- Speed options → `{0.25, 1, 2}`; add `intercept` + `source-death` fixtures; upgrade phase readout to live markers if cheap. en/vi strings already exist or need two keys.

### W7 — Invariant pins (the regression contract this plan must leave behind)

- Impact ACK exactly once, at cast-duration end, before any resolved cue (existing runner tests — keep).
- Complete ACK once, only after the longest group ends, never inside the `skill_presentation_resolved` emit callstack (existing — keep).
- `actorImpulse` fires once per cast for impulse-bearing recipes, targets the **source** sprite, and never produces/consumes an ACK.
- A recipe with `actor-impulse` never reaches `accent()` (no ellipse misrender) — driver unit test.
- Camera cue ≤ 1 per action on landed hit (new pin once OQ2 resolves).
- No legacy-lane outcome is dropped when a routed primary group exists (structural pin for the 1.1 watch item).
- Headless/no-scene parity: sealed batches identical with and without the scene bound (existing receipt tests — keep).

### Explicitly untouched

- `SkillPresentationFacts.ts` types/collector/seal, runner state-machine core (`SkillPresentationRunner.ts`), `VfxPool.ts`, `trajectory.ts`, `TurnBattleSystem`/`TurnSkillPlanRuntime` collector wiring, `CombatAnimationRuntime` publish/deferred-ACK seam, dev-lab mechanics, `applyResumePlayback` flow, all gameplay/damage logic, authored `PHI_KIEM_RECIPE`.

---

## Open questions (decisions deferred to the plan-gate reviewer — do not guess in implementation)

- **OQ1 — Impulse scope.** Recommended default: every auto-migrated recipe (`upright` + `arcane_impact` fallback + hybrid/ground presets too if "universal lunge" is the true prior contract). Design §9 only *requires* impulse for melee; the old code lunged every cast. If the reviewer wants melee-only, we need a melee classifier — no `melee`/`ranged` field exists on `TurnSkillDefinition`; options: `space==='upright'` presets (`slash`,`claw`,`metal_slash`,`lightning_strike`,`wind_blade`) or an authored recipe list. Also: should `lightning_strike`/`wind_blade` (upright but ranged-feel) lunge?
- **OQ2 — Camera-cue contract.** (a) Does `camera-cue` replace the current crit-only stroke impulse, or stack with it under the ≤1-per-action cap? (b) Re-map `screen`-space presets off `ring`? (c) Reduced-motion: suppress or keep (design lowers decoration, not milestones — the shake is arguably a milestone)?
- **OQ3 — Background-tab combat.** With the new `isBlocking()` re-arm, does auto-combat need to keep progressing while the tab is hidden (rAF paused → runner can't tick → session stays blocking → indefinite re-arm)? If yes, either unblocking `isSessionBlocking` when `document.hidden` or driving the runner off `setTimeout` in background. Old behavior fell back at 4 s.
- **OQ4 — `turn_cast_start`.** Keep as documented observation feed (recommended — tests pin it), or remove emit + tests?
- **OQ5 — Production e2e now or follow-up?** Design calls it mandatory; flagging because it may deserve its own task scope.
- **OQ6 — `resumeResolved` ordering.** Swap token-check before `cancel()` (nit), and whether the 120 ms tail should carry a visible recovery cue or stay an empty wait.
