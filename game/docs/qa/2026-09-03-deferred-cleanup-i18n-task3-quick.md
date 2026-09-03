# QA Review: deferred-cleanup task 3 — i18n extraction (FunctionOverlayPanel + useBagFilter + HomeBuildingIcons aria)

- Date: 2026-09-03
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/components/layout/FunctionOverlayPanel.vue`
  - `game/src/composables/useBagFilter.ts`
  - `game/src/components/panels/bag-sections/MaterialBagSection.vue`
  - `game/src/components/game/HomeBuildingIcons.vue`
  - `game/src/locales/vi.json`, `game/src/locales/en.json`
  - `game/src/components/layout/LeftPanel.building.test.ts`
  - `game/src/components/game/DongFuScene.test.ts`
- Exclusions: untracked `game/docs/superpowers/{plans,specs}/2026-09-03-*` (task docs, not code); pre-existing eslint warning `PILL_FAMILIES` unused in useBagFilter.ts (verified present on baseline via stash).

## Scope and Risk Map

- Mapper (`changed-risk-map.mjs`): domains `pinia-phaser-sync`, `ui-input-lifecycle`; `deepAuditCandidate: true` ("cross-system change: 2 domains"); `unmappedPaths`: test file, useBagFilter.ts, both locale JSONs.
- Escalation decision: NOT escalated to deep. Justification: the change is presentation-only string extraction. No save/cloud, time/offline, economy/progression, or state-ownership transition changed — upgrade action, filter/search/grouping logic, badge ranking, and pagination are byte-identical behavior with strings now sourced from locale tables. Mapper domains are satisfied by: (a) plugin-lifecycle check for `useI18n()` at every mount site (prod `main.ts:25` + all 3 component test mounts), (b) locale-key completeness via existing parity test + t()-based assertions. Unmapped paths manually routed: `useBagFilter.ts` → pure key-mapping refactor (one-hop consumer: MaterialBagSection only, verified by grep); locale JSONs → parity test is the oracle; test files are their own evidence.
- Learned-defect ledger (QA-2026-09-01-007, locale rendered copy): addressed — new keys asserted through `i18n.global.t()` and parity-tested both directions; vi values verified byte-identical to extracted literals.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-I18N-1 | Locale tables (vi/en JSON) | Render any extracted string in either locale | Synchronization: every key exists in BOTH locales; vi values byte-identical to originals | Reorder/mutation: add key to one side only; drift a vi value | Parity leaf-set equality + programmatic byte comparison | Vitest (`i18n/index.test.ts`) + node script | High (silent missing-key fallback risk) — resolved: 519=519 leaves, 28/28 byte-identical |
| INV-I18N-2 | FunctionOverlayPanel heading | Open building overlay → heading renders level range with params | Boundedness: named interpolation renders `Cấp {level} / {max}` not raw key/braces | Value mutation: level 1→2 after upgrade | `heading.textContent` contains `t('layout.functionOverlay.levelRange', {level, max})` | Vitest (LeftPanel.building.test.ts, both level 1 and 2 asserted) — pass | Medium — resolved |
| INV-I18N-3 | FunctionOverlayPanel actions | Click upgrade with realm/cost gates | Exactly-once + behavior preservation: gate/disabled/upgrade flow unchanged by i18n rewrite | Repeat: upgrade click → level increments exactly once; title/cost copy from keys | `buildingManager` level + button text via `t()` | Vitest (LeftPanel.building.test.ts) — pass | High (paid action) — resolved |
| INV-I18N-4 | MaterialBagSection chips/badge | Filter by group chip; family badge renders `realm · ageKey` | Synchronization: `groupLabelKey`/`badgeLabel` key-thread resolves to locale strings in both locales | Degraded: missing key would render raw key text | Slot labels + chips + badge assertions ('Thảo', 'Khác', 'Gỗ', 'Phàm Nhân', 'Bách Niên') | Vitest (MaterialBagFilter.test.ts) — pass | Medium — resolved |
| INV-I18N-5 | useBagFilter data tables | Family grouping + name prefix strip (`baseNameFor`) | Determinism: vi DATA prefix tables retained; grouping/keys unchanged | Stale/mutation: renamed data labels would break prefix strip | Family collapse counts + badge text unchanged | Vitest (MaterialBagFilter.test.ts 5/5) — pass | High (core logic) — resolved |
| INV-I18N-6 | HomeBuildingIcons mount | Mount app/scene with hotspot layer | Lifecycle: `useI18n()` requires plugin at EVERY mount site | Reorder/interruption: mount without i18n plugin → setup crash | Prod: `main.ts:25` installs i18n; tests: HomeBuildingIcons.test, DongFuScene.test (fixed during this task), e2e via real app | Vitest (DongFuScene.test 6/6, HomeBuildingIcons.test 12/12) + grep of all mount sites — pass | High (boot crash) — resolved |
| INV-I18N-7 | aria-labels | Focus/AT announcement of building hotspots | Synchronization: `Mở {name}`/`Xem yêu cầu mở {name}` interpolate data name via params | Value mutation: building name from data passes through | `aria-label` contains building name | Vitest (HomeBuildingIcons.test.ts aria assertion) — pass | Medium — resolved |
| INV-I18N-8 | Heading when instance undefined | Overlay open for building WITHOUT instance (hypothetical) | Boundedness: `level ?? 0` renders `Cấp 0 / 3` where old code rendered `Cấp / 3` | Value mutation: missing instance | Static inspection + flow trace | Static — Suspected Low | Low |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm.cmd run test -- src/components/panels/MaterialBagFilter.test.ts src/components/layout/LeftPanel.building.test.ts src/components/game/HomeBuildingIcons.test.ts src/i18n/index.test.ts` | 30/30 pass | Touched-area focused suite |
| `npm.cmd run test -- src/components/game/DongFuScene.test.ts` | 6/6 pass | After adding `app.use(i18n)` |
| `npm.cmd run test` (full unit suite) | 336 files / 2172 tests pass | Second run after DongFuScene fix; first run caught DongFuScene failure (fixed) + earthPath flake (see Pre-existing) |
| `npm.cmd run type-check` | pass | vue-tsc --build clean |
| `npm.cmd run build` | pass | Pre-existing chunk-size warning only |
| Parity + byte-identity node script | 519=519 leaves both locales; 28/28 vi values byte-identical | Programmatic, reproducible |
| Mount-site grep (`app.use(i18n)`) | All `useI18n` component mounts install plugin; prod `main.ts:25` | Static, bounded |
| ESLint touched files | 0 errors; 1 pre-existing warning (baseline-confirmed via stash) | — |

