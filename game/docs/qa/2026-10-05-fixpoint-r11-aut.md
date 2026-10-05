# Fixpoint r11 — AUT (authority / ownership / single-source-of-truth) audit

- Date: 2026-10-05
- Target: branch `codex/hoa-cau-fireball-vfx` pinned at `5805d962` (aggregate state, real code only)
- Facet: authority, ownership, duplicated sources of truth, state mutated outside owning system, bypassed domain APIs, parallel validators that disagree, duplicated business rules, responsibility in the wrong layer, ambiguous contracts, two writers for one field.
- Write boundary respected: docs + QA evidence pin only (`tests/architecture/fixpointR11AutEvidence.qa.test.ts`); no production edits, no fixes.

## Delta vs r10 (`e4df599c` → `5805d962`)

The r10 adjudicated commit resolves all six r10 findings as claimed; verified
against real code, not the commit message:

| r10 finding | Fix verified at |
|---|---|
| F-AUT-1 `elapsedOfflineSeconds` bypass | legacy branch now routes through `calculateOfflineTime` (`GameManagerSaveRestore.ts:380-383`); see R11-AUT-3 for the cold-boot residual |
| F-AUT-2 two private day-bucket rules | `utcDayBucket` exported from `GameClock.ts:64`; `QuestSystem.dayBucket` delegates (`QuestSystem.ts:223-224`); `SkillInsightBalance` ledger delegates (`SkillInsightBalance.ts:76`) |
| F-AUT-3 `EnemyReward.skillInsight` dead field | field gone from `EnemyReward`; `getSkillInsightReward` is mastery-derived only (`SkillInsightBalance.ts:30-32`) |
| F-AUT-4 offline-efficiency name | renamed `AUTO_FARM_OFFLINE_EFFICIENCY` (`GameClock.ts:57`), sole consumer `GameManagerAutoFarmOps.ts:257` |
| F-AUT-5 fail-open clamps | `poolMissWeight` throws on `!(>=0 && <=1)` (`resolveDrops.ts:111-134`); `applyFloorStatScale` throws on `!(scale > 0)` (`EnemyStatInput.ts:347-352`); `itemQualityCeilingForFloor` throws on non-finite floor (`ItemQualityBalance.ts:115-118`) |
| F-AUT-6 future-dated `lastCheckedMs` | `tickAutoFarm` re-anchors `> now` (`GameManagerAutoFarmOps.ts:311-315`) |

## Verdict

PASS WITH EVIDENCE — 0 Critical / 0 High / 0 Medium / 2 Low / 3 Nit.

All five attack lines resolve to a single live class: one persisted
wall-clock marker family now has three defenses (writer-bound validation,
runtime re-anchor, settle-time normalization), and exactly one member —
`quests.lastDailyResetAtMs` — still has none. The daily cadence it gates is
scope-hidden (`BETA_FEATURES.dailyQuest === false`), which is what keeps the
finding at Low instead of Medium.

## Findings

### R11-AUT-1 — forged future `lastDailyResetAtMs` freezes the daily board — Low (EXECUTED)

- `src/core/quest/QuestManager.ts:181-184` (restore preserves finite ≥0 unchanged)
- `src/services/save/saveShapeValidation.ts:3129` (`isNonNegativeFiniteNumber` only)
- `src/core/quest/QuestSystem.ts:470-488` (gate `dayBucket(now) <= dayBucket(marker)`)
- Evidence: `tests/architecture/fixpointR11AutEvidence.qa.test.ts` — 2/2 green

Mechanism: `resetDaily` (`QuestManager.ts:134-140`) is the sole honest writer
and the reader contract is "marker = last reset instant". A crafted save with
`lastDailyResetAtMs = now + 365d` passes shape validation and restore
normalization untouched; the reset gate then compares day buckets —
`dayBucket(now) <= dayBucket(marker)` holds for every reachable `now`, so
`checkAndResetDaily` returns false forever and unclaimed daily progress never
rolls.

