# R9 — Equipment / Inventory Operation Integrity — Design Spec

Date: 2026-09-08
Missions: Roadmap Phase R9 (Architecture Repair Program), Mission 0 findings AR-21 + AR-22 + AR-23 + AR-34.
Status: APPROVED-by-user-scope (chat, 2026-09-08 — R9+R10 planning authorized), pending spec review.

## 1. Findings / Evidence

**AR-21 (P1, confidence 100):** wash commit trusts caller-owned affixes.

```text
EquipmentWash.ts:247-265  commitWashAffixes(instanceId, affixes, ...) assigns the
                           SUPPLIED array to instance.affixes - no domain-retained
                           preview, no payment binding, no one-use identity.
previewWashAffixes (:234) rolls + deducts cost and hands the rolled affixes to the
                           UI; the paid result lives in WashTab.vue local state.
Executed counterexample (audit): a fixture item (quality hoang, locked/favorite,
zero remaining forge uses) accepts [{affixId: arbitrary-unpaid, tier: 99,
value: 999999}] through the public GameManager.commitWashItem with no preview.
ok: true.
```

Precedent to reuse (do NOT weaken): `EquipmentSystem.ts` refine pending-preview
(1045-1118) is an internal, one-use, provenance-checked capability - the bounded
precedent for wash.

**AR-22 (P2 practical, confidence 100):** failed vendor exchange leaves credited currency.

```text
VendorSystem.sellMaterial:
  :169  bag.remove(materialId, amount)      // debit first
  :171  overflow = bag.add(stone, gained)   // credit
  :173-177  if overflow: refund the sale item, return bag_full
MaterialBag.add mutates the stack BEFORE returning overflow (MaterialBag.ts:41-47).
Executed counterexample (lowered stack limit 100): stones 99 + herbs 2 -> failed
sale returns bag_full and leaves stones 100 + herbs 2 (currency credit kept,
material refunded).
```

**AR-23 (P2, confidence 90-100):** operation previews reproduce domain rules.

```text
production upgrade cost/gate: ProductionSystem.ts:224-257  vs  ProductionPanel.vue:164-202
alchemy success/guaranteed/extra split: AlchemySystem.ts:96/:311  vs  GameManagerAlchemyOps.ts:143-156
equipment main-stat roll ranges: EquipmentSystem.ts:384-390  vs  useEquipmentTooltip.ts:188-192
dissolve eligibility/dedup: EquipmentDissolve.ts:48-87  vs  EquipmentOpsSystem.ts:373-402
```

**AR-34 (P2, confidence 95):** reward delivery lacks a consistently consumed receipt.

```text
PillBag.add returns overflow. AlchemySystem.ts:324 and QuestSystem.ts:166 ignore it;
BattleLootSystem.ts:408 handles it. Requested/delivered/overflow handled ad hoc in
EquipmentOpsSystem.ts:102/:355, GameManagerBuildingOps.ts:214, QuestSystem.ts:139
and the production settlement path. Decompose delivery has no collect hook.
```

## 2. Invariants

1. **Paid random results are domain-owned (AR-21).** The accepted wash result is
   retained by the equipment domain bound to item identity; the UI receives a
   display copy + capability id and cannot fabricate affixes. Commit validates
   identity, membership and one-use; every attempt consumes the capability.
   Costs and RNG distributions do not change.
2. **Compound exchange is atomic or explicitly partial (AR-22).** A failed sale
   leaves ALL involved balances unchanged. Use the smallest domain operation
   (preflight/commit on MaterialBag) - no universal transaction framework.
3. **One rule, one implementation for operation previews (AR-23).** Each
   operation exposes its own smallest domain-specific quote/projection read
   model; presentation formats it. No universal Quote framework. Preserve
   genuinely shared helpers (calculateEquipmentScale, getEffectiveAffixValue,
   alchemyRoomSuccessBonus) - do not duplicate or bypass them.
