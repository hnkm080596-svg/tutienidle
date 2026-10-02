# QA Review: huyen-kim imperial-scroll lifecycle (P6 branch tail)

- Date: 2026-10-02
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: the uncommitted workspace diff on `devin/huyen-kim-ui-art` —
  imperial-scroll shell + nav (`ImperialScrollScene.vue`, `ImperialNavRail.vue`,
  `useImperialNav.ts`, `ImperialScrollScene` hosts in `LeftPanel` /
  `FunctionOverlayPanel` / standalone panels), `BodyPanel.vue`,
  `TechniquePanel.vue`, `betaFeatureFlags.ts` leaf + `betaScope.ts` re-export,
  `panelIds.ts`, `stores/ui.ts` (`characterSceneTab`), `TribulationDirector.ts`
  (`chapterNames`), chrome manifest/`huyenKimChrome.ts`, scene recomposes
  (Character/Realm/Skill/Inventory/Quest/Settings/Alchemy/Equipment/StageSelect/
  onboarding/combat ceremony), e2e selector migrations + flag skips, deletions
  (`RightPanel.vue`, `TechniqueBand.vue`+test, `inkDrawerSurface.test.ts`,
  `panel-drawer-*.png`).

## Scope and Risk Map

changed-risk-map returned `deepAuditCandidate: true` (reasons: "critical state
boundary: save-and-cloud", "cross-system change: 6 domains"). Bounded by
inspection:

- The save/cloud hits are e2e spec paths (`boot-fresh`, `save-reload`,
  `beta-journey`) whose diffs are selector/step migrations - no save shape,
  persistence, boot, or cloud code was touched.
- `stores/ui.ts` additions (`characterSceneTab`) are session-transient flags;
  the store persists only the automation-flag slice (`persistAutomationFlags`),
  verified by reading the store - overlay state never reaches the save payload.
- Domain ownership is unchanged: panels consume canonical read models
  (`betaRealmLadderNodes`, `getBetaTechniqueSurfaceModel`, `betaSkillTreeFor`)
  and call canonical ops (`tryAdvanceTechniqueGrade`, store actions). Mutations
  verified to route through `realmAdvanceOps`/stores, none inline in
  presentation.
- The material risk surface is Vue lifecycle of the new scroll shell: unfold
  transitions, nav swaps, overlay exclusivity, Esc/scrim, detail-dock leak.
  That surface is directly observable and was attacked in a real browser
  (tests/e2e/huyen-kim-scroll-lifecycle.qa.spec.ts).

`unmappedPaths` were inspected: chrome manifest/art registries, locale files,
test-only files, deleted files, CSS. All presentation or test authority; no
unrouted risk.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-SCRL-1 | `standalonePanel`/`characterOverlayOpen`/`leftPanelMode` in `stores/ui` | Rapid nav-seal clicks swap scenes | Lifecycle: exactly one settled scroll; content = last click | Repeat + timing boundary | `.hk-scroll` count==1; `.hk-nav-seal.is-active[data-scene]` == last target | Playwright | High reachability (rail is the primary nav) |
| INV-SCRL-2 | scroll `open` + `<Transition>` enter | Esc pressed mid-unfold | Lifecycle: full teardown, no stuck shell | Interruption | `.hk-scroll` count==0; wheel layer restored | Playwright | Esc is the advertised close path |
| INV-SCRL-3 | scroll scrim `@click.self` | scrim click mid-unfold | Lifecycle: close path works through transition | Interruption | `.hk-scroll` count==0 | Playwright | Same as above |
| INV-DOCK-4 | `characterDetailOpen` (ui store, session) | open Chi Tiet -> nav to inventory -> back | Stale state: dock never renders over inventory; state reset, not resurrected | Reorder | `character-detail-card` count==0 in both checks | Playwright | Cross-scene leak inside one shell |
| INV-NAV-5 | `sceneAdmitted()` in `useImperialNav` | rail render under beta lock | Boundedness/fail-closed: hidden surfaces absent, not disabled | Value mutation | rail `data-scene` set == admitted 11 | Playwright | Scope-lock contract |
| INV-ART-6 | chrome manifest slots | `hkChromeUrl` on pending slot | Degraded env: no fetch, CSS fallback paints | Degraded environment | `v-if="url"` guards; fallback classes | code inspection + jsdom tests | Missing-art path |
| INV-PERS-7 | ui overlay flags | reload while scroll open | Recoverability: session flags not persisted | Interruption | ui store persistence audit | source inspection | Save leak would reopen stale panels |
| INV-MODE-8 | `characterSceneTab` | openLeftPanel char<->inventory | Exactly-once/exclusivity: `closeHomeOverlays` clears siblings before open | Reorder | swap keeps one scroll; detail flag reset | Playwright + store read | Core nav semantics |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx playwright test huyen-kim-scroll-lifecycle.qa.spec.ts` | 5 passed (1.2m) | All adversarial attacks green on current code |
| probe spec (deleted after use) - DOM+store dump through rapid swaps | CONFIRMED transient stale window | At t=0 the leaving quest scroll was the only mounted scroll (`activeSeals:["quest"]`, dialog "Nhiệm Vụ") while `standalonePanel` was already `technique`; converged at t=0.5s |
| `npm run type-check` | clean | after the leaver `pointer-events` fix |
| `npx playwright test scroll-lifecycle + imperial-shell` | 14 passed (3.0m) | Post-fix regression on the shell contract |
| `npm run verify` (aggregate) | typecheck + build + vitest 865 files / 7888 tests | 1 flake: `eslintCoreSeverity` lint-probe timeout under load; isolated rerun passes in 1.7s - environmental, not a defect |

## Findings

### QA-2026-10-02-001: leaving scroll stays hit-testable during crossfade

- Severity: Low
- Status: Confirmed (runtime evidence; strict-mode strict violation in the
  first spec run showed both leaver and enterer rail seals for the transition
  window; probe captured leaver alive at t=0 while store already pointed at the
  next scene)
- Invariant: Lifecycle - a dismissed overlay must not remain an interaction
  surface.
- Preconditions: two imperial scrolls crossfade during scene swap (nav click).
- Reproduction: open character scroll -> click realm -> quest -> technique
  rapidly; sample DOM during swaps.
- Expected: the leaving scroll cannot intercept input (rail clicks or scrim
  self-close on the ghost would navigate/close against user intent - a scrim
  hit on the leaver closes the just-opened scene).
- Actual: leaver was hit-testable for the ~0.16-0.5s leave window; navigations
  still converged correctly (shared store) but scrim hits could close the
  incoming scene.
- Evidence: probe dump (t=0 activeSeals:["quest"] under
  standalone='technique'); Playwright strict-mode 2-element resolution.
- Test file: `tests/e2e/huyen-kim-scroll-lifecycle.qa.spec.ts`
- Owner subsystem: `ImperialScrollScene.vue` transition surface
- Blast radius: local UX - mis-click during a ~0.2s window; recoverable by
  reopening.
- Disposition: FIXED post-QA (normal implementation change) -
  `.hk-scroll-leave-active { pointer-events: none }`; reruns green.

### QA-2026-10-02-002: technique scene root gated on model state

- Severity: Nit (test-design note, no defect)
- Status: Confirmed behavior, oracle corrected
- `.technique-scene` renders only when `model.state === 'available'`; a fresh
  mortal shows `.technique-scene__empty` - seal `aria-pressed`/`is-active` is
  the correct content-independent oracle for scene-active assertions.
- No action.

## New or Changed QA Tests

- `tests/e2e/huyen-kim-scroll-lifecycle.qa.spec.ts` (new, 5 tests):
  mid-unfold Esc teardown, mid-unfold scrim close, rapid nav convergence,
  detail-dock cross-tab leak guard, scope-hidden seal absence.

## Gaps and Residual Risk

- Esc mid-unfold relies on `useDialogFocus` keydown wiring; verified at runtime
  but only on Chromium projects - cross-browser engine variance unverified.
- The 9-10s dwell on non-settled scenes observed earlier was Playwright
  actionability retry across remounts, not a product stall (probe shows store
  converges in <0.5s).
- `beta-authority.spec.ts` remains env-blocked (missing
  SUPABASE_URL/ANON_KEY/DB_URL) - pre-existing, unrelated to this diff.

## Pre-existing Failures

- `beta-authority.spec.ts` setup fail: Supabase contract env absent
  (environmental).
- `eslintCoreSeverity.test.ts` 120s lint-probe timeout under concurrent load;
  passes isolated - contention flake, not a diff defect.
