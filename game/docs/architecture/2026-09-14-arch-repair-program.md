# Architecture Repair Program — 2026-09-14

Execution program for the findings of
`docs/qa/2026-09-14-full-project-engineering-audit.md` (plus the combat /
economy / lifecycle reviewer reports and runtime evidence alongside it).
Audit verdict: **REPAIR BEFORE MAJOR FEATURES**.

This document is the program-level contract. Per-mission task cards are
written at dispatch time inside each mission worktree (G0/G1 of
`architecture-worker-workflow.md`); this file carries the wave order,
dependencies, locked decisions, and completion gates.

## Locked decisions (user rulings, 2026-09-14)

- **Scope:** missions M1-M13 (all 15 ARCH findings except remote) plus
  baseline hygiene: 24 ESLint errors, 4 failing perfectClear feasibility
  Vitest assertions, 5 failing Playwright specs.
- **M14 (ARCH-015 remote contract):** DEFERRED — separate mission before
  remote rollout; requires a disposable Supabase DB and a deploy decision.
- **MP/Ward regen units (ARCH-003):** per-turn — same cadence family as
  `hpRegenPerTurn`. The `PerSecond` field names are legacy debt; M8
  normalizes the contract at one point. Ward's delayed-regen intent
  (`timeSinceLastHitTaken`) is preserved, measured against the turn cadence.
- **Hoi Xuan Dan (ARCH-008):** RETIRE the family — the removed HP-regen
  mechanic is not restored; the inert pill is marked explicitly
  retired/unavailable on craftable + usable surfaces in M10. Reopenable
  later by user decision to design a replacement effect.
- **perfectClear feasibility:** conditions unchanged — no limit rebalance,
  no fixture/oracle change. The 4 failing multi-hit assertions are
  quarantined via `it.fails` (suite green; auto-alerts if a future change
  makes them pass) and recorded as playtest debt pending skill-system
  completion.
- **Integration:** program branch `arch/repair-2026-09` off master
  (`f2846064`); mission branches merge into it per wave; one final merge
  to master at convergence after full gates — user flags the final merge.

## Wave plan

```text
Wave 0  Setup + lint baseline                    (coordinator worktree)
Wave 1  M1 save | M3 session | M5 tribulation    (5 parallel worktrees)
        | M7 stat refresh | M11 production lane
Wave 2  M2 wash | M6 settlement | M4 lifecycle   (4 parallel)
        | M8 combat resources/phases
Wave 3  M9 buff identity | M12 UI/events         (2-3 parallel)
        | E2E failure diagnosis/repair
Wave 4  M10 authored execution | M13 retirement  (2 parallel)
        | perfectClear quarantine
Wave 5  Convergence: full gates, audit-repro
        regression matrix, roadmap update, deep QA,
        user-approved merge to master
```

## Mission cards

### M1 — Complete save value boundary (ARCH-001, P1, HIGH)

- **Invariant:** every `GameSave` slice is a detached value at the save
  boundary; `computeRestoreIdentity` covers the whole payload (minus the
  documented `lastSavedAt` exclusion); restore is replace/reset for every
  slice with repeat-application semantics; identity commits only after
  successful apply.
- **Owners:** `services/save/SaveSystem.ts` (`buildGameSave` ~319-360),
  `services/save/saveTypes.ts` (`computeRestoreIdentity` 212-218),
  `stores/player.ts` (`restoreFromSave` 342-384),
  `core/game/GameManagerSaveRestore.ts` (`restoreFromSave` 146-401);
  shallow getters in `SkillManager`, `TechniqueManager`, `EquipmentBag`,
  `BuildingManager`, `ProductionSystem`, `AlchemySystem`.
- **Changes:** (a) identity covers all slices (equipment, skills,
  techniques, pills, buildings, equipmentSlots, productionSites,
  alchemyJobs, decompose, talismans/formations stubs); (b) detach every
  slice at `buildGameSave`; (c) restore = full replacement (current
  additive/first-ID-wins in `GameManagerSaveRestore.ts:161-262`); reset
  fields absent from payload; (d) never mutate the input `save` during
  restore; (e) define the pending-ops invalidation hook M2 consumes;
  (f) commit `lastAppliedPayloadHash`/`lastRestoredPayloads` only after
  all slices apply.
