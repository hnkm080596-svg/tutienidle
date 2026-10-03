# Huyen Kim Son Thuy — Phase 2: Dong Fu / Global Navigation

Worker audit + plan (AUDIT -> PLAN -> IMPLEMENT). Spec: `TuTienIdle_UI_UX_Redesign_HuyenKimSonThuy_FinalSpec.md`
(SS9 scene composition/motion, SS10 Dao Luan, SS11 top bar, SS12 Thien Co Bang, SS14 Dong Fu, SS8.1 sanctuary mode, SS59-61 perf/responsive).

Worktree: `.agent-worktrees/huyen-kim-nav`, branch `devin/<ts>-huyen-kim-nav`, base `origin/devin/huyen-kim-redesign`.

## G0 task card

- Task: Phase-2 home composition + navigation treatment (top bar, Thien Co Bang right rail, Dao Luan wheel treatment, Dong Fu layer/state formalization, ambient flags).
- Requested observable behavior: on `home`, a screen-space top bar shows identity (avatar+name+realm+cultivation progress) left, global resources center, utilities (feedback/bag/settings) right; a right-side Thien Co Bang rail lists max 4 actionable opportunities; the command wheel reads as Dao Luan (ring-1 inner orbit, everything else outer orbit, center Tu Luyen seal, rune-ignition on newly unlocked slots); clicking a building adds a slight parallax drift toward it + context dim; buildings show ready/active/upgradeable ambient cues; L8 chrome never moves with world camera.
- Single responsibility: home-screen chrome composition + Dong Fu presentation treatment. No gameplay/state-authority changes.
- Current owners: `GameRoot.vue` (chrome mount points), `DongFuScene.vue` (parallax/layers), `DongFuCommandWheel.vue` (nav surface), `HomeBuildingIcons.vue`/`DongFuBuildingSprite.vue` (building states), `CurrencyHud.vue`/`AutoFarmIndicator.vue` (floating chips).
- Target owners: same files + new `GlobalTopBar.vue`, `ThienCoRail.vue`, `useThienCoEntries.ts`.
- Existing primitives to reuse: `--hk-*` tokens + `.hk-state-*`/`hk-attention`/`hk-breath` (Phase-0), `huyenKimChrome` manifest 'pending' pattern, `GameButton`, `InkNineSlice` fallbacks, `FeedbackDialog`, `PlayerPortrait` (`variant="portrait"`), existing parallax mechanism (`--parallax-x/y`, `clampUnit`), existing building status read-model (`useBuildingNavigation.getBuildingStatus`).
- Missing capability: top-bar + opportunity-rail composition (new components, purely presentational over existing stores/ops).
- Non-goals: primitives reskin (Phase-1), combat HUD, new particle systems, gameplay/state changes, any prop/event/slot signature change.

## Audit: current vs target

| Surface | Current | Target (spec) | Gap |
|---|---|---|---|
| Top bar | None. `CurrencyHud` floats top-left (z9); `AutoFarmIndicator` floats top-right (z12); no identity/realm chrome; settings only via wheel/left panel | SS11: identity left / global resources center / utilities right, thin edge chrome | New `GlobalTopBar.vue`; dock existing chips into it |
| Opportunity surface | None | SS12 Thien Co Bang: right rail, max 3-4 actionable entries, no stale info | New `ThienCoRail.vue` + `useThienCoEntries.ts` over existing read-models |
| Dao Luan | `DongFuCommandWheel`: 2 orbits assigned `index % 2` (interleaved), paper-styled slots, no center, no unlock cue | SS10.1: inner ring = cultivation core (catalog ring 1), outer = systems/buildings/unlocks; center Tu Luyen seal; newly-unlocked = rune ignition; ready = subtle pulse not badge spam | Orbit assignment by `slot.ring`; decorative center seal (chrome `dao-luan-center` = pending -> CSS seal); ignition class; hk-token reskin; keep props/events/data attrs/tests |
| Layer stack | `DongFuArt` descriptors have order/motion/shift only; DOM has `data-layer` name | SS14.4 canonical map L0..L8 | Add `canonical` field + `data-canonical-layer` attrs on scene layers (L0-L5), hotspots (L3), player (L4), Linh Nhan/motes (L5); L8 stays DOM in GameRoot |
| Building states | sprite `is-status-*` + hover lift/selected ring/locked silhouette; nameplate pill | SS14.5: + action-ready ambient cue (local, no badge spam) + click -> slight parallax/camera drift toward building + context dim | Breathing ring on sprite for ready/upgradeable/active (reuses `hk-breath`); focus bias blended into existing pointer-parallax unit domain (no new px constants) + masked dim overlay |
| Ambient | `cloud-slow/cloud-medium/mist-slow` on layers 01/02/08; `home-motes` + Linh Nhan rings at player | SS14.4 ambient candidates: waterfall shimmer (05), water shimmer/haze (06), petal drift (seasonal) — assets absent | Flag via `fxPending` on descriptors (mirrors chrome manifest 'pending' pattern); no new particle systems |
| Screen-space UI | Wheel/popover/panels are DOM (never parallaxed) | L8 must stay DOM | Preserved by construction; focus bias applies inside `.home-scene` only |

