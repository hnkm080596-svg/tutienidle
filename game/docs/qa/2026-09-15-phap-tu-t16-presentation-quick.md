# QA Review: Phap Tu Reimagined Task 16 — presentation wiring

- Date: 2026-09-15
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths (commit `a7d3f482`):
  - `game/src/core/progression/NodeSystem.ts` (previewRouteSwitch + shared paid math)
  - `game/src/core/progression/NodeBranchViews.ts` (elementTag/routeTag view membership)
  - `game/src/components/panels/loadout-sections/NodeTreePanel.vue` (route toggle + refund preview modal)
  - `game/src/components/panels/SkillPathPanel.vue` (element tabs + always-show tree)
  - `game/src/components/panels/skill-path/NodeInspector.vue` (blocking route pick)
  - `game/src/components/panels/skill-path/SkillDetailView.vue` (cast-level progress)
  - `game/src/components/panels/QuanKhiPanel.vue` (offerable-path gating + An card)
  - `game/src/composables/useLoadoutActions.ts` (wrappers)
  - `game/src/presentation/bridges/theBarBridge.ts` (new — The bar reader)
  - `game/src/presentation/gate/PresentationGate.ts` (theBarReader key)
  - `game/src/components/game/PhaserCanvas.vue` (reader registration)
  - `game/src/game/scenes/CombatScene.ts` (pollTheBar)
  - `game/src/game/scenes/combat/PlayerHudLayer.ts` + `combatConstants.ts` (The bar group + colors)
  - `game/src/components/game/combat/hud/TurnCombatSkillBar.vue` (An passive emblem)
  - `game/src/data/skill/CoreSkills.ts`, `TurnSkillDisplayMeta.ts`, `game/src/locales/{vi,en}.json` (copy)
  - Test files: `NodeSystem.route.test.ts`, `theBarBridge.test.ts`, `PlayerHudLayer.test.ts`, `TurnCombatSkillBar.display.test.ts`, `SkillDetailView.test.ts`, `NodeBranchViews.test.ts`, `nodeBranchCoverage.test.ts`

## Scope and Risk Map

changed-risk-map flagged 4 domains (combat-and-tribulation, economy-and-progression, pinia-phaser-sync, ui-input-lifecycle) → `deepAuditCandidate: true` on breadth alone. Manual routing of unmapped paths: `useLoadoutActions.ts`/`locales` → ui-input-lifecycle; `theBarBridge.ts`/`PresentationGate.ts` → pinia-phaser-sync.