- **Tests:** pills-only identity change; live-skill mutation must not
  alter a built snapshot; empty-slice restore clears live state;
  per-slice mutation/replacement matrix; repeated restore; mid-restore
  fault injection + retry convergence.
- **Gates:** full P3; P4 QA; save-reload E2E.
- **Must not:** dev-save backward migration; economy rule changes;
  transaction framework.

### M3 — Preserve admitted session (ARCH-004, P1, HIGH)

- **Invariant:** the session a domain command accepted is the identity
  carried through admission -> resources -> `renderer.prepare` -> READY —
  never re-derived from ambient session state.
- **Owners:** `presentation/createGamePresentation.ts` (124-158),
  `presentation/GamePresentationCoordinator.ts` (337-353, 397-402),
  `presentation/PhaserSceneAdapter.ts` (93-105, 136-157),
  `core/game/GameManager.ts` (972-990), `game/scenes/CombatScene.ts`
  (795-822, 1902-1920), `composables/useTribulation.ts` (44-75),
  `App.vue` (221-238).
- **Changes:** typed behind-curtain contract carrying the accepted
  `RouteRequest`/`SessionRef`; coordinator adopts that session
  (kind-checked), passes a session-bound request downstream; READY
  requires matching `sessionId`/`gameGeneration` for session routes;
  `getCurrentSession` becomes recovery-only for the buffered
  `presentation_session_started` path.
- **Tests:** retained combat victory session -> `runAdmitted('tribulation')`
  enters instead of "Domain command produced no session"; renderer
  receives the adopted session; stale/retry/duplicate READY; same-route
  combat rebind.
- **Gates:** full P3 + P13/P14 actual Phaser E2E.
- **Must not:** new SceneManager/router; reward semantics changes.

### M5 — Unique tribulation terminal (ARCH-006 first half, P1, MEDIUM)

- **Invariant:** `TribulationDirector` commits exactly one terminal
  outcome; a lethal strike ends the run — `enterChapter` never overwrites
  a committed defeat with victory.
- **Owner:** `core/tribulation/TribulationDirector.ts` (`tickTank`
  388-407, `applyLightningDamage` 424-458, `enterChapter` 461-473).
- **Changes:** single terminal-transition guard; `enterChapter` requires
  `active.state === 'ongoing'`; `tribulation_outcome` emitted once from
  one site.
- **Tests:** defense=105 `foundation_establishment` repro -> `["defeat"]`
  only, hp 0; lethal mid-chapter strike; last-frame death at
  final-chapter boundary.
- **Must not:** chapter/damage/reward balance changes.

### M7 — Unify stat assembly/refresh (ARCH-002, P1, HIGH)

- **Invariant:** one owner assembles resolved->effective battle stats;
  live runtime modifiers reach in-battle recompute; ephemeral state
  resets BEFORE the battle-start snapshot; buff add/remove/expire
  refreshes the effective view before the next reader.
- **Owners:** `core/game/GameManagerTurnBattleOps.ts` (741-751, 798-818,
  945-954), `core/game/GameManagerPersistentEffectOps.ts` (74-100),
  `App.vue` (479-486), `core/battle/turn/TurnStatsRecompute.ts` (8-11),
  `TurnBattleSystem.ts` (730-793, 1102-1138), `core/buff/BuffSystem.ts`.
- **Changes:** reset passive/ephemeral state before
  `playerToCombatEntity`; feed a battle-scoped live-modifier provider
  into `recomputeEffectiveStats`; recompute on buff apply/remove/expire
  incl. formation buffs and CC/charge branches; duration-1 buffs folded
  before expiry.
- **Tests:** `tat_phong` 3 kills -> live speed rises in-fight, next
  battle base clean; `thiet_y_tang`/`kim_giap` effective for the counter
  immediately after apply.
- **Must not:** rebalance speed; derive attributes twice; another
  StatCalculator.

### M11 — Per-lane offline production (ARCH-007, P1, HIGH economy)

- **Invariant:** each worker lane completes independently; partial work
  across lanes never synthesizes a completed cycle; identical saved
  state + elapsed yields identical completed-cycle counts online vs
  offline within the documented cap.
