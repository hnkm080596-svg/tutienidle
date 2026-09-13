# M2 — Wash ticket binds item lifetime (ARCH-011, P2)

Worktree `.agent-worktrees/arch-m2-wash-binding`, branch
`arch/m2-wash-binding`, base `arch/repair-2026-09` @ `1775f441` (contains
M1's save-boundary work). Verification mode: **quick** (domain module +
its real consumer chain; no build/pipeline/config surface touched).

## G0 task card

| Field | Value |
|---|---|
| Requested observable behavior | A paid wash preview issues a one-use ticket that commits only onto the exact item object it was issued for, while that object still occupies the same bag-membership generation and keeps its issued-at shape; commit revalidates current `locked`/`favorite` eligibility; the ticket dies on owner/session reset. Same-id replacement, remove/re-add, post-preview mutation, flag flips, replay and restore all reject. |
| Single responsibility / invariant | Paid generated result is bound to one item lifetime + current eligibility (A3 paid-preview contract), enforced inside the domain owner — never by the caller. |
| Current owner (before) | `src/core/equipment/EquipmentWash.ts` — `PendingWashSlot` held only `ticketId`/`instanceId`/`affixes`; `commitWashAffixes` compared strings (ARCH-011 / AUD-E02 defect). |
| Target owner | Same owner: `EquipmentWash.ts`; shared snapshot primitive `src/core/equipment/EquipmentInstanceSnapshot.ts` (extracted 1:1 from the refine guard — A9 single implementation). |
| Existing primitive reused | `EquipmentBag.getMembershipGeneration` (exact-object membership capability, `EquipmentBag.ts:29-31,128-134`); refine's exact-object/membership/snapshot guard (`EquipmentRefine.ts`), now the shared `captureEquipmentInstanceSnapshot`/`equipmentInstanceMatchesSnapshot`. |
| Production chain | `WashTab.vue:125-137` → `useEquipmentActions.ts:125-155` (`washPreview`/`washCommit`) → `EquipmentOpsSystem.previewWashItem`/`commitWashItem` → `EquipmentSystem.previewWashAffixes`/`commitWashAffixes` → `EquipmentWash.*`. Signatures unchanged; UI holds only the ticket id. |
| State | `EquipmentSystem.washPendingSlot` (instance-owned accessor). Writers: `EquipmentWash.ts` only (pinned by `tests/architecture/paidRandomContract.test.ts`). Reset: `discardWashTicket` (ticket-scoped UI cancel), replace-on-next-preview, consume-on-every-commit-attempt, `invalidatePendingWashTicket` on session restore via `EquipmentSystem.invalidatePendingOperationTickets()` (M1 hook, `GameManagerSaveRestore.ts:240`). Not persisted. |
| Explicit non-goals | Roll odds, wash/refine cost or forge-budget semantics, UI redesign, save-schema changes (pending slot stays session-only). |
| Stop condition | ARCH-011 diagnostic cases reject through the real commit path; existing wash/refine/restore suites stay green; type-check clean. |

## Q1–Q12 evidence