This is the same defect class the r10 commit fixed on the sibling marker
`autoFarmStage.lastCheckedMs` (future-dated → re-anchor at tick) and that
`tribulation.cooldownUntil` covers at the validation seam (F-LC-1:
deadline > `saveClock + COOLDOWN` rejected, `saveShapeValidation.ts:4371-4389`).
`lastDailyResetAtMs` has neither a writer bound nor a runtime re-anchor.

Why Low, not Medium: the cadence is dormant in beta
(`betaFeatureFlags.ts:42` — `dailyQuest: false`), so the frozen board is
unreachable in the shipped scope today; the flag flips by config, not code,
which is exactly when this becomes reachable. Repro executed with the scope
mock enabled (same convention as `QuestSystem.lifecycle.test.ts`).

### R11-AUT-2 — stale-PAST `lastCheckedMs` still mints the same window at live rate — Low (residual, pinned)

- `src/core/game/GameManagerAutoFarmOps.ts:311-323` (guard covers `!finite`/`<0`/`>now`; stale-past passes, then `Math.min(now - lastCheckedMs, 24h)` mints at 100%)
- `src/core/game/GameManagerAutoFarmOps.ts:257` (offline settle pays the same window at `AUTO_FARM_OFFLINE_EFFICIENCY = 0.5`)
- `src/services/save/saveShapeValidation.ts:2290-2293` (validation comment documents the 24h clamp as the accepted bound)
- Existing pin: `tests/architecture/fixpointR10IntEvidence.qa.test.ts:131-149` (INT-04) still green — stale marker mints 864 cycles / 1728 insight live vs 432 at settle rate.

r10 closed only the future-dated direction. The two settle paths for the
identical input still disagree on the rate: a persisted
`lastCheckedMs = now − 24h` with a fresh `lastSavedAt` (elapsed < 60 s gate,
`GameManagerSaveRestore.ts:392`) skips `settleAutoFarmOffline` entirely and
the next `tickAutoFarm` pays the full window at live rate — double the
efficiency the same wall-clock window earns through settle. Bounded by the
24h clamp (documented as the accepted mitigation), so Low.

### R11-AUT-3 — cold-boot elapsed still computed inline in SaveRestore — Nit (migration residual)

- `src/core/game/GameManagerSaveRestore.ts:379` — `Math.max(0, (timeAuthority.untilMs - timeAuthority.sinceMs) / 1000)`
- `src/stores/player.ts:277-280` — the other cold-boot consumer routes through `calculateOfflineTime`

r10 moved the legacy branch onto `calculateOfflineTime` but left the
cold-boot branch inline, so the "single source" comment at :374 owns one of
two sites. It is reachable through the helper —
`calculateOfflineTime({lastOnlineAt: sinceMs}, untilMs, Infinity)` is
semantically identical (uncapped server window, `max(0,·)` via the
currentTime clamp) — and `player.ts` already proves the helper handles this
shape (with its own deliberate 24h channel cap). Semantic equivalence today;
drift risk only. Nit.

### R11-AUT-4 — `itemQualityCeilingForFloor` terminal fallback unreachable — Nit

- `src/core/equipment/ItemQualityBalance.ts:110-128`

The last band is `maxFloor: Infinity → 'tien'` (:126), so the trailing
`return 'tien'` (:127) can never execute. Harmless — the new non-finite throw
at :115-118 makes the bands total — but it is a dead defensive line that now
implies a gap that cannot exist.

### R11-AUT-5 — `drawFromPool` fail-open fallback vs the new fail-closed rule — Nit (latent)

- `src/core/drop/resolveDrops.ts:74-100` — on non-finite `totalWeight`/`missWeight` the fallback `missWeight > 0 ? undefined : pool[pool.length - 1]` (:99) silently pays the last pool entry
- `src/core/drop/resolveDrops.ts:111-134` — `poolMissWeight` now throws on the same input class