- **Owners:** `core/production/ProductionOffline.ts` (210-260 —
  `floor(windowMs * slots / cycleMs)` pools fractional lane time),
  `core/production/ProductionSystem.ts` (363-376, 435-449),
  `core/game/GameManagerSaveRestore.ts` (339-361 entry — coordinate with
  M1; interface pinned in both task cards).
- **Changes:** per-lane advancement preserving deadline/remainder; kept
  future cycles reserve lane capacity; shared advancement semantics
  between `tickWorkers` and `settleOffline`.
- **Tests:** 2 workers due T+100s, settle at T+65s -> 0 granted, both
  pending kept; fractional windows, multi-lane, capped offline, repeated
  save/settle.
- **Must not:** change yields, cycle durations, or the offline cap.

### M2 — Bind generated operations to item lifetime (ARCH-011, P2; after M1)

- **Owners:** `core/equipment/EquipmentWash.ts` (246-361),
  `EquipmentBag.ts` (29-31, 112-140 membership generations), precedent
  `EquipmentRefine.ts`; UI chain `WashTab.vue -> useEquipmentActions ->
  EquipmentOpsSystem`.
- **Changes:** `PendingWashSlot` binds the exact item
  object/membership generation + item snapshot; commit revalidates
  eligibility incl. `locked`/`favorite`; ticket cleared on owner/session
  reset via M1's hook; once-only preserved.
- **Tests:** same-ID replacement marked locked/favorite rejects commit;
  remove-add, changed item, replay, restore invalidation.
- **Must not:** roll odds, forge budget/cost, UI redesign.

### M6 — Domain-owned outcome settlement (ARCH-006 second half, P1; after M3+M5)

- **Owners:** `composables/useTribulation.ts` (149-176),
  `presentation/GamePresentationCoordinator.ts` (314-328),
  `core/tribulation/TribulationOutcomeService.ts`,
  `TribulationDirector.ts`.
- **Changes:** resolved outcome gets domain-owned identity + idempotent
  once-only commit independent of curtain success; presentation consumes
  the committed receipt. Behind-curtain presentation sequencing kept;
  the commit moves to domain.
- **Tests:** curtain failure/retry/reload timing — outcome settles
  exactly once; duplicate settlement converges; exact reward/penalty.
- **Must not:** move pacing authority to rendering.

### M4 — Own boot/host lifecycle (ARCH-013 + lifecycle notes, P2; after M3)

- **Owners:** `composables/useAppLifecycle.ts` (205-277, 316-335),
  `core/battle/turn/RafClockSource.ts` (43-57),
  `components/game/PhaserCanvas.vue` + `composables/useDynamicRegion.ts`,
  `presentation/AssetBundleManager.ts` (100-105 vs 241-279), Electron
  bridge unsubscribe gap.
- **Changes:** boot generation/disposal fence across every await;
  `stopAll` bumps generation; RAF stop honored inside its own callback;
  host bootstrap retry hook; loader publication generation-fenced; root
  unmount disposes combat clock + Electron subscriptions.
- **Tests:** deferred-load -> `stopAll` -> resolve -> zero
  restores/intervals/route entries; double boot; host import failure ->
  retry; loader swap mid-load; RAF self-stop leaves no pending frame.
- **Gates:** full P3 + browser recovery evidence.
- **Must not:** second clock implementation; resource-policy rewrite.

### M8 — Combat resources & turn-phase contract (ARCH-003 + ARCH-010 + C05, P1; after M7)

- **Owners:** `core/battle/turn/TurnBattleSystem.ts` (635-669, 727-740,
  781, 925-958, 1089-1100), `core/combat/EntityVitalsSystem.ts` (86-93),
  `core/player/Player.ts` (451-489),
  `core/battle/turn/TurnSkillAction.ts` (105-130),
  `core/combat/CombatSystem.ts` (345-366).
- **Changes:** (a) MP/Ward regen through the vitals/resource owner in
  **per-turn units (user-locked)** — normalize the legacy `PerSecond`
  names at one contract point; Ward delay preserved via
  `timeSinceLastHitTaken` on the turn cadence; (b) post-status-phase
  liveness boundary — lethal DoT stops regen + charged resolution;
  `EntityVitalsSystem` healing rejects dead entities; (c) charged-hit
  completion preserves the outcome contract (The-gain parity).
