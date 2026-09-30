# QA Review: beta playable scope lock (pathways + hidden + companion + Tran Phap access)

- Date: 2026-09-30
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - game/src/core/betaScope.ts (new flag module)
  - game/src/core/player/CultivationPathKit.ts, CultivationPathSystem.ts
  - game/src/core/realm/hidden/HiddenLineage.ts, NghichChuTian.ts
  - game/src/core/game/HiddenBeastSystem.ts, FormationPlacement.ts, GameManagerCompanionOps.ts
  - game/src/core/companion/CompanionAvailability.ts, CompanionGifts.ts
  - game/src/core/production/ProductionSystem.ts
  - game/src/data/ui/commandWheelCatalog.ts
  - game/src/components/game/CurrencyHud.vue, DongFuCommandWheel.vue
  - game/src/components/panels/QuanKhiPanel.vue, WorkerLodgePanel.vue
  - game/src/locales/en.json, vi.json
  - game/vite.config.ts, game/tests/betaScopeTestSetup.ts,
    game/tests/architecture/betaScopeLock.test.ts
  - game/src/core/realm/ReleasePolicy.test.ts, ReleasePolicy.artifactDeferred.test.ts (fixture fields)

## Scope and Risk Map

changed-risk-map: domains = economy-and-progression, pinia-phaser-sync,
ui-input-lifecycle; `deepAuditCandidate: true` (3 domains); 14
unmapped paths.

Escalation decision — NOT escalating to deep. The mapper flags breadth,
not depth: every gate is a flag-only early return at an owning system's
authority point; no persisted shape, no state transition, no lifecycle
or subscription changed. Manual routing of unmapped paths:
- `core/betaScope.ts`, `companion/*`, `game/FormationPlacement.ts`,
  `game/GameManagerCompanionOps.ts`, `game/HiddenBeastSystem.ts`,
  `player/CultivationPath*`, `production/ProductionSystem.ts`,
  `realm/hidden/*` → economy-and-progression domain pack (offers,
  acquisition, emissions, deployment = progression transactions).
- `data/ui/commandWheelCatalog.ts`, `locales/*`, `.vue` panels →
  ui-input-lifecycle pack (slot affordance, locked-card rendering).
- `vite.config.ts`, `tests/*` → test-authoring-and-evidence rules
  (the global flag mock + vi.unmock escape hatch).

