# QA Review: Task 9.1 Breakthrough Confirm Panel + Auto-Unequip

- Date: 2026-09-02
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/game/GameManager.ts`, `game/src/composables/useTribulation.ts`, `game/src/components/common/BreakthroughRequirementPanel.vue`, `game/src/components/panels/RealmPanel.vue`, `game/src/locales/vi.json`, `game/src/locales/en.json`, plus their test files.

## Scope and Risk Map

Mapper (`changed-risk-map.mjs`, 6 production paths): domains `combat-and-tribulation`, `economy-and-progression`, `pinia-phaser-sync`, `time-and-offline`, `ui-input-lifecycle`; `deepAuditCandidate: true` (reasons: `critical state boundary: time-and-offline` via GameManager.ts, `cross-system change: 5 domains`). Unmapped: `useTribulation.ts`, `vi.json`, `en.json` (composable/locale — routed manually).

Escalation decision: the mapper's `time-and-offline` flag is triggered by the generic GameManager.ts hotspot, NOT by a change to clock/offline accrual logic. The actual diff is bounded to the breakthrough trigger/panel flow. The final whole-branch review already performed a full cross-system trace (realm-change ordering, defeat-penalty path, save-facing state). No material time/offline or economy-accrual logic was altered. Quick mode is sufficient; no escalation warranted.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
|---|---|---|---|---|---|---|---|
| INV-91-1 | Player realm / equipped gear | triggerBreakthroughAction → realm change | Conservation: realm-change boundary clears equipped gear before tribulation stats are read | Cross-system chain | weapon.equipped=false + finalStats gear-free before startTribulation | Unit (dotPha) | High |
| INV-91-2 | Player realm | chooseCultivationPath (post-breakthrough) | Synchronization: path selection is NOT a breakthrough; gear intentionally retained | Reorder | weapon.equipped=true after chooseCultivationPath | Unit (realmAdvanceUnequip) | High |
| INV-91-3 | Tribulation result | resolveVictory realm-advance | Exactly-once: realm advances once; reward applied once | Repeat | realmId + artifact/technique reward | Integration | High |
| INV-91-4 | Tribulation result | resolveDefeat | Conservation: spirit-stone defeat penalty still applied (entry-cost removal must not touch it) | Value mutation | materialBag.remove on defeat | Integration | High |
| INV-91-5 | UI panel | confirm panel open/close | Lifecycle: "Đã hiểu" closes store + triggers; "Chờ đã" closes only | Repeat | store.isOpen transitions | Component | Medium |
| INV-91-6 | Realm gate | canTriggerBreakthrough | Boundedness: only mortal/qi_refining ≥ CORE_REALM_LEVEL pass | Value boundary | true/false per realm+level | Unit (progressionScope) | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| `npm.cmd run test` (full suite) | 2085/2086 pass | 1 pre-existing flaky `dongFuBuildingAssets` (passes standalone) |
| `npm.cmd run type-check` | Pass | clean |
| `npm.cmd run build` | Pass | pre-existing chunk-size warning only |
| Focused: realmAdvanceUnequip + dotPha + progressionScope + panel + RealmPanel + integration | 19/19 pass | all task-owned tests green |
| Ordering inspection (useTribulation.ts:63-66) | unequip+modifier-sync BEFORE startTribulation | finalStats fed to tribulation is gear-free — correct |
| Defeat-penalty path (useTribulation.ts:184-189) | intact | entry-cost removal did not touch defeat penalty |
| i18n parity (vi/en) | 4 keys present, matching structure | verified programmatically |

## Findings

No Confirmed defects. The QA-2026-09-02-001 learned-defect (realm-change unequip contract inconsistency) is resolved by the new design: every breakthrough path (Quán Khí, Trúc Cơ) routes through `triggerBreakthroughAction`, which auto-unequips before the realm change; `chooseCultivationPath` is explicitly reclassified as a post-breakthrough feature-unlock (not a realm-change breakthrough), and its reproduction test now locks that contract.

### QA-2026-09-02-013: Cooldown not surfaced on confirm panel
- Severity: Low
- Status: Suspected
- Invariant: Lifecycle / UX
- Preconditions: Player defeats a tribulation (cooldown active), then re-opens the breakthrough panel within the cooldown window.
- Reproduction: The old BreakthroughRequirementPanel disabled the "Độ Kiếp" button during `getTribulationCooldownSeconds() > 0`. The new confirm panel does not check cooldown; clicking "Đã hiểu" within cooldown closes the panel and `startTribulation` returns false (TribulationDirector cooldown gate) — silent no-op.
- Expected: Either the RealmPanel button is disabled during cooldown, or the panel communicates the cooldown.
- Actual: Panel closes with no tribulation started and no message.
- Evidence: `game/src/composables/useTribulation.ts:49-69` (no cooldown check); `game/src/components/panels/RealmPanel.vue` (button gated only by `canTriggerBreakthrough`, not cooldown).
- Test file: none
- Owner subsystem: ui-input-lifecycle, combat-and-tribulation
- Blast radius: Minor UX confusion; no state corruption; retry after cooldown works. Recommend a follow-up to gate the RealmPanel button on `getTribulationCooldownSeconds()`.

### QA-2026-09-02-014: Auto-unequip occurs before startTribulation success check
- Severity: Low
- Status: Suspected
- Invariant: Atomicity
- Preconditions: `triggerBreakthroughAction` passes gate + battle-check, then `startTribulation` returns false (only reachable via cooldown, since battle-check precedes unequip).
- Reproduction: `useTribulation.ts:63` unequips, then `:66` startTribulation may fail → gear stripped with no tribulation entered.
- Expected: Unequip only on a confirmed tribulation start.
- Actual: Unequip happens unconditionally before the start attempt.
- Evidence: `game/src/composables/useTribulation.ts:63-70`.
- Test file: none
- Owner subsystem: combat-and-tribulation
- Blast radius: Low — the only failure mode is cooldown (already unequipped from the prior attempt), and the player can re-equip manually. Acceptable for this iteration; could reorder unequip after a successful start if tightened.

## New or Changed QA Tests

No new QA-authored tests in this pass (the feature's own tests were authored during SDD). The existing task-owned tests provide the evidence above.

## Gaps and Residual Risk

- No automated test asserts the cooldown behavior (QA-013) — would need a cooldown-state fixture.
- No automated test asserts the unequip-before-failed-start edge (QA-014) — low reachability.
- `chooseCultivationPath` leaving gear equipped is intended design; if a future realm-change entry point is added that bypasses `triggerBreakthroughAction`, the QA-001 class of bug could reappear. The learned-defect weighting recommendation (cover every realm-change API) remains relevant.

## Pre-existing Failures

- `dongFuBuildingAssets.test.ts`: known timing flake (passes standalone). Not caused by this branch.