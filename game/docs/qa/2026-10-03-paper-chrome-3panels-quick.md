# QA Review: paper chrome swap on quest/settings/inventory panels

- Date: 2026-10-03
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths: game/src/components/layout/FunctionOverlayPanel.vue, game/src/components/layout/LeftPanel.vue, game/src/components/layout/GameRoot.vue, game/src/components/panels/InventoryPanel.vue, game/src/components/panels/QuestPanel.vue, game/src/components/scenes/inventory/InventorySurface.vue, game/src/components/scenes/inventory/fidelity/InventoryFidelityScene.vue, game/src/components/scenes/quest/QuestScene.vue, game/src/components/scenes/quest/fidelity/QuestFidelityScene.vue, game/src/components/scenes/settings/SettingsSurface.vue, game/src/components/scenes/settings/fidelity/SettingsFidelityScene.vue, game/src/ui-preview/{Inventory,Quest,Settings}Preview.vue, game/src/ui-preview/{inventory,quest,settings}.ts, game/src/ui-preview/{inventory,quest,settings}Messages.ts, game/src/ui-preview/remainingPreview.test.ts, game/tests/e2e/{cultivation-path-ritual,huyen-kim-fidelity-capture.qa,huyen-kim-imperial-shell,huyen-kim-scroll-lifecycle.qa,huyen-kim-stable-art,ink-wash-ui,system-ui}.spec.ts

## Scope and Risk Map

The mapper returned `deepAuditCandidate: true` on file-name heuristics
(3 mapped domains: economy-and-progression, inventory-equipment,
ui-input-lifecycle) plus unmapped preview/e2e paths. Manual inspection
bounds the risk confidently: the diff changes chrome/mount seams only —
no save/cloud transition, no clock/offline accrual, no economy or
progression transaction, no Pinia/Phaser ownership change (the same
`closeHomeOverlays`/`openLeftPanel`/`openStandalonePanel` calls the
scroll-era code and the already-migrated tabs issue). The only material
domain is ui-input-lifecycle. Escalation to deep audit not warranted;
the reason is recorded here per the quick workflow.

Unmapped paths routed by inspection: `ui-preview/*.ts` +
`*Messages.ts` are the preview harness seam (vite multi-page entries +
per-scene i18n fixtures, no production consumers); e2e specs are the QA
evidence layer, not consumers.

## Invariant Ledger

| # | Invariant | Oracle | Result |
|---|-----------|--------|--------|
| 1 | Exactly one home surface open at a time | store `closeHomeOverlays()` runs first in every open path; FunctionOverlayPanel `paperMode`/`scrollMode` are exclusive | Holds — code inspection + `scroll-lifecycle` spec |
| 2 | Esc/scrim/rail-back close parity with scroll era | `useDialogFocus` onEscape → `back` → `ui.closeHomeOverlays()`; `@click.self` on scene root; `PaperPanelNavigation` back arrow | Holds — same contract as Equipment/Character/Realm scenes |
| 3 | No double chrome (paper + scroll both mounted) | `.hk-scroll` mounts only for `scrollMode === 'exploration'`; e2e asserts `function-overlay-panel` testid count 0 for settings | Holds — imperial-shell spec updated |
| 4 | Scaled canvas never under `contain:layout` | `bag-panel` container anchor moved inside `#grid` slot (`.bag-anchor`), below the canvas layer | Holds — CSS containment semantics; preview renders |
| 5 | Content fits the paper interior (no overflow/scroll where content fits) | interior rect 234/227/1143×465 adopted from migrated scenes; inner components keep own `overflow-y:auto` | Holds — preview screenshots at 1920×1080/1440×810/1280×720 |
| 6 | Same tabs/data/actions as scroll era | seams pass identical props/slots; `getBetaQuestSurfaceModels` read, bag sections, SettingsPanel untouched | Holds — diff inspection |
| 7 | Preview harness keeps working | per-scene message files mirror prod keys; previews mount `SceneDesignCanvas` + `DongFuVista` + fidelity scene | Holds — screenshots |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| `npm run type-check` | exit 0 | post-change rerun clean |
| `npx vitest run` scoped (22 files incl. beta* architecture seams, bag sections, SettingsPanel, remainingPreview, i18nKeyParity) | 199 passed, 4 skipped | green |
| `npx vitest run tests/architecture/asciiComments.test.ts` | pass | new comments ASCII-only |
| Playwright screenshots `/ui-quest.html`, `/ui-settings.html`, `/ui-inventory.html` at 1920×1080, 1440×810, 1280×720 | paper chrome + nav rail + content render; no `.hk-scroll`; no unintended scrollbars | `/tmp/paper-chrome-shots/*.png`; flagged `quest-list`/`banner`/`reward-tile` overflow is designed inner-scroll/decorative |
| DOM probe: `.hk-scroll` absent on all 3 pages at all 3 sizes | confirmed | script output |

