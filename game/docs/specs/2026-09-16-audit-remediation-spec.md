# Audit Remediation Spec — 2026-09-16

**Source audit:** `docs/qa/2026-09-16-full-project-scout-audit.md` (merged two-agent report, all findings verified). Finding numbers below (`T1-3`, `T5-41`, …) reference that file's tables.

**Goal:** Fix the confirmed defects and consolidate the three weak boundaries (persistence, lifecycle, authority) before further feature expansion.

**Non-goals:** No gameplay redesign, no new features, no mass i18n/comment migration, no dead-code deletion beyond what a task explicitly owns. Preserve authored gameplay intent.

## Product decisions (locked 2026-09-16, owner: user)

- **Dev-stage rule:** the game is not live — there is NO migration concern. Old-save migrations, version compat shims, and legacy↔new "bridge" code are defects to delete, not behavior to preserve. Fix the code directly; do not write migrations.
- **Root-cause rule:** choose the strongest infrastructure fix; no symptom-patching.
- **C1 auto-repeat:** each repeat cycle is a **fresh battle** — HP/MP/Ward restored, buffs/debuffs/cooldowns/gauge/path-runtime/proc counters all reset, identical to a new `startStage`.
- **D2 production realms:** beta scope ends at Trúc Cơ (foundation_establishment). Realm→territory-tier resolution must clamp cleanly to the top supported tier and leave a documented extension point — do not author higher-tier content now.
- **D3 worker model:** **workers are required fuel for production** — all production runs through worker lanes; the player decides worker allocation. The manual `activeCycle` path is removed entirely (not kept as a bridge).
- **B5 auto-farm stop:** control in BOTH places — a persistent HUD indicator while auto-farm runs + a control inside StageSelectPanel.
- **Artifact (Pháp Bảo):** combat path stays parked — a dedicated reimagine lands after the cultivation-path framework. Until then, remove/hide all combat-effect advertising (milestones, HUD slot) so players aren't misled; dormant runtime files stay for that future rework.
- **E11 dead-end content:** deferred to the roadmap for pre-beta handling — do not wire up or delete now; add a roadmap section tracking them.
- **F8 cloud save:** `SAVE_KEY` becomes per-account (`SAVE_KEY:<userId>`, guest slot for unauthenticated). Login pulls that account's remote save, newest-wins. Fix the SQL talent-cardinality bug **in place** (edit the migration file — dev stage, not yet applied anywhere that matters). Add token refresh + fetch timeout.

**Verification contract (P3):** `quick` = `npm run type-check` + `npx vitest run <relevant scope>`; `full` adds `npm run build` + whole suite. Wiring-critical changes (App.vue, useAppLifecycle, boot, tick, scene lifecycle) additionally need the relevant Playwright e2e (P13). Every task ends with a failing-test-first cycle where feasible (P4 quick QA after each mission).

---

## Mission A — Save integrity (highest leverage)

Closes the persistence boundary. Both audits converged here: T1-1, T1-3, T1-7, T1-9, T2-13, T2-14, T2-15.

### A1. Deep per-slice save validation

**Problem:** `validateGameSaveShape` checks player/equipment/materials/pills deeply but only `optionalArray`/`isObject` for `productionSites`, `alchemyJobs`, `buildings`, `quests`, `talismans`, `formations`, `equipmentSlots`-adjacent fields, and only `settings.workers` inside `decompose`. Malformed elements pass the gate then crash or corrupt runtime (quest `active:"x"` → TypeError; building `level:"bad"` → NaN rates; decompose `nextCycleAt:"bad"` → per-tick runaway).

**Contract:** after `validateGameSaveShape()` returns `ok`, domain restore may trust the declared TypeScript shape. One `validate<Slice>Save` function per aggregate — not scattered `if`s:

```
validateGameSaveShape
 ├── validatePlayerSave          (exists)
 ├── validateEquipmentEntries    (exists)
 ├── validateStackEntries        (exists — materials, pills)
 ├── validateQuestSave           (new: active array, questId string, amount finite ≥0, claimed bool, completedOnceIds string[], lastDailyResetAtMs finite)
 ├── validateBuildingSave        (new: buildingId string, level finite int ≥1 ≤ maxLevel, accumulated finite ≥0)
 ├── validateProductionSiteSave  (new: siteId string, level finite int, autoRestart bool, activeCycle/workerCycles → validateProductionCycleSave: timestamps finite, seed finite)
 ├── validateAlchemyJobSave      (new: all fields present, finite timestamps, string ids)
 ├── validateDecomposeSave       (extend: nextCycleAt finite ≥0, started bool, gradeFilter/ageFilter ∈ enums)
 └── validateEquipmentSlotSave   (exists — reuse)
```

