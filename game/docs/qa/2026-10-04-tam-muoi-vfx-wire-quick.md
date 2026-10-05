# QA Review: Tam Muoi aura + empowered fireball VFX wiring

- Date: 2026-10-04
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths:
  - game/src/core/battle/CombatAction.ts
  - game/src/core/battle/turn/SkillPresentationFacts.ts
  - game/src/core/battle/turn/TurnBattleSystem.ts
  - game/src/core/battle/turn/TurnBattleSystem.tamMuoiPresentation.test.ts
  - game/src/core/skilldef/LegacySkillAdapter.converter.test.ts
  - game/src/data/skill/PhapTuSkills.ts
  - game/src/data/vfx/CombatVfxPresets.ts
  - game/src/data/vfx/SkillPresentationRecipes.ts
  - game/src/dev/HoaCauLabPlayback.ts
  - game/src/game/scenes/CombatScene.ts
  - game/src/game/support/HoaCauVfxAssets.ts
  - game/src/game/support/skill-vfx/HoaCauFireballPresentation.ts
  - game/src/game/support/skill-vfx/HoaCauFireballPresentation.test.ts
  - game/src/game/support/skill-vfx/TamMuoiAuraPresentation.ts
  - game/src/game/support/skill-vfx/TamMuoiAuraPresentation.test.ts
  - game/tests/architecture/domArtLiteralCoverage.test.ts
  - game/tests/architecture/hoaCauVfxAssets.test.ts

## Scope and Risk Map

Mapper routed `combat-and-tribulation` + `pinia-phaser-sync` and flagged
`deepAuditCandidate: true` (2 domains). Not escalated: the only engine-side
change is a read-only `casterBuffIds` snapshot stamped onto cast declares
(no damage/targeting/lifecycle mutation); the scene change is a purely
visual presentation class admitted beside the existing HoaCau one-hop
pattern. unmappedPaths (skill-vfx classes, vfx data tables, asset
descriptors, dev lab, architecture tests) route to the same two domains:
visual ownership + declared-fact plumbing. Bounded risk.

One-hop consumers inspected: `SkillPresentationRunner` (timing-only recipe,
ACK still scheduled), `CombatAnimationRuntime` (cast/resolved events),
`AssetBundleCatalog` (`hoaCauCombatDescriptors()` now enumerates all 10
production atlases), `PhaserSkillVfxDriver` (untouched fallback).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-1 | aura sprite pair / CombatScene | cast starts -> resolves/cancels/teardown | Lifecycle | Interruption | sprites destroyed on every exit path | Unit + scene wiring | High (leak) |
| INV-2 | active cast / TamMuoiAuraPresentation | stale or duplicate resolve receipt | Idempotency | Reorder/Repeat | receipt token+requestId mismatch ignored | Unit | Medium |
| INV-3 | declared record / TurnBattleSystem | declare on natural/queued/reactive lanes | Synchronization | Cross-system chain | casterBuffIds stamped on all three lanes | Unit (empirical) | High |
| INV-4 | anchor / bodyBoxFor | missing sprite, unsized box | Boundedness | Value mutation | start() no-ops, render hides all | Unit | Medium |
| INV-5 | presentation | never ACKs impact, never mutates battle | Exactly-once/domain | Cross-system chain | class has no ack/emit surface; readonly facts | Inspection | High |
| INV-6 | runner resolve | lost receipt mid-cast | Recoverability | Timing boundary | overdue bound (releaseMs+800ms) tears down | Unit | Medium |
| INV-7 | tam_muoi window | empowered art locked at declare | Stale state (accepted) | Timing boundary | fact carries declare-time snapshot | Unit | Low |
| INV-8 | asset bundle | aura/circle/phoenix atlases load in combat | Recoverability | Degraded env | contract test enumerates descriptors + on-disk | Arch test | High |
| INV-9 | disposition gate | self-buff cast reaches presentation | Synchronization | Cross-system chain | empirical: disposition 'action', slot 'special' | Unit (engine) | High |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | clean | vue-tsc build graph |
| scoped vitest (10 files, 91 tests) | all green | includes new empirical engine pins |
| `hoaCauVfxAssets.test.ts` (blank-frame contract) | green after declared-range scoping | nonblank asserted only inside [firstFrame,lastFrame] |
| Source inspection of ACK/token paths | clean | matches QA-2026-09-08-RR5 guidance: stale/missing token covered by isCurrent gate + token-matched resolve + overdue teardown |
| Real runtime battle cast (aura visible, phoenix variant) | NOT VERIFIED | Playwright/browser check deferred to P5 Pass 3 runtime evidence |

## Findings

No Confirmed findings.

### QA-2026-10-04-01: aura scale heuristic may not match dev-lab framing
- Severity: Low
- Status: Suspected
- Invariant: Boundedness
- Preconditions: production CombatScene renders the aura
- Reproduction: visual comparison vs the dev lab's flat 0.95 scale
- Expected: aura wraps the sprite comparably to the lab preview
- Actual: production scales by `personHeight / 256`; body-height aura is the
  authored intent, but exact framing is unverified in the real scene
- Evidence: source inspection only
- Test file: none
- Owner subsystem: CombatScene presentation
- Blast radius: cosmetic only

## New or Changed QA Tests

None authored by QA (development-owned pins already cover the transitions):
- `TurnBattleSystem.tamMuoiPresentation.test.ts` (empirical disposition/preset/buff-id facts)
- `TamMuoiAuraPresentation.test.ts` (lifecycle, ignite, stale token, overdue, reduced motion)
- `HoaCauFireballPresentation.test.ts` additions (casterBuffIds -> phoenix variant, surface pin wins)

## Gaps and Residual Risk

- Real Phaser render of the aura layers and the empowered variant is not yet
  observed in the running game (P5 Pass 3 runtime evidence pending).
- INV-7 documents the accepted declare-time lock: a window expiring mid-cast
  still renders the empowered variant for that cast (matches the "cast
  inside the window" contract; noted for the reviewer).

## Pre-existing Failures

None observed in scope.
