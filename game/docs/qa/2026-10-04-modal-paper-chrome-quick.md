# QA Review: modal paper chrome migration

- Date: 2026-10-04
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths: `game/src/assets/theme.css`, `game/src/components/common/{BetaCompletionModal,ConfirmModal,ErrorScreen,FeedbackDialog,OfflineSummaryModal,OverlayPanel,SaveIncompatibleScreen,TalentEntitlementModal,TutorialOverlay}.vue`, `game/src/components/common/InkWashLargeSurfaces.test.ts`, `game/src/components/game/combat/CombatDefeatPanel.vue`, `game/src/components/panels/GuestAbandonDialog.vue`, `game/src/components/scenes/victory/{VictoryGrowthRow,VictoryScene}.vue`

## Scope and Risk Map

Presentational-only migration: 12 `.vue` surfaces swap dark ink-wash/`paper-on-dark` chrome for drawn huyen-kim nine-slice PNGs (`chrome-id` props), plus theme.css (`.paper-on-dark` retired, `.ghost-on-paper` added). No state transitions, lifecycle, EventBus handlers, i18n keys, or domain calls changed.

Mapper domains: `ui-input-lifecycle` (primary), `combat-and-tribulation` + `pinia-phaser-sync` (path-triggered by `components/game/combat/` and `scenes/victory/` locations only). `deepAuditCandidate: true` from cross-domain path count; **not escalated** — code inspection bounds the risk: the combat/victory files changed only props/classes (`asset-id`→`chrome-id`, class removal), zero logic lines. `unmappedPaths`: `InkWashLargeSurfaces.test.ts` — the test asserting the migration itself; routed to ui-input-lifecycle.

One-hop consumers reviewed: OverlayPanel `variant='system'` (SysPanel chrome), settings panel token family (`.paper-on-sys` untouched), hidden file input in SaveIncompatibleScreen, `useDialogFocus` traps (untouched), e2e `ink-wash-ui.spec.ts` color assertions (settings panel, `.paper-on-sys` family — unaffected).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-MPC-1 | Panel host with 2 InkNineSlice slices (surface z=1, frame z=2) | Render + interact | Blocking: children must sit above slices and receive input | Reorder/stale state | Real-app click targets rendered and usable | Browser | High — resolved |
| INV-MPC-2 | OverlayPanel `variant='system'` (SysPanel) | Restyle of ink variant | Cross-system: sys tokens must not leak | Scope leak | Computed colors of system card | Source + tests | High — resolved |
| INV-MPC-2b | OverlayPanel `variant='ink'` consumers (~9 panels: VendorPanel, WorkerLodgePanel, ScripturePavilionPanel, TranPhapPanel, CompanionPanel, ArtifactPanel, QuanKhiPanel, BreakthroughRequirementPanel, FunctionOverlayPanel building heading) | Surface swap dark `surface-m-panel` (RGB 40,41,37) → cream `surface-xl-scroll` (RGB 238,229,203) | Synchronization: slotted content authored for the dark shell (`--surface-text`/`--hk-text-*` light ramps; self-painted paper bodies) must stay consistent with the card's fill | Stale state | FunctionOverlayPanel comment states the header is DARK ink; PNG center-pixel probe proves the fills differ | Source (SOURCE_PROOF) | High — CONFIRMED, fixed: reverted ink to `surface-m-panel`; added opt-in `variant='paper'` used only by FeedbackDialog |
| INV-MPC-3 | SaveIncompatibleScreen hidden file input | Click import label | Interaction: invisible input still receives click | Reorder | Input covers label (z=4>3, opacity 0) | Source | Medium — resolved |
| INV-MPC-4 | theme.css `.paper-on-dark` removal | Class deletion | Recoverability: no remaining static/dynamic consumer | Stale state | `rg "paper-on-"` + class-construction grep → zero | Source | Medium — resolved |
| INV-MPC-5 | All `chrome-id` slots | Render | Degraded environment: only `status:'ready'` PNGs used | Missing asset | Manifest audit + PNGs visibly drawn in real-app shots | Source + browser | Medium — resolved |
| INV-MPC-6 | `tint-var` removal on CombatDefeatPanel | Prop drop | Determinism: prop was inert (slot tintable:false) | Dead config | Manifest flag + rendered frame | Source | Low — resolved |
| INV-MPC-7 | i18n/copy | Edits | Conservation: text and keys identical | Value mutation | `git diff` — zero `*.json`/key edits | Source | High — resolved |
| INV-MPC-8 | VictoryGrowthRow empty-state color | Token swap | Ownership: component consumed only inside victory scroll | Cross-system | Sole importer = VictoryScene.vue | Source | Low — resolved |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | green | run after each fix round |
| `npx vitest run` (6 touched-component test files incl. `InkWashLargeSurfaces.test.ts`) | green | assertions updated to `data-hk-slice`/`chrome-id` |
| `rg "paper-on-"` repo-wide incl. dynamic class patterns | zero consumers of removed class | `.paper-on-sys` is a separate class, untouched |
| Real-app Playwright (vite :5199, guest boot → pokes): offline summary, talent entitlement, tutorial, victory (kill-loop), defeat (player-kill) | 5 surfaces captured | `/tmp/modshots/real-{offline,talent,tutorial,victory,defeat}.png` — cream scroll + gold frame + readable dark text verified |
| Mounted preview harness (`ui-preview/ModalChromePreview.vue`, seeded pinia) | 6 remaining surfaces captured | confirm, beta, error, save-incompatible, feedback, guest-abandon — same recipe, screenshot-verified |
| Manifest audit | all used ids `status:'ready'` | `surface-xl-scroll`, `frame-m-modal`, `frame-xl-ceremony`, `text-field`, `button-standard` |

