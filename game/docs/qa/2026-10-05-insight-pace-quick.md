# Adversarial QA — insight-pace retune (quick)

- Scope: `SkillInsightBalance.ts`, `SkillCoreLevel.ts`, `data/progression/{PhapTuNodes.builders,PhapTuBasicNodes,KiemTuNodes,TheTuNodes,TheTuAnNodes}.ts`, `data/quest/quests.ts` + pinned tests.
- Change class: numbers-only retune (mint rate 0.18 -> 0.018; node/core/quest prices re-anchored per realm window).
- Mapper: domains=[economy-and-progression], oneHop=[UI affordability, save/offline progression], deepAuditCandidate=false, unmappedPaths=[].
- Domain packs: economy-and-progression. save-and-cloud consulted for the refund hypothesis below.

## Invariant ledger

| ID | Hypothesis | Check | Result |
| --- | --- | --- | --- |
| INV-IP-1 | Node prices: every level affordable-path mints a finite, non-negative cost; purchase/upgrade/refund read ONE cost source | `getNextLevelCost` is the single read path for charge/UI/refund; probe dumped all 75 non-granted nodes — all totals finite, flat per-level pricing verified (600/L5=3000, 40k/L4=160000) | No defect |
| INV-IP-2 | Window split: nodes reachable in QI are QI-priced, nodes behind realm:foundation are TC-priced | Full node dump: every >=40k-priced node carries `realm:foundation_establishment` directly or via parent chain; no QI-reachable node is TC-priced and vice versa | No defect |
| INV-IP-3 | Quest `skillInsight` rewards land via RewardSystem | `RewardSystem` handles `reward.skillInsight` -> player.skillInsight; quest tests + journey sim green | No defect |
| INV-IP-4 | Respec/refund symmetry | `computeNodeRefund` = sum(getNextLevelCost) - nodeFreePurchaseRecord; symmetric within a build. Cross-BUILD: saves that bought nodes at OLD prices refund at NEW prices -> one-time insight windfall via the normal respec button | CONFIRMED (source proof) — structural, flagged to Minh, not fixable numbers-only |
| INV-IP-5 | Insight mint path survives 0.018 | Insight mints off the realm band's drop-table techniqueMastery roll (mortal 5-8 -> 0, QI 35-45 -> ~1, TC 90-120 x3 -> ~5-6), NOT off `EnemyReward.skillInsight` — that optional field is never read in production (pre-existing dead field) | CONFIRMED dead-field (pre-existing structural gap) — flagged |
| INV-IP-6 | Repeat purchase / cap / duplicate | NodeSystem tests green (dedup purchase, max level, failed-mutation leaves state) | No defect |
| INV-IP-7 | `perLevel:5` upgradeCost stays flat for all authored maxLevels (max L5) | Node dump: L5=5x600/5x40k, L4=4x, L3=3x — all flat; perLevel>=maxLevel invariant holds for every edited node | No defect |
| INV-IP-8 | Offline/idle accrual | Income channel unchanged mechanically (auto-farm mints band roll x rate per cycle incl. offline) — magnitude reduced ~x10 by the constant, same ownership | No defect; unbounded offline mint remains a flagged structural property |

## Findings

- **F1 (Confirmed, source proof, Medium, structural-flagged)**: `computeNodeRefund` repays at live prices. Pre-patch saves that bought the tree at old totals (e.g. ~30-150/node) will refund at the new totals (600-200k/node) on first respec — a one-time insight windfall reaching the normal respec flow. Direction provable in `NodeSystem.ts:515-532` (refund = recompute, `nodeFreePurchaseRecord` only tracks waived grants, no paid-price memory). Not fixable by number tuning: ANY price raise has this delta. Options for Minh: accept one-time windfall, store paid price on purchase, or zero out `nodeLevels` insight-bearing nodes on migration.
- **F2 (Confirmed, pre-existing, Low, flagged)**: `EnemyReward.skillInsight` optional override is dead in production — `BattleLootSystem` calls `getSkillInsightReward` on a constructed `{spiritStone, techniqueMastery}` object that never carries `skillInsight`. Data authors setting it per-enemy get silence. Pre-dates this diff.
- **F3 (Structural observation, flagged)**: auto-farm idle insight mints the full stage kill-reward every half-clear cycle online AND offline (24h cap) — income is unbounded by design; the x10 rate cut bounds the slope but not the mechanism.

## Verdict

PASS WITH GAPS — no repairable defect inside the retuned constants; F1/F2/F3 are flagged structural findings, not in-diff regressions. P5 sequential passes still required before done.