## Findings

### QA-2026-09-03-001: Heading level text renders "Cấp 0 / 3" for a built-state-less instance where old code rendered "Cấp / 3"
- Severity: Low
- Status: Suspected (static inspection only; no runtime reproduction found)
- Invariant: Boundedness (INV-I18N-8)
- Preconditions: FunctionOverlayPanel heading rendered while `header.instance` is undefined (building not built).
- Reproduction: Not achieved — normal flows route not-built buildings to BuildingDetailPopover (HomeBuildingIcons.test.ts asserts popover authority), so `leftPanelMode` is not set for them; the state appears unreachable through hotspot/command-wheel flows.
- Expected: ideally no level text or unchanged legacy rendering.
- Actual: `t('layout.functionOverlay.levelRange', { level: level ?? 0, max })` renders "Cấp 0 / 3" in the hypothetical state.
- Evidence: code inspection of FunctionOverlayPanel.vue heading slot; flow trace of `useBuildingNavigation.openBuilding`.
- Test file: none
- Owner subsystem: `game/src/components/layout/FunctionOverlayPanel.vue`
- Blast radius: cosmetic only, likely unreachable state; no state/economy impact.

No Confirmed findings.

## New or Changed QA Tests

- None added by QA. Existing tests converted to t()-key assertions by the task itself (`LeftPanel.building.test.ts`), and `DongFuScene.test.ts` gained `app.use(i18n)` — both prove locale-driven rendering and plugin lifecycle.

## Gaps and Residual Risk

- QA-2026-09-03-001 (Suspected Low) remains unreproduced; recommended follow-up if a not-built panel entry point is ever added: render heading level only when instance exists.
- en-locale visual rendering is proven at key/parity level, not by browser screenshot; acceptable for a string-extraction task (same bar as prior i18n batches).

## Pre-existing Failures

- `BattleSystem.earthPath.test.ts`: failed once during the first full-suite run, passed in isolation both on baseline (stash) and with the task changes; classified `Flaky`, not caused by the audited change.
- Chunk-size build warning; eslint `PILL_FAMILIES` unused warning in useBagFilter.ts (baseline-confirmed).
