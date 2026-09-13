# QA — Talent Catalog v4 M3 (production talents)

Date: 2026-09-14 · Branch: `feat/talent-m3` · Mode: quick (deep-audit candidate,
bounded by review + full-suite evidence)

## Scope

`hoa_hau_thong_than` (alchemy ×2 yield / +50% potency / ×2 fuel+stone) and
`bach_luyen_thanh_khi` (enhance never fails / ×3 materials+stone), plus §4.4
retired-id catalog cleanup. Touched: `Talent.ts`, `TalentEffects.ts`,
`Talents.ts`, `AlchemySystem`, `PillSystem`, `EquipmentSystem`,
`EquipmentOpsSystem`, `GameManagerAlchemyOps`, `GameManagerPillOps`,
`GameManagerTickOps`, `GameManagerSaveRestore`, `AlchemyView.vue`, docs.

## Verdict: PASS WITH EVIDENCE

## Evidence

- `vue-tsc --build` clean.
- Focused scope (talent/alchemy/equipment/pill/wiring): 6 files / 102 tests green.
- Touched-system regression: 120 files / 852 tests green (pre-review-fix baseline;
  post-fix re-run below).
- TDD: RED observed for all new tests before implementation.

## Checks performed

| Check | Result |
|---|---|
| Atomic reserve — scaled cost validated before ANY `bag.remove` | OK — `missing_fuel_wood`/`missing_spirit_stone` tests prove nothing deducted |
| Check-vs-deduct single formula | OK — `startJob` returns `spiritStoneCost`; ops deducts exactly the validated amount (review Minor #3 fixed) |
| Preview/spend parity — enhance | OK — `getEnhanceCost`/`getEnhanceSpiritStoneCost`/`enhance()` share `resolveEnhanceCost` → `applyEnhanceCostPolicy` |
| Preview/spend parity — alchemy | FIXED — review Important #1: `AlchemyView` showed base cost/yield while charging ×2. `previewAlchemyOutcome` now takes `player`, returns scaled `fuelWoodAmount`/`spiritStoneCost`/`guaranteedPills`/`extraPillYield`; view consumes them. Covered by `AlchemySystem — preview với Hoa Hau` tests |
| Online/offline settle parity | OK — `GameManagerTickOps` + `GameManagerSaveRestore` both forward `yieldMultiplier` |
| Enhance policy lifecycle | OK — `EquipmentOpsSystem` syncs policy from `getActivePlayer()` in all 3 entry points (enhanceSlot, getEnhanceCost, getEnhanceSpiritStoneCost); policy cleared when talent absent (`setEnhancePolicy` test) |
| One-talent rule | OK — both getters via `collectTalentEffects` (first id only); second-id non-activation tested |
| Retired ids | OK — `RETIRED_V4_TALENTS`/`M2_PENDING_TALENTS` removed; `getTalentDefinition` → undefined; `CharacterPanel` filters undefined; `collectTalentEffects` yields nothing; old saves safe |
| Multiplier bounds | OK — `costMultiplier` clamped ≥1 (`startJob`, `setEnhancePolicy` precedent), `pillYieldMultiplier` clamped ≥0 |
| Herb/specials NOT scaled | OK — spec-explicit; only fuel wood + spirit stone scaled |
| Indivisible grants not scaled | OK — `random_main_stat` +1 unchanged; `skill_insight` rounds (×1.5 of 10 → 15, tested) |
| Dead plumbing | OK — `alchemy_success_bonus` kind + `getAlchemySuccessBonusPercentPoints` + call-site args removed (last producer `dan_duyen` retired); `successBonusPercentPoints` stays as AlchemySystem's tested capability |

## Recorded spec deviations / notes

1. **Pill potency applies to ALL profession pills consumed, not only self-crafted.**
   Spec §4.2 says "đan do chính mình luyện"; `PillBag` has no provenance tracking
   (pills also arrive via battle loot, quest rewards, save restore). Provenance
   would need a PillBag schema + save change — judged out of scope for dev phase.
   Shipped description was deliberately worded "đan ngươi dùng" so the
   player-facing text matches actual behavior (no lie). Revisit if provenance
   tracking is ever added to `PillBag`.
2. **Yield reads live talent at settle; cost was snapshotted at job start.** A
   job started without the talent settles at ×2 — reachable only via save edit
   (talents are lifetime-permanent by design §3.2). Acceptable.
3. **`previewAlchemyOutcome(player?)` is optional** — callers that don't pass a
   player get the unscaled base view (used by tests/non-player previews).
4. Online-tick yield at GameManager level is covered at the unit seam
   (`AlchemySystem.tick` + `GameManagerTickOps` forwards); no GameManager-level
   tick integration test for the double (offline settle covered).

## Balance note (manual — balance-check subagent unavailable)

- Hỏa Hầu: ×2 output for ×2 fuel+stone — net-positive ONLY via pill potency
  (+50%) and time efficiency (same duration, double pills). Herb is NOT scaled,
  so the real gain is herb-per-pill efficiency: the talent halves herb cost per
  pill while doubling fuel/stone per batch. Reasonable vs ~20-30% power budget
  since it only pays off if the player runs the alchemy loop.
- Bách Luyện: deterministic ×3 vs baseline E[attempts] curve — guardrail test
  asserts baseline E ≥ 1 and < 3 at early high-rate levels (talent pays a
  premium there) and never exceeds pity cap. At low-rate deep levels (rate →
  pity-bound ~11 attempts), ×3 is cheaper in expectation — intended spec payoff
  ("chắc chắn thì trả giá đắt" inverts at high levels; spec §8 accepts this).
