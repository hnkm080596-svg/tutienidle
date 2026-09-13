# M1 — Save snapshot/restore boundary repair (ARCH-001, P1, HIGH)

Worktree `.agent-worktrees/arch-m1-save-boundary`, branch
`arch/m1-save-boundary`, base `81c30e04`. Verification mode: **full**
(Pinia root state + major save/restore architecture).

## G0 task card

Repair ARCH-001 before major feature work continues. Required boundary:

```
Domain snapshots → Detached Game Save → Validation → Session Restore Transaction → Domain Owners
```

Invariant: every `GameSave` slice is a detached value at the save
boundary; `computeRestoreIdentity` covers the whole payload (minus the
documented `lastSavedAt` exclusion); restore is replace/reset for every
slice with repeat-application semantics; identity commits only after
successful apply.

## G1 evidence map (defects found before repair)

- `computeRestoreIdentity` hashed only
  `[version, player-minus-lastSavedAt, materials, quests]` — techniques,
  skills, pills, equipment, buildings, slots, production, alchemy,
  decompose, talismans, formations were invisible to the identity.
- `buildGameSave` detached only `player` (JSON), `materials`/`pills`
  (fresh stack records), `quests`/`decompose` (structuredClone).
  `techniques`, `skills`, `equipment`, `buildings`, `equipmentSlots`,
  `alchemyJobs` were returned by live reference; `productionSites` was
  shallow-mapped (live `activeCycle`/`workerCycles`). Aliasing ran both
  ways: live→save and save→live.
- Restore was additive: `techniqueManager.add`/`skillManager.add` skipped
  already-known ids; `equipmentBag.add` never cleared; equipment slots
  overwrote only supplied entries; `player` used `Object.assign` so
  payload-absent fields kept previous-session values; absent
  `alchemyJobs`/`decompose`/`quests`/`productionSites` did not reset.
- Restore mutated its input: template backfill wrote
  `skill.execution`/`targeting`/`name`/`description` and
  `technique.name`/`description` directly on the payload.
- `lastRestoredPayloads`/`lastAppliedPayloadHash` committed identity
  BEFORE the apply finished — a mid-restore throw left the payload
  committed, so a retry of the same payload was skipped by the guard.
- `EquipmentSystem` held pending wash ticket + refine preview across a
  restore; a ticket issued pre-restore could commit onto the restored
  item set.
- `restoreGameSession` let a mid-restore throw propagate as an uncaught
  boot exception instead of a handled `rejected` result.

## Red → green evidence

New/extended tests (authored red first; initial run: 4 files, 29 failed /
17 passed — all failures matched the intended defect list):

- `src/core/game/GameManagerSaveRestore.boundary.test.ts` (18 tests) —
  per-slice replacement matrix, empty/absent-slice reset, input
  immutability, post-restore save isolation, A→B→A convergence,
  mid-restore fault + retry, `restoreGameSession` handled rejection,
  pending wash + refine invalidation.
- `src/services/save/SaveSystem.restoreIdentity.test.ts` (extended) —
  identity changes for every slice; `lastSavedAt`-only changes do not.
- `src/services/save/SaveSystem.snapshotIsolation.test.ts` (extended) —
  both-direction detachment incl. Pinia-reactive player state.
- `src/stores/player.restoreFromSave.test.ts` (extended) — absent
  optional player fields reset; identity commits only on success.

Post-fix run: **46/46 green** in the four files.

## Production changes

- `services/save/saveTypes.ts` — `computeRestoreIdentity` serializes every
  declared slice; only `player.lastSavedAt` excluded; absent optional
  slices hash as `null` (distinct from `[]`).
- `services/save/SaveSystem.ts` — `detachSaveValue` (JSON round-trip,
  Proxy-safe) applied to every `buildGameSave` slice; `restoreGameSession`
  wraps the apply transaction and returns `{status:'rejected'}` on a
  mid-restore throw (preflight already rejected before any mutation).
- `core/game/GameManagerSaveRestore.ts` — techniques/skills rebuilt on
  clones then `manager.restore()` (full replace); `equipmentBag.clear()`
  before add; slot/building/quest/production/alchemy/decompose restores
  consume detached values; absent slices reset via `?? []`/`?? default`;
  `equipmentSystem.invalidatePendingOperationTickets()` after item-set
  replacement; `lastAppliedPayloadHash` commits at the end.
- `stores/player.ts` — player slice = `{...createDefaultPlayer(),
  ...clone(save.player)}` (absent fields reset to defaults) + dynamic
  `$state` keys not in `PlayerData` are deleted; identity commit moved to
  after `normalizeArtifactProgress`.
- `core/player/Player.ts` — `highestFoundationAchieved: undefined`
  declared in defaults (existing `toRefs()` snapshot contract — the
  outcome service writes via store proxy, so an undeclared key never
  reached `$state`/save and could not be reset).
- Owner APIs: `SkillManager.restore`, `TechniqueManager.restore`,
  `EquipmentBag.clear`, `BuildingManager.restore` (detached),
  `EquipmentSlotManager.restore` (reset all 6 fixed slots + detached
  entries), `QuestManager.restore` (detached), `ProductionSystem.
  restoreStates` (deep-detach `activeCycle`/`workerCycles`),
  `AlchemySystem.restoreJobs` (detached), `DecomposeSystem.restore`
  (absent slice → defaults).
- `core/equipment/EquipmentWash.ts` `invalidatePendingWashTicket` +
  `core/equipment/EquipmentRefine.ts` `invalidatePendingRefinePreview`
  (unconditional, domain-owner-held writes — keeps the R14 paid-random
  guard green) wired through
  `EquipmentSystem.invalidatePendingOperationTickets()`.

## Adversarial review findings (resolved)

- `paidRandomContract` guard flagged `washPendingSlot.set` inside
  `EquipmentSystem.ts` → invalidation writes moved into
  `EquipmentWash.ts`/`EquipmentRefine.ts`; the system now issues commands
  only.
- `progressionOutcomeOwnership` guard flagged a `= `-style snippet in the
  new `Player.ts` comment → reworded (literal default declarations are
  exempt; the regex scans comments).
- `highestFoundationAchieved` stale-field test failure exposed a real
  pre-existing persistence hole (proxy write never reached `$state`) —
  fixed via the declared default, matching the documented
  `cultivationPath`/`kiemTuRoute`/`artifact` pattern.

## Verification (full P3)

- `npm run type-check` — PASS.
- `npm run build` — PASS (vite 29.04s; pre-existing chunk-size warning).
- `npx vitest run` — 546 files, 3832 passed / 3 failed. The 3 failures
  are `GameManager.perfectClear.feasibility.test.ts` multi-hit probes —
  **documented pre-existing fixture-calibration debt**
  (`2026-09-14-beta-c2-architecture-gate.md`, known-gaps list); unrelated
  to save/restore. Two earlier full-run flakes (worker-spawn timeouts,
  asset fetch/timeout tests, `autoFarmOffline` 5s timeout) re-ran green
  in isolation (59/59).

## Remaining concerns

- `player.load()` still calls `store.restoreFromSave` directly (not the
  `restoreGameSession` coordinator) — pre-existing shape, unchanged.
- Offline settle and decompose timer keep their merge (`Math.max`,
  `started ||`) repeat-application contract by design — idempotent
  re-apply verified by tests.
- Pending-operation invalidation is whole-set granularity; M2
  (ARCH-011) will add per-item lifetime binding on top of this hook.