| ID | Answer — evidence |
|---|---|
| Q1 | Observable behavior: `previewWashItem` returns a ticket; `commitWashItem(instanceId, ticketId)` applies the domain-held roll iff the bag's current object is the bound object, same membership generation, unchanged snapshot, currently unlocked/unfavorited. Failure: `{ok:false, reason}` with `not_found` / `no_pending_wash` / `locked` / `favorite`; the ticket is consumed on every attempt; affixes of the current item are never overwritten by a stale roll. Tests: `EquipmentWash.pending.test.ts` M2 describe. |
| Q2 | One owner completes the rule: `EquipmentWash.ts` — `previewWashAffixes` issues+binds, `commitWashAffixes` revalidates+applies+refreshes equipped modifiers. `EquipmentSystem` only injects the slot accessor; ops/UI only carry the ticket id. |
| Q3 | Write/read/reset/persist: writers all inside `EquipmentWash.ts` (static guard `paidRandomContract.test.ts` green); read by `getWashPreviewAffixes` (display copy, cloned); reset paths enumerated in G0; never persisted (R9 contract — `GameManager.r9qa.test.ts`). |
| Q4 | Real chain: `WashTab.vue:125-137` → `useEquipmentActions.washPreview/washCommit` → `EquipmentOpsSystem.previewWashItem`/`commitWashItem` → `EquipmentSystem` → `EquipmentWash.*`; `GameManager.washTransaction.test.ts` exercises the public API end-to-end. Restore entry: `GameManagerSaveRestore.ts:232-240`. |
| Q5 | Reused: `EquipmentBag.getMembershipGeneration` + the refine exact-object/snapshot guard — now shared as `EquipmentInstanceSnapshot.ts` (verbatim field set: instanceId, itemId, slot, equipped, locked, favorite, grade, quality, realmLevel, zoneId, icon, forgeUsesTotal/Remaining, mainStat, affixes). No new abstraction beyond that extraction. |
| Q6 | Dependencies point inward: `EquipmentInstanceSnapshot.ts` imports types only (`EquipmentInstance`, `StatModifier`); `EquipmentRefine`/`EquipmentWash` → snapshot module; no new upward edge; `EquipmentWash` still has exactly one production importer (`EquipmentSystem`) — guard test green. |
| Q7 | Timing/gameplay/presentation: unchanged — preview pays+rolls at command time; commit applies at command time; UI only holds a ticket id and a cloned display copy. |
| Q8 | Consumers preserve semantics: `useEquipmentActions.washCommit` reports `result.reason` via `actionFailureKey` — `locked`/`favorite` map to existing locale keys (`ActionAvailability.ts:47-48`); `no_pending_wash` falls back to `actionFailure.unknown` (pre-existing mapping, unchanged). |
| Q9 | Queries stay observational: `getWashPreviewAffixes` still returns a cloned display copy and cannot commit; commit never trusts caller data (static guard pins `instance.affixes = pending.affixes` and the ticket-only signature). |
| Q10 | Duplicate/stale/failed/interrupted: consume-on-every-attempt kept (replay → `no_pending_wash`); a new preview replaces the old ticket; stale object/generation/snapshot all reject; failed preview still drops the previous ticket only by slot replacement on success — unchanged R9 semantics. |
| Q11 | Old/alternate path: none — the direct `washAffixes()` already routes through preview+commit internally, so the binding applies to both paths. Refine keeps its own payload matching; only its duplicated snapshot machinery moved to the shared module (live path, migrated — not a parallel copy). |
| Q12 | Scope/finish: files map 1:1 to the invariant below; verification recorded; remaining debt listed at the end. |

Triggered module checks:

- **E3 (paid/random binding):** PASS — roll+payment are domain-owned; the ticket now carries exact-object + generation + snapshot binding; forged payload impossible (commit takes no affix input); replay/changed-eligibility/stale-item tests green.
- **E4 (preview/commit one owner, commit revalidates):** PASS — same `rollWashAffixes` validation at preview; commit re-checks current `locked`/`favorite` and the unchanged snapshot.
- **S2/S5 (restore/lifecycle):** PASS — `equipmentBag.clear()` + `invalidatePendingOperationTickets()` adjacency preserved from M1; `invalidatePendingWashTicket` drops the whole bound slot (object ref + generation + snapshot). Real-path test added: pre-restore ticket cannot overwrite a restored same-id item with a different shape.
- **E7 (economics):** PASS — no cost, odds, or forge-budget change; every failure still exits before payment; preview still pays once, commit never repays.

## File → invariant map

