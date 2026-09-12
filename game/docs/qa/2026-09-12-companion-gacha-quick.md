# QA Review: companion-gacha

- Date: 2026-09-12
- Mode: quick
- Verdict: FAIL
- Task-owned paths (branch `companion-gacha`, `eb9fc8c5..2246754a`):
  - Production: `game/src/core/companion/CompanionCombat.ts`, `CompanionGacha.ts`, `CompanionProgression.ts` (new; `CompanionLeveling.ts` deleted), `game/src/core/game/GameManager.ts`, `GameManagerCompanionOps.ts` (new), `GameManagerTurnBattleOps.ts`, `BattleLootSystem.ts`, `game/src/core/player/Player.ts`, `game/src/data/companion/Companions.ts`, `game/src/data/enemy/Enemies.ts`, `game/src/data/materials/materials.ts`, `game/src/data/quest/quests.ts`, `game/src/data/skill/TurnSkillDisplayMeta.ts`, `game/src/data/ui/commandWheelCatalog.ts`, `game/src/presentation/contracts/panelIds.ts`, `game/src/services/save/saveShapeValidation.ts`, `saveVersion.ts`, `game/src/components/layout/GameRoot.vue`, `game/src/components/panels/CompanionPanel.vue` (new), `TranPhapPanel.vue`, `WorkerLodgePanel.vue`, `worker-lodge/ChieuMoTab.vue` (new), `worker-lodge/DuyenPhanTab.vue` (new), `game/src/locales/{en,vi}.json`
  - Tests: `CompanionGacha.test.ts`, `CompanionProgression.test.ts`, `CompanionCombat.test.ts`, `CompanionLeveling.test.ts` (deleted), `GameManagerCompanionOps.test.ts`, `GameManager.companionSkillKit.test.ts`, `GameManager.partyFormation.test.ts`, `GameManager.perfectClear.test.ts`, `BattleLootSystem.companionExp.test.ts`, `BattleLootSystem.beginTribulation.test.ts`, `GameManagerTurnBattleOps.idleDrops.test.ts`, `Companions.roster.test.ts`, `Companions.test.ts`, `ChieuHienLenhDrops.test.ts`, `EnemyDropSinkInvariant.test.ts`, `TurnSkillDisplayMeta.test.ts`, `DongFuCommandWheel.test.ts`, `ChiHienQuan.integration.test.ts`, `CompanionPanel.test.ts`, `saveShapeValidation.test.ts`
  - Docs: `game/docs/superpowers/{specs,plans}/2026-09-12-companion-gacha*.md`, `game/docs/systems/companions.md`
  - Exclusions: none — every diff path is task-owned.

## Scope and Risk Map

`changed-risk-map.mjs` output: domains `combat-and-tribulation`, `economy-and-progression`, `inventory-equipment`, `pinia-phaser-sync`, `save-and-cloud`, `time-and-offline`, `ui-input-lifecycle`; `deepAuditCandidate: true` (critical boundaries save-and-cloud + time-and-offline; 7-domain cross-system change); 30 `unmappedPaths`.

Manual routing for task-owned unmapped paths (code inspection, not the mapper, decided materiality):

- `core/companion/*` (new subsystem) → economy-and-progression (pull/exchange/feed/exp economy) + combat-and-tribulation (`CompanionCombat` entity build, skill-kit resolution feeding `buildTurnBattle`).
- `core/game/GameManagerCompanionOps.ts` → economy-and-progression orchestrator mutating persisted `PlayerData` fields (save-and-cloud consumer).
- `core/player/Player.ts` → save-and-cloud (new persisted fields) — persistence rides the wholesale `buildGameSave` JSON detach (`SaveSystem.ts:567`) + `Object.assign(this, structuredClone(save.player))` restore (`stores/player.ts:354`); no per-field list to drift.
- `data/companion/Companions.ts` → combat (skill/buff/ailment registry refs) + economy (grade → exchange cost).
- `data/ui/commandWheelCatalog.ts`, `panelIds.ts`, `locales/*.json` → ui-input-lifecycle / pinia-phaser-sync (panel id + wheel entry + copy).
- Docs + test files → no additional domain; coverage of their owning domains.

Escalation decision (mandatory-escalation rules applied, not triggered):