## Files

Create:
- `src/components/game/GlobalTopBar.vue` — grid identity | resources | utilities. Identity: `PlayerPortrait variant="portrait"` + name + realm line + cultivation progress bar (jade fill); click -> `ui.openLeftPanel('character')`. Center: `CurrencyHud` (position neutralized via `:deep`). Right: `AutoFarmIndicator` (`:deep` static) + seal buttons: feedback (`FeedbackDialog` teleported to body), bag (`openLeftPanel('inventory')`), settings (`openLeftPanel('settings')`). Mounted only in `!isFullSceneActive`; z-index 9; near-transparent edge gradient from `--hk-surface-base`.
- `src/components/game/ThienCoRail.vue` — right edge card below top bar (CSS fallback for pending `surface-l-drawer` chrome: `--hk-surface-raised` + `--hk-border-muted` + gold eyebrow); header + <=4 entries (marker + title + detail + `GameButton size="sm"` CTA); first entry CTA gets `.hk-attention`; empty -> quiet line; `role="complementary"`.
- `src/composables/useThienCoEntries.ts` — computed entry list. Sources (all read-only): `realmAdvanceOps.canTriggerBreakthrough(player)`, `questOps.getActiveQuests(player)` + `canClaimQuest`, `alchemyOps.getJobs()` (running jobs => pill_room CTA with coarse remaining minutes via 30s `nowMs` ticker), `navigation.getBuildingStatus` per `DONG_FU_BUILDING_IDS` (ready/upgradeable). Priority order breakthrough > quest > ready > active > upgradeable; `MAX_ENTRIES = 4`. Recomputed on `stateVersion` + ticker.
- Tests: `GlobalTopBar.test.ts`, `ThienCoRail.test.ts` (mount helpers reuse GameManager/provide pattern from `DongFuCommandWheel.test.ts`).

Modify:
- `src/components/layout/GameRoot.vue` — replace `<CurrencyHud />` + `<AutoFarmIndicator />` mounts with `<GlobalTopBar />` + `<ThienCoRail />` inside the `!isFullSceneActive` block.
- `src/components/game/DongFuCommandWheel.vue` — orbit assignment by `slot.ring` (ring1 -> orbit 0; else orbit 1; `ORBIT_COUNT` stays 2, sweep/direction/`data-wheel-*`/labels unchanged); decorative `command-wheel__center-seal` ("Tu Luyen", `aria-hidden`, `pointer-events:none`); slot/orbit/backdrop reskin to `--hk-*` tokens; `.is-ignited` class on slots whose `disabledReason` cleared since last open (tracked in a `ref<Set<string>>`, cleared after animation; reduced-motion safe); upgrade-dot/notification badges get `hk-breath` pulse.
- `src/presentation/background/DongFuArt.ts` — descriptor + `canonical: 'L0'|'L1'|'L2'|'L3'|'L5'` per SS14.4 (00->L0; 01,02,03->L1; 04->L2; 05,06->L2; 07->L3; 08->L5; 09->L2 occluder) and optional `fxPending` flag (`waterfall-shimmer` on 05, `water-shimmer` on 06 — the two SS14.4 candidates mapped to real modular layers) — pending-art bookkeeping only.
- `src/components/game/DongFuScene.vue` — `data-canonical-layer` attrs on layers/hotspots/player/linhnhan/motes; `focusAnchor` computed (`ui.activeBuildingPopoverId`, else `leftPanelMode -> functionType -> buildingId` via `buildingOps.getBuildingDefinitions()` + `DONG_FU_BUILDING_ART.scenePlacement`); effective parallax unit = `mix(pointerUnit, anchorUnit, FOCUS_BLEND)` (named constant, normalized domain — no new px constants); `focus-dim` overlay masked with radial-gradient at `--focus-x/--focus-y` anchor %; all gated by `reducedMotion`; `data-fx-pending` attr on flagged layers.
- `src/components/game/HomeBuildingIcons.vue` — `data-canonical-layer="L3"` on root.
- `src/components/game/DongFuBuildingSprite.vue` — ambient cues: `is-status-ready` -> jade breathing `__ring`, `is-status-upgradeable` -> gold breathing `__ring`, `is-status-active` -> faint cinnabar breath; all via existing `--hk-*`/`hk-breath`, `is-reduced-motion` -> static faint ring.
- `src/locales/vi.json`, `src/locales/en.json` — `home.topBar.*`, `home.thienCo.*` (P16).
- Tests: extend `DongFuScene.test.ts` (canonical attrs + focus class), `DongFuCommandWheel.test.ts` (orbit-by-ring + center seal).