Escalation declined — the risk is confidently bounded: every task-owned change is read-only presentation or a thin UI→op wrapper. The only state-mutating seams it exposes (`selectPhapTuElement`, `switchRoute`) were already hardened and tested in earlier tasks; the new code adds a *read-only* preview sharing the same paid-math implementation (A9). No save schema, clock, reward, or persistence boundary is touched. The core-engine properties (multicast storms, detonate re-seed, ritual gate, save/load of `phap_tu_an`) live outside this diff and carry their own task-owned test coverage (TurnBattleSystem.anKit/detonate/empowerment, GameManager.phapTuAnPath).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-PRES-1 | nodeLevels + skillInsight / NodeSystem | Route respec confirm dialog shows "regain X / lose Y" | Conservation — preview must equal switchRoute's actual refund | Value mutation (multi-level, waived costs) | `preview.refund === switchRoute()` return | Unit (parity) | High — a lying preview taxes players wrong |
| INV-PRES-2 | PlayerData / NodeSystem | previewRouteSwitch called | Idempotency — preview mutates nothing | Repeat | nodeLevels/route unchanged after preview | Unit | High |
| INV-PRES-3 | phapTu.{element,route} / GameManagerProgressionOps | Element-root purchase | Atomicity — element != null implies route != null | Reorder (buy root without route) | `purchaseNode` op rejects roots; only `selectPhapTuElement` commits | Op-level | High |
| INV-PRES-4 | skillCastCounts / QuanKhiPanel | linh_bao crosses Lv3 mid-session | Synchronization — An card appears live, not stale | Timing boundary (9999→10000) | `availablePaths` computed re-evaluates via reactive `$state` | Unit + inspection | Medium |
| INV-PRES-5 | CombatEntity.currentThe / theBarBridge→PlayerHudLayer | The bar poll each frame | Lifecycle — hidden with no pool/battle; marker at fixed 100 vs raised cap; armed tint | Value mutation (0 max, raised cap, armed) | group visibility, marker position, label | Unit (PlayerHudLayer) | High |
| INV-PRES-6 | cultivationPath / TurnCombatSkillBar | An path in battle | No dead ult button — emblem not button | — | 2 buttons + emblem div, ult label absent | Component mount | Medium |
| INV-PRES-7 | skillCastCounts / SkillDetailView | View a cast-leveled skill | Cast progress replaces dead Insight-upgrade affordance (INV-9) | — | "{count} / {next} casts" text, no upgrade button | Component mount | Medium |
| INV-PRES-8 | phapTu.route / NodeTreePanel | Respec while battle active | Out-of-combat only | Timing boundary | toggle disabled in-battle; op rejects anyway | Op test (pre-existing) | Medium |
| INV-PRES-9 | phapTu.element / SkillPathPanel tabs | Browse a foreign element tree | Foreign nodes locked, never purchasable | — | elementMismatch reason + disabled purchase | Inspection | Low |
| INV-PRES-10 | locales | New keys | i18n parity vi/en | — | i18nKeyParity test | Architecture test | Medium |
| INV-PRES-11 | routePickOpen / NodeInspector | Element-root route pick | Blocking choice, no dismiss | Interruption (ESC/click-out) | No cancel affordance exists (by design); note: no focus trap | Inspection | Low (a11y gap — see Findings) |
| INV-PRES-12 | KiemTuNodes.branchTag / NodeBranchViews | kiem_tran/bat_kiem views after elementTag precedence | Route trees still render | Cross-system chain | Kiem nodes carry only branchTag → `elementTag ?? branchTag` resolves correctly | Coverage test | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | Clean (exit 0) | Post-commit state |
| `npm run build` | Success (vite build + vue-tsc) | Full production build |
| `npx vitest run` (full suite) | 558 files / 4190 tests pass, 4 expected-fail | Expected-fail entries pre-date the task |
| `NodeSystem.route.test.ts` | 11 pass incl. preview↔mutation parity + waived-cost exclusion | Parity asserted against live `switchRoute` return |
| `theBarBridge.test.ts` (new) | 7 pass — path gate, element gate, battle-state gate, raised-cap snapshot, empowered flag, registry round-trip | Structural fakes, no Pinia/Phaser |
| `PlayerHudLayer.test.ts` | 8 pass incl. marker-inside-bar at raised cap + armed label | jsdom fake scene |
| `TurnCombatSkillBar.display.test.ts` | 4 pass incl. An emblem (2 buttons + emblem, no dead ult) | Store mocked |
| `SkillDetailView.test.ts` | 4 pass incl. cast progress replaces upgrade button | Real SKILLS data + Pinia |
| `CombatScene.hudWiring.test.ts` | 9 pass — poll plumbing unaffected | — |
| `nodeBranchCoverage.test.ts` + `NodeBranchViews.test.ts` | All pass — every node tag renderable or explicitly hidden | — |
| `setActivePlayer(player.$state)` (App.vue:579) | `activePlayer` is the reactive Pinia state → INV-PRES-4 staleness ruled out by reactivity | Static evidence + store semantics |
| `purchaseNode` op (GameManagerProgressionOps:163-167) | Element roots hard-rejected → atomicity holds even if another surface bypasses the modal | Static evidence |

## Findings

### QA-2026-09-15-001: Route-pick modal has no focus management
- Severity: Low
- Status: Coverage gap
- Invariant: UI input lifecycle — blocking overlay should own the active surface.
- Preconditions: NodeInspector route-pick modal open (element root clicked, pre-commit).
- Reproduction: The modal is a fixed overlay + `role="alertdialog"` but does not use `useDialogFocus` (unlike ConfirmModal). Keyboard Tab can escape to background controls; pointer interaction is correctly blocked. No Escape handler — blocking by design per spec §3.3.
- Expected: A blocking modal should also trap keyboard focus for parity with pointer blocking.
- Actual: Keyboard users can Tab to background controls; all ops still guard state correctly, so no gameplay corruption is possible.
- Evidence: Static inspection of `NodeInspector.vue` (no `useDialogFocus` import, no keydown handling). No runtime repro needed for a focus-management gap.
- Test file: none (presentation a11y; a Playwright focus-order check belongs with the deferred P14 pass).
- Owner subsystem: NodeInspector.vue
- Blast radius: Keyboard-only users only; state integrity unaffected.

## New or Changed QA Tests

None added by this QA run — the implementation already carries the decisive tests (preview parity, bridge mapping, emblem, cast progress, marker/cap HUD state). The one gap found is an a11y/focus matter that needs a browser check, deferred with P14.

## Gaps and Residual Risk

- P14 visual pass deferred per the isolated-worktree exception: the The bar/threshold marker/route modal/hidden-card visuals are unit-covered but not browser-confirmed. Recommend a `npm run dev` visual sweep at branch finishing (authorized main checkout).
- Focus-trap gap above (QA-2026-09-15-001).
- The The-bar marker self-heals next frame after a group `setVisible(false→true)` toggle (≤1 frame of missing tick) — cosmetic, bounded, poll-driven.

## Pre-existing Failures

- 4 expected-fail tests (long-standing `.fails` markers, pre-date this branch).
- `eslintCoreSeverity.test.ts` flake under parallel load (60s timeout at full-suite concurrency; 1.2s isolated pass — observed twice this session).
