# Architecture and autonomous production implementation plan

> **For agentic workers:** use subagent-driven-development task-by-task; all subagents GPT-6 Luna only.

Goal: deliver the Architecture panel with authoritative upgrade effects, remove the worker economy, and then display background expedition in Dong Fu.
Architecture: ProductionSystem owns autonomous site cycles; BuildingSystem owns building rules, BuildingManager instances, operations own transactional commands. Architecture owns upgrade UI only. Expedition presentation reads AutoFarmOps and never resolves combat or loot.
Tech Stack: Vue 3, TypeScript, Pinia, Phaser, Vitest, Playwright.
Spec: docs/design/2026-10-12-architecture-panel-audit-design.md plus accepted rulings below.

## Accepted rulings and constraints

Independent one-cycle-per-site production; disabling another site never increases speed. Keep Chi Hien Quan building/art with no upgrade or worker effect. Move all ProductionSite upgrades into Architecture under Khai Vat Duong. Khai Vat Duong includes three raw resource types and spirit stone. Single-level buildings default max. Vendor building/art only, no selling/conversion. Alchemy building speed retained, no room-level success bonus; one active kiln plus 3 waiting slots/level; reserve at enqueue, refund waiting inputs in full, active cancellation burns inputs; instant decompose, no worker or cycle. No file deletion; preserve saves/art/worktrees/stashes. Native worktree C:/Users/hnkm0/.codex/worktrees/architecture-production-panel/tutienidle, branch codex/architecture-production-panel, baseline f2729f0bf. No merge/push in worker assignments.

## G0/G1 task card and evidence

Responsibility: upgrade ownership plus explicit production/queue contract changes. Existing chain: TickOps and SaveRestore -> pool split -> ProductionSystem -> worker lanes; upgrade UI -> navigation -> BuildingOps -> BuildingSystem/material bag. New chain removes pool admission, retains one site-cycle clock/settlement owner online/offline. Real consumer census in design. Q1-Q12: no Vue/Phaser dependency in domain; queries stay observational; detached snapshots and duplicate restore handling retained; quote/commit same owner; all timing remains TimeAuthority. First proof BEFORE_WRITE: regress current single-site 3-lane behavior against accepted one-cycle invariant; retain fresh/reopen/offline semantics. Record changed contract in roadmap; do not rewrite unrelated architecture.

### Task 1 — autonomous production

- [ ] Add RED regressions at ProductionSystem + manager tick/offline seams: one enabled site gets exactly one cycle; other toggles/legacy assignments/capacity have no effect; retained work settles once; finite clock, cap and RNG parity preserved.
- [ ] Replace runtime pool/capacity/assignment reads with direct autonomous site-cycle operation. Retire worker state from live Player/Production contracts and save writes; no file deletion. Preserve actual pending progress or explicitly document any unresolved migration ruling.
- [ ] Update corresponding tick, restore, save whitelist/validator and real consumers; keep scope-hidden decompose inert and remove pool reservation use.
- [ ] Reverify relevant suites/typecheck; update maintained roadmap; return changed files and G5 evidence.

### Task 2 — authoritative upgrade view and Architecture UI

- [ ] Domain view current/next effects and exact costs, realm/affordability/max/dormant status; no UI formula copies.
- [ ] Alchemy speed-only building bonus and queue capacity with accepted serial-queue ruling; preserve talent bonus and recipe base success (only room-level bonus removed).
- [ ] Architecture panel using PcPaper controls and existing building art; desktop 3x2 grid and resource header, no English IDs/sample prices. Khai Vat details own ProductionSite upgrades for all 3 resources plus spirit stone building effect.
- [ ] Unlock sect rail under Architecture destination; update Ui store/registry/mount seam/i18n. Move upgrade controls from Alchemy/Equipment/FunctionOverlay/Production panels. Function panels may link to Architecture; cannot upgrade independently.
- [ ] Vendor selling inaccessible; Chi Hien Quan art-only max-level/no upgrade. No dormant feature unhide.
- [ ] Test missing realm/resources/double click/max/quote drift/save reopen and browser visual/runtime from this worktree.

### Task 3 — expedition presentation

- [ ] AutoFarm owner read model of current stage/cycle progress and resolved receipts; no second StageLease or TurnBattleSystem.
- [ ] Compact hero/enemy combat presentation in Dong Fu, driven by background expedition progress; reuse production sprites/VFX where supported, never fabricate authoritative HP/damage/loot.
- [ ] Stop/remount/reload/background/reduced-motion cannot change reward/progress. Browser progression evidence, visual acceptance and accessibility.

### Final gates

- [ ] Aggregate typecheck/build/full Vitest, targeted Node QA, OCR delegation coverage, real Playwright, adversarial runtime and sequential resulting-state reviews.
- [ ] Independent Luna reviewers; root reasons aggregate state. Report actual gaps/accepted exceptions, not unqualified fixed point.
- [ ] Inventory obsolete files and request permission before physical deletions, if any remain necessary.
