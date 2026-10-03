# Adversarial QA (quick) — building upgrade affordances + quest pill fix

Date: 2026-10-03. Branch: devin/upgrade-button-pill.
Scope: 2 gates for building upgrade (plaque chip + in-panel button),
quest Tất Cả/Một Lần pill edge fix (tab-seal -> seal-chip chrome).

## Task-owned paths
- useBuildingNavigation.ts, useBuildingHeaderState.ts (composables)
- BuildingUpgradeButton.vue (new), FunctionOverlayPanel.vue
- DongFuStage.vue, DongFuHomeContent.vue, dongFuUi.ts (real home surface)
- DongFuBuildingPlaque/Anchor/Hotspots (+test), LeftPanel.building.test.ts
- AlchemyFidelityScene.vue, EquipmentFidelityScene.vue, QuestGroupTabs.vue
- DongFuHomeContent.test.ts (new)

Mapper: ui-input-lifecycle; composables manually routed to
economy/progression (write path spends materials, bumps level) +
Vue/Pinia bridge (stateVersion). deepAuditCandidate: false.

## Invariant ledger / attacks

| # | Hypothesis | Result |
|---|---|---|
| 1 | Overspend / double-upgrade via rapid second click | SAFE — upgradeBuilding re-quotes synchronously; BuildingSystem.upgrade is the domain authority and enforces the same rules (quote = read side of upgrade). Runtime: click -> level+1, bag decremented, chip gone. |
| 2 | 'upgrade' badge leaks to wheel/opportunity renderers | SAFE — only DongFuStage buildings computed sets 'upgrade'; wheel/board never receive it. |
| 3 | Chip stays after upgrade (stale UI) | SAFE — upgradeBuilding -> bumpState; stateVersion-driven rebuild hides it. Verified live (3 chips -> 2). |
| 4 | Realm-gated building shows dead affordance | SAFE — predicate is the same quote incl. meetsRealmRequirement. Verified live: pill_room lv2 at qi realm -> no chip/no panel button. |
| 5 | Scope-hidden building upgraded via chip | SAFE — buildingOps.upgradeBuilding refuses non-beta surfaces; quote also gates. |
| 6 | Nested <button> inside plaque .df-building | SAFE — affordance is span[role=button] w/ Enter/Space handlers; on hotspots layer the plaque button is sibling of the anchor <button>, not nested. |
| 7 | /ui-*.html previews crash without provides | SAFE — inject-optional + `provided` gate; loaded ui-alchemy/ui-equipment/ui-quest/ui-dong-fu: 0 page errors. |
| 8 | Click chip also opens building panel | SAFE — @click.stop; pinned test asserts leftPanelMode stays null. |
| 9 | Quest pill renders broken chrome | SAFE — seal-chip manifest slices 24/24/14/14; runtime screenshot shows flat edges vs beveled before. |
| 10 | save/persistence affected | N/A — upgrade path unchanged at domain layer; only UI consumers added. |

## Evidence
- npx vitest run (scoped): hotspots + dong-fu + layout + quest + composables — green.
- npm run type-check — clean.
- Runtime (dev server, guest char, seeded realm/materials):
  plaque chip click -> pill_room 1->2; panel button hidden while
  realm-gated, appears at foundation realm -> click -> 2->3;
  equipment plaque chip -> 1->2. Quest pills render flat edges.
- /tmp screenshots: home-upgrade.png, plaque-btn.png, alchemy-btn.png,
  equipment-btn.png, quest-pills.png (old-zoom/new-zoom comparison).

## Findings
- Low (deferred): naming collision navigation.upgradeBuilding(buildingId)
  vs buildingOps.upgradeBuilding(instanceId) — documented in code.
- Low (deferred): equipment-upgrade fixed 120px width may clip long
  cost labels — cosmetic.
- Coverage gap: no automated e2e for chip click (manual runtime only);
  unit pins exist at component + navigation level.

## Label: PASS WITH EVIDENCE (per-operation; coordinator owns run verdict)
