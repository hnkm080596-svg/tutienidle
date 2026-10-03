# QA Review: huyen-kim Phase-2 Dong Fu / Global Navigation

- Date: 2026-09-30
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths: `game/src/components/game/GlobalTopBar.vue`, `game/src/components/game/ThienCoRail.vue`, `game/src/composables/useThienCoEntries.ts`, `game/src/components/game/DongFuScene.vue`, `game/src/components/game/DongFuCommandWheel.vue`, `game/src/components/game/DongFuBuildingSprite.vue`, `game/src/components/game/HomeBuildingIcons.vue`, `game/src/components/layout/GameRoot.vue`, `game/src/presentation/background/DongFuArt.ts`, `game/src/locales/{vi,en}.json`, plus the four touched test files.

## Scope and Risk Map

Mapper output: domains `pinia-phaser-sync` + `ui-input-lifecycle`; `deepAuditCandidate: true` (2-domain spread); unmapped: `useThienCoEntries.ts`, `DongFuArt.ts`, both locale files.

Escalation decision — documented bounded, not escalated: every write is absent. All transitions are Vue-DOM navigation (`ui.openStandalonePanel`, `ui.openLeftPanel`, `navigation.openBuilding`, `ui.openBuildingPopover`) or pure presentation derivation (computed focus anchor, orbit layout map, descriptor `canonical`/`fxPending` fields). No GameManager mutation, no persistence, no economy/progression write, no Phaser scene, no time ownership. The pinia surface is the standard `stateVersion` bridge plus ui-store flags, identical to every existing home component. Manual routing: `useThienCoEntries.ts` -> ui-input-lifecycle (one interval) with read-only economy reads; `DongFuArt.ts` + locales -> ui-input-lifecycle (data/text only).

Exclusions: `game/docs/design/huyen-kim-phase2-dong-fu-nav-plan.md` (plan doc, not production).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-NAV-1 | `useThienCoEntries` 30s ticker | rail unmount on combat route | Lifecycle | repeat | one interval; cleared in `onBeforeUnmount` | unit/inspection | low reachability, checked in code |
| INV-NAV-2 | entries computed | alchemy job completes between ticks | Synchronization | stale state | `void stateVersion.value` dep forces recompute on bump; `getAlchemyJobs()` re-read each compute | inspection | medium risk, bounded to <=30s stale label |
| INV-NAV-3 | `captureIgnitionOnOpen` | lock clears between opens | Exactly-once | repeat | ignite only when slot was disabled at previous open and enabled now; re-open recomputes | unit test possible; code-verified | medium |
| INV-NAV-4 | `igniteHandle` | unmount during 700ms window | Lifecycle | interruption | `onBeforeUnmount` clears it (added alongside ready/close handles) | inspection | low |
| INV-NAV-5 | `igniteHandle` re-arm | wheel re-opens during ignite | Repeat | reorder | `captureIgnitionOnOpen` clears existing handle before re-set | inspection | low |
| INV-NAV-6 | `slotOrbitLayout` map | rendered vs layout index drift | Determinism | reorder | map built from same `renderedSlots` computed; ring-1 (character/realm/skill) -> orbit 0, rest -> orbit 1 | unit test (orbit-by-ring test added) | medium, verified |
| INV-NAV-7 | `focusBuildingId` leftPanelMode path | functionType with no matching building | Boundedness | value mutation | `?.id ?? null` -> `focusAnchor` null -> no dim, no class | inspection | low |
| INV-NAV-8 | `effectivePointerUnit` under reduced motion | reduced-motion user + focus | Boundedness/accessibility | degraded env | returns raw pointer unit (no blend); `parallaxStyle` zeroes anyway | unit test (scene focus test covers non-reduced path; reduced path covered by existing reduced-motion test for parallax) | low |
| INV-NAV-9 | FeedbackDialog teleport | combat enters while dialog open | Lifecycle | interruption | dialog inside `!isFullSceneActive` fragment -> unmounts with subtree; teleport content unmounts with parent | inspection | low |
| INV-NAV-10 | AutoFarmIndicator moved into top bar | combat while auto-farm armed | Synchronization | cross-system | same `!isFullSceneActive` mount region as before -> identical visibility semantics | diff inspection | low, no regression |
| INV-NAV-11 | CurrencyHud moved | duplicate mount risk | Exactly-once | repeat | GameRoot removed its instance; exactly one mount inside GlobalTopBar | runtime DOM check (one `.currency-hud`) | verified |
| INV-NAV-12 | en/vi locale parity | missing key | Synchronization | value mutation | identical 45-line key block in both files | diff inspection | verified |
| INV-NAV-13 | rail (z9) + top bar (z9) vs wheel backdrop (z8) | L8 chrome clickable while wheel open | Overlay stacking | reorder | chrome stays above wheel backdrop; rail CTA opens panel over wheel | runtime observation | Low finding QA-2026-09-30-NAV-1 |
| INV-NAV-14 | `slotStyle` fallback placement | slot absent from layout map | Boundedness | value mutation | unreachable: map built from identical list; fallback is defensive only | inspection | nit |
| INV-NAV-15 | top bar `pointer-events:none` + children auto | scene click-through | Overlay stacking | repeat | clicks pass between grid cells; cells only wrap their chips | runtime screenshot + DOM | verified |
| INV-NAV-16 | `.is-selected` ring vs `.is-status-*` breath | selected + ready building | Determinism | reorder | cascade: selected rule declared after status rules -> `animation:none` wins | source-order inspection + OCR fix | fixed before QA |
| INV-NAV-17 | entries `run()` closures | CTA navigation exactly-once | Exactly-once | repeat | each run is a ui-store open (idempotent) | unit test (breakthrough CTA -> standalonePanel 'realm') | verified |
| INV-NAV-18 | focus-dim under `is-focusing` without reduced motion | dim fades via `--hk-motion-scene` | Lifecycle | degraded env | reduced-motion CSS kills the transition -> static dim, no motion | inspection | acceptable; note |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | exit 0 | full vue-tsc build |
| `npx vitest run` 5 touched spec files | 46/46 pass | DongFuScene, DongFuCommandWheel, HomeBuildingIcons, GlobalTopBar, ThienCoRail |
| `npx eslint` 13 touched files | 0 errors, 0 warnings on production files | test-file one-component-per-file warnings only |
| Runtime: guest flow -> home scene, Playwright over CDP (1440x810) | `.global-top-bar`, `.thien-co-rail` (L8), CurrencyHud docked, 10 canonical layer tags + 2 fxPending flags present, no console/page errors | `/tmp/hk-home5.png` |
| Runtime: `.home-player__trigger` click | wheel `is-visible`+`is-ready`, center seal "Tu Luyen", orbit0 = [character, realm, skill], orbit1 = 11 slots | `/tmp/hk-wheel.png` |
| Runtime: building sprite click | `is-focusing` true, dim vars `--focus-x:13% --focus-y:58%`, popover opens, no errors | `/tmp/hk-focus.png` |

