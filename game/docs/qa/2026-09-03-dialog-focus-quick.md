# QA Review: dialog focus management (useDialogFocus + OverlayPanel/ConfirmModal)

- Date: 2026-09-03
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/composables/useDialogFocus.ts` (new)
  - `game/src/components/common/OverlayPanel.vue` (modified)
  - `game/src/components/common/ConfirmModal.vue` (modified)
  - `game/src/components/common/dialogFocus.test.ts` (new, dev-written)
  - QA-authored (allowlist): `game/src/components/common/dialogFocusAdversarial.test.ts`, `game/src/components/common/dialogFocusEscape.test.ts`

## Scope and Risk Map

- Mapper (`changed-risk-map.mjs`) domain: `ui-input-lifecycle`; `deepAuditCandidate: false`; no reasons.
- `unmappedPaths`: `dialogFocus.test.ts` (test file) and `useDialogFocus.ts` (new composable). Both manually routed to `ui-input-lifecycle` (UI composable + overlay keyboard/focus behavior). Risk is confidently bounded by code inspection: the composable touches DOM focus/listeners only — no save/cloud, time/offline, economy/progression, or Pinia/Phaser ownership surface → no deep escalation.
- One-hop consumers inspected in current code: 11 `<OverlayPanel>` usages (BreakthroughRequirementPanel, FunctionOverlayPanel, ArtifactPanel, TechniquePanel, LuyenThePanel, SkillPathPanel, RealmPanel, QuestPanel, QuanKhiPanel) and 3 `<ConfirmModal>` usages (SaveIncompatibleScreen, QuanKhiPanel, SettingsPanel). All inherit behavior through the two primitives; none pass competing keydown/focus handlers into the card.
- Escalation triggers reviewed: none apply (no persistence, clock, economy, or scene-ownership change).
- Exclusions: pre-existing full-suite flake `BattleSystem.earthPath.test.ts` (see Pre-existing Failures) — not task-owned, zero diff overlap with `core/battle`.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| QA-DF-1 | Dialog card (`useDialogFocus` watch on open) | Mount with `open=true` / open transition | Focus-on-open lands inside dialog (focusable[0], else card) | Repeat (5 test dialogs across files) | `document.activeElement` ∈ dialog | Vitest jsdom | High (reachability) |
| QA-DF-2 | Card keydown handler | Escape keydown on card | Escape fires exactly once → OverlayPanel `close` / ConfirmModal `cancel` (never confirm) | Repeat + reorder (Escape before/after focus) | emitted event call counts | Vitest jsdom | High |
| QA-DF-3 | Card keydown handler | Tab from first/last focusable | Tab never escapes dialog; wrap is explicit `.focus()` (jsdom has no native nav) | Reorder (Tab at boundary, shift-Tab untested — see gaps) | `activeElement` still in dialog, moved off first button | Vitest jsdom | Medium |
| QA-DF-4 | Composable closure state | Close/unmount transition | Focus restored to trigger recorded at open; trigger in document check | Stale state (trigger removed before close) | `activeElement === trigger` | Vitest jsdom | High |
| QA-DF-5 | Composable closure state | Rapid `true→false→true` same tick | No stale close-restore race: dialog ends focused; async open callback re-checks `open` after `nextTick` | Timing boundary / Repeat | `activeElement` in dialog, not trigger | Vitest jsdom (adversarial) | Medium |
| QA-DF-6 | Composable closure state | Rapid `false→true→false` before open microtask settles | Focus restored to trigger; no dialog rendered; no orphan state | Timing boundary / Interruption | `activeElement === trigger`, no `[role=dialog]` | Vitest jsdom (adversarial) | Medium |
| QA-DF-7 | Card listener lifecycle | Unmount while open | Listener removed at `onBeforeUnmount`; no post-unmount Escape action | Lifecycle / Repeat | dispatch after unmount: no errors, focus is an HTMLElement, no live dialog state | Vitest jsdom (adversarial) | Medium |
| QA-DF-8 | FOCUSABLE_SELECTOR | Dialog whose first button is `disabled` | Selector skips `[disabled]`; focus lands on first enabled control | Value mutation (disabled) | `activeElement === .slot-enabled` | Vitest jsdom (adversarial) | Low |
| QA-DF-9 | Document-level keydown consumers (BagPaginationControls, DongFuCommandWheel) | Escape keydown while dialog open | Composable `stopPropagation()` isolates modal Escape from document/window handlers (brief-specified); dialog close still fires | Cross-system chain | doc-level spy NOT called; `onClose` called | Vitest jsdom (adversarial) | Medium |
| QA-DF-10 | Click-outside path (OverlayPanel) | Backdrop click while focus-managed | Existing `@click.self` close unaffected by composable | Reorder | `InkWashLargeSurfaces` regression: `onClose` ×1 | Vitest jsdom (existing regression) | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm.cmd run test -- src/components/common/dialogFocus.test.ts` (before implementation) | 4 failed / 1 passed — failed for the intended reason (no focus management) | RED step; restore test passed trivially pre-implementation (nothing moved focus), becomes meaningful with focus-on-open present |
| `npm.cmd run test -- src/components/common/dialogFocus.test.ts` (after) | 5/5 pass | GREEN step |
| `npm.cmd run test --` 6 focused files (incl. adversarial + regression) | 18/18 pass (repeated twice: post-impl and post-QA-tests) | Final run 02:15:22 |
| `npm.cmd run test -- src/components/common/dialogFocusAdversarial.test.ts` | 4/4 pass (after fixing a missing `vi` import in the QA test itself) | Test error ≠ implementation defect |
| `npm.cmd run test -- src/components/common/dialogFocusEscape.test.ts` | First version: 2 fail (1 real signal: stopPropagation blocks doc handlers; 1 QA test bug `entry.remove`) → corrected semantics: 2/2 pass | Documented behavior, not a production defect |
| `npm.cmd run type-check` | Pass (run twice: after composable fix and after adding test files) | vue-tsc --build clean |
| `npm.cmd run build` | Pass, 665 modules, no new warnings | Pre-existing chunk-size + plugin-timing notices only |
| `npm.cmd run test` (full suite) ×2 | Run 1: 2143/2144 (1 fail = `BattleSystem.earthPath.test.ts` damage-ratio assertion, diff 12.46 ≫ 0.05); Run 2: no FAIL lines; isolated rerun: 6/6 pass | Flaky (seeded RNG damage/block rolls under suite load — same class as root-caused `waterMitigation`, commit 59a71c8); no task diff touches `core/battle` |