- **Save boundary:** v60 adds fields + shape validation; v59 rejection is the established dev convention (no migration). Player snapshot/restore is wholesale — verified new fields round-trip without a field list. The two Confirmed findings below have decisive unit oracles, so the boundary is bounded without a deep pass.
- **Time/offline:** `GameManager.ts` touch is thin delegates only; the single offline-adjacent path is companion EXP flowing through `settleAutoFarmOffline` → `rollAutoFarmCycleReward` → shared `processDefeatedEnemies` — deterministic per kill, clamped by `applyCompanionExp`, covered by `GameManagerTurnBattleOps.idleDrops.test.ts`. No clock or accrual ownership changed.
- **Economy transactions** (pull/exchange/feed) are synchronous, single-owner, gated before mutation, with refund-on-throw — bounded at the ops layer.
- **Vue/Pinia/Phaser:** standard `OverlayPanel`/`ui.standalonePanel` pattern; no Phaser scene or EventBus contract changes.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority / result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-CG-1 | `materialBag` token stack / `GameManagerCompanionOps` | `pullCompanion`: has → remove → roll → commit | Atomicity: consumed token always yields an outcome or is refunded | Interruption (throw mid-op) | Token count unchanged on throw; refund path at `GameManagerCompanionOps.ts:95-105` | Unit (existing) | High — resolved: refund present; roll is unthrowing by construction (both filtered rate sums = 1.0 exactly, verified numerically) |
| INV-CG-2 | `player.companionPullsSinceRare` / `CompanionGacha` | counter+1 → arm at ≥30 → roll elevated → reset on dia+ | Monotonicity + exactly-once pity | Timing boundary (pull 29/30/31) | Counter + grade sequence | Unit (existing `CompanionGacha.test.ts`) | High — resolved |
| INV-CG-3 | Pool-filtered pity weights | Pity armed while pool lacks dia+ defs | Recoverability | Value mutation (empty grade pool) | `pickDefinitionOfGrade` throw + refund | Unit | Low — unreachable with shipped roster (dia+thien exist); refund belt covers |
| INV-CG-4 | `player.duyenPhan` + `player.companions` / ops | `exchangeCompanion` gates: unknown → constellation_maxed → insufficient → deduct | Atomicity + conservation | Reorder (gate ordering) | No deduction on any reject; rank+1 in place; no 2nd instance | Unit (existing) | High — resolved |
| INV-CG-5 | `constellationRank` / `applyConstellationRank` | Duplicate pull at C6 → +5 DP; exchange at C6 → reject | Boundedness (rank ≤ 6) | Value mutation (rank 6) | `constellation_maxed` kind + `duyenPhanBonus` | Unit (existing) | High — resolved |
| INV-CG-6 | Static `CompanionDefinition` / `resolveCompanionSkillKit` | Kit resolution applies `skill_override` perks at sufficient rank | Idempotency + no static mutation | Repeat + stale state | Cloned skills; locked slots skip overrides | Unit (existing) | High — resolved |
| INV-CG-7 | `instance.realmId/realmLevel/exp` / `applyCompanionExp` | EXP grant → level → auto-breakthrough → player-realm ceiling clamp | Boundedness + monotonicity | Value mutation (ceiling, chained realms) | `realmBreakthroughs`, `clampedExp`, exp=0 at cap | Unit (existing) | High — resolved |
| INV-CG-8 | `formationLoadout` snapshot / `BattleLootSystem` | Per-kill EXP to formation-assigned companions | Exactly-once per kill; snapshot semantics | Reorder (mid-battle swap); repeat | `companion.exp` delta per kill | Unit (existing) | High — resolved for normal loadouts |
| INV-CG-9 | `formationLoadout.assignments` / `BattleLootSystem` | Same `combatantId` on two slots → per-slot EXP loop | Exactly-once per companion per kill | Value mutation (duplicated assignment in persisted loadout) | exp = 2×perKill instead of 1× | Unit — **new failing test** | **CONFIRMED (QA-2026-09-12-01)** |
| INV-CG-10 | `saveShapeValidation` / v60 shape | Load v60 save; reject v59; validate companion fields | Recoverability | Degraded environment (malformed entries) | `ok:false` + issue paths | Unit (existing) | High — resolved for shape/dedupe; see INV-CG-11 |
| INV-CG-11 | `companion.definitionId` vs `COMPANIONS` roster / validator | v60 save references a roster-absent definitionId | Recoverability + no silent owned-entry loss (learned-defect QA-2026-09-01-013 pattern) | Value mutation (unknown id) | Validation accepts → inert companion in `player.companions` | Unit — **new failing test** | **CONFIRMED (QA-2026-09-12-02)** |
| INV-CG-12 | `materialBag` / `isCompanionFeedable` | `feedCompanion` gates: level_maxed → unknown_material → not_feedable → insufficient → remove → apply | Atomicity + single-owner rule (A2) | Reorder + value mutation (count 0/negative/oversized; spirit stone; pull token) | Bag untouched on every reject | Unit (existing) | High — resolved |
| INV-CG-13 | Panel UI state / `ChieuMoTab`, `DuyenPhanTab`, `CompanionPanel` | Pull/exchange/feed controls render result-only state | Lifecycle + A7 presentation-is-not-authority | Repeat (double click); stale state | Disabled gates mirror ops; reveal binds result only; stale feed selection falls back | Component (existing) | Medium — resolved; note: a thrown roll reaches the click handler uncaught (refund already applied) — unreachable with the shipped roster |
| INV-CG-14 | `combatantId === definitionId` convention / formation→battle→EXP chain | Companion joins battle via slot; EXP keyed by definitionId | Synchronization (consistent identity across consumers) | Cross-system chain | Participant + EXP grant both find by definitionId | Unit | High — resolved (consistent everywhere) |
| INV-CG-15 | Token sources / `Enemies.ts` signatureDrops + `quests.ts` | Boss floor-10 drops ×1/×2/×3 + daily kill-20 quest → `chieu_hien_lenh` | Conservation (defined source/sink) | Cross-system chain | `EnemyDropSinkInvariant` updated; `ChieuHienLenhDrops.test.ts` | Unit (existing) | Medium — resolved; quest `itemDrops` path verified with registry+overflow handling (`QuestSystem.ts:161-191`) |
| INV-CG-16 | Spec constants | Rates 0.8399/0.10/0.05/0.01/0.0001; pity 30 + {5:1:0.01}; exchange 20/30/60/150/300; +10%/rank; C2/C4/C6; exp curve `40·L^1.2·(idx+1)`; battle EXP `2·(idx+1)`; feed `10·(idx+1)`/10 | Determinism (spec conformance) | — | Code vs spec diff | Inspection | High — resolved; all constants match spec §2/§5/§7 |
| INV-CG-17 | `player.realmId` / `getRealmIndex` | Unknown player realm → index −1 → companion self-capped | Boundedness | Degraded environment | Companion stops at own-realm max | Inspection | Low — defensive behavior, unreachable post-validation |
| INV-CG-18 | `instance.realmId` unknown / `applyCompanionExp` | Feed on unknown realmId banks exp that can never level | Conservation | Value mutation | `exp` increases, no levels | Inspection | Low — unreachable (validator rejects unknown realmId); noted as residual |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/core/game/BattleLootSystem.companionExp.test.ts src/services/save/saveShapeValidation.test.ts` | 107 passed / 2 failed — the 2 new repro tests fail for the intended reasons | exp 8 vs expected 4 (duplicate slot grant); validator `ok:true` vs expected `false` (unknown definitionId) |
| `npx vue-tsc --noEmit -p tsconfig.json` (from `game/`) | Exit 0 | Includes the two edited test files |
| Numeric check of `effectiveCompanionRates` sums (node) | Base filtered sum = 1, pity filtered sum = 1 | `rollCompanionGrade` fallback to `'tien'` unreachable with the MVP roster; token loss on throw additionally covered by ops refund |
| `git diff eb9fc8c5..2246754a` inspection of all production files | Completed | See ledger |
| Locale key parity (flattened `en.json` vs `vi.json`) | 0 missing keys either direction | Programmatic diff |
| Playwright/P14 | Not run — worktree browser launch unreliable (P14 isolated-worktree exception) | UI flows covered by jsdom component tests; defer live check to branch finishing |

## Findings

### QA-2026-09-12-01: Companion battle EXP is granted per formation slot, not per companion — a duplicated `combatantId` pays double

- Severity: Medium
- Status: Confirmed
- Invariant: Exactly-once — one assigned companion earns `companionBattleExpPerKill` once per kill.
- Preconditions: `player.formationLoadout.assignments` contains the same companion `combatantId` (definitionId) on two slots. No current producer creates this — `TranPhapPanel.onDrop` dedupes by `combatantId` — but `formationLoadout` is persisted state that `saveShapeValidation.ts` never inspects, so a crafted/corrupted current-version save loads it unchallenged.
- Reproduction: `BattleLootSystem.companionExp.test.ts` → "a companion occupying two formation slots (malformed loadout) gains exp once, not per slot". One kill with the companion on two slots.
- Expected: `exp === companionBattleExpPerKill('qi_refining')` (4).
- Actual: `exp === 8` — the loop at `BattleLootSystem.ts:307-329` iterates assignments, `findIndex` resolves the same companion from both slots, and `applyCompanionExp` is applied twice per kill.
- Evidence: failing assertion `expected 8 to be 4` (vitest run above). Consistency note: `buildTurnBattle` uses `formation.find(...)` (first match) so combat spawns one participant while EXP pays twice — the inconsistency itself proves the double grant is unintended.
- Test file: `game/src/core/game/BattleLootSystem.companionExp.test.ts` (new `it` block, lines ~153-178)
- Owner subsystem: `BattleLootSystem` EXP loop (fix direction: dedupe combatantIds or iterate companions∩formation; alternatively validate `formationLoadout` assignments at the save boundary — both out of QA scope).
- Blast radius: companion EXP inflation on every kill in every battle channel (active, turn-shim, idle auto-farm incl. offline settle) whenever a duplicated loadout exists; persisted EXP gain survives reload.

### QA-2026-09-12-02: Save validator accepts a companion `definitionId` absent from the roster — owned entry loads as permanently inert dead state

- Severity: Medium
- Status: Confirmed
- Invariant: Recoverability — registry/catalog-referencing owned entries must hard-fail validation (learned-defect QA-2026-09-01-013 principle; the same validator already enforces it for `realmId` vs `REALMS` one check above).
- Preconditions: a v60 save whose `player.companions[i].definitionId` is not in `COMPANIONS` (roster drift across content passes, or crafted data).
- Reproduction: `saveShapeValidation.test.ts` → "từ chối companions entry có definitionId không tồn tại trong COMPANIONS (registry drift)".
- Expected: `validateGameSaveShape(save).ok === false` with issue path `player.companions[0].definitionId`.
- Actual: `ok === true` — the entry loads, then every consumer silently skips it: `CompanionPanel` flatMap hides it, `buildTurnBattle` skips it (no participant), the EXP loop skips it, `exchangeCompanion`'s owned lookup can't match it. The player keeps a dead roster entry with no signal.
- Evidence: failing assertion `expected true to be false` (vitest run above).
- Test file: `game/src/services/save/saveShapeValidation.test.ts` (new `it` block, ~lines 691-709)
- Owner subsystem: `saveShapeValidation.validateCompanionEntries` — `COMPANIONS` is a static import reachable from the validator exactly like `REALMS`.
- Blast radius: silent loss of an owned progression entity on any roster id change/drift; no crash, so it surfaces only as "my companion vanished from everything" — the worst observability class.

## New or Changed QA Tests

- `game/src/core/game/BattleLootSystem.companionExp.test.ts` — added "a companion occupying two formation slots (malformed loadout) gains exp once, not per slot": proves the per-slot loop double-grants (exp 8 vs invariant 4).
- `game/src/services/save/saveShapeValidation.test.ts` — added "từ chối companions entry có definitionId không tồn tại trong COMPANIONS (registry drift)": proves the validator accepts a roster-absent owned companion.

Both fail for the intended reason and must remain as regression tests after repair.

## Gaps and Residual Risk

- Pull-throw → uncaught exception in `ChieuMoTab.onPull` (ops refunds the token first): unreachable with the shipped roster — verified both filtered rate tables sum to exactly 1.0 and `Math.random() < 1` always lands a pooled grade. If a future roster leaves a zero-weight edge, the UX failure is an unhandled throw + silent UI. Suspected/low; no production hook needed to observe today.
- `companionPullsSinceRare`/`duyenPhan` are validated as finite ≥0 but not as integers — a fractional value is loadable yet harmless (counter still monotonic; costs still compare correctly). Cosmetic residual.
- `applyCompanionExp` on an unknown `instance.realmId` banks unlevelable exp — unreachable post-validation; noted only.
- Companion battle EXP is granted regardless of the companion's alive state in the running battle (formation snapshot, not participation state) — spec silent; consistent with the formation-snapshot contract.
- Live-browser check deferred per P14 isolated-worktree exception — pull reveal/feed interactions are covered by jsdom component tests only.

## Pre-existing Failures

None observed — the only failing tests in this run are the two QA reproductions added by this review. `BattleLootSystem` shim `battle.player` can be `undefined` when `turnBattle.players` is empty (`grantTurnBattleRewards` line ~1217 dereferences `.currentHp` under heal-on-kill talents) — pre-existing, outside this diff.