## Findings

### QA-2026-10-04-001: OverlayPanel surface swap broke every ink-variant consumer
- Severity: High
- Status: Confirmed (SOURCE_PROOF) — FIXED
- Invariant: a shared shell's chrome change must keep every slotted consumer's authored token contract.
- Preconditions: `surface-m-panel` is a dark fill (center RGB 40,41,37); `surface-xl-scroll` is cream (238,229,203). OverlayPanel default `variant='ink'` is consumed by VendorPanel, WorkerLodgePanel, ScripturePavilionPanel, TranPhapPanel, CompanionPanel, ArtifactPanel, QuanKhiPanel, BreakthroughRequirementPanel and FunctionOverlayPanel (building heading), whose content uses light `--surface-text`/`--hk-text-*` ramps or self-painted paper interiors.
- Reproduction: static proof — `FunctionOverlayPanel.vue` documents `.building-heading__name { color: var(--surface-text) }` as required because "the DARK ink header of OverlayPanel" (audit H4); changing the shell to cream renders that text light-on-cream.
- Expected: migration only affects the listed dialogs.
- Actual: first implementation swapped the ink surface globally.
- Evidence: PNG center-pixel probe + authored comment contract + token audit of consumers.
- Test file: `game/src/components/common/InkWashLargeSurfaces.test.ts` (now asserts `surface-m-panel` on default ink and `surface-xl-scroll` only on `variant='paper'`).
- Owner subsystem: UI/input/lifecycle — OverlayPanel shell.
- Blast radius: every legacy ink panel in the game (≈9).
- Fix: ink variant reverted to `surface-m-panel` (byte-identical rendering to base); new opt-in `variant='paper'` renders `surface-xl-scroll` + paper text ramp; FeedbackDialog opts in. Diff vs base for ink/system consumers is additive-only.

### Pre-existing (not task-caused)

- `game/tests/e2e/ink-wash-ui.spec.ts:99` comment references retired `.settings-panel .paper-on-dark`; the asserted RGB values belong to the `.paper-on-sys` token family (settings panel never carried `.paper-on-dark` on this base). Severity: Low — comment drift only; assertions unaffected.

## New or Changed QA Tests

`game/src/components/common/InkWashLargeSurfaces.test.ts` updated (task-owned): asserts `data-hk-slice="surface-xl-scroll"` and `chrome-id="frame-xl-ceremony"` on migrated surfaces. No new tests authored — defect count is zero and the surface is presentational.

## Gaps and Residual Risk

- ConfirmModal, BetaCompletionModal, ErrorScreen, SaveIncompatibleScreen, FeedbackDialog, GuestAbandonDialog were verified in a mounted preview harness, not the live app — each requires a distinct trigger (corrupt save, beta flag, error state, logout). Bounded cosmetic risk: identical chrome recipe proven live on 5 surfaces including both ceremonial frames.
- `real-defeat.png` proves the defeat panel live; victory live shot shows loot slots and action buttons drawn correctly.
- Legacy ink panels (vendor, lodge, tran_phap, companion, artifact, quan_khi, breakthrough, function-overlay building panels) intentionally stay on the dark `surface-m-panel` + `frame-m-modal` shell — migrating their interiors is a separate per-panel design task, flagged for the PR body.

## Pre-existing Failures

None observed in scope. The e2e comment drift above predates this diff.
