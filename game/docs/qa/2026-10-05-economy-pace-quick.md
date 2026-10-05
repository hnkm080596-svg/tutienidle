# QA Quick Review — 2026-10-05 economy pace retune

Scope: currency/material pace retune on `devin/1791206331-economy-pace`
(stone costs scale by realm factor; autofarm cycle = perfectClearSeconds;
foundation realm-reward multiplier retired; ZT curve; tribulation fees).

## Risk map

changed-risk-map: domains = combat-and-tribulation + economy-and-progression
+ inventory-equipment; `deepAuditCandidate=true` (cross-system). Bounded by
inspection: every change is a constant/rate change inside one authority each —
no new transitions, no new writers, no persistence-shape or lifecycle change.
The only time-ownership-adjacent change (autofarm cycle seconds) is a rate
change on an existing bounded loop (DEFAULT_MAX_OFFLINE_SECONDS, cycle guard
unchanged). Unmapped paths are all test/lab files — reviewed as tests.

## Invariant ledger

| # | Invariant attacked | Result |
|---|---|---|
| 1 | Auto-farm mint bound: offline settle and online tick share `isValidCycleSeconds` guard + same `cycleSeconds*1000` math (learned defect QA-2026-09-13-002 — symmetric validation) | verified both sites identical; comments updated where stale (`/2` references) |
| 2 | Chu Thien step affordability: per-step cost must not exceed the phap essence stackLimit (1000) or late steps become unaffordable forever | **DEFECT FOUND & FIXED pre-report**: original retune (100+30s) made steps 31+ cost >1000 > bag max — repro via `GameManager.nghichChuTian` and `TrucCoJourney` failing; slope retuned to 25 (max step 975, total 19,350) |
| 3 | Cost authority: all stone costs flow through `stoneCostRealmFactor` or per-quality maps; no second source of truth | verified: enhance catalog -> `50*factor`; wash/refine -> quality maps (preview + commit read the same constant); site upgrade -> `factor`; alchemy -> `factor`; tu linh tran -> `factor` |
| 4 | Cost display/spend parity: `getWashCost`/`getRefineCost` preview equals the debited commit | verified: same map read at both sites (`EquipmentSystem.ts` vs `EquipmentRefine.ts:356`) |
| 5 | Reward scale consumers: `getRealmRewardMultiplier` x1 does not break enemy.realmId-stamped loot path or UI | sole consumer `BattleLootSystem.ts:318` (stones + techniqueMastery); no UI derives cycle time from perfectClearSeconds; stale comment fixed |
| 6 | Enhance cost fallback drift: template `enhanceSpiritStoneCost` (20 flat) bypasses catalog scaling | bounded: catalog covers all SUPPORTED_PROFESSION_REALMS (mortal/qi/foundation); template path dead in beta. LOW — if a new realm id reaches enhance without catalog support it pays 20 flat (pre-existing shape) |
| 7 | Tribulation retry hurt-not-lock: stone loss drains min(bag, loss); defeat requires no purchase | verified via `TribulationOutcomeSettlement`/`tribulationRouting` tests — bag drains to 0, settlement still commits cultivation loss, retry never gated by stones |
| 8 | Quest/vendor prices unchanged — sinks can't be bypassed cheaply | vendor table untouched; quest rewards static (negligible vs farm income either way) |

## Escalation check

`deepAuditCandidate` + economy + offline-accrual triggers technically map to
deep escalation. Bounded reason: all edits are constant/rate changes inside
existing single-writer loops; no new transition/persistence/lifecycle; the
offline-cap asymmetry is recorded as a structural flag (below) rather than
redesigned per task orders. If the coordinator disagrees, escalate before
the P5 sequence.

## Findings

- FIXED: ZT step cost exceeded essence stackLimit (steps 31-36 unaffordable)
  — slope 30→25, max step 975, total 19,350 (was 3,690).
- FIXED: stale comments claiming `perfectClearSeconds/2` in
  GameManagerAutoFarmOps + BattleLootSystem.
- LOW (pre-existing): `enhanceSpiritStoneCost=20` template fallback is
  unscaled — dead in beta, drifts if a future realm skips the catalog.
- LOW (pre-existing): `TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_FALLBACK=2000`
  prices mortal/post-beta realm defeats at 2000 ha stones — harsh at mortal
  income (~1.6k/h) but unchanged by this retune and "hurt" by design.

## Structural flags (for Minh — not redesigned per task)

1. `DEFAULT_MAX_OFFLINE_SECONDS=24h` applies to autofarm: one idle day banks
   ~553k TC stones > the entire TC basket (~370k). Online-vs-offline parity
   is intact — the question is whether offline should pay less than online.
2. `getSpiritStoneMaterialIdForEnhanceLevel` requires trung stones at
   enhance ≥30 — no beta source → effective cap +29.
3. `signatureDrops` with chance<1 never mint on the idle channel →
   yeu_dan/TC-era pill materials are live-play only.
4. Quest rewards are flat one-shots vs hourly farm income — decorative
   as a sink at current scale.

## Evidence

- `npm run type-check` — green.
- `npx vitest run` (full) — 947 files / 8860 tests, all green (post-fix).
- `.audit-out/economy-pace.json` — BEFORE/AFTER incomes + baskets.
- `tests/architecture/` + `tests/lab/economyPaceAudit.test.ts` pass.

Operation label: **PASS WITH GAPS** (structural items flagged, one defect
fixed inside the task boundary).
