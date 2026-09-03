# QA Review: useDialogFocus zero-focusable Tab + same-tick re-open guard

- Date: 2026-09-03
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/composables/useDialogFocus.ts`, `game/src/components/common/dialogFocusAdversarial.test.ts`

## Scope and Risk Map

Changed: the shared dialog-focus composable (2 targeted fixes) plus 2 added tests in the existing adversarial test file. No architecture change.

`changed-risk-map.mjs` returned `unmappedPaths` for both task-owned paths (mapper has no composable routing). Manual routing: `useDialogFocus.ts` → `ui-input-lifecycle` domain pack (UI composable, overlay focus lifecycle). One-hop consumers inspected in current code:

- `OverlayPanel.vue:22` and `ConfirmModal.vue:28` — the only two production consumers. Both pass `computed(() => props.open)` into the composable, so all open/close transitions flow through Vue's pre-flush batched watcher.
- Downstream OverlayPanel users (FunctionOverlayPanel, ArtifactPanel, LuyenThePanel, TechniquePanel, SkillPathPanel, RealmPanel, QuestPanel, QuanKhiPanel, BreakthroughRequirementPanel) and ConfirmModal users (SettingsPanel, QuanKhiPanel, SaveIncompatibleScreen) inherit the behavior unchanged — no consumer reads `lastTrigger` or relies on Tab default behavior.
- `DongFuCommandWheel.vue:198-217` keeps a window-level Tab keydown listener (bubble phase). It does not check `event.defaultPrevented`; `preventDefault()` does not stop propagation, so what reaches window is unchanged before/after this fix (verified by reading the handler).

Escalation to deep: not required. No save/cloud, time/offline, or economy/progression surface; Vue lifecycle risk is bounded to one composable with two thin consumers and full regression coverage.

Exclusions: unrelated dirty files `game/docs/superpowers/plans/2026-09-03-deferred-cleanup-followups.md` and `.../specs/2026-09-03-deferred-cleanup-followups-design.md` (planning docs, not code).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-DLG-1 | `useDialogFocus` keydown handler on card | Tab keydown on dialog with zero focusables | Lifecycle/containment: Tab must be preventDefault'd before the empty-list early return; native Tab never escapes | Tab dispatch from in-card element on zero-focusable dialog | `event.defaultPrevented === true` + `activeElement` stays inside card | jsdom unit | High (keyboard trap escape) / reachable / transient / single composable / fully observable |
| INV-DLG-2 | `useDialogFocus` watch(open) capture branch | false→true re-open while focus already inside card | Synchronization: trigger capture must not overwrite a retained `lastTrigger` with an in-dialog element; restore must return to the original body trigger | Same-tick open→close→open bounce through component props, then final close | `document.activeElement === originalTrigger` after final close | jsdom unit (component path) | Medium / reachable only via async-gap double-fire / transient / bounded / observable |
| INV-DLG-3 | Escape path | Escape keydown on card | Idempotent isolation: stopPropagation + single onEscape call unchanged | Escape dispatch with document-level spy | `onClose` 1×, document spy 0× | jsdom unit (existing) | High / reachable / transient / bounded / observable |
| INV-DLG-4 | Tab cycle with focusables ≥ 1 | Tab keydown inside populated dialog | Cycle wraps within card; preventDefault placement for non-empty lists unchanged | Tab from first focusable | focus moved within dialog, not to first button | jsdom unit (existing) | High / reachable / transient / bounded / observable |
| INV-DLG-5 | Listener lifecycle | Mount/unmount while open | Listener removed from card at close/unmount; no orphan handler | Unmount while open + dispatch on detached card | no errors, activeElement is HTMLElement | jsdom unit (existing) | Medium / reachable / transient / bounded / observable |
| INV-DLG-6 | DongFuCommandWheel window Tab listener | Tab keydown while any dialog open | Parity: window handler behavior unchanged by this fix (does not read `defaultPrevented`) | Code inspection of handler + propagation semantics | n/a (static, pre-existing behavior) | Code inspection | Low (pre-existing UX concern, out of scope) |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm.cmd run test -- src/components/common/dialogFocusAdversarial.test.ts -t "zero-focusable"` (pre-fix) | FAIL at `expect(tabEvent.defaultPrevented).toBe(true)` — intended reason: handler returned before `preventDefault()` | Intended RED for Edge 1 |
| `npm.cmd run test -- src/components/common/dialogFocusAdversarial.test.ts -t "same-tick"` (pre-fix) | PASS | See Finding QA-2026-09-03-001: Vue pre-flush batching collapses the literal same-tick overwrite through the component path; test pins the user-visible contract |
| `npm.cmd run test -- dialogFocus.test.ts dialogFocusAdversarial.test.ts dialogFocusEscape.test.ts InkWashLargeSurfaces.test.ts` (post-fix) | 4 files, 16/16 passed | Full focused regression matrix green |
| `npm.cmd run type-check` (post-fix) | Clean (`vue-tsc --build`, no errors) | — |
| jsdom focus probe (`node -e` with JSDOM) | Plain `<section>` cannot take focus; `[tabindex="-1"]` can; synthetic Tab never moves focus natively | Justifies test (a) design: containment asserted via `defaultPrevented` + pre-focused in-card element |
| Read of `DongFuCommandWheel.vue:198-217`, `ui.ts:249-258` | Window Tab handler ignores `defaultPrevented`; toggles wheel regardless of modal state | Basis for INV-DLG-6 pre-existing observation |

