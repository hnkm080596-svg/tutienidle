# R9 Equipment / Inventory Operation Integrity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (opencode inline execution per AGENTS.md P6 convention) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Domain-owned wash results (AR-21), atomic vendor exchange (AR-22), explicit acquisition receipts (AR-34), and authoritative operation quotes (AR-23) — one vertical slice at a time.

**Architecture:** Reuse the refine pending-preview precedent for wash; add the smallest MaterialBag preflight needed by vendor; introduce one small `AcquisitionReceipt` type consumed by orchestration; expose per-operation domain quote read models. No new frameworks.

**Tech Stack:** TypeScript, Vitest (TDD), Vue SFC (WashTab + ProductionPanel + tooltip).

**Spec:** `game/docs/superpowers/specs/2026-09-08-r9-inventory-integrity-design.md`

## Global Constraints

- No `any` (P8). New/edited comments English plain ASCII (P15).
- Frozen: wash costs/RNG, vendor prices, bag caps, quest rewards.
- No universal transaction/quote framework.
- Dedicated worktree `r9-inventory-integrity` via using-git-worktrees.
- Verification: P3 `full` (save shape + shared GameManager touched). Stop on first failure.
- Every slice ends green before the next starts; do not batch slices into one commit.

---

### Task 1 (S1/AR-21): Wash pending-result — domain-retained one-use capability

**Files:**
- Modify: `game/src/core/equipment/EquipmentWash.ts` (preview/commit + pending state)
- Modify: `game/src/core/equipment/EquipmentOpsSystem.ts:275` region (facade)
- Modify: `game/src/core/game/GameManager.ts` (commitWashItem facade)
- Modify: `game/src/components/panels/equipment-hall/WashTab.vue`
- Test: `game/src/core/equipment/EquipmentWash.pending.test.ts` (new)

**Interfaces:**
- Produces:
  ```ts
  // EquipmentWash.ts
  export interface WashPreviewTicket {
    ticketId: string        // domain-generated identity
    instanceId: string
  }
  // previewWashAffixes now returns { ok: true; ticket: WashPreviewTicket } | { ok: false; reason }
  // and NO rolled affixes in the result; a new read model supplies the display copy:
  export function getWashPreviewAffixes(ticketId: string): { affixes: RolledAffix[] } | undefined
  // commitWashAffixes(instanceId, ticketId, ...) - ticket consumed on EVERY attempt
  export function discardWashTicket(ticketId: string): void
  ```

- [ ] **Step 1: Write the failing reproduction + contract tests**

```ts
// EquipmentWash.pending.test.ts (sketch - follow existing EquipmentWash.test.ts harness)
it('commit without preview is rejected (no caller-fabricated affixes)', () => {
  const result = commitWashAffixes(instanceId, 'fabricated-ticket', ...)
  expect(result).toEqual({ ok: false, reason: 'no_pending_preview' })
})
it('commit consumes the ticket: second commit rejected', ...)
it('item removed between preview and commit -> rejected', ...)
it('item replaced by another with same id -> rejected (identity)', ...)
it('commit does not charge cost again; every new preview charges', ...)
it('equipped modifier refresh happens on commit only', ...)
```

Also port the audit's executed counterexample as a regression test at the
GameManager public API level (GameManager.commitWashItem with no preview must
fail) — follow `GameManager.washTransaction.test.ts` harness.

- [ ] **Step 2: RED** — run new tests; expect failures (current API accepts affixes).

- [ ] **Step 3: Implement the pending capability** modeled on
  `EquipmentSystem.ts:1045-1118` refine pending: internal Map of ticketId ->
  { instanceId, itemId, affixes, createdAt } + one-use consumption on every
  commit attempt + membership/identity re-validation. Ticket ids generated
  via an incrementing counter + random (no crypto dependency).

- [ ] **Step 4: Migrate consumers**
  - `EquipmentOpsSystem`/`GameManager.commitWashItem`: drop the `affixes`
    parameter, pass ticketId; keep facade signatures otherwise stable.
  - `WashTab.vue`: keep local MIRROR for display only (from
    `getWashPreviewAffixes`); "Giữ" sends ticketId; "Bấm lại" discards ticket
    before re-preview. No affix array leaves the domain.

- [ ] **Step 5: GREEN + type-check + focused vitest** — then commit:
  `feat(r9): wash pending-result domain-owned one-use ticket (AR-21)`

---

### Task 2 (S2/AR-22): Vendor atomic exchange

**Files:**
- Modify: `game/src/core/economy/VendorSystem.ts:107-181`
- Modify: `game/src/core/material/MaterialBag.ts` (smallest preflight helper, e.g. `canAddAmount(material, amount): number` returning addable amount WITHOUT mutating — or a `peekAdd`; keep it minimal)
- Test: `game/src/core/economy/VendorSystem.test.ts` (extend)

**Interfaces:**
- Produces on MaterialBag (exact name to be confirmed against bag style):
  ```ts
  /** Amount of `amount` that would fit without mutation (0..amount). */
  canAcceptAmount(material: Material, amount: number): number
  ```

