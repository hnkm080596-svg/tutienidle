# Coordinator attack brief — beta-release-2026-09-29

Inspector: coordinator (local). Target: frozen S1 @ f1049b5e.
Surfaces attacked: identity matrix, stage admission, battle reward exactly-once,
battle terminal states, quest claim atomicity, offline accrual, save whitelist,
restore domain gate, event-bus listener lifecycle, breakthrough gate read-model
parity, release policy suppression.

## Clean surfaces (SOURCE_PROOF)

- **6-ways identity** — CULTIVATION_PATH_WAY_IDS is the single census
  (3 paths x 2 ways); CultivationPathSystem.commit writes way+path atomically,
  refuses a second commit. No second authority found.
- **Stage admission** — StageWaveSystem.start is transactional: lease acquire →
  pick/launch → any throw rolls lease back. canStart mirrors both gates.
- **Battle reward exactly-once** — rewardsGranted set + battleEndEmitted flag in
  GameManagerBattleRewardOps; abandon path shares the same once-guard
  (emitAbandonEnd); reset on stage start.
- **Terminal states** — all `battle.state = victory|defeat` writes are the legal
  end conditions inside resolveNextStep (wave-complete, wipe, timeout) +
  runToCompletion test helper.
- **Quest claim** — resolveClaimable gate → grant → collect-debit → drops →
  markClaimed; claimed flag + canClaim make double-claim impossible.
- **Offline accrual** — single GameClock.calculateOfflineTime authority;
  cultivation pays per-buff-expiry segment through splitCultivationSpeedWindow;
  NaN/±Inf blocked at save validator + calculateOfflineProgress guard;
  production/decompose/auto-farm settle share the >60s window + capacity clamp.
- **Restore whitelist** — every one of the 53 PlayerData fields exists in
  createDefaultPlayer (scripted census: 0 orphans); foreign keys are deleted at
  restore; modifiers on domain-gated stats drop unless they declare the owning
  domain; baseStats keys filtered to allowedStatKeys.
- **Event lifecycle** — every eventBus.on call site inspected has a paired
  off/unsubscribe (CombatScene.unsubscribeCombatEvents, useAppLifecycle stopped
  guard, BattleMetrics teardown, AssetLoaderScene one-shot offs).
- **Determinism** — every Math.random consumer in domain code is behind an
  injectable `random`/`rng` param (CombatRng, drops, gacha, refine, alchemy);
  Date.now uses are id-generation/offline-clock only, not gameplay math.
- **Breakthrough read-model parity** — RealmPanel renders exactly
  realmAdvanceOps.getBreakthroughRequirements (same predicate rows that gate
  canTriggerBreakthrough); hidden inputs never rendered (QI-D6).

## Findings

| ID | Sev | Status | Evidence | Symptom |
|---|---|---|---|---|
| COORD-1 | Low | Confirmed (source) | BreakthroughGate.ts:66,75-77 | foundation_establishment returns [] requirement rows; if release policy ever opens TC->KD, canTriggerBreakthrough = `length>0 && every` = false — silently dead transition with no rows rendered. Dormant in beta (ceiling closed); activating TC->KD must add requirement rows at the same time. |
| COORD-2 | Low | Confirmed (source) | RealmPanel.vue:51-55 + BreakthroughGate.ts:50-53 | When transition is release-closed, requirements = [] — the section shows an empty list; RealmPanel compensates with `nextRealmBeyondCeiling` banner. Parity OK — recorded as verified-clean, no action. |

## Coverage gaps handed to repair/deep phase

- UI↔domain parity beyond breakthrough read-model (panels render derived
  state; per-panel render-vs-owner audit not exhaustively done this pass).
- The e2e spec fix (teleport wheel slot) landed in the QA run checkout —
  diff at `git status` M game/tests/e2e/cultivation-path-ritual.spec.ts.

## Additional clean surfaces (wave 2)

- **Save shape validation** — realmLevel >= 1 finite, cultivationPerSecond
  non-negative finite, attributePoints non-negative, companion realmLevel
  integer in [1, maxLevel]. Version/classification gates reject corrupt shapes.
- **Auth/creation split** — config presence selects Supabase (guest signup
  makes a real anonymous session -> server-authoritative talent roll + name
  check) vs mock service offline. Cloud CAS = revision + resync + one retry,
  revision reset on new character.
- **Auto-farm offline** — settle runs before reconcile; anchors lastCheckedMs
  to the UNSETTLED remainder (T1-12 double-pay fix verified in source);
  eligibility re-validated before paying (revoked perfect-clear drops the farm
  before it can pay).
- **Notification queue** — MAX_QUEUED_TOASTS=100 + drop-newest policy; no
  unbounded growth under AoE loot storms.
- **World announcements** — auto-close timer cancelled on show/hide; identity
  check prevents a stale timer closing a newer announcement.
- **Battle step timers** — pendingStepTimers tracked and cleared on reset;
  animation fallback uses the same pool.
- **Buff lifecycle** — ordered expiry phases (death -> expiry -> bound-marker
  re-sweep); reasons carry through events; no orphan modifiers.
- **i18n parity** — vi.json 961 keys == en.json 961 keys, 0 missing either way.
- **Companion pull tokens** — isCompanionPullTokenSourceSuppressed consulted at
  quest unlock/claim/loot delivery (origination suppression, not clawback);
  banked balances never re-checked.

## Sweep-cluster coverage (solo — persistence/inventory/economy/stats)

All SOURCE_PROOF clean:

- **MaterialBag + PillBag** — NaN/negative/non-finite guarded on add AND
  remove; overflow returns the spilled amount (reward callers toast);
  canAcceptAmount preflight exists for atomic exchanges.
- **EquipmentSystem** — equip/unequip symmetric (flip flag + applyModifiers /
  removeBySource); re-equip idempotent ok:true even cross-realm (deliberate —
  worn item survives breakthrough); grade gate rejects mismatched equips.
- **VendorSystem.sellMaterial** — full credit preflight via canAcceptAmount
  BEFORE debit (A9 failed-exchange preserves all balances); sole-recipe
  ingredient guard; grade gate after price check preserves legacy reasons.
- **NodeSystem refunds** — computeNodeRefund replays the frozen cost curve
  minus recorded waivers; revokeNodeOwnership cascades into granted skill
  cores (lifecycle-tied); rewardOnly nodes guarded inside the seam itself.
- **ProductionSystem settle** — sequential offline settle, per-cycle rolls
  (never multiplied), total cap budget, backlog cancelled rather than drained
  slowly past cap; worker lanes advance top-up-then-settle.
- **StatCalculator** — canonical flat -> increased(pooled) -> more pipeline;
  domain gate first; two-pass attribute derivation documented; clamps at
  consumption (clampStatValue), never in-pipeline.
- **Save backup/delete** — backupCurrentSave best-effort before destructive
  ops; deleteSave returns observable success (callers reload only on true);
  restoreBackup removes import handoff BEFORE writing.
- **CloudSaveCoordinator** — revision + resync + exactly one retry; revision
  reset on new character; never fabricates success on unavailable.

No Medium+ findings from the solo sweep. Sweep agent covered this cluster
was rate-limited mid-run; coverage re-done by coordinator directly.
