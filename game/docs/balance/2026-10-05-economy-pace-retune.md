# 2026-10-05 — Economy pace retune (currency & material flows)

Baseline branch: `codex/hoa-cau-fireball-vfx` + pace-floor retune
(Luyen Khi ~1 day, Truc Co ~1 week cultivation).
Instrument: `tests/lab/economyPaceAudit.test.ts` → `.audit-out/economy-pace.json`
(headless earlygame sim, real stage clears + authored costs).

## Directive

Progression must not be maxable in a few sessions. Currencies must be a
real constraint: funding per-floor upgrade thresholds = hours at Luyen
Khi, days at Truc Co — not one session. Tribulation retry must hurt but
not soft-lock. Numbers-only tuning; structural gaps are flagged, not
redesigned.

## BEFORE (measured on codex tip)

| Realm | Manual stones/h | Autofarm stones/h | Spring/h | Basket (stones) | Time-to-fund |
|---|---|---|---|---|---|
| mortal | ~1,572 | ~5,064 | 127 | ~11k | ~2h |
| qi_refining | ~8,581 | ~28,999 | 858 | ~61k | ~2.3h |
| foundation_establishment | ~42,314 | ~159,772 | 3,005 | ~62k | ~25min |

Root causes found:
- Autofarm minted a full stage loot roll every `perfectClearSeconds/2`
  — idle income ran at 2x live clear rate.
- `getRealmRewardMultiplier` paid foundation drops at x3 while the
  foundation drop band was already authored ~x3 the qi band
  (double-counted).
- Nearly every stone cost was flat or `2^tier` — far below income.

## AFTER (this change)

| Realm | Manual stones/h | Autofarm stones/h | Spring/h | Basket (stones) | Time-to-fund |
|---|---|---|---|---|---|
| mortal | ~1,642 | ~2,599 | 127 | ~11k | ~2-4h (tutorial ok) |
| qi_refining | ~7,058 | ~12,208 | 858 | ~199k | ~16h autofarm |
| foundation_establishment | ~12,305 | ~23,043 | 3,005 | ~370k | ~16-30h (~1-2 days) |

The LK basket includes the full 93-pill meridian grind (139.5k stones +
93 yeu_dan live-only + 279 herbs) and a deep wash/refine 30+30 basket;
the TC basket adds site L3 (33k) and dia-tier wash/refine (165k). These
are end-of-era sinks — per-floor thresholds sit at a fraction of each
basket, so a floor's upgrade check now costs hours (LK) / a day+ (TC).

## Changes

Income-side:
- `GameManagerAutoFarmOps`: autofarm cycle = `perfectClearSeconds` (was
  /2). Idle now mints at live clear rate, not 2x.
- `RealmRewardScale`: realmIndex <= 2 pays x1; above-foundation realms
  keep 3^(index-2). The foundation band's own ~x3 values now carry the
  era jump alone.

Cost-side (all linh thach unless noted):
- `EconomyRealmPace.ts` (new): `stoneCostRealmFactor` = tier{1:1, 2:8,
  3:50}, >3 = 50*3^(tier-3). Single authority for per-era stone cost
  scaling.
- `EquipmentOperationCostCatalog` (enhance ore/attempt fee): 50 ->
  50*factor (LK 400 / TC 2,500 per attempt).
- `RefinementBalance`: wash 100 -> by-quality {100,600,1500,4000,8000};
  refine unit 50 -> {50,300,800,2000,4000}. Quality keys track era
  income without plumbing realmId through the ops signatures.
- `alchemyRecipes`: 50*2^tier -> 50*factor; thong_mach_dan 500->1500;
  truc_co_dan 1000->5000.
- `ProductionCatalog` site upgrades: 100*2.2^level * factor (L2 = 800,
  L3 = 11,000 at qi; TC sites scale by factor 50).
- `TuLinhTranBalance`: realm growth x2 tier -> factor (qi 400/600/900,
  tc 2500/3750/5625 per stack).
- `TribulationChapters` defeat stone loss: qi 50->250, foundation
  200->1000. Cultivation bar loss unchanged — retry still hurts, can't
  soft-lock (loss clamps at bag contents).
- `ZhouTian` step cost: 15+5s -> 100+25s (total 3,690 -> 19,350 phap
  essence). Per-step max 975 stays under the essence stackLimit (1000) —
  a steeper curve would make late steps physically unaffordable.

Deliberately untouched:
- Vendor prices, quest rewards (small vs farm income — flagged).
- Technique grade costs (mastery-gated, not stones).
- Linh Tuyen spring yield (already ~3-8% of income) and
  PRODUCTION_OFFLINE_CAP_SECONDS (10h).
- Mortal-era costs (tutorial stays light).

## Structural flags for Minh (not redesigned)

1. Autofarm offline cap = 24h (`DEFAULT_MAX_OFFLINE_SECONDS`): one idle
   day banks ~553k TC stones > one full era basket (~370k). The TC gate
   is ~1 week of cultivation, but a single offline session can skip a
   floor's material grind entirely. Options: lower cap for autofarm,
   or scale offline payout by era — needs a product decision.
2. `getSpiritStoneMaterialIdForEnhanceLevel`: enhance >=30 needs trung
   stones, which have NO beta source — effective enhance cap = +29 in
   beta regardless of numbers.
3. Yeu dan / TC-era signature materials never drop via autofarm (idle
   channel skips chance<1 signatureDrops) — pill grind is live-only.
   Good for pace, but confirm intent: TC pills can't be farmed offline
   at all.
4. Quest rewards flat vs farm income — negligible sink/source either
   way at these scales.