## G1 — Q1-Q12 + module U (evidence)

- Q1 observable behavior: home shows top bar + rail; wheel regroups orbits; building click biases parallax + dims context; sprite breathes when actionable; disabled->enabled transition ignites once. Failure: rail empty -> quiet line; no actionable state -> no badges.
- Q2 owner: chrome composition = `GameRoot.vue`; opportunity derivation = `useThienCoEntries.ts` (single read-model owner); focus geometry = `DongFuScene.vue`; building status = `useBuildingNavigation` (unchanged authority).
- Q3 state: no new persisted state; `ignitedIds`/`nowMs`/`focusAnchor` are component/composable-local refs; ui store untouched (feedback dialog mounted via Teleport inside `GlobalTopBar`).
- Q4 chain: `GameRoot` -> `GlobalTopBar`/`ThienCoRail` -> `useThienCoEntries` -> `gameManager.*Ops` read-models; `DongFuScene` -> `ui` store reads.
- Q5 reuse: `--hk-*` tokens, `hk-breath`, `GameButton` (`size="sm"`, `shape="circle"`), `FeedbackDialog`, `PlayerPortrait('portrait')`, `formatNumber`, `DongFuArt` motion classes, `clampUnit` parallax domain. No new abstraction.
- Q6 deps: components -> composables/data/core read-models; nothing imported upward.
- Q7 separation: entries are observational (Q9); clicks only navigate (ui store actions) — no grants/progression in UI.
- Q8 consumers: `COMMAND_WHEEL_SLOTS` consumers = wheel only; `DongFuLayerDescriptor` consumers = `DongFuScene` + its test (new optional fields are additive).
- Q9 queries: `getActiveQuests`, `canClaimQuest`, `getJobs`, `getBuildingStatus`, `canTriggerBreakthrough` are reads (verified in ops sources).
- Q10 duplicate/interrupt: wheel re-open diffs disabled set (ignition fires once per transition); ticker cleared on unmount; Teleport dialog unmounts with top bar on route change.
- Q11 old path: `CurrencyHud`/`AutoFarmIndicator` keep working — only mount position changes (`:deep` position override); wheel alternation `index % 2` replaced by ring grouping (same 2-orbit contract).
- Q12 scope proof: file list above maps 1:1 to audit gaps; verification = `npm run type-check` + `npx vitest run` on touched scopes + new tests; stop when scope items implemented.
- U1: `GameButton`/`InkNineSlice`/`FeedbackDialog`/`v-tooltip` are the canonical primitives — reused.
- U2: no Phaser projection change; parallax stays DOM-side.
- U3: no new assets; pending FX flagged on descriptors (`fxPending`).
- U4: rendering resources unchanged; focus-dim is a DOM overlay owned by `DongFuScene`.
- U5: all new strings via i18n keys vi+en; code comments ASCII-only (P15).
- U6/P14: UI work -> runtime spot-check via dev server + browser/Playwright evidence inside this worktree during Pass 3; environment failure reported as blocker.

## Risks

- `CurrencyHud`/`AutoFarmIndicator` carry self-positioning; neutralized via `:deep` in top bar (components untouched).
- Wheel orbit regroup changes `data-wheel-orbit` assignment (by ring, not index%2) — tests updated to assert ring semantics; `radii.size === 2` and direction contract preserved.
- Focus bias + masked dim degrade gracefully: no anchor (settings/scripture/character panels) -> no focus; reduced-motion -> bias 0, dim static.
- Thien Co freshness: `stateVersion` + 30s ticker; entries are navigation-only (no commit authority).
- `leftPanelMode` modes without scene buildings (settings/scripture_pavilion/character/inventory) -> focus resolves to none (no dim) — intentional.

## Verification plan

- `cd game && npm run type-check`
- `npx vitest run` scoped: `DongFuScene`, `DongFuCommandWheel`, `HomeBuildingIcons`, `GlobalTopBar`, `ThienCoRail`
- P18 OCR (delegation mode) on the diff; P4 adversarial quick; >=3 sequential P5 passes (no fixpoint loop — coordinator owns global fixpoint).