Learned-defect ledger check: QA-2026-09-12-012 (persisted
formationLoadout drives per-entity grants) — reviewed: the deployment
gate sits inside `commitFormationLoadout` only; `resolvePartyFormation`
is intentionally ungated, so a persisted loadout still resolves and the
BattleLootSystem per-kill EXP seam sees identical assignment state - no
half-applied handoff. QA-2026-09-12-013 (roster membership validation)
unaffected - no persisted shape changed.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-BSL-1 | way offers / CultivationPathKit | ritual offer + applyPathChoice commit | locked way never offerable/committable | value mutation: max all precursor gates | listOfferableWays eligible set; applyPathChoice ok:false | unit (betaScopeLock.test.ts) | Holds - pinned |
| INV-BSL-2 | hiddenPerfection / HiddenLineage | discovery, Quan The divert, Co Thu trial, Nghich Chu Thien attempt, hidden breakthrough | no hidden progression while flag off | reorder + repeat | discoverHiddenRealm returns undefined and writes no realms entry; eligibility false at every seam | unit (betaScopeLock.test.ts + code trace: completeHiddenBody line 210, isNghichChuTianEligible line 94, AncientBeastTrial line 93 all funnel through canProgressHiddenBody) | Holds - pinned + traced |
| INV-BSL-3 | hiddenPerfection.lineageActive | beta-era normal breakthrough (closeHiddenLineage call) | persisted lineage is never burned during beta | interruption/save boundary | lineageActive stays true; no lineageClosedByRealmIds entry | unit (betaScopeLock.test.ts) | Holds - pinned |
| INV-BSL-4 | hiddenBeastKills / HiddenBeastSystem | spawn substitution + banded-kill write | no substitution, no counter writes, no window events | repeat + value mutation | maybeReplaceSpawn undefined at rng=0 (forced hit); onEnemyDefeated returns [] and hiddenBeastKills stays {} | unit (betaScopeLock.test.ts) | Holds - pinned |
| INV-BSL-5 | hiddenChannelCycles / ProductionSystem | grotto settle (online + offline) | no hidden material emission; counters frozen | timing boundary + offline | rollHiddenChannelRewards returns [] before counter writes; single authority covers online+offline settle paths | code trace + existing ProductionSystem.test.ts (enabled shape) | Holds - traced |
| INV-BSL-6 | companionGifts / CompanionGifts | realm_entered + stage_completed gift moments | no record issuance while locked | repeat + reorder | issueCompanionGifts returns [] and companionGifts stays empty | unit (betaScopeLock.test.ts) | Holds - pinned |
| INV-BSL-7 | formationLoadout / FormationPlacement | commitFormationLoadout | companion deployments refuse; solo 'player' commits legal; persisted loadouts still resolve | stale state (pre-beta save) | companion assignment -> false; player-only -> true; resolvePartyFormation returns persisted companion slots | unit (betaScopeLock.test.ts) | Holds - pinned |
| INV-BSL-8 | wheel slots / commandWheelCatalog | slot disabledReason | Tran Phap + roster slots report release-unavailable at every realm | value mutation | RELEASE_UNAVAILABLE_REASON returned; flipping context flags restores null | unit (betaScopeLock.test.ts) | Holds - pinned |
| INV-BSL-9 | wheel activate / DongFuCommandWheel | slot click | locked slot never opens a panel | repeat input | activate() early-returns on disabledReason; lock badge + tooltip + aria-disabled render | component (existing DongFuCommandWheel.test.ts under enabled mock; reason pinned in betaScopeLock) | Holds - verified by inspection + tests |
| INV-BSL-10 | worker-lodge tabs / WorkerLodgePanel | tab render at Truc Co | companion tabs visible but locked; Nhan Cong stays live | UI state | v-else-if locked card precedes companion tab branches; nhan_cong branch unreachable when locked | component inspection | Holds - traced |
| INV-BSL-11 | save compatibility / all flags | pre-beta save with sword way + companions + open lineage + committed loadout | persisted state untouched; machinery keeps resolving | interruption (reload semantics) | getActiveWayDefinition ungated; resolvePartyFormation ungated; lineageActive preserved (suspended closure); gift records claimable post-beta | unit pins + code trace | Holds |
| INV-BSL-12 | ops gates / GameManagerCompanionOps | pull/exchange/claimGift/feed direct call | 'realm_locked' rejection at authority even if UI bypassed | cross-system chain | isCompanionGameplayUnlocked gate precedes all mutation; zero side effects on reject | existing GameManagerCompanionOps.test.ts (enabled) + code trace | Holds - traced |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` (vue-tsc --build) | clean, exit 0 | full repo |
| `npm run build` (vite build) | clean | 1914 modules transformed |
| `npx vitest run` (full suite) | 7663 passed / 5 expected-fail / 1 skipped, 843 files | includes the 16 new scope-lock pins running under the REAL flag module (vi.unmock) |
| `npx vitest run tests/architecture/betaScopeLock.test.ts` | 16/16 pass under locked flags | real module, not the setup mock |
| Source trace: completeHiddenBody/isNghichChuTianEligible/canRollHiddenBeastTrial | all funnel through canProgressHiddenBody | lines HiddenLineage.ts:210, NghichChuTian.ts:94, AncientBeastTrial.ts:93 |
| Source trace: openStandalonePanel callers | only wheel activate (DongFuCommandWheel.vue:336) + CharacterPanel quan_khi | no other programmatic route into companion/tran_phap panels |
| Wheel badge check | hasBreakthroughBadge applies to 'character' slot only | no companion/formation badge desync possible |
| QuanKhiPanel choice section | v-if="!player.cultivationPath" wraps choices + locked cards | locked cards only ever render pre-commit - a committed sword save sees its own tree, not a self-locked card |

## Findings

### QA-2026-09-30-001: gift-moment one-shot triggers permanently skipped for beta-era saves
- Severity: Low
- Status: Suspected (design tradeoff, documented)
- Invariant: exactly-once acquisition vs scope reduction.
- Preconditions: save crosses a realm_entered/stage_completed gift
  trigger DURING the beta window while BETA_COMPANION_CONTENT_ENABLED
  is off.
- Reproduction: enter foundation_establishment during beta; no
  `gift_than_nong_foundation_entry` record is written; post-beta the
  one-shot trigger does not refire, so that moment never issues.
- Expected: acquisition gated (task requirement) - the skip is the
  literal reading of "gift moments acquisition gated".
- Actual: matches requirement; persisted records from pre-beta saves
  stay claimable. The residual is a beta-era save misses a one-shot
  moment rather than deferring it.
- Evidence: CompanionGifts.ts early return + betaScopeLock.test.ts pin;
  documented in betaScope.ts header.
- Test file: tests/architecture/betaScopeLock.test.ts
- Owner subsystem: companion gifts
- Blast radius: beta-era saves only; accepted per task scope.

### QA-2026-09-30-002: devtools can still mount locked panels directly
- Severity: Low (Nit)
- Status: Suspected
- Invariant: access-layer lock completeness.
- Reproduction: `ui.openStandalonePanel('companion')` from console
  bypasses the wheel slot lock and mounts CompanionPanel.
- Actual: panel renders; all mutating ops inside remain flag-gated
  (realm_locked), so no state can be mutated. Not a reachable player
  flow - requires devtools.
- Evidence: ui.ts:231 + GameRoot.vue:133-135 mount is unconditional.
- Test file: none
- Owner subsystem: UI store / panel routing
- Blast radius: presentation only; ops authority unaffected.

### QA-2026-09-30-003: global enabled-flag test seam hides the locked shape from future tests
- Severity: Low (Nit)
- Status: Coverage gap (accepted, documented)
- Invariant: test seam honesty - a new test asserting LOCKED behavior
  must vi.unmock or it silently runs under the enabled mock.
- Mitigation: documented in betaScopeTestSetup.ts header +
  vite.config.ts comment; the unmock pattern is proven live by
  betaScopeLock.test.ts (16 locked-state pins run against real flags).
- Test file: tests/betaScopeTestSetup.ts (the seam itself)

## New or Changed QA Tests

None added by this run - the task-owned pin suite
(tests/architecture/betaScopeLock.test.ts, 16 cases under the real
locked flag module) already provides reproduction-grade evidence for
every ledger row; duplicating it adds no oracle.

## Gaps and Residual Risk

- Gift one-shot skip (QA-...-001) is an accepted design tradeoff, not
  resolved by code.
- No browser-level render evidence of the locked cards/locked wheel
  slots (P13/P14 not triggered - pure disabled-reason + template change
  on existing proven patterns; slots already had lock-badge plumbing).
- Behaviors pinned only transitively (e.g. attemptNghichChuTian via
  canProgressHiddenBody) rely on the funnel staying the sole authority;
  a future direct write path would bypass - the drift-guard set + seam
  pins bound this.

## Pre-existing Failures

None observed - the full suite is green (7663 pass) with the flag seam
in place; the 5 `expected-fail` entries predate this change.
