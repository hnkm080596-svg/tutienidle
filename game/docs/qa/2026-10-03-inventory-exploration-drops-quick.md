# Quick QA - inventory / exploration / drop-table fixes (2026-10-03)

Scope (task-owned): PaperPanelNavigation.vue, MaterialBagSection.vue,
materialTooltip.ts (new), ExplorationSurface.vue,
ExplorationPaperDetails.vue, ExplorationPaperMap.vue, explorationUi.ts,
InventoryFidelityScene.vue, ProductionSystem.ts,
StageDropTables.ts, vi/en.json, ExplorationPreview.vue, exploration.ts,
plus the two test files that pin the new behavior.

Risk map: domains = economy-and-progression + ui-input-lifecycle;
deepAuditCandidate=true (2 domains). Manual routing for unmapped paths:
materialTooltip.ts + explorationUi.ts -> ui-input-lifecycle consumers
(tooltip/slot surfaces); StageDropTables.ts + exploration.ts ->
economy data + preview bootstrap. Escalation waived - bounded in code:
the economy change is one deterministic weight-map inside the single
settle funnel (grantCycleRewards -> rollRewards); RNG consumption count
is preserved (zero weights consume no draws); no schema/clock/pinia
ownership change; UI side verified at runtime (Playwright on the 4
preview pages).

## Confirmed defect fixed (reproduction pinned)

- REAL_DEFECT / F-MAT-REALM leak: ProductionSystem.rollRewards rolled
  the raw tier weight profile (low=[60,20,10]) so a mortal collector
  minted foundation_establishment materials ~11% of cycles; the save
  validator (producible ceiling = claimed tier + 1) then rejected the
  save. All settle paths (online tick, worker, offline) share
  grantCycleRewards -> rollRewards, so the leak hit every channel.
  Fix: cap the rolled profile at collection tier index + 1, matching
  the validator's documented ceiling. Pinned by
  ProductionSystem.realmTier.test.ts (no foundation materialId across
  3000 mortal-cycle rolls; qi tier still reachable ~25%).

## Sibling-faucet audit (task 6 asks "audit all mortal-reachable sources")

- Stage drop tables: mortal band lists no profession materials;
  qi/foundation bands are realm-gated upstream. Bounded.
- Family drop tables: no material entries reachable at mortal. Bounded.
- Hidden material channels (grotto): own gate `cycleTierIndex >=
  bandIndex` - cannot mint above the cycle realm. Bounded.
- Quest rewards: isQuestRewardDropAdmitted applies the realm window.
  Bounded.
- equipment_any (battle loot): rolls the equipment registry uniformly;
  can mint high-grade gear at mortal, but save validation only pins
  EQUIPPED grade (canUseItemGrade) - unequipped records stay loadable
  by design. Out of scope; noted for the report.

## UI hypotheses attacked

- Nav rail occlusion: rail bottom now 680 design px vs corner-ornament
  ~702 (runtime: last item bottom 658, container overflowed=false on
  inventory/quest/settings previews).
- Inventory internal scroll: .bag overflow:auto->hidden + cells
  82->76/gap 12->10/img 67->62 (4 rows fit 337 usable); count line gets
  30px bottom margin off the decorative rule. Runtime: scrollable=false,
  content ends 662 design px.
- Locked stages: aria-disabled + click guard + lock badge + title;
  runtime: 25 locked nodes, all with lock marks, click emits nothing
  (verified - stage detail unchanged). Old inspectable-locked test
  replaced per the user's new "not clickable" spec.
- Drop cells: SlotView tiles (item art or monogram fallback) + amount
  under cell + item-info tooltip on hover; material drops reuse the
  extracted bag tooltip builder (extraRows carry drop amount/chance);
  equipment/implied-one cells show x1. Runtime-verified (icon + tooltip
  rendered on /ui-exploration.html).

## Gaps

- No e2e click-through test for the locked-stage guard (unit test +
  manual Playwright click evidence instead).
- Currency cells render monograms (no item art exists for currency) -
  sanctioned fallback, not a defect.
- Preview fixture uses literal tooltip text (bare fixture labels
  pattern); production resolves registry data + i18n keys.

Verdict label: PASS WITH EVIDENCE.

---

## Clean round 2 (2026-10-03, post external-CI + final adversarial pass)

Reviewers (passes 1-4) flagged: shared tier-lead constant needed (fixed:
PRODUCIBLE_REALM_TIER_LEAD); bag tooltip duplicated instead of reused
(fixed: extracted useMaterialTooltip composable); StageSelectPanel tests
still asserting the old selectable-locked contract (fixed: fixtures now
satisfy the real isStageUnlocked gate - realmLevel plus previous floor);
architecture registries stale after the tooltip extraction (fixed:
exposure exception list gained useMaterialTooltip.ts, renderedTokens
benign entry removed since the tokens left the .vue corpus); locked
node reason unreachable after the click guard (fixed: lockedHint on
ExplorationNode carries disabledReasonLabel into the node title).

Final verification on this state: npm run verify - type-check clean,
build clean, 8635 tests green (921 files).

Deferred Lows (recorded, non-blocking):

- Hidden-channel mint path (grotto): the new collection cap does not
  guard grotto channels; latent only - zero grotto material channels
  are authored today.
- equipment_any unequipped high-grade loot at mortal remains loadable
  by design (validator pins equipped grade only); out of scope, noted.
- Currency drop cells render monogram fallbacks (no item art for
  currency) - sanctioned pattern.
- Preview fixtures use literal tooltip text; production resolves
  registry + i18n.