r10 made the *validator* fail closed on corrupt weights while the *draw*
still fails open in the opposite direction on the same input class. Latent:
authored weights are literals, so no reachable caller produces NaN today —
only a future computed weight could. Direction asymmetry (one surface throws,
the other silently grants) is the ownership smell; Nit.

## Attack-surface verdicts

1. **Third day-bucket site** — none. `rg` for `86400000` / `MS_PER_DAY` /
   `24 * 60 * 60` across `src/`: all day-index computation delegates to
   `utcDayBucket` (`GameClock.ts:64`). Remaining `* 1000`/`/ 1000` sites are
   unit conversion, not bucketing. CLEAN.
2. **`idleSkillInsightDaily` writer ownership** — sole mutator is
   `settleIdleSkillInsightMint` (`SkillInsightBalance.ts:70-91`, `??=` +
   `minted +=`); the `!==` day-bucket roll self-heals forged bucket values.
   Validation is shape-only (`saveShapeValidation.ts:2321-2345`). No bypass.
   CLEAN.
3. **`lastCheckedMs` writers** — four sites, consistent contract
   ("anchor = now − unsettled remainder"): `startAutoFarm` :111 (arm),
   `settleAutoFarmOffline` :272 (always re-anchors, elapsed-0 included),
   `tickAutoFarm` :315 (corrupt-guard reset `!finite|<0|>now`) + :344
   (advance). `reconcileAutoFarmRuntime` correctly touches only the lease.
   GAP: stale-past accepted → R11-AUT-2.
4. **`calculateOfflineTime` semantic diff** — legacy swap is
   semantics-preserving: future-dated `lastSavedAt` → `currentTime =
   max(lastOnlineAt, timestamp)` → elapsed 0 both ways; NaN propagates
   identically (`Math.max(NaN,·)`). `lastSavedAt` is required-finite in
   validation (:2215-2218), so the `?? Date.now()` asymmetry vs
   `player.ts:284` is dead code, not a divergence. Cold-boot residual →
   R11-AUT-3. CLEAN otherwise.
5. **Quest daily reset contract** — reader `checkAndResetDaily` /
   writer `resetDaily` agree on "marker = last reset instant"; restore
   normalization + validation accept future-dated values the gate cannot
   recover from → R11-AUT-1.

## Verified clean (audited, no defect)

- `getSkillInsightReward` (`SkillInsightBalance.ts:30-32`) is mastery-derived
  only; the dead `EnemyReward.skillInsight` field is gone and
  `BattleLootSystem.ts:345-368` gates the ledger mint on `channel === 'idle'`
  before crediting `player.skillInsight` — single ownership chain.
- `AUTO_FARM_OFFLINE_EFFICIENCY` has exactly one reader
  (`GameManagerAutoFarmOps.ts:257`).
- `utcDayBucket` is the only day-index convention; both prior private copies
  delegate.
- `reconcileAutoFarmRuntime` (`:140-194`) is lease-only — eligibility,
  lease release/acquire, no marker writes; the marker contract stays with
  settle/tick.
- `persistentTimedEffects` deadline fields are writer-bound at validation
  (`:811-812`, `:1484-1489` vs `lastSavedAt`) — the sibling surfaces with
  future-dated markers are already defended, which is what makes
  R11-AUT-1 a gap rather than a pattern.
- `tribulation.cooldownUntil` writer-bound validation (`:4365-4389`) — same
  class, already defended.

## Verification executed

- `npx vitest run tests/architecture/fixpointR11AutEvidence.qa.test.ts` —
  2/2 (forged marker frozen + past-marker control).
- `npx vitest run` scoped: idle/quest/reward/drop/equipment/save/data —
  70 files / 1226 tests green; `src/core/game` + `tests/` — 142 files /
  1013 tests, 4 expected-fail (pre-pinned INT evidence).
- `npm run type-check` — clean.
