# QA Review: Task 9 followups + i18n (consolidated quick, Tasks 1-10)

- Date: 2026-09-03
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: consolidated over the SDD series `2026-09-02-task-9-followups-i18n` (commits `d126008..fc3efa6` + docs): `game/src/core/game/GameManager.ts` (restoreFromSave guard), `game/src/core/idle/OfflineProgressSystem.ts` (isFinite guard), `game/src/components/ui/OverlayPanel.vue`, `game/src/components/ui/ConfirmModal.vue`, `game/src/composables/useDialogFocus.ts` + adversarial tests, `game/src/data/skill/**` (labels/formatter), `game/src/i18n/**`, `game/src/components/**` (extraction batches 1+2, 9 files), `game/tests/**` (locale assertions, flake fix), `game/package.json` + lockfile (vue-i18n v11), `game/docs/roadmap.md`, `game/docs/qa/**`. Task 10 itself: docs only.

## Scope and Risk Map

Consolidated close-out for the 10-task SDD series. Each task already received an individual quick review (all review-clean, per ledger `.superpowers/sdd/2026-09-02-task-9-followups-i18n/progress.md`); this report re-verifies the branch end-state as a whole and collects deferred findings. No production code changed in Task 10.

- **Systems touched across the series:** save/restore integrity (9.2), offline accrual (9.7), dialog a11y/lifecycle (9.3), i18n rendering surface (2.1-2.6), test locale-coupling (2.5), dependency layer (v11 bump).
- **One-hop consumers:** 13 dialog consumers inheriting focus trap; ~43 i18n-consuming components; save/load flow (validator v55); offline settle path; all locale-asserting tests (333 files).
- **Escalation decision:** no deep escalation. Save/cloud and time/offline changes (9.2/9.7) were narrow, TDD-guarded, individually reviewed, and the full matrix is green; no materially broad unresolved risk remains. The two deferred Low findings (dialog edges) are bounded by code inspection and covered below.
- **Exclusions:** untracked file `game/docs/qa/2026-09-03-vue-i18n-v11-migration-quick.md` (Task 9's own QA artifact, present in worktree, not part of any diff under review here; it will be committed with the series).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-C1 | Save payload → `restoreFromSave` (`GameManager.ts`, 9.2) | Boot / reload with already-applied payload | Idempotency — duplicate restore must not double-credit offline gains | Repeat (double restore, same-tick re-entry) | Payload-identity guard (WeakMap) unit tests (6/6) + seam suite 184/184 | Unit | High |
| INV-C2 | `cultivationPerSecond` → offline settle (9.7) | Boot with NaN/Infinity rate from corrupt chain | Boundedness — no non-finite credit written to resources | Value mutation (NaN/Infinity/huge) | isFinite guard unit tests (7/7); validator v55 root guard | Unit | High |
| INV-C3 | Dialog primitives (9.3) | Open/Tab/Escape/restore in OverlayPanel+ConfirmModal | Lifecycle — focus installed on open, cycled on Tab, restored on close | Repeat, reorder (nested, immediate:true) | 13 adversarial focus tests (Task 3) | Unit (jsdom) | Medium |
| INV-C4 | i18n message surface (2.1/2.2/2.3) | Render + locale switch vi↔en after v11 + extraction | Synchronization — extracted keys resolve identically in both locales | Value mutation (byte drift), dependency swap | 38/38 + 36 string byte-identity checks at review time; parity test `i18n/index.test.ts:81-92`; 2162 unit tests assert rendered output | Unit | High |
| INV-C5 | Locale-coupled tests (2.5) | Suite runs against locale JSON changes | Determinism — tests resolve keys, not hardcoded vi strings | Stale state (locale edit breaks tests) | 3 files converted to `t()` key resolution, 5 verified data-driven (`d384e1d`) | Unit | Medium |
| INV-C6 | vue-i18n v11 runtime | Boot + full flows under v11 | Recoverability/synchronization — boot, params, chunking intact | Dependency swap | e2e 9/9 (boot-fresh, save-reload, create-to-combat); build emits vendor chunk | Browser + build | High |
| INV-C7 | Flake history (dongFuBuildingAssets, BattleSystem.earthPath) | Full suite run | Determinism — previously flaky cases pass reliably | Degraded environment (ImageMagick process spawn timing) | Full suite 2162/2162 this run; root-cause fix `79bab1c` (alpha-bounds case removed) | Unit | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm.cmd run test` (full Vitest) | PASS — 333 test files, 2162/2162 tests, 0 failures, 107.05s | Includes INV-C7 flake cases — green this run; single-run observation, but root cause was removed structurally |
| `npm.cmd run type-check` (vue-tsc --build) | PASS — 0 errors | |
| `npm.cmd run build` (type-check + vite build) | PASS — built in 6.05s, 666 modules | Pre-existing chunk-size warning (index 526.18 kB) — tracked in roadmap 7.6, not caused by this series |
| `npm.cmd run test:e2e` (Playwright) | PASS — 9/9 in 1.2m (boot-fresh, save-reload, create-to-combat, combat-overlay-layout ×3, ink-wash-ui ×3) | |
| Per-task quick reviews (ledger) | 10/10 review-clean; vi string byte-identity independently evidenced (Task 4: 38/38; Task 6: 38/38) | Static+runtime evidence recorded in per-task sessions |
| Full-suite baseline reproduced by Task 9 reviewer | 2162/2162 + build + e2e 9/9 under v11 | Recorded in `2026-09-03-vue-i18n-v11-migration-quick.md` |

## Findings

None Confirmed. No `Confirmed` finding exists from any task review in this series (ledger), and the consolidated re-verification found no new defect. Deferred findings are classified below.

### QA-2026-09-03-001: Dialog focus edge cases (deferred from Task 9.3)
- Severity: Low
- Status: Suspected
- Invariant: Lifecycle — focus must stay trapped across all dialog states
- Preconditions: (a) dialog rendered with zero focusable elements; (b) dialog closed and re-opened in the same tick
- Reproduction: static analysis from Task 3 review (deferred by design decision, out of task scope)
- Expected: (a) Tab cycles or escapes safely; (b) trigger ref points at the new trigger
- Actual: (a) Tab may escape a zero-focusable dialog; (b) same-tick re-open may overwrite the stored trigger element
- Evidence: Task 3 reviewer analysis (ledger Task 3 entry); no runtime reproduction attempted
- Test file: none
- Owner subsystem: `game/src/composables/useDialogFocus.ts`
- Blast radius: a11y-only, transient, no state/persistence impact

### QA-2026-09-03-002: CombatExitConfirmModal lacks focus trap
- Severity: Low
- Status: Suspected
- Invariant: Lifecycle — all modal dialogs should trap focus
- Preconditions: combat exit confirm opened standalone
- Reproduction: static inspection (pre-existing since commit `ed1e1a4`; noted in Task 7 review as parked follow-up)
- Expected: focus trapped like OverlayPanel/ConfirmModal
- Actual: standalone dialog, no useDialogFocus
- Evidence: code inspection; not reproduced at runtime
- Test file: none
- Owner subsystem: `game/src/components/**/CombatExitConfirmModal.vue`
- Blast radius: a11y-only, single dialog, pre-existing (predates this series)

### QA-2026-09-03-003: i18n extraction leftovers (tracked as roadmap 2.2/2.7)
- Severity: Low
- Status: Coverage gap
- Invariant: Synchronization — all user-facing strings resolve from locale JSON
- Preconditions: FunctionOverlayPanel, useBagFilter GROUP/AGE_LABELS, HomeBuildingIcons aria labels, data-layer content names
- Reproduction: grep for raw vi literals in remaining files
- Expected: strings in vi.json/en.json
- Actual: remaining literals known and tracked in roadmap 7.2 (2.2) and 2.7 (data layer)
- Evidence: batch 1+2 extraction completed (commits `80c441e`, `46b3df9`, `6705982`); remainder enumerated at review time
- Test file: none (parity test exists for extracted keys)
- Owner subsystem: `game/src/i18n/` + remaining components
- Blast radius: cosmetic; vi/en remain internally consistent; planned work, not a defect

## New or Changed QA Tests

None in Task 10 (docs-only). Series total across tasks 1-9: adversarial dialog focus tests (Task 3, commit `cfb3b4b`), offline-guard and restore-guard tests (Tasks 1-2), locale key-resolution test conversions (Task 8, `d384e1d`), flake root-cause removal (`79bab1c`).

## Gaps and Residual Risk

- Roadmap 2.2 leftovers (QA-2026-09-03-003) remain as planned work for 2.2/2.7 — enumerated above, not a regression risk.
- Two Low dialog edges deferred from Task 9.3 and the pre-existing CombatExitConfirmModal gap remain open as Suspected findings (no runtime reproduction); none affect save integrity, economy, or progression.
- `npm.cmd run lint` was not part of this task's verify matrix (per task instructions) — lint status not re-evidenced here.
- Flake fix (`79bab1c`) is evidenced by a single full-suite green run in this session; repeated-run stability was not re-measured.

## Pre-existing Failures

None. All four verify commands are green on this branch at `fc3efa6`. Historical flakes (`dongFuBuildingAssets`, `BattleSystem.earthPath`) were root-caused earlier (`79bab1c` removes the ImageMagick-spawning case) and pass now. The build chunk-size warning is pre-existing and tracked in roadmap 7.6.