**Files:** `src/services/save/saveShapeValidation.ts` (new validators + wire into `validateGameSaveShape`), `saveShapeValidation.test.ts` (one rejection test per malformed field — at minimum: quest `active` string, building `level` string, decompose `nextCycleAt` string/NaN-equivalent, productionSite missing `siteId`, alchemyJob `completesAtMs: "x"`).

**Defense-in-depth (cheap, do it):** `DecomposeSystem.restore` clamps with `Number.isFinite` guards so even a bypassed validator can't poison the timer; `QuestManager.restore` normalizes `active` via `Array.isArray` check.

### A2. Persist `assignedWorkers`

`ProductionSiteStateSave` gains `assignedWorkers?: number`; serializer at `SaveSystem.ts:366-376` maps it; restore in `GameManagerSaveRestore`/`GameManagerBuildingOps` passes it through (restore path already consumes `state.assignedWorkers` — verify). Round-trip test: assign → save → fresh restore → `getState(siteId).assignedWorkers` matches.

### A3. Round-trip conformance test (executable changelog)

New test `tests/architecture` or `SaveSystem.roundTrip.test.ts` extension: build a fully-populated live state → `buildGameSave` → `JSON.parse(JSON.stringify())` → `validateGameSaveShape` → restore into fresh runtime → re-save → **deep-equal both saves**. Mutate each declared persistent field one at a time and assert it survives. This makes T2-14 structurally impossible going forward: any field the serializer drops or the validator rejects fails the diff.

### A4. `combatInputMode` persistence

`App.vue:97-108`: dirty signature becomes `battleRunMode + '|' + combatInputMode` (or a small tuple compare). Regression test in `useAppLifecycle`/`App`-level test: toggle `combatInputMode` alone → `savePersistedUiAutomationFlags` called.

### A5. Exception-safe recovery storage

Route `backupCurrentSave`, `restoreBackup`, `deleteSave`, and `importSaveRaw`'s writes through the same try/catch → `SaveWriteResult`-style contract as `writeGameSave`. Recovery UI surfaces the failure instead of throwing.

### A6. Restore hygiene

`player.ts:355-395` — stop spreading unknown payload keys onto `$state`; whitelist declared `PlayerData` fields. Test: save with a foreign key → restore → `player.$state` has no such key.

---

## Mission B — Durability at boundaries

Closes T1-2, T1-4, T1-5, T1-6, T1-8, T1-12, T6-51, T6-52.

### B1. Quit-save acknowledgement

`useElectronBridge.ts:71-79`: check `result.status === 'ok'` before `notifyFlushComplete()`. On failure: still notify (the 2s backstop must not hang the app) but log + surface via the notification store where possible; main process needs no protocol change (timeout already exists). Also fix re-entrancy: track in-flight flushes in `flushedWindows` handling — add `win` to a `flushingWindows` WeakSet on first `close` so a second `close` event doesn't re-trigger renderer save (`electron/main.ts:130-157`).

### B2. Character-creation transaction

`App.vue:647-675`: `bootGame(true)` must not start the tick loop until the first durable save commits — reorder to `initialize → grants → save → startTickLoop → entered`, or tear down the started runtime on save failure. Check `useAppLifecycle.bootGame` internals for the right seam.

### B3. Auto-repeat / defeat stage-slot leak

