# QA Review: Scene 09 exploration scaffold (stage-select rebuild)

- Date: 2026-10-02
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `src/components/panels/StageSelectPanel.vue`, `src/components/panels/StageSelectPanel.test.ts`, `src/components/panels/stageTrailLayout.ts`, `src/components/scenes/exploration/` (16 new files), `src/locales/en.json`, `src/locales/vi.json`, `docs/design/art-requests/09-exploration.md`

## Scope and Risk Map

`changed-risk-map.mjs` returned all task-owned paths as `unmappedPaths` (no matcher entries for `components/scenes`, panels, locales, docs) — `deepAuditCandidate: false`. Manual routing:

- Domain packs: `ui-input-lifecycle` (panel rewrite, click/scroll/watchers), `pinia-phaser-sync` (Pinia `player.$state` -> read-model boundary; no new subscriptions), `economy-and-progression` (display-only `rewardPreview`; `start`/`startAutoFarm` call the same domain ops through `canStart` — bounded read+delegate, no new mutation path).
- One-hop consumers: `FunctionOverlayPanel.vue` (hosts the panel inside `function-overlay-panel`), `stageTrailLayout.test.ts` (pins `layoutStageTrail` byte-identical output), `useI18n` consumers of appended locale leaves.
- Escalation check: no save/cloud, clock/offline, or new economy mutation; Vue/Pinia boundary unchanged (watchers preserved, no listeners/timers added); `deepAuditCandidate: false`; every high-risk hypothesis got a decisive oracle below. Quick mode is sufficient.
- Exclusions: none — every dirty path is task-owned.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-S09-1 | `selectedStageId` (panel) | node click -> `select-stage` -> `selectedStageId` | Synchronization: click reaches selection exactly once | Value mutation (locked vs unlocked node) | detail head shows `{chapter}-{floor} {name}` after click | Playwright runtime | high reachability |
| INV-S09-2 | `canStart` (panel computed) | select locked stage | Boundedness: locked stage can never start | Value mutation | start button `:disabled` + locked-hint text | Playwright runtime | high |
| INV-S09-3 | `mode` (panel) | any `selectedStageId` write incl. chapter re-pick | Lifecycle: armed mode must not leak (T4-38) | Reorder | `mode` resets to `manual` on every selection change | Vitest unit | medium |
| INV-S09-4 | `canStart`/`start` (panel -> domain) | start button | Exactly-once: only `startSelectedStage`/`startAutoFarm` may launch; UI gate must match model | Value mutation (busy slot) | `startAvailable` = `stageWaves.canStart` (unlock + slot-free); gate = zone-unlocked && startAvailable | code inspection | high |
| INV-S09-5 | zone unlock verdict (panel) | zone chip render/disabled | Synchronization: zone unlock derived from model, not re-probed | Stale state | `isZoneUnlocked` = first-stage `model.state !== 'locked'` | code inspection | medium |
| INV-S09-6 | node enemy label (model) | node render | Contract: never render an enemy not in `displayEnemy` | Value mutation | node `<small>` bound to `model.displayEnemy?.name` only | Vitest (Dã Trư/Man Hổ assertions) | high |
| INV-S09-7 | `chapterBands` (panel) | map render | Boundedness: 3 bands x 10 nodes, DOM order = chapter order | Reorder | `nodes[9]` = `mortal_dong_10`; 30 `.stage-map__node` | Vitest + runtime | medium |
| INV-S09-8 | `scrollToChapter` (panel -> MapPanel) | chapter chip click | Lifecycle: scroll must be safe under jsdom | Degraded environment | `?.scrollIntoView?.()` guard; vitest zero unhandled errors | Vitest | medium |
| INV-S09-9 | mount/teardown (all new components) | overlay open/close cycles | Lifecycle: no leaks on remount | Repeat | no listeners/timers/subscriptions in new components; watchers auto-dispose | code inspection | medium |
| INV-S09-10 | `layoutChapterBandTrail(count)` | band render | Boundedness: points within [0.26,0.92]x{0.36,0.48,0.62}; count 0/1 handled | Value mutation | count<=0 -> empty; count=1 -> boss point only | code inspection | low |
| INV-S09-11 | i18n leaves (both locales) | render new labels | Conservation: every new key exists in en AND vi | Value mutation | leaf parity scripted check | script | medium |
| INV-S09-12 | `rewardPreview` render | slot render | Boundedness: absent model/entries never throw | Value mutation | `?.` chains; `v-if` guards; kind-label fallback for `equipment_any` | code inspection | medium |
| INV-S09-13 | `tooltipFor` (band) | locked node hover | Contract: locked tooltip = `disabledReason` verdict | Value mutation | locked -> `disabledReasonLabel`; selected -> none; else `stage.description` | code inspection | low |
| INV-S09-14 | `.stage-select__workspace` grid | RESERVED rail renders nothing | Layout integrity: hidden slot must not leave a phantom column | Degraded environment | map panel width collapse (boss node unreachable) | runtime (Playwright) | high |
| INV-S09-15 | `.stage-select__map-scroll` geometry | render at design res | Boundedness: all 3 bands inside panel clip | Value mutation | scrollbox 653px vs panel 527px -> band 3 clipped | runtime + DOM probe | medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` (vue-tsc --build) | clean | full run |
| `npx vitest run src/components/panels/` | 32 files / 184 tests pass, 0 unhandled errors | includes StageSelectPanel (9) + stageTrailLayout |
| Playwright runtime capture (1672x941, dev server :5191) | guest -> creation -> Tab wheel -> `teleport_array` -> `.stage-select` renders; `.stage-map__node` x30 across 3 bands; boss node click -> detail `1-10 Động 10`, locked hint `Cần Phàm Nhân tầng 10`, start disabled | `/tmp/exploration-scene09.png`, `/tmp/exploration-scene09-boss.png` |
| DOM geometry probe (panel/scroll/map/bands bounding boxes) | scroll 527 = panel 527; bands end 740 <= 762 | after box-sizing fix |
| e2e selector audit (stable-art spec) | `.stage-select`, `__map-frame`, `__chapter-divider`, `--map-mask`, `.stage-map__node.is-locked .stage-map__lock .hk-symbol`, `stage-start-button`, `stage-node-{id}`, `autofarm-stop` all preserved | source + runtime |
| Forbidden classes `.stage-select__intro`/`__scene` | absent | rg |
| Locale leaf parity en/vi | all appended keys identical shape both locales | scripted json compare |

## Findings

### QA-2026-10-02-S09-1: RESERVED zone-rail left a phantom grid column (fixed during implementation)
- Severity: High
- Status: Confirmed (runtime evidence)
- Invariant: layout integrity — a slot that renders nothing must not occupy a grid track.
- Reproduction: `.stage-select__workspace` used `grid-template-columns: auto 1.25fr .75fr`; `ExplorationZoneRail` renders zero elements (`v-if`), so the map panel landed in the `auto` track and collapsed to ~60px; all 30 nodes piled into a vertical strip and the boss node was clipped outside the panel (Playwright click intercepted by `.stage-select__map-scroll`).
- Expected: 2-column map|detail layout while the rail is reserved.
- Actual: 3-track grid vs 2 rendered children.
- Evidence: `/tmp/exploration-scene09.png` (first capture) + Playwright click log.
- Fix: `ZONE_RAIL_VISIBLE` const (false, audit RESERVED) drives both `ExplorationZoneRail :visible` and a `stage-select__workspace--rail` modifier; default grid = original `minmax(0,1.25fr) minmax(290px,.75fr)`.
- Test file: none (caught by runtime evidence before report; covered by visual check)
- Owner subsystem: `StageSelectPanel.vue` workspace grid
- Blast radius: scene-09 presentation only

### QA-2026-10-02-S09-2: map scrollbox overshot the panel by its own padding (fixed during implementation)
- Severity: Medium
- Status: Confirmed (runtime evidence)
- Invariant: boundedness — content must fit inside the frame clip.
- Reproduction: `.stage-select__map-scroll` = `height:100%` under content-box sizing: 527px height + 126px padding = 653px box, so band 3 (609-740 after fix) previously ran 104px past the 527px panel and clipped mid-band.
- Expected: all three chapter bands visible inside the map frame (ref 09).
- Actual: band 3 ~60% clipped.
- Evidence: DOM probe (`scroll.h=653` vs `panel.h=527`, `panel.overflowY=hidden`).
- Fix: `box-sizing: border-box` on `.stage-select__map-scroll`; padding tightened `126px 36px 46px` -> `104px 36px 22px`; `.stage-map` `min-height: 340px` -> `0` so bands shrink to fit.
- Test file: none
- Owner subsystem: `ExplorationMapPanel.vue`
- Blast radius: scene-09 map only

### QA-2026-10-02-S09-3: boss node can overflow the band's right edge on narrow panels
- Severity: Low
- Status: Suspected
- Invariant: boundedness.
- Preconditions: workspace collapsed to column layout (`@container max-width:900px`) with a map panel narrower than ~460px.
- Reproduction: node at `left:92%` + 84px width centered -> right edge = `0.92*W + 42`; exceeds `W` below ~456px, clipped by `.stage-select__map-panel { overflow:hidden }`.
- Expected: node fully visible at all widths.
- Actual: right ~half of the 46px boss medallion could clip on very narrow panels.
- Evidence: geometry arithmetic only — the design space is 1672x941 and runtime floor is 1280x720 (HD_VIEWPORT), where W>700 keeps the node clear; no runtime repro.
- Test file: none
- Owner subsystem: `stageTrailLayout.ts` / `ExplorationStageNode.vue`
- Blast radius: cosmetic clip on sub-460px map panels only

### QA-2026-10-02-S09-4: `layoutStageTrail` is dead in production after the band migration
- Severity: Low (nit)
- Status: Confirmed (static — no runtime impact)
- Invariant: ownership clarity.
- Reproduction: `rg` shows production callers = none (only `stageTrailLayout.test.ts`); bands use `layoutChapterBandTrail`.
- Expected: either keep as a documented layout primitive or remove.
- Actual: function retained, byte-identical, pinned by its unit test — kept deliberately because the existing test contract was preserved per mission rules.
- Evidence: caller grep.
- Test file: `src/components/panels/stageTrailLayout.test.ts` (existing)
- Owner subsystem: `stageTrailLayout.ts`
- Blast radius: none — dead export only

## New or Changed QA Tests

- `src/components/panels/StageSelectPanel.test.ts` — node-count assertion updated 10 -> 30 with a stated-reason comment (audit EXACT pattern renders all 3 bands; `nodes[9]` unchanged = `mortal_dong_10`). No new tests authored: every high-risk hypothesis already had a decisive oracle (unit suite + live Playwright capture).

## Gaps and Residual Risk

- INV-S09-14/15 were confirmed via runtime evidence and repaired before this report; the recorded evidence (screenshots + DOM probe) documents both the defect and the fix.
- Narrow-panel boss-node clipping (S09-3) is suspected-only, unreachable at supported viewport sizes.
- e2e specs (`huyen-kim-stable-art`, `huyen-kim-imperial-shell`) were not re-executed in this run — every selector they assert was verified present in rendered DOM by source + runtime evidence instead; CI covers execution.
- Behavioral note (CORRECTED, verified equivalent): `canStart` now gates on `model.startAvailable` (= `stageWaves.canStart` = unlocked + slot free) instead of `isStageUnlocked` alone — the start button additionally disables while the single stage slot is busy, matching `disabledReason.kind:'busy'`. The domain outcome is identical (a busy click was refused either way); the new gate only surfaces it earlier.
- Ambiguities for the coordinator (not self-decided): power-compare rows in ref have no read-model; `Zone` has no description field for the ref's zone flavor text; ref shows 3 enemy portraits vs contract's single `displayEnemy`; chapter flavor lines have no read-model. None were built.

## Pre-existing Failures

None observed in scope.

## Sequential Review Passes (P5)

```
Sequential Review Pass 1 - Local Correctness / Regression
  Reviewed state: post-fix implementation (grid modifier + box-sizing fixes landed)
  Findings: every new component re-read end-to-end. selectFirstStageInChapter
    equivalence verified (state!=='locked' covers current/available/completed/
    perfect exactly like isStageUnlocked for a first-pick). v-tooltip=undefined
    pattern identical to the pre-change code. autoFarm.* + bossNamePrefix +
    chapterPrefix locale keys verified present. EmptyState gating equivalent
    (a chapter in chapterOptions always has >=1 stage by construction).
  Fixes: none - zero confirmed Medium+.
  Verification: type-check clean; vitest src/components/panels 32 files / 184 tests.

