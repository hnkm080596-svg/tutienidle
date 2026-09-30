# P4 Quick Adversarial QA — BETA SCOPE LOCK v2 Phase-6 (navigation/global-surface)

Date: 2026-09-30 · Mode: quick · Worktree: `.agent-worktrees/beta-scope-v2-navigation`
Scope: fail-closed pruning of every domain registry feeding navigation, HUD,
notifications, deep-links and post-ceiling realm-progression surfaces, per the
phase task's contracts A–E. Phase-5-owned quest-set content untouched by design.

## Mapper result

`changed-risk-map.mjs` on the 25 task-owned paths → domains:
`economy-and-progression`, `inventory-equipment`, `pinia-phaser-sync`,
`ui-input-lifecycle`; `deepAuditCandidate: true` ("cross-system change: 4
domains"); 12 `unmappedPaths`.

**Routing decision — no deep escalation.** The breadth is parallel instances of
ONE mechanic (a read-model/predicate early-out per surface), not a cross-system
state transition: no persistence shape changes (contract E is read-model only),
no economy math changes (hidden-channel registry ships empty today; the gate is
a no-op for beta-live production), no Vue/Pinia/Phaser lifecycle ownership
moved (stores still own UI state; only admission predicates were added at
existing seams). Every unmapped path was inspected and routed by hand:

- `betaScope.ts`, `betaScopeSurface.ts`, `betaFeaturesUnlock.ts`,
  `setup.betaScope.ts`, 3 architecture specs → economy-and-progression
  (release-policy reads) + ui-input-lifecycle (surface predicates).
- `useBuildingNavigation.ts` → ui-input-lifecycle (deep-link funnel).
- `CompanionGifts.ts`, `HiddenBeastSystem.ts`, `GameManagerTickOps.ts`,
  `GameManagerProgressionOps.ts` → economy-and-progression (dormant-domain
  emission gates; facade bindings are pure delegation).

## Invariant ledger

| ID | Hypothesis / attack operator | Oracle | Result |
| --- | --- | --- | --- |
| INV-NAV-1 | Hidden standalone panel mounts via direct `ui.standalonePanel = X` bypassing the action (stale-state operator) | `mountedStandalone` render authority in `GameRoot.vue` | **Bounded, no defect** — the watcher gate rejects mount; the only direct-assign caller (`useTribulation` victory) can emit `'quan_khi'` only (typed so in `TribulationOutcomeService.ts:68`). A hypothetical future hidden direct-assign leaves an inert truthy flag: render never mounts, wheel slot filtered, `toggleStandalonePanel` recovers (closes it). |
| INV-NAV-2 | `LeftPanelMode`/`StandalonePanel` unions contain ids absent from the binding maps → over-gating of a beta-live surface (cross-system operator) | `presentation/contracts/panelIds.ts` union vs maps | **Rejected** — `BETA_LEFT_PANEL_FEATURES` covers all 10 non-null modes (incl. `stage_select`, `vendor`); `BETA_STANDALONE_PANEL_FEATURES` covers all 7. Wheel map now covers all 15 `COMMAND_WHEEL_SLOTS` ids. |
| INV-NAV-3 | Wheel slot fail-closed semantics diverged from other maps (unlisted id admitted) | Spec assertion `isBetaWheelSlot('made_up_slot')` | **Fixed** — `BETA_WHEEL_SLOT_FEATURES` converted to a full 15-entry `BetaFeatureName \| null` binding map; unlisted ids now resolve scope-hidden. Spec updated to pin fail-closed. |
| INV-PROG-1 | Hidden (Đại Đạo) breakthrough reachable via `resolveBreakthroughType` bypassing the gated `isHiddenBreakthroughEligible` | `HiddenLineage.ts:361` source read | **Rejected** — `resolveBreakthroughType` is a pure delegate of the gated predicate; no second hidden resolver exists (`GameManagerRealmAdvanceOps`, `TribulationDirector` both route through it). |
| INV-PROG-2 | Post-ceiling tribulation reachable through a UI CTA (`BreakthroughRequirementPanel`, `CharacterPanel`, `useTribulation`) | `useTribulation.ts:39` source read | **Rejected** — `canTriggerBreakthrough` (ReleasePolicy `isRealmTransitionEnabled`) guards the trigger at domain level; ceiling tribulation already dead pre-task. |
| INV-ECO-1 | `rollHiddenChannelRewards` early-out drops beta-live rewards or skips state the settle loop needs (value mutation: early return) | Function body + `ProductionSystem.test.ts` suite | **Rejected** — the function only computes hidden-channel rewards; early return `[]` merges as no-op; suite green incl. settle idempotence tests. Registry is empty today so no observable change. |
| INV-ECO-2 | `hidden_window_opened` audio cue still fires (contract C, Phase-4 flagged) | `BattleLootSystem.ts:457` emit loop | **Rejected** — emit iterates `hiddenBeast.onEnemyDefeated()` return; gated to `[]` → zero emits; counters stay dormant so `maybeReplaceSpawn` substitution can never arm either. |
| INV-HUD-1 | Other notification/toast emitters owned by dormant features (artifact, formation, wash/refine/ore) still fire | Grep over `core/notification`, `stores/notification`, emitter call sites | **Rejected** — the only dormant-domain emitter is `hidden_window_opened` (dead at source). Daily-reset toast gated on `dailyQuest`. Artifact/formation/wash/refine domains produce no events when dormant. |
| INV-HUD-2 | CurrencyHud leaks dormant-system currencies beyond companion tokens | `CurrencyHud.vue` diff + source list | **Rejected** — the only HUD source owned by a dormant domain is the companion-token chip; gated on `companion` feature at the source (plus existing realm-unlock check). |
| INV-SAVE-1 | `unsupportedReleaseReason` false-positives on a clean beta save / throws on bypassed-shape saves (value mutation: missing/corrupt fields) | `Player.ts` field types + defensive guards + spec malformed-shape case | **Rejected** — `formationLoadout` is `null`-typed and validator-required (valid save always has it); `artifact` optional-`undefined`; `companions` guarded by `Array.isArray`; `hiddenPerfection` reads are shape-defensive (non-object `realms` counts as hidden state instead of throwing). All over-reporting directions are fail-closed (flag unsupported), never silently supported. |
| INV-TAB-1 | EquipmentHall hidden tab selectable via deep-link or persisted active tab | `EquipmentHallPanel.vue` tab state | **Rejected** — `activeTab` is component-local seeded `'enhance'`; `switchTab` only fires from rendered (filtered) tab buttons; no deep-link/persisted tab seam exists. |
| INV-BUILD-1 | Building ids outside `BETA_BUILDING_FEATURES` reachable via `openBuilding` → over-gating | `DongFuBuildingArt` + `buildings.ts` catalogs | **Rejected** — both catalogs declare exactly the 6 mapped ids. Unmapped-id callers get the same no-op as before (`getBuildingPresentation` finds no template). |
| INV-UI-1 | `worker_lodge` still rendered by a sidebar/menu registry | Grep `worker_lodge` across `components/`, `composables/`, `data/` | **Rejected** — only reachable via gated action paths (`openLeftPanel`, `openBuilding`) and a `FunctionOverlayPanel` `v-else-if` that requires `mode === 'worker_lodge'` (unreachable — the setter gates it). |

## Evidence

- P3 quick: `npm run type-check` clean; `npx vitest run` full suite
  **851 files / 7769 tests, 0 failures** (clean-tip baseline carried 3
  pre-existing `betaScopeSkillDomain` failures — this diff re-pins the missing
  way lock there, so the suite is strictly greener than base).
- Spec coverage: `tests/architecture/betaScopeSurface.test.ts` (44 assertions
  incl. fail-closed unknown ids, hidden-domain gates, beta completion,
  unsupported-reason precedence).
- Source verification of every consumer chain above (file:line citations).
- No reproduction test was required: no hypothesis survived to Confirmed —
  each was rejected by direct source/predicate evidence or converted into an
  implemented fix (INV-NAV-3) with a pinning spec.

## Verdict labels

Per-operation evidence labels for the protocol ledger:

- Contract A (realm/body progression fail-closed): **PASS WITH EVIDENCE**
- Contract B (navigation/wheel/hotspot fail-closed): **PASS WITH EVIDENCE**
- Contract C (HUD/currencies/notifications): **PASS WITH EVIDENCE**
- Contract D (beta completion beat read-model): **PASS WITH EVIDENCE** —
  domain flag exists and is spec-pinned; no frontend consumes it yet
  (Phase-7+ ending surface is out of this phase's scope).
- Contract E (save safety read-models): **PASS WITH EVIDENCE**

Gaps recorded honestly: no live-browser rendering check of the wheel/hotspot
surfaces (P3 quick mode per task order; UI edits are pure read-model
consumption); `hidden_window_opened` suppression verified at source, not via a
running battle scene.

## Learned-defect lesson candidates (unconfirmed — no REAL_DEFECT found)

- INV-NAV-3 pattern: when a scope gate admits "unlisted = live" while sibling
  gates fail closed, the quiet inconsistency hides future leak surface. Weight
  exhaustiveness-vs-catalog assertions when reviewing allow-list maps.