`GameManagerBattleRewardOps.ts:135-137`: release `StageManager.active` on defeat regardless of repeat mode (stage system's own comment says death stops the stage and auto-repeat). Failing test first: start stage + repeat → force defeat → assert `stageManager.active` null and a new `start()` succeeds. This fix must be coordinated with **Mission C** (repeat carry policy) — B3 only fixes the leak; C decides what resets.

### B4. Refight Promise contract

`useBattleActions.ts` + victory/defeat panels: make `startBattle`/`refight` consistently return `Promise<boolean>`; `await` it in countdown handlers; on `false`/rejection reset retry state and re-enable the button. `useAutoRetryCountdown` callback type becomes `() => void | Promise<void>`.

### B5. Auto-farm stop

`stopAutoFarm` has zero production callers — wire it: persistent HUD indicator while auto-farm is armed + control inside `StageSelectPanel` (decision: both places). On reload-after-autofarm ensure the orphaned state can't double-pay: settle uses `max(lastCheckedMs, offlineSince)` semantics.

### B6. Detached subscription cleanup

`App.vue:97-108`: capture `ui.$subscribe` return value; call it in `onUnmounted`.

---

## Mission C — Battle lifecycle constitution (do before expanding combat features)

Closes T5-41, T5-42, T5-43, T5-44, plus T3-19/T3-22 which are symptoms.

### C1. `RepeatCarryPolicy` — decided: FRESH BATTLE

Locked: each repeat cycle is a fresh battle — full reset of HP/MP/Ward/buffs/debuffs/cooldowns/gauge/survive/path-runtime/proc counters/dynamic basic/`currentThe`, identical to a new `startStage`. Encode as a `RepeatCarryPolicy` constant (everything reset) consumed by the cycle owner; update `roadmap.md` combat-chain section in the same change (P17).

### C2. `beginBattleCycle(policy)` owner

One entry that owns the full reset/setup list per policy (`fresh` | `stage` | `repeat` | `tribulation` | `test`); the four existing entry paths delegate to it. Each currently-scattered reset moves behind the owner — no entry path keeps its own partial list.

### C3. Single RNG authority

Injectable session RNG reaches hit/block/crit/ignore-resist/placement. Enables deterministic replay tests; prerequisite for meaningful combat e2e assertions.

### C4. `CultivationPathRuntime` boundary

Interface exposing basic provider / special / ultimate / battle-start buffs / reset hooks / survive sources per path; `GameManagerTurnBattleOps` stops branching on path ids.

### C5. Skill-semantic correctness (content bugs)

After C1-C4 land: fix `thanh_luy` target (caster not enemy), `thach_hoa` proc owner, `elementApplicationPercent` application in turn combat, `ailmentStackBonus` 1-stack default, and extend `SkillToTurnSkillConverter`'s unsupported-field report to cover `scope`/`refresh`. Each gets a failing content test first.

---

## Mission D — Worker economy authority

Closes T1-1 (done in A2), T3-17, T3-18, T4-29, T4-30, T5-47 (worker parts), N-02.

### D1. Workforce read model

One authoritative `getWorkforceView()` returning `{ total, reserved, available, requested, effective, idle }` — production panel renders it directly; `workerMode` derives from `assignedWorkers` presence (delete the local ref).

### D2. Production realm-tier resolution

Resolve player realm → territory-supported tier at one boundary (`ProductionSystem` entry): clamp to the top supported tier (beta scope ends at foundation_establishment — decided), `indexOf → -1` fallback deleted, extension point documented for post-beta tiers.

### D3. Workers-as-fuel model — decided

All production runs through worker lanes; workers are required fuel. **Remove the manual `activeCycle` path entirely** — no bridge kept (dev-stage rule). Lane count = `activeWorkerSlots` exactly; apply uniformly to online tick and `settleOffline` via one shared helper. UI start-cycle controls are removed; the panel becomes pure worker allocation.

### D4. Decompose cadence

Per the code comment's stated contract: after a catch-up cycle, `nextCycleAt = nowMs + cycleMs` (not `+= cycleMs` from a stale deadline). If true catch-up is desired instead, define a bounded `maxCatchUpCyclesPerTick` and document it. Test: stall 300s at 30s cycle → exactly 1 cycle on next tick, next deadline = now + 30s.

### D5. Shared capacity split

`resolveProductionWorkerCapacity(player)` used by both `GameManagerTickOps` and `GameManagerSaveRestore` — delete the second copy.

---

## Mission E — Correctness & UX batch (independent small fixes)

Each is a self-contained small task; group per area for PR sanity:

- **E1.** Kill-quest id mismatch: carry template/species id alongside runtime entity id through `BattleLootSystem` → quest + hidden-beast consumers (T3-16). Failing test: kill `wild_wolf` → quest progress increments.
- **E2.** Material pills: reject `drink`/`use` for material-type pills in `GameManagerPillOps`; remove the drink binding in `PillBagSection` (T1-10).
- **E3.** Quest claim atomicity: grant rewards before debiting costs, or make debit conditional on successful grant (T1-11).
- **E4.** Tribulation: apply documented HP regen in `TribulationDirector` tick, emit `damage` events (or fix scene listener to `entity_vitals_changed`), fix overlay computed chain to return primitives/snapshot (T3-21, T3-23, T6-54).
- **E5.** Offline summary: report actual post-cap cultivation; single owner for showing the modal (T3-26, T5-48).
- **E6.** UI staleness batch: `BuildingConstructionGate`/`useBuildingNavigation` read `stateVersion`; `AlchemyView` disable button + show `alchemy.reason.*` toasts; `StageSelectPanel` only close on `startAutoFarm() === true` + disarm on stage change (T4-31, T4-32, T4-38).
- **E7.** Wash/refine batch: preview iterates the *rolled* affix list (incl. zero-line case), enforce min-affix range, unify ticket lifecycle semantics between wash/refine (one policy: when is a paid ticket consumed?), clear pending ticket on unmount, fix tooltip cap to `MAX_SLOT_ENHANCE_LEVEL` (T4-33, T4-34).
- **E8.** `WorldAnnouncementOverlay`: drop below modal layer or scope the click interceptor; add Escape/timeout cleanup/focus handling (T4-35).
- **E9.** Raw IDs → display names via `TURN_SKILL_DISPLAY_META` in CompanionPanel + BattleLogPanel; mojibake strings → i18n keys (T4-36, T4-37).
- **E10.** `weightedRandom` empty-input throw; `NodeSystem` unknown-realm prereq → warn/reject instead of silent pass (T8-71, T8-75).
- **E11.** Dead-end content → **roadmap entry, pre-beta** (decided: defer, don't wire or delete). Add a `roadmap.md` "deferred content" section listing: `alchemy_thong_mach_dan`↔parked MeridianSystem, `great_dao_seed` boss-gate, `heaven`/`great_dao` grades + `pham_nhan_chi_cot`, realm-gated `phap_tu`/`kiem_tu` top-tier nodes, artifact combat reimagine. UI-only stopgaps where players can be hurt now (e.g. craftable-unusable pill is already blocked by E2's material-pill rejection).
- **E12.** `phap_tu_an` visual form fallback; `PlayerVisualForm` handles hidden-path ids (T4-39).

---

## Mission F — Infrastructure

Closes T7-60..68, T5-46.

- **F1.** tsconfig: include `tests/architecture/**` + `tests/lab/**` in a project so `npm run type-check` covers them.
- **F2.** Exclude `tests/lab/**` from the default vitest glob (or move lab under a non-matching dir); delete committed `scratch.test.ts`.
- **F3.** Playwright: `strictPort:true` + unique port per worktree + `reuseExistingServer` only locally-not-CI; drop `DEADLINE_SCALE` or scope it to a documented flake-tagged subset.
- **F4.** Add `npm run verify` = type-check + build + vitest; document in AGENTS.md as the canonical evidence command.
- **F5.** `.env*` gitignore, fix `index.html` lang/title, pin Vue off `rc` (or document the deliberate choice), remove `patch-t14.cjs`, fix `check-bundle-split` usage comment, cmd-agnostic env syntax (`cross-env` or node script).
- **F6.** Tick constant: either wire `SpeedSettings.TICK_INTERVAL_MS` into `useAppLifecycle` or delete the dead export + fix its comment.
- **F7.** EventBus: snapshot handlers before dispatch; isolate per-handler exceptions with logged names (T5-49).
- **F8.** Supabase + save keying (decided): `SAVE_KEY` → `SAVE_KEY:<userId>` with a guest slot for unauthenticated play; login pulls that account's remote save (newest-wins); fix the talent-cardinality CHECK **in the existing migration file in place**; add token refresh + fetch `AbortSignal` timeout on `SupabaseHttp`.

## Mission G — Dead-code & type-hygiene sweep (last, cheap)

- **G1.** M13 dormant cluster + legacy bridges: **delete** (dev-stage rule — no compat to preserve). `SkillTriggerRunner`, `SkillEffectSystem`, `SkillActionRegistry` runtime path, `ActionImpactSystem`, `ActionTargetingSystem` dead helpers, `Battle.ts` transitional types, `createArtifactRuntime` callers, `fireKillTriggers`/`killIfDead` 3rd arg, Phù/Trận socket chain, `statKeyMigration`, `pham_nhan` legacy keys, retired-save-resolution shims — all deleted with their tests adjusted to the surviving contracts. **Exception:** artifact combat runtime files stay parked (reimagine pending) — but their combat-effect *advertising* in UI is removed now.
- **G2.** `as never` fixes: typed `Material` fallback in `GameManagerTickOps`, `DecomposeSettings[...]` casts, typed event payload; `CombatScene` handler tuples → `EventHandler<never>`; `declare global` for `__tutienPhaserGame`.
- **G3.** Dead UI/data cleanup: unreachable MainMenu, empty router dep decision, floor-8 beetle typo (`Stages.ts:145` → ferocious variant or intentional?), dead `the_tu`/`pham_nhan` keys, no-producer materials (add drop or remove from allowlist).
- **G4.** Dedup batch: shared quality-color table, `getNodeMaxLevel` reuse, `ESSENCE_REALM_ORDER` → derive from `RealmTierMap` or declare intentional divergence, shared material-id constructor, material/pill bag mutable-stack encapsulation.

---

## Execution notes

- **Order:** A → B → C → D → E → F → G. A+B are data-loss; C must precede any new combat/path feature work; E items are independent and can run parallel to C/D by different workers. All product decisions locked above.
- **Per-mission gates:** each mission = one worktree (P2), quick verification per task + full before merge, triggered P13/P14 checks run inside that worktree (no deferral to a main checkout), adversarial-QA quick after each mission (P4), P5 three-lens review round before completion (zero unresolved Medium+).
- **Known-intentional, do not "fix":** parked MeridianSystem, retired `hoi_xuan_dan`/`dung_nham_burn`/`PARKED_TALENTS`, `phap_tu_an`/`da_phap` hidden stubs, post-foundation realm placeholder data, `REALM_SLOT_TABLE` full coverage, test-support files under `src/` (deliberate convention — though they should move under `tests/` in G-sweep or be excluded from production imports by an arch guard).