4. **Acquisition receipts are explicit (AR-34).** Where required:
   `{ requested, delivered, overflow, reason }` is explicit; quest notices and
   collect hooks consume delivered amounts. Restore does NOT emit
   new-acquisition events. Restoration, sale, turn-in and newly earned loot
   remain distinct reasons.
5. **No rebalance.** Prices, costs, RNG distributions, bag caps and quest
   rewards are frozen. Only ownership/atomicity/receipt semantics change.

## 3. Ownership

| Rule | Owner |
|---|---|
| Wash preview lifecycle (paid result + accept/discard) | `EquipmentSystem`/`EquipmentWash` domain (new pending-wash capability, refine precedent) |
| Wash payment/cost | existing wash cost path (unchanged) |
| Vendor exchange atomicity | `VendorSystem` (owns pricing + the exchange transaction) |
| Material debit/credit preflight | `MaterialBag` (smallest addition needed by vendor; not a framework) |
| Operation quotes | each operation's domain system (Production/Alchemy/EquipmentSystem) exposing a read model |
| Acquisition receipts + notices/quest facts | reward/grant orchestration consuming a shared small receipt type |

## 4. Migration path — vertical slices, one at a time (audit Wave 5)

```text
S1 (AR-21, P1)  Wash pending-result: domain-retained preview, one-use
                capability, identity/membership checks, UI accepts/discards
                by capability - migrate WashTab + EquipmentOpsSystem +
                GameManager.commitWashItem.
S2 (AR-22)      Vendor atomic exchange: preflight credit capacity, commit
                debit+credit coherently, refund nothing needed on failure.
S3 (AR-34)      Acquisition receipt: introduce the small receipt type; migrate
                alchemy + quest pill drops first (clear ignored-overflow
                defects), then production/decompose/building/loot consumers
                to consume receipts uniformly. Quest notices use delivered.
S4 (AR-23)      Authoritative operation quotes: production upgrade cost/gate,
                alchemy success split, equipment roll-range tooltip,
                dissolve eligibility - each its own domain read model.
```

S1 and S2 are self-contained; S3 crosses several consumers and should land
after S1/S2; S4 is per-operation and may be split further at execution time.
Do NOT combine slices into one unreviewable patch.

## 5. Real consumers to migrate (production, not fixtures)

- `WashTab.vue` (local paid-preview state) via `GameManager.commitWashItem` →
  `EquipmentOpsSystem.ts:275`.
- `VendorSystem.sellMaterial` callers (`GameManager` vendor facade + panel).
- `AlchemySystem` settle, `QuestSystem.claim` pill drops, building collect,
  production/decompose settlement drains (receipts).
- `ProductionPanel.vue` upgrade cost/gate display, `useEquipmentTooltip`
  roll ranges, `GameManagerAlchemyOps` success split (quotes).

## 6. Regression tests required

- Wash: payment-at-preview, accept/discard, repeat commit rejected,
  item removed/replaced between preview and commit, payload mutation,
  equipped-stat refresh, no cost on commit, cost on every re-roll.
- Vendor: exact-fit / partial-capacity credit, insufficient input, unchanged
  balances on every failure mode (incl. lowered stack limit), sole-ingredient
  guard, grade gate unchanged.
- Receipts: delivered/overflow surfaced; quest collect-credit uses delivered;
  restore path emits nothing; repeated claim once.
- Quotes: quote == commit parity for each migrated operation; UI renders the
  same values it enforced before (characterization first).

## 7. Explicit out of scope

- No new wash balance/RNG tuning; no vendor price changes.
- No universal transaction/quote framework (A9/A12).
- AR-16 remote/cloud contracts (R10 boundary keeps local scope).
- Dissolve redesign beyond the eligibility/dedup quote parity.
- Quest content/reward balance changes.

## 8. Completion gate

```text
- wash commit cannot accept caller-fabricated affixes (reproduction test)
- failed vendor sale leaves all balances bit-identical (test)
- migrated delivery paths consume receipts uniformly (grep + tests)
- migrated previews read domain quotes (parity tests)
- P3 full + adversarial QA (escalate to deep if quick shows cross-system
  persistence/progression risk) + code review
```
