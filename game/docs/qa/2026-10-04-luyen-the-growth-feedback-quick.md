# QA Review: luyen-the-growth feedback fix

- Date: 2026-10-04
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - game/src/core/game/GameManagerRealmAdvanceOps.ts
  - game/src/core/game/GameManager.ts
  - game/src/locales/en.json
  - game/src/locales/vi.json
  - game/src/core/game/LuyenTheGrowth.test.ts

## Scope and Risk Map

Request: diagnose "luyen the danh quai khong thay tang truong" and fix
the real break plus the missing player-visible growth feedback.

Diagnosis (headless repro on real GameManager): drop -> bag -> tick
auto-invest -> tier progress all work; the realmLevel-1 tier gate is
authored design (tiers open at mortal levels 2/4/6/8/10/12, and the
auto-cultivation/auto-breakthrough tick reaches level 2 in ~60 s). The
confirmed break is feedback-only: the drop toast names the bag item,
then tick invest drains the bag invisibly, so nothing on screen ever
reports essence becoming Luyen The progress.

Fix: `GameManagerRealmAdvanceOps.investBodyChapter` emits a growth
toast (`notifications.bodyRefinementInvested`) on real conversion and
a milestone toast (`notifications.bodyRefinementTierComplete`) on tier
completion, scoped to chapterId 'body_refinement'. Wired through a new
`notifications: NotificationQueue` dep (single construction site in
GameManager.ts). Two locale keys vi/en + a 5-test regression suite on
the real GameManager.

changed-risk-map output: domains combat-and-tribulation,
economy-and-progression, pinia-phaser-sync, time-and-offline;
deepAuditCandidate=true ("4 domains", "time-and-offline boundary").

Escalation decision: NOT escalated - the diff is a 69-line
presentation funnel. It reads post-apply state and pushes to a queue
that App.vue already drains every tick; it changes no invest math,
debit path, persistence write, or time ownership. The
economy/progression boundary it sits near is observational only, and
the regression suite exercises the real chain end-to-end. Risk is
confidently bounded from code inspection.

unmappedPaths (manually routed): GameManagerRealmAdvanceOps.ts ->
economy/progression invest seam; LuyenTheGrowth.test.ts -> QA evidence;
en.json/vi.json -> presentation strings.

## Invariant Ledger

| # | Invariant | Operator | Result |
|---|-----------|----------|--------|
| 1 | No toast when invest is gated/returns 0 | guard check | held - emit sits inside `applied > 0` / `consumed > 0`; repro: realmLevel-1 test asserts no invest toast |
| 2 | Exactly-once toast per invest | call-path census | held - essence/non-essence paths are exclusive; one emit each |
| 3 | Probe/fail-closed path never toasts | ordering | held - emit after real apply, never on the JSON probe or plan-failure returns |
| 4 | Non-refinement chapters unaffected | scope guard | held - emit early-returns on chapterId !== 'body_refinement' |
| 5 | Tier-index bounds | adversarial index | held - completion branch indexes completedTiers-1 (always defined); progress branch unreachable at completedTiers==6 (invest returns 0) and uses `?.` + getTierCap clamps to 0 anyway |
| 6 | messageParams all strings | type check | held - String() on every param; notification.push optional loot fine |
| 7 | Construction sites supply new dep | census | held - only GameManager.ts:633; type-check green |
| 8 | No persistence/offline drift | seam check | held - notifications queue is transient, drained per tick; one toast per catch-up drain max |
| 9 | Locale keys resolve | cross-check | held - both keys present vi + en |
| 10 | Post-apply state honest | data origin | held - emit reads player.bodyProgression after investBodyChapterState mutated the real player |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|------------------------|--------|---------------------|
| `npm run type-check` | green | exit 0 |
| `npx vitest run src/core/game/` | 140 files / 999 pass / 4 expected-fail | full manager surface incl. bodyChapter + idleDrops suites |
| `npx vitest run src/core/game/LuyenTheGrowth.test.ts` | 5/5 | new regression suite |
| Headless repro (same harness) | realmLevel 1: bag 0->1, progress 0; realmLevel 2: progress 20/50 after 20 kills | real `BattleLootSystem.processDefeatedEnemies` + `tickOps.update` |
| Read of emit seam vs probe path | emit post-apply only | source inspection |

## Findings

None. No Confirmed, Suspected, or Coverage-gap finding remains open.

## New or Changed QA Tests

- `game/src/core/game/LuyenTheGrowth.test.ts` (new, 5 tests):
  kill->bag landing; realmLevel-1 gate (no toast - honest);
  realmLevel-2 conversion + `bodyRefinementInvested` params;
  tier-fill -> `bodyRefinementTierComplete` only; 20-kill pace ->
  exactly 20 growth toasts. Uses real GameManager/enemySystem/processDefeatedEnemies
  so it exercises the authority path, not a stub.

## Gaps and Residual Risk

- Browser-level toast rendering is covered only to the queue boundary
  (App.vue drain -> notification.push is pre-existing behavior shared
  with every loot toast); no new UI surface was added, so no P13/P14
  trigger.
- The realmLevel-1 gating window (~first 60 s of a fresh mortal,
  longer without auto-progression) is authored design and reported to
  the requester as a ruling question, not a defect.

## Pre-existing Failures

None observed in the affected scope (4 expected-fail tests in
src/core/game/ are pre-marked and unrelated).