## Findings

No `Confirmed` defects. One documented design trade-off (not a defect):

### QA-2026-09-03-001: Escape is isolated from document/window-level handlers while a dialog is open
- Severity: Low
- Status: Suspected (design trade-off confirmed by behavior test; player impact bounded by code inspection)
- Invariant: Synchronization — modal Escape should not leak to background handlers (brief specifies `stopPropagation()`).
- Preconditions: Dialog open AND a document/window-level Escape handler active (BagPaginationControls sort menu, DongFuCommandWheel).
- Reproduction: `dialogFocusEscape.test.ts` — Escape on dialog card does not reach a document-level keydown spy.
- Expected (per brief): isolation — background handlers must not react to modal Escape.
- Actual: matches brief. Residual: if a player opens a dialog while the command wheel is open, one Escape closes only the dialog; a second press reaches the wheel. This is standard modal layering, not a lock.
- Evidence: `dialogFocusEscape.test.ts` both tests pass (02:14:33).
- Test file: `game/src/components/common/dialogFocusEscape.test.ts`
- Owner subsystem: UI/input/lifecycle
- Blast radius: transient keyboard UX only; no state corruption; reversed by closing the dialog.

## New or Changed QA Tests

- `game/src/components/common/dialogFocusAdversarial.test.ts` — proves rapid-toggle race safety (QA-DF-5/6), post-unmount listener safety (QA-DF-7), disabled-button skip (QA-DF-8). Observable oracles: `document.activeElement`, absence of `[role=dialog]`, no-throw dispatch.
- `game/src/components/common/dialogFocusEscape.test.ts` — proves Escape isolation semantics (QA-DF-9) and that body-level Escape cannot close (handler bound to card only), keeping QA-DF-2 unambiguous.
- Dev-authored `dialogFocus.test.ts` covers QA-DF-1..4, QA-DF-10 (via `InkWashLargeSurfaces`).

## Gaps and Residual Risk

- Shift+Tab wrap (Shift variant) is implemented (explicit `last.focus()` branch) but not directly asserted in jsdom tests; the non-shift wrap is proven. Low residual risk.
- Restore-to-trigger is asserted via composable-driven close; a browser-level check of real Tab navigation (jsdom lacks it) remains an e2e-level gap — recommend a future Playwright case if keyboard QA is raised.
- `BattleSystem.earthPath.test.ts` full-suite flake (pre-existing, unrelated) — root-cause/seeding fix belongs to battle domain work.
- No ledger row appended: no `Confirmed` defect (entry criteria not met).

## Pre-existing Failures

- `BattleSystem.earthPath.test.ts` ("Thổ Thế" AOE 50% damage ratio): failed once in full-suite run 1 (`expected 49.87 to be close to 37.41`), absent in run 2, passed 6/6 in isolation. Classified Flaky, pre-existing; task diff contains no `core/battle` changes (verified via `git status -- game/src/core/battle/`).