- **Tests:** 10 turns regen 10 -> MP/Ward +10/turn capped; dead actor no
  heal / no post-death damage; charged hit accrues `currentThe`; real
  Thanh Tuyen / Bang Giap / Dia Tru kits through the stage loop.
- **Must not:** change cost/regen numbers; per-skill-ID patches.

### M9 — Buff target/ingredient identity (ARCH-009, P2; after M8)

- **Owners:** `TurnBattleSystem.ts` (1049-1050 — proc'd debuff written
  into the attacker's pool), `core/buff/BuffSystem.ts` (363-404 CC
  queries unscoped), `core/battle/turn/TurnReactionManager.ts` (48-64 vs
  93-137), `core/element/ElementReaction.ts`.
- **Changes:** proc'd effects apply through the target's pool with
  correct source/target identity; reaction consumption removes the exact
  matched ingredient instances; multi-source selection defined.
- **Tests:** `thach_hoa` — target pool gets `choang`, source not stunned;
  fire+water x2 consumes player's `bong` exactly once; stacking/refresh/
  removal, self-vs-target.
- **Must not:** element recipes/damage balance changes.

### M12 — Finish UI/event consumers (ARCH-005 + ARCH-012 + ARCH-014)

- **ARCH-005:** `useTurnCombatManual.ts` — every derived computed reads
  `stateVersion.value` (proven pattern `useTurnBattleInfo.ts:20-29`);
  sweep all projections deriving from the plain domain object without
  reading version.
- **ARCH-014:** `GameManagerBattleRewardOps.ts` (88-129 — natural defeat
  never emits `battle_end`); unify one terminal-outcome publication for
  victory/defeat/abandon; migrate/retire dead CombatScene listeners
  (`positions`, `cast_start`, `cast_complete`, `player_teleported`);
  consumers `combatAudioBinding.ts`, `PhaserCanvas.vue`,
  `CombatScene.onBattleEnd`.
- **ARCH-012:** `GameManagerTickOps.ts` (170-209) — notifications show
  delivered amounts + overflow via `createBagOverflowEvent`; production
  carries `amount`+`overflow`, alchemy `pills`/`delivered`/`overflow`.
- **Tests:** same-object countdown->fighting->manual-choice projection
  regression asserting real controls render; each terminal outcome emits
  exactly once to all listeners; full-stack settle asserts bag + quest +
  message agree.
- **Must not:** local timers, weakened guards, UI deciding outcomes.

### E2E baseline repair (after M3/M5/M12 land where overlap exists)

- `accessibility` — Google Fonts `ERR_NETWORK_ACCESS_DENIED` (network
  policy; resilient test or bundled font — may escalate).
- `create-to-combat` — no result modal in 180s; real-time pacing budget.
- `presentation-routing` — likely resolved by M3; re-verify.
- `tribulation-flow` — likely overlaps M5/M6; re-verify.
- `turn-combat-hud` — likely overlaps M12; re-verify.
- Rule: no timeout bumps or assertion removal without a diagnosed root
  cause.

### M10 — Authored-execution parity (ARCH-008, P2; after M8+M9)

- **Owners:** `core/game/SkillToTurnSkillConverter.ts` (94-102 drops
  authored buff duration), `GameManagerTurnBattleOps.ts` (843-858 basic
  selection bypasses `SkillSystem.getEffectiveSkill` scaling),
  `data/skill/TurnBasicAttacks.ts`, `SkillSystem.ts` (94-130), pill
  family (`PillFamilies.ts`, `pills.ts`, `alchemyRecipes.ts`,
  `PillSystem.ts`, `GameManagerPillOps.ts`, `PillBagSection.vue`).
- **Changes:** production basic path consumes canonical resolved output
  (level/cast scaling incl. `tram` flat bonus); authored duration
  override carried through the converter (`appliesBuff.duration`);
  unsupported content rejected or retired explicitly. **Hoi Xuan Dan
  retired per user ruling** — marked unavailable on craftable + usable
  surfaces with a data note; HP-regen mechanic NOT restored.