## Findings

### QA-2026-09-03-001: Edge 2 literal same-tick overwrite is unreachable through the component reactive path
- Severity: Low
- Status: Suspected (reachability limitation, not a defect in the change)
- Invariant: INV-DLG-2
- Preconditions: `false→true` transition in one tick while focus is inside the card
- Reproduction: test (b) — trigger focused, open → focus lands in dialog → sync `open=false; open=true` → final close
- Expected (per original defect report): `lastTrigger` overwritten by in-dialog element; restore skipped
- Actual (observed): watcher is pre-flush; the sync bounce batches into a single job whose old value equals the new value (`true→true`), so the callback does not re-fire; original trigger is restored. The overwrite can only occur if the watcher fires twice around the internal `await nextTick()` gap (async double-fire), which the props-driven path does not produce.
- Evidence: pre-fix test pass + Vue watcher semantics; post-fix behavior identical
- Test file: `game/src/components/common/dialogFocusAdversarial.test.ts` (test b)
- Owner subsystem: `game/src/composables/useDialogFocus.ts`
- Blast radius: none for current consumers; the prescribed guard (`lastTrigger === null || !activeInCard`) is implemented as specified and makes the composable robust if a future consumer drives `open` without prop batching
- Note: the brief/spec prescribed this exact guard; implemented as specified. The reachability nuance is documentation, not a deviation.

### QA-2026-09-03-002 (pre-existing, out of scope): window-level Tab listener toggles command wheel while a dialog is open
- Severity: Low
- Status: Suspected (static inspection; pre-existing, unaffected by this change — `preventDefault()` does not stop propagation, so the window handler's input is identical before/after)
- Invariant: INV-DLG-6
- Owner subsystem: `game/src/components/game/DongFuCommandWheel.vue:198`
- Recommendation: coordinator may want the wheel handler to skip Tab when a modal is open or when `event.defaultPrevented` is true. Not repaired here (outside task scope; QA write boundary).

## New or Changed QA Tests

- `dialogFocusAdversarial.test.ts` — "zero-focusable dialog: Tab is contained": proves Edge 1 (was RED pre-fix on `defaultPrevented`, GREEN post-fix).
- `dialogFocusAdversarial.test.ts` — "same-tick false→true re-open … original body trigger restored": proves the user-visible restore contract across a bounce + final close (passed before and after; documents the batching nuance).

## Gaps and Residual Risk

- Edge 2's overwrite path has no failing-reproduction test because it is unreachable through Vue's batched watcher from the component layer; the guard is verified indirectly (regression matrix) and by construction. Residual risk: negligible for current consumers.
- INV-DLG-6 is a static observation only (no test authored — out of QA write scope for production behavior, pre-existing).

## Pre-existing Failures

None observed; all 16 focused tests green both at baseline (for Edge 2's file) and post-fix.