## Findings

### QA-2026-10-03-1: preview unit mounts lacked newly required props
- Severity: Low
- Status: Confirmed (source proof)
- Invariant: fixture mounts satisfy the component contract
- Reproduction: `remainingPreview.test.ts` mounted `InventoryFidelityScene`/`QuestFidelityScene` without `navigation`/`notice` after those became required props — tests still passed via Vue prop-warning tolerance, so evidence kind is source inspection, not a failing run.
- Fix: mounts now pass `navigation: []`, `notice: ''`.
- Owner subsystem: ui-preview
- Blast radius: preview fixture only

### QA-2026-10-03-2: `.inventory-panel` seam div adds `position:fixed;inset:0` wrapper
- Severity: Low
- Status: Coverage gap / style note
- Invariant: migrated seams mount the surface bare (EquipmentHall convention)
- Reproduction: InventoryPanel keeps a `.inventory-panel` wrapper div with `position:fixed;inset:0` rather than mounting `InventorySurface` bare; the wrapper preserves the `.inventory-panel` selector used by e2e oracles and the fixed layer the scroll used to provide.
- Resolution: deferred intentionally; harmless and keeps a stable seam selector.

## New or Changed QA Tests

- `tests/e2e/huyen-kim-imperial-shell.spec.ts` — scroll-shell lifecycle test repointed to 'exploration' (last scroll consumer); scenes 04/09/17/18 re-anchored to paper scene roots; scene 09/17 assert old chrome absent.
- `tests/e2e/huyen-kim-scroll-lifecycle.qa.spec.ts` — the two scroll-internal interruption tests repointed to 'exploration'; rail-swap target assertion updated to `.inventory-scene`.
- `tests/e2e/huyen-kim-fidelity-capture.qa.spec.ts` — scene table roots updated (inventory/settings/quest → `.inventory-scene`/`.settings-scene`/`.quest-scene`).
- `tests/e2e/huyen-kim-stable-art.spec.ts` — close-glyph check repointed to 'exploration'.
- `tests/e2e/system-ui.spec.ts`, `ink-wash-ui.spec.ts`, `cultivation-path-ritual.spec.ts` — settings anchors moved off `.hk-scroll__envelope` onto `.settings-scene`/`.settings-paper`/`.settings-title` + close-union extended.
- `src/ui-preview/remainingPreview.test.ts` — fixture mounts updated for the new required props.

## Gaps and Residual Risk

- Production surfaces (real QuestList/bag sections/SettingsPanel under `box-sizing:border-box` + the 1143×465 interior) are verified by e2e selectors and component inspection, not by a production screenshot — the preview harness renders fixture slot content. Residual: minor visual drift inside real components; bounded by `height:100%;min-height:0;overflow-y:auto` self-management on every slotted component.
- `deepAuditCandidate` mapper flag documented above; risk bounded by chrome-only diff.

## Pre-existing Failures

- `tests/e2e/tribulation-flow.spec.ts` close-helper union (`.overlay-panel, .hk-scroll`) does not match already-migrated paper scenes (realm/technique/etc.) — stale on base before this change; Esc fallback still closes them.
- `tests/e2e/huyen-kim-stable-art.spec.ts` other stale anchors for equipment/character noted in earlier sweeps; out of this task's scope.