Sequential Review Pass 2 - Architecture / Authority / Ownership
  Reviewed state after Pass 1 fixes: YES (no fixes needed - same state)
  Findings: contract §7 DO-NOT-DERIVE honored - zero remaining
    isStageUnlocked/stageLockReasonCode calls in panel or scene components
    (only catalogOps.getStage hydration, same as before). Components take
    props + emit events only; no store/domain access under scenes/exploration.
    Zone-unlock derivation from first-stage model.state verified equivalent
    (first stage cannot be completed while locked; realms cannot regress).
    layoutStageTrail retained byte-identical (dead export pinned by its test -
    recorded as QA-...-S09-4 nit).
  Fixes: none - zero confirmed Medium+.
  Verification: type-check + 184 panel tests still green.

Sequential Review Pass 3 - Adversarial Integration
  Reviewed state after Pass 2 fixes: YES (same state)
  Findings: emit chain ModeGroup update:modelValue -> DetailPanel
    update:mode -> parent mode=... verified. selectChapter -> nextTick ->
    scrollToChapter -> querySelector('.exploration-band[data-chapter]')
    null-safe when no stages render. Button keyboard activation native.
    Panel remount resets selectedStageId/mode/chapter - identical to old
    refs behavior. scrollfade/scrollToChapter/flex layout resolved in live
    DOM probe; full golden path exercised end-to-end (guest auth ->
    creation -> wheel -> teleport_array -> 3 bands, boss click, locked
    hint, disabled start, progress bar 0/30).
  Fixes: none - zero confirmed Medium+.
  Verification: runtime Playwright evidence (2 screenshots + geometry probe).
```
