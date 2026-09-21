# QA Quick Review — P7-M9 Companion & Ring-2 Realm Gating

Date: 2026-09-22 · Mode: quick · Scope: `feat/m9-companion-ring2-gating` task-owned diff

## Task-owned paths

Production: `core/companion/CompanionAvailability.ts` (new), `core/game/FormationPlacement.ts`, `core/game/GameManagerCompanionOps.ts`, `core/quest/QuestManager.ts`, `core/quest/QuestSystem.ts`, `data/enemy/MortalEnemies.ts`, `data/quest/quests.ts`, `data/ui/commandWheelCatalog.ts`, `data/formation/TranPhap.ts` (comment), `components/panels/WorkerLodgePanel.vue`, `components/panels/CompanionPanel.vue`, `components/panels/worker-lodge/ChieuMoTab.vue`, `components/panels/worker-lodge/DuyenPhanTab.vue`, `locales/{en,vi}.json`. Tests owned by the same diff reviewed alongside.

## Risk map

Mapper: 3 domains (economy-and-progression, combat-and-tribulation, ui-input-lifecycle), `deepAuditCandidate: true` on breadth alone. Unmapped paths routed manually: CompanionAvailability/GameManagerCompanionOps → economy; FormationPlacement → combat; commandWheelCatalog/locales → ui-input-lifecycle; TranPhap.ts → comment-only.

**Non-escalation rationale:** the change is gating-only — no new persisted state, no save-shape change, no clock/offline path, no new transaction. Economy surface is rejection-before-mutation (conservation asserted by tests). Combat surface is unchanged (resolve + EXP paths deliberately ungated). Vue surface is disabledReason/tab-filter, covered by component tests plus real-browser evidence below. Material risk is confidently bounded; quick verdict stands.

## Invariant ledger

| ID | Hypothesis | Invariant | Result |
|---|---|---|---|
| INV-M9-1 | Locked pull/exchange/feed mutates token/duyenPhan/bag/companions | Conservation | Rejected — gate runs before any read/mutation; tests assert balances untouched |
| INV-M9-2 | Restored active `daily_chieu_hien_lenh` keeps counting/paying below gate | Monotonicity | Rejected — inverse pass in `reconcileActiveQuests` deactivates; regression test covers progress+claim |
| INV-M9-3 | Claim fires on stale entry without reconcile | Exactly-once | Rejected — `resolveClaimable` requires an active entry; deactivate removes it; realm is monotonic in-session |
| INV-M9-4 | Reconcile misses a lifecycle seam | Lifecycle | Rejected — restore calls `reconcileQuestLifecycle` synchronously (`GameManagerSaveRestore` L474→574); tick flags cover daily-rollover + realm transition |
| INV-M9-5 | Loadout commit bypasses the gate via another caller | Boundary | Rejected — sole writers are `commitFormationLoadout` and `turnBattleOps.setFormationLoadout` → same function |
| INV-M9-6 | Persisted duplicate `combatantId` → double EXP (QA-2026-09-12-012) | Exactly-once | Rejected — `grantedCombatantIds` Set dedupes (`BattleLootSystem` L364-369), pre-existing fix intact |
| INV-M9-7 | Wheel `hasFoundationRealm` not reactive/stale | Synchronization | Rejected — real-browser evidence: mortal shows `is-disabled` on both slots, click opens nothing; patched-foundation save unlocks both and panels open |
| INV-M9-8 | `deactivate` leaves claim residue → double-claim/block | Recoverability | Rejected — `claimed` lives on the progress entry; `completedOnceIds` only covers 'once' cadence (quest is 'daily') |
| INV-M9-9 | Unknown `realmId` → gate bypass | Recoverability | Rejected — `getRealmIndex` → -1 → locked (fail-closed) |
| INV-M9-10 | Gate order leaks info/mutation before realm check | Atomicity | Rejected — realm check precedes token/definition/instance checks; `realm_locked` asserted without token |
| INV-M9-11 | Mortal-mounted panel with grandfathered companion | Feedback | Rejected — `realm_locked` renders in all three consumers; i18n keys exist en+vi |
| INV-M9-12 | `nhan_cong`/worker capacity gated as side effect | Boundary | Rejected — `visibleTabs` always includes `nhan_cong`; building untouched; integration test passes |
| INV-M9-13 | Grandfathered committed loadout fails to resolve at mortal | Recoverability | Rejected — `resolvePartyFormation` intentionally ungated; regression test asserts resolution |
| INV-M9-14 | Mortal/LK enemy or quest still yields token | Conservation | Rejected — data-level assertions enumerate all enemies/quests |
| INV-M9-15 | `canClaim` true after deactivate | Exactly-once | Rejected — requires active progress entry |

## Evidence run

- Type-check: green.
- Focused vitest: companion ops, formation placement, quest lifecycle/system, token drops, command wheel, ChiHienQuan integration, companion panel — all green (68+44 tests across runs).
- Real browser (playwright-cli, worktree dev server :5675): fresh mortal save → `formation_slot`/`companion_roster` `is-disabled`, click opens nothing, `chi_hien_quan` and other slots available. Save patched to `foundation_establishment` → re-auth → both slots enabled, `companion_roster` opens CompanionPanel, `formation_slot` opens TranPhapPanel.

## Findings

- **Confirmed defects:** none.
- **Pre-existing note (not M9):** `QuestSystem.isUnlocked` fails *open* when `requiredRealmId` names a non-existent realm (`getRealmIndex` → -1 → always unlocked). M9's data test pins the one gated quest, so the leak is unreachable today; flag for the quest-data validator in a later hardening pass.
- **Coverage gap (accepted):** no e2e spec for wheel gating (runtime evidence captured manually this mission); jsdom component tests cover the same assertions.

## Verdict

**PASS WITH EVIDENCE** — zero confirmed defects; gate surfaces verified at data, domain, component, and real-browser layers.
