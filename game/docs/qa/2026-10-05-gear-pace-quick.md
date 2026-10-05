# QA Review: gear-pace retune (floor-banded quality ceiling + weighted affix tiers)

- Date: 2026-10-05
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - game/src/core/equipment/ItemQualityBalance.ts
  - game/src/core/equipment/EquipmentRolling.ts
  - game/src/core/equipment/EquipmentSystem.ts
  - game/src/core/game/BattleLootSystem.ts
  - game/src/core/game/battleLootTestSetup.ts (fixture type extension)
  - game/src/core/equipment/ItemQualityBalance.test.ts
  - game/src/core/equipment/EquipmentSystem.test.ts
  - game/src/core/game/BattleLootSystem.dropResult.test.ts
  - game/tests/lab/gearPaceMeasure.test.ts
  - game/docs/balance/2026-10-05-gear-pace-curve.md

## Scope and Risk Map

changed-risk-map: domains combat-and-tribulation / economy-and-progression /
inventory-equipment; `deepAuditCandidate: true` on breadth ("cross-system change:
3 domains"); unmappedPaths = the balance doc (docs-only, no runtime surface) and
BattleLootSystem.dropResult.test.ts (test file — routed manually to
inventory-equipment + economy-and-progression, its one-hop consumer is the
createInstance seam it already asserts).

Escalation decision: NOT escalated. The breadth is the authorized pacing change
itself — one roll-time ceiling plumbed through the existing drop grant, one
weight table replacing a uniform pick. No persistence schema change (instance
shape untouched; old saves keep rolled quality), no clock/offline path touched,
no Vue/Pinia/Phaser lifecycle touched. The only cross-system seam is the one
being tested. Material risk bounded by code inspection: the changed transition
(drop grant) has a deterministic oracle at unit level.

Exclusions: none beyond OCR's own doc exclusion.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-GEAR-1 | rng stream / EquipmentRolling | quality + affix-tier rolls | Determinism: identical draw cadence for pinned rng sequences | Reorder | every positional rng pin in EquipmentSystem.test.ts | unit | high — suite-wide pins |
| INV-GEAR-2 | rolled quality / rollItemQuality | capped roll | Boundedness: base roll never exceeds band ceiling | Value mutation (rng endpoints 0, 0.999999) | instance.quality vs ceiling | unit | high |
| INV-GEAR-3 | floor resolution / BattleLootSystem | stage-less kill, template miss, optional floor | Recoverability/compat: stage-less keeps flat ladder; floor-optional stage resolves via requiredRealmLevel | Stale state / missing field | createInstance arg[6] | integration | high — floor is optional in the Stage contract |
| INV-GEAR-4 | qualityBonusSteps / applyQualityBonusSteps | stacked/elite kill on capped floor | Exactly-once + spec E5/E9: bonus applies AFTER cap | Reorder | capped+steps roll reaching one band up | unit | medium — intended escape valve, must stay |
| INV-GEAR-5 | signature equipment drops / grantResolvedDrops | authored signature `kind:'equipment'` | Consistency: same floor rules as pool draws (grade was already realm-forced) | Cross-system chain | createInstance ceiling arg on signature grant | unit | low — uniform cap is correct |
| INV-GEAR-6 | affix tier weight / AFFIX_TIER_ROLL_WEIGHT | affix authored with tier >5 | Boundedness: weight 0 -> excluded; all-zero eligible -> weightedRandom picks first entry deterministically | Value mutation | rollAffixValue output | unit | low — authored data caps at tier 5 |
| INV-GEAR-7 | essence income / dissolve of low-floor items | lower average quality on floors 1-3 | Conservation: less essence per dissolve early | Cross-system chain | dissolve yield vs ITEM_QUALITY_ESSENCE_RANGE | manual review | medium — flagged to currency-surface worker, not a defect of this diff |
| INV-GEAR-8 | save restore of pre-change items | load save with old thien/tien item | Monotonicity: stored quality untouched (cap binds rolls, not state) | Interruption/reload | SaveRoundTrip suite | integration | high — no regression |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | PASS | vue-tsc clean on post-fix state |
| `npx vitest run src/core/game/BattleLootSystem src/core/equipment tests/lab/gearPaceMeasure.test.ts` | 31 files / 440 tests PASS | post-fix state |
| `npx vitest run src/core/simulation tests/e2e` | 14 files / 124 pass + 1 expected fail | journey sim green; xfail pre-existing pin |
| Full suite (earlier run, pre-fallback fix) | 8868 pass / 12 xfail / 9 skip | baseline; scoped rerun after fix green |
| `ocr delegate preview -f json` | 9 reviewable / 1 excluded (md) | coverage 9/9 = 100% |
| rng=0.999999 pin | capped→huyen, uncapped→tien, capped+2steps→thien | EquipmentSystem.test.ts:470 |

## Findings

### QA-2026-10-05-001: floor-optional stage bypassed the ceiling
- Severity: Medium
- Status: Confirmed — fixed inside this task (production fix authorized by task scope)
- Invariant: stage contract — `Stage.floor` is optional; canonical read is
  `floor ?? requiredRealmLevel` (ChapterStages normalizes requiredRealmLevel =
  floor; GameManagerStageOps reads it that way).
- Preconditions: authored stage omitting `floor` (legacy literal pattern).
- Reproduction: `grantResolvedDrops` initially received `stage?.floor` →
  undefined → `itemQualityCeilingForFloor(undefined)` → uncapped roll.
- Expected: ceiling resolves via requiredRealmLevel.
- Actual (pre-fix): uncapped.
- Evidence: new pin `stage without floor resolves the ceiling via
  requiredRealmLevel` in BattleLootSystem.dropResult.test.ts asserts
  arg[6]==='thien' for requiredRealmLevel 7 — fails for the intended reason on
  the pre-fix call.
- Test file: game/src/core/game/BattleLootSystem.dropResult.test.ts
- Owner subsystem: BattleLootSystem drop plumbing.
- Blast radius: any future stage literal without floor; presently none authored
  (all go through defineChapterStages which sets floor), so reachable-but-idle.

### QA-2026-10-05-002: no-stage kills keep the flat ladder
- Severity: Low
- Status: Coverage gap — intentional semantics, documented
- Invariant: none violated; uncapped roll on stage-less kills is deliberate
  (debug/lab/`obtainEquipment` paths).
- Evidence: `no stage context leaves the quality ladder uncapped` pin asserts
  arg[6]===undefined on both grants.
- Note: if a future production path grants drops without stage context it must
  pass floor explicitly — recorded as balance-doc flag #4.

### QA-2026-10-05-003: affix weight 10/6/3/2/1 starved the merged stat-wall journey
- Severity: Medium
- Status: Confirmed — fixed inside this task (weight softened to 7/5/3/2/1)
- Invariant: pacing composition — after merging the stage-wall worker's
  statScale ladder (0848268d), the pinned canonical early loop must
  still clear mortal_dong_9.
- Preconditions: merge base 0848268d (per-floor statScale ladder).
- Reproduction: `npx vitest run src/core/simulation/earlygame/
  EarlyGameSession.test.ts` on merged HEAD → canonical loop fails at
  step 12 (mortal_dong_9, 8 attempts).
- Expected: failedAt null.
- Actual (pre-fix): failedAt=12. Bisected: ceiling alone + uniform
  tiers passes; the 10/6/3/2/1 tier reweight is the power loss.
  8/5/3/2/1 also fails; 7/5/3/2/1 passes (margin thin, flagged).
- Evidence: deterministic same-seed repros on merged state.
- Test file: existing pin (journey test is the oracle; no new test).
- Owner subsystem: equipment roll balance tables.
- Blast radius: any future statScale raise re-touches this margin.

### QA-2026-10-05-004: early-floors dissolve income drops
- Severity: Low
- Status: Suspected (economic side effect, other worker's surface)
- Invariant: conservation of essence income is intentionally changed by the
  pacing goal.
- Evidence: quality distribution on floors 1-3 now excludes dia+;
  ITEM_QUALITY_ESSENCE_RANGE scales with quality.
- Flag #3 in the balance doc; routed to the currency/economy worker via the
  coordinator report.

## New or Changed QA Tests

- `BattleLootSystem.dropResult.test.ts`: it.each floor→ceiling pin (2/5/8/10),
  requiredRealmLevel fallback pin, no-stage uncapped pin — assert the resolved
  ceiling reaches createInstance (the real consumer boundary).
- `ItemQualityBalance.test.ts`: band table shape + itemQualityCeilingForFloor
  outputs; AFFIX_TIER_ROLL_WEIGHT pinned strictly decreasing.
- `EquipmentSystem.test.ts`: rng-endpoint pin — same draw yields capped huyen /
  uncapped tien / capped+steps thien.

## Gaps and Residual Risk

- Band-gap magnitude (~+8%/band from quality alone) is a documented tuning
  choice, not a defect — enhance ladder carries the wall (balance doc flag #1).
- Mortal 100%-drop-per-kill dissolve spam is pre-existing and on the
  drop-frequency/currency surface — flag #2.
- No runtime/browser check needed: no UI, lifecycle, or render path changed;
  lowest conclusive layer is unit/integration.

## Pre-existing Failures

- 1 expected-fail in simulation suite (pre-existing pin, unchanged by this diff).
- Full-suite baseline (pre-fallback-fix): 8868 pass / 12 xfail / 9 skip — same
  xfails as base branch.

## Learned-Defect Row

Appended to game/docs/qa/learned-defects.md:
QA-2026-10-05-001 — optional `Stage.floor` consumed raw while sibling reads use
the `floor ?? requiredRealmLevel` normalization.