- **Tests:** real-kit matrix through `GameManager` entry — `tram` level-3
  damage reaches the actual basic; `duong_linh_tuyen` yields 7.984
  duration not 5.988; authored consumables produce a meaningful outcome
  or assert the retired state.
- **Must not:** restore the HP-pill mechanic; redesign skill trees;
  rebalance recipes to compensate.

### M13 — Retire proven compatibility debt (P2; after M3/M8/M12)

- `GameManagerTurnBattleOps.getBattle()` double-cast + live callers;
  legacy event/adapters per M12's ledger; audit §I dead modules
  (`EnemyAttackSystem`, `KiemTranOnHitSystem`,
  `PhapTuBattleResourceSystem`, `SkillEffectResolver`,
  `TheResourceSystem`, `AttackTiming`) — retire only after
  consumer/content verification; parked modules (`WorldMap`/Hex*,
  `MeridianSystem`, `ZoneDotBuffs`) get explicit live/transitional/parked
  labels; `GamePanel`/`SceneHeader`/`ThemedIcon`/iconRegistry — check
  templates first.
- **Must not:** delete parked/type/test-only code on reachability alone.

### perfectClear quarantine (baseline — user ruling: conditions unchanged)

`GameManager.perfectClear.feasibility.test.ts` multi-hit floors 1/5/9/10
fail (floor 9 no victory in 5000 steps). Ruling: needs playtest; skill
system unfinished; keep limits and fixture. Resolution: convert the 4
failing multi-hit assertions to `it.fails` (suite green; auto-alerts on a
future pass) + record the debt in `docs/qa/`; one-shot best-case
assertions keep running normally.

## Wave 5 — Convergence (on `arch/repair-2026-09`)

1. Full P3: type-check + build + full Vitest green + lint clean +
   bundle-split guard.
2. Audit-repro regression matrix: each finding's diagnostic (or ported
   Vitest equivalent) re-run against merged tip — IDENTITY_PILLS_ONLY,
   SNAPSHOT_ALIAS_SKILL, RESTORE_EMPTY_SKILLS, PASSIVE_CURRENT/NEXT,
   REGEN, ON_HIT_POOL, CHARGE_THE, DEAD_CHARGE, AUTHORED_MONK_BUFF,
   MULTISOURCE_REACTION, SPECIALIZATION_DURATION, BASIC_PROGRESS,
   TRIBULATION_LETHAL_END, ADMITTED_RENDERER_SESSION/COLLISION,
   BOOT_COMPLETES_AFTER_STOP, offline-settle parity, wash same-ID commit,
   notification receipts.
3. Full Playwright suite — 5 baseline failures resolved or documented
   with root cause.
4. P4 adversarial QA deep mode — verdict in `docs/qa/`.
5. Roadmap §0.8a statuses updated; closeout note lists verified
   contracts + retained debt (M14, art debt, equipment-speed affix
   units, perfectClear playtest debt).
6. User flags the final `arch/repair-2026-09` -> master merge (P7).

## Cross-cutting risks

- **Merge conflicts:** `TurnBattleSystem.ts` (M7->M8->M9),
  `GameManagerTurnBattleOps.ts` (M7->M8->M10/M12),
  `GameManagerSaveRestore.ts` (M1->M2/M11), `CombatScene.ts` (M3->M12),
  `TribulationDirector`/`useTribulation` (M5->M6). Wave ordering
  serializes same-file missions; coordinator reviews the aggregate diff
  after each wave.
- **M1<->M2 contract:** pending wash/refine invalidation on session
  restore — M1 defines the hook, M2 consumes it.
- **P14 caveat:** browser launch unreliable inside `.agent-worktrees/` —
  visual checks run from the main checkout at branch finishing or defer
  with `DONE_WITH_CONCERNS`.

## Deferred / out of scope

- M14 remote contract (user-confirmed deferral).
- Equipment speed-affix fractional units; decompose->collect-quest
  notification; `pourCultivationOvercharge` gap in
  `chooseCultivationPath`; tribulation cooldown/injury persistence;
  asset-bundle granularity/cache eviction; Electron packaged
  suspend/resume matrix; remote save capability.
- perfectClear achievability for realistic party composition — playtest
  debt, recheck after skill/content completion.