| File | Why in this responsibility |
|---|---|
| `src/core/equipment/EquipmentInstanceSnapshot.ts` (new) | Shared item-lifetime snapshot primitive: detached issued-at capture + field-wise match. Extracted 1:1 from `EquipmentRefine`'s private guard so wash and refine share one implementation (A9). |
| `src/core/equipment/EquipmentRefine.ts` | Migrated to the shared primitive: `RefineInstanceSnapshot`/`RefineAffixSnapshot`/`cloneRefineMainStat`/`refineMainStatMatches` removed; `PendingRefinePreview.snapshot: EquipmentInstanceSnapshot`; commit conjunction now `pending.instance === instance && generation match && equipmentInstanceMatchesSnapshot(...)`. Behavior identical. |
| `src/core/equipment/EquipmentWash.ts` | `PendingWashSlot` binds `instance` (exact object) + `membershipGeneration` + `snapshot` + `affixes`; `rollWashAffixes` captures the generation pre-payment (undefined → `not_found`, refine precedent); `previewWashAffixes` stores the bound slot post-payment; `commitWashAffixes` revalidates ticket+instanceId, current `locked`/`favorite`, then exact-object/generation/snapshot before applying the domain-held roll. |
| `src/core/equipment/EquipmentWash.pending.test.ts` | M2 regression block (7 tests): AUD-E02 same-id locked+favorite replacement; same-id unprotected replacement; remove+re-add generation bump; affix/grade mutation; locked/favorite flip; unchanged-item commit-once + replay. |
| `src/core/game/GameManagerSaveRestore.boundary.test.ts` | Real restore path: pre-restore ticket cannot overwrite a restored same-id clone with a different affix shape (restored object is a different instance; commit rejects `no_pending_wash`; payload shape preserved). |

## Red → green evidence

New M2 tests authored against the fix, then re-run with the two
production files stashed (`git stash push -- EquipmentWash.ts
EquipmentRefine.ts`): **6 of 7 new pending tests failed** on the old
implementation (same-id locked/favorite replacement committed `ok:true`,
reproducing AUD-E02 verbatim). The boundary restore test already passed
on the stashed baseline because M1's `invalidatePendingOperationTickets`
hook clears the ticket — it pins the restore layer, which M2 keeps.
After `git stash pop`: all green.

## Verification record (P3 quick)

- `npm run type-check` (vue-tsc --build) — PASS, exit 0.
- `npx vitest run src/core/equipment src/stores src/core/game/GameManagerSaveRestore.boundary.test.ts src/core/game/GameManager.washTransaction.test.ts src/core/game/GameManager.r9qa.test.ts tests/architecture/paidRandomContract.test.ts` — **40 files / 425 tests, all green** (incl. `EquipmentWash.pending` 14/14, `GameManagerSaveRestore.boundary` 19/19, paid-random guard 7/7).
- `npx vitest run src/core/game/GameManager.refineTransaction.test.ts src/core/game/GameManager.r5Refinement.reaudit.test.ts src/components/panels/equipment-hall/RefineTab.test.ts src/components/panels/equipment-hall/WashTab.test.ts src/components/panels/EquipmentHallPanel.test.ts` — **5 files / 21 tests green** (refine migration + UI consumer chain).
- `npx eslint` on all touched files — clean (0 findings).
- Post-stash-pop re-run of the two changed test files — 33/33 green.

## Retained debt / Notes-Suggestions (out of scope, recorded not fixed)

- `no_pending_wash` is unmapped in `ACTION_FAILURE_KEYS` → UI shows the
  generic `actionFailure.unknown` for stale/replayed commits (pre-existing;
  `invalid_refine_preview` IS mapped — asymmetric vocabulary worth a
  follow-up). `locked`/`favorite` emitted at commit map correctly.
- `getWashPreviewAffixes` still serves a display copy after the bound item
  changed/was removed — cosmetic staleness only; commit is the authority.
  Matches the refine preview-read precedent.
- Snapshot now also rejects commit after benign flag/state changes (e.g.
  equip/unequip flip mid-preview) — same strictness as the refine guard;
  cost was already paid at preview, re-preview is the documented recovery.
- `PendingWashSlot.instanceId` top-level field removed — the issued-at id
  now lives only in `snapshot.instanceId` (single source, A3); the ticket
  scope check compares against it.

## Known pre-existing failures (unchanged)

`GameManager.perfectClear.feasibility.test.ts` ×4 — documented
fixture-calibration debt, untouched by this mission.