## Findings

### QA-2026-09-30-NAV-1: Thien Co rail and top bar stay interactive above the open command wheel
- Severity: Low
- Status: Suspected (runtime-observed stacking, spec-neutral)
- Invariant: overlay stacking — defined active surface
- Preconditions: wheel open (`ui.isCommandWheelOpen`).
- Reproduction: open wheel -> top bar utilities / rail CTAs remain at z9 above the z8 backdrop and remain clickable.
- Expected: either modal exclusivity or intentional always-on chrome — spec SS10.1 does not pin this.
- Actual: chrome interactive over backdrop; a rail CTA opens its panel while the wheel stays open underneath.
- Evidence: runtime DOM z-order inspection (`.command-wheel-layer` z8, `.thien-co-rail`/`.global-top-bar` z9).
- Test file: none
- Owner subsystem: home chrome layout (GameRoot)
- Blast radius: cosmetic stacking only; slot activation still closes the wheel first.

### QA-2026-09-30-NAV-2: Focus dim remains visible (static) under prefers-reduced-motion
- Severity: Low
- Status: Suspected
- Invariant: accessibility / degraded environment
- Preconditions: `prefers-reduced-motion` + a building popover open.
- Reproduction: reduced-motion CSS removes the dim's transition but `.is-focusing` still raises opacity to 1 — a static dim state, no animation.
- Expected: arguably no context dim at all, or static dim is acceptable as a non-motion state cue.
- Actual: static dim shows.
- Evidence: CSS block inspection (`transition: none` under reduced-motion; `.is-focusing` opacity rule unaffected).
- Test file: none
- Owner subsystem: DongFuScene presentation
- Blast radius: none — no motion is introduced; a state cue, not an animation. Kept deliberately (drift is disabled, dim aids focus context).

## New or Changed QA Tests

- `DongFuCommandWheel.test.ts` (+1 test): asserts catalog ring-1 slots ride orbit 0 and all others orbit 1; asserts the decorative center seal exists and is `aria-hidden`.
- `DongFuScene.test.ts` (+1 test): asserts canonical layer tags (L0/L1/L5/L2), fxPending flags on 05/06, building L3 / player L4, `is-focusing` + dim anchor vars on popover open, blended parallax unit toward the anchor, and restore after close.
- `GlobalTopBar.test.ts` (new): L8 attr, identity name/realm render, three utility seals, character/bag/settings navigation, feedback dialog teleport to body.
- `ThienCoRail.test.ts` (new): L8 attr, quiet empty state, breakthrough-ready entry with realm CTA reaching `standalonePanel === 'realm'`.

## Gaps and Residual Risk

- Alchemy countdown label can lag up to the 30s ticker (bounded; `stateVersion` bump on job completion refreshes earlier). Coverage gap only.
- `getCurrentRealm(player.realmId)` throws on an unknown realm id — consistent with every existing consumer; corrupt-realm saves already crash elsewhere. Pre-existing pattern, not introduced here.
- Rail vs RightPanel (z10) overlap: rail intentionally under panels; on very narrow viewports the rail can cover right-side building nameplates — cosmetic, deferred to coordinator's responsive pass (spec SS59-61).
- Wheel ignite cue has no dedicated unit test (logic verified by inspection; behavior depends on cross-open disabled-state diff — a reproduction needs two open/close cycles; coverage gap, low risk).

## Pre-existing Failures

None observed in scope.