- [ ] **Step 1: Failing tests** (adapt the audit fixture):
```ts
it('failed sale (currency stack at capacity) leaves ALL balances bit-identical', () => {
  // lowered stone stack limit fixture: stones 99/limit 100, herbs 2
  const before = snapshotBag(bag)
  const result = vendor.sellMaterial(bag, herb, 2, realm)
  expect(result.ok).toBe(false); expect(result.reason).toBe('bag_full')
  expect(snapshotBag(bag)).toEqual(before)   // stones still 99, herbs still 2
})
it('exact-fit credit succeeds', ...)
it('preexisting failure modes keep balances unchanged (grade gate, sole ingredient, insufficient input)', ...)
```

- [ ] **Step 2: RED → implement:** preflight with `canAcceptAmount` before any
  mutation; only mutate when the FULL credit fits; otherwise return `bag_full`
  with zero mutations. No refund path needed anymore.

- [ ] **Step 3: GREEN + focused tests + commit:**
  `fix(r9): vendor exchange is atomic - preflight before debit/credit (AR-22)`

---

### Task 3 (S3/AR-34): Acquisition receipt — smallest shared type

**Files:**
- Create: `game/src/core/material/AcquisitionReceipt.ts` (+ test)
- Modify: alchemy settle path (`AlchemySystem.ts:324` region) + quest pill drops (`QuestSystem.ts:166` region) FIRST (the two proven ignored-overflow defects)
- Then migrate, in separate sub-commits: building collect (`GameManagerBuildingOps.ts:214`), equipment drops (`EquipmentOpsSystem.ts:102/:355`), production/decompose settlement delivery (already reason-tagged), battle loot (`BattleLootSystem.ts:408` — already handles overflow; migrate to the receipt type for uniformity)
- Test: extend each consumer's test file with delivered/overflow assertions

**Interfaces:**
- Produces:
  ```ts
  export type AcquisitionReason =
    | 'loot' | 'craft' | 'quest_claim' | 'building_collect' | 'production_settle' | 'decompose' | 'restore'
  export interface AcquisitionReceipt {
    materialId: string
    requested: number
    delivered: number
    overflow: number
    reason: AcquisitionReason
  }
  ```

- [ ] **Step 1:** failing tests: alchemy settle with full pill bag must surface
  overflow receipt; quest pill-drop claim must consume `delivered` (not
  requested); restore path (`GameManagerSaveRestore`) must not emit quest
  hooks (characterization guard - it must keep not firing).
- [ ] **Step 2:** implement type + migrate the two defect consumers; keep
  notification strings unchanged.
- [ ] **Step 3:** migrate remaining consumers one commit each; each ends green.
- [ ] **Step 4:** commit series: `feat(r9): acquisition receipt consumed by <consumer> (AR-34)`.

---

### Task 4 (S4/AR-23): Authoritative operation quotes (per-operation)

Four independent sub-slices; characterization FIRST (lock current displayed
values), then move the rule to the domain and make the UI consume the quote:

- [ ] **4a Production upgrade cost/gate:** add
  `ProductionSystem.quoteSiteUpgrade(siteId, player): { affordable, costs, meetsGate } | undefined`;
  migrate `ProductionPanel.vue:164-202` to render it. Parity test: quote ==
  `upgradeSite` outcome for the same state.
- [ ] **4b Alchemy success split:** add an `AlchemySystem.quoteSuccess(...)`
  read model returning { successPercent, guaranteed, extraPillPercent };
  migrate `GameManagerAlchemyOps.ts:143-156` duplicate.
- [ ] **4c Equipment roll ranges:** expose from `EquipmentSystem.ts:384-390` a
  `quoteMainStatRange(slot, quality)`; migrate `useEquipmentTooltip.ts:188-192`.
- [ ] **4d Dissolve eligibility/dedup:** align `EquipmentOpsSystem.ts:373-402`
  with `EquipmentDissolve.ts:48-87` by moving validation into the dissolve
  domain and making the ops layer call it (same rejection reasons; dedup
  applied at the domain boundary).

Each sub-slice: characterization test → domain quote → UI migration → parity
test → commit `feat(r9): <operation> domain quote (AR-23)`.

---

### Task 5: Mission close

- [ ] Grep evidence: no remaining caller-supplied affix commit; no debit-then-refund vendor path; receipt type consumed by all migrated sources (inventory list in mission report).
- [ ] P3 full: type-check + build + full vitest.
- [ ] Adversarial QA quick (escalate to deep if persistence/progression risk surfaces).
- [ ] E3 simplify + P5 code review.
- [ ] Roadmap R9 status cutover with evidence block (same style as R7).

## Self-Review Notes

- Type consistency: `WashPreviewTicket.ticketId` flows through facade and UI;
  `AcquisitionReceipt` field order fixed above; `canAcceptAmount` name to be
  validated against MaterialBag naming style at execution (record deviation).
- The audit's lower-stack-limit vendor fixture is TEST-ONLY - do not change
  production currency caps (SpiritStoneMaterial MAX_SAFE_INTEGER stays).
- AR-23 4a-4d may be executed by separate parallel agents; each sub-slice is
  self-contained (note for dispatching).
