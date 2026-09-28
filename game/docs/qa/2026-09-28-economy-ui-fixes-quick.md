# QA Quick Review — economy UI audit fixes (devin/ui-fix-economy)

Scope: task-owned paths only — CurrencyHud.vue (new), FunctionOverlayPanel.vue,
GameRoot.vue, VendorPanel.vue(+test), ChieuMoTab.vue, QuaTangTab.vue,
PillBagSection.vue, MaterialBagSection.vue, DecomposeTab.vue(+test),
DecomposeSystem.ts, AlchemyView.vue, QuestPanel.vue, CompanionPanel.vue,
useBagPagination.ts, useBuildingHeaderState.ts, buildings.ts, quests.ts,
vi.json, en.json. Excluded: sibling fixers' surfaces (creation-meta close
affordance, other slices' findings).

Risk map: 3 domains (economy-and-progression, pinia-phaser-sync,
ui-input-lifecycle), deepAuditCandidate=true. Not escalated: the diff is
presentation-layer reads + one pure-read domain helper
(`DecomposeSystem.listMatchingOres`); no transaction, persistence, combat,
offline-time or lifecycle-owning write paths changed. Sell claim still calls
the same `economyOps.sellMaterialToVendor`; companion/alchemy writes unchanged.

## Invariant ledger

| ID | Boundary | Invariant | Check | Result |
| --- | --- | --- | --- | --- |
| INV-ECON-1 | Vendor qty input → sell | Displayed qty == sold qty; bounded 1..owned | Source trace: onQtyInput stored 0 while qtyFor coerced to 1 → CONFIRMED display/action mismatch | FIXED: input clamps min 1 |
| INV-ECON-2 | Confirm-all modal vs live bag | Sold qty never exceeds owned at confirm time | qty captured at click; sell() path unchanged (server-side authoritative); owned can't shrink without user action | Rejected — clamped inputs, domain enforces remainder |
| INV-UI-1 | CurrencyHud mount boundary | HUD must not overlay combat/full scenes | Mounted inside `v-if="!isFullSceneActive"` in GameRoot | Rejected — hidden in full scenes |
| INV-UI-2 | Pill arm timer | No leaked interval/listener; disarm on unmount/re-arm | clearTimeout on disarm, re-arm, onUnmounted | Rejected |
| INV-UI-3 | giftContext lookup | Unknown record id must not crash | find() → null → context null → span v-if | Rejected |
| INV-ECON-3 | rewardChips vs claim-side filters | Preview must match claim output | Same ReleasePolicy predicates called for chips and claim; residual mirror-drift risk noted as Low | Accepted residual (Low) |
| INV-UI-4 | brewBlockReason vs canBrew | Reason must cover every block | Mirrors same computeds, herb reported first by design | Accepted residual (Low: drift if canBrew grows a condition) |
| INV-UI-5 | DecomposeTab matchingOres refresh | Per-tick scan cost | bag.getAll() runs per stateVersion tick — O(materials), trivial | Rejected |
| INV-ECON-4 | Collect-quest shortfall | Show only when progress full AND bag short | collectShortfall guards both conditions | Rejected — verified in runtime screenshot m6 (5/5 shows "Cần giữ đủ… 2/5") |

## Evidence

- `npm run type-check` clean; scoped vitest 97 tests green
  (VendorPanel, DecomposeTab, ChiHienQuan integration, bag sections).
- Runtime evidence: docs/ui-audit/economy/fixed/*.jpg — HUD chips,
  vendor qty/preview/confirm, parked Chiêu Mộ/Đổi Duyên Phận, Quà Tặng
  context line, building header art+titles, decompose hint, alchemy
  outcome label, quest chips+shortfall+Đóng, companion Đóng, pill armed
  hint + fixed tooltip, material accent monograms.
- Save-boot verified end-to-end via seeded v87 guest save (preflight
  required realm-consistent technique gradeHistory — seed fixture order
  fixed accordingly).

## Verdict

PASS WITH GAPS — INV-ECON-1 confirmed and fixed; remaining residuals are
Low mirror-drift risks recorded above. No Critical/High/Medium found.
