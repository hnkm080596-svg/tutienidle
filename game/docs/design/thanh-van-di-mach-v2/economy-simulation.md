# S0 — Economy simulation and feasibility bounds

Date 2026-10-14; baseline `c516dab9cb99403524b5806e84d675443b20b200`. Read with [source-proof.md](source-proof.md) and [release-blockers.md](release-blockers.md). This is an executed mathematical model of inspected source tables, not an executed fresh-account playthrough. No balance constants were changed. All times assume production level 1, one autonomous cycle per site, continuously running, no overflow, no tick delay, independent weighted outcomes, and collection realm fixed. Real unlock/combat/death/AFK gaps can increase them; site speed and talents can reduce them.

## Reward schedule check

`QuestSystem.scaleQuestRewardByRealm` and `questRewardBandRealmId` use quest/ancestor band with EconomyRealmPace factors 1/8/50. Currency/cultivation scale; insight and item quantities do not. Calculated from all 21 ACT rows:

| Act | Base stone | Effective stone | Base cultivation | Nominal effective cultivation | Insight | Pills |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| I | 170 | 170 | 390 | 390 | 0 | 0 |
| II | 270 | 2160 | 320 | 2560 | 6800 | 1 qi Tu Linh |
| III | 230 | 11500 | 250 | 12500 | 37000 | 0 |
| Total | 670 | **13830** | 960 | **15450** | **43800** | **1** |

These are the offered totals, not guaranteed wallet/landed cultivation. `CultivationSystem.addCultivation` caps at the current minor-level requirement, with talent-specific overflow bank/diversion; a late claim can land less cultivation. Item overflow may lose the pill. Achievement/daily/weekly are separate and excluded. V1 and V2 rewards must never both be budgeted as one character's progression schedule.

## Reproduced production model

Sources: `ProductionBalance.CYCLE_BASE_SECONDS_BY_REALM` = 100/300/900; `SITE_SPEED_MULTIPLIERS[0]=1`; low/middle/high tier weights 60:20:10 / 40:40:20 / 20:40:40; `ProductionSystem.rollRewards` caps by `PRODUCIBLE_REALM_TIER_LEAD=1`. Thus mortal weights become **60:20:0**, not 60/90 for mortal. Decade wood/ore chance is 50/100, yield 3. One correctly matched drop satisfies an acquire-3 leaf.

| Quest / source target | Probability per cycle | Expected cycles | Expected time | 95% completion bound |
| --- | ---: | ---: | ---: | ---: |
| Q01 mortal decade wood3, forest | (60/80)×0.5 = .375 | 2.667 | 266.67 s / 4.44 min | 7 cycles / 11.67 min |
| Q03 mortal decade ore3, mine | .375 | 2.667 | 266.67 s / 4.44 min | 7 cycles / 11.67 min |
| Q12 qi decade ore3, mine | .4×.5 = .2 | 5 | 1500 s / 25 min | 14 cycles / 70 min |
| Q15 foundation decade ore3, mine | .4×.5 = .2 | 5 | 4500 s / 75 min | 14 cycles / 210 min |

Formula: E[T]=cycleSeconds/p; geometric 95% cycles = ceil(log(.05)/log(1-p)). These are probabilistic bounds, not guarantees. Forest/mine/grotto operate in parallel; do not sum simultaneous waiting time as elapsed playtime. Higher-realm player still farming old mortal exact material at foundation collection speed has p=.2×.5=.1: expected 9000 seconds (150 min), 95% 29 cycles (435 min). Moving realm early can materially slow unfinished Q01/Q03.

Q09: admitted normal grotto families at QI are **Tu Linh, Hồi Linh, Khải Linh**; retired Hồi Xuân and other scope-hidden families are excluded. Special breakthrough recipes reuse Tu Linh herb and do not add new grotto identities. `HERB_AGE_WEIGHTS` sum **102**, decade=55; `GROTTO_HERB_AMOUNT=1`. Probability of exact QI Tu Linh decade herb per cycle = .4×(1/3)×(55/102) = **.0718954248**. Five fresh units require expected 69.545 cycles = **5.79545 h**. One unit mean = 4172.73 seconds. A herb batch alone does not mean the target herb dropped.

Executed on 2026-10-14 in the S0 worktree: PowerShell arithmetic read ProductionBalance cycle values; geometric/negative-binomial simulation used `System.Random(516)`, **10000 trials**, five independent geometric draws per trial, each times 300 seconds. Results: mean **5.809283 h**, median **5.416667 h**, p95 **10.5 h**, p99 **13.25 h**. This models Q09's exact-herb acquisition only. It does not run ProductionSystem's mulberry32 or prove offline/online parity.

Reproduction for the stochastic model (read-only; does not create an artifact):

```powershell
$rngS0 = [System.Random]::new(516)
$pS0 = 0.4 / 3 * 55 / 102
$samplesS0 = [System.Collections.Generic.List[double]]::new()
for ($trialS0 = 0; $trialS0 -lt 10000; $trialS0++) {
  $cyclesS0 = 0
  for ($leafS0 = 0; $leafS0 -lt 5; $leafS0++) {
    $cyclesS0 += [math]::Ceiling([math]::Log(1-$rngS0.NextDouble()) / [math]::Log(1-$pS0))
  }
  $samplesS0.Add($cyclesS0 * 300 / 3600)
}
$sortedS0 = @($samplesS0 | Sort-Object)
($samplesS0 | Measure-Object -Average).Average
$sortedS0[4999], $sortedS0[9499], $sortedS0[9899]
```

Offline cap is 10h (`PRODUCTION_OFFLINE_CAP_SECONDS`). The modeled Q09 p95 is already above one cap window. Save/reopen and repeated settle must not recount old rewards. Startup/current cycles, realm changes and upgrading mid-cycle retain start snapshots; this model assumes no retained legacy multi-cycle heads and does not assert hard wall-clock completion by 10h.

## Required sinks and forward funding

Actual source conversion `DecomposeSystem.outputFactors/stackOutputAmount`: floor(amount×(1+gradeIndex×.5)×2^ageIndex/6), separately per material stack. Mortal/QI/foundation decade factors = 1/1.5/2. Wood → bui_go; herb → luyen_dan_tinh_hoa; ore → luyen_khi_tinh_hoa. Do not spend quest progress a second time when converting retained acquire inputs. Rounding across different stacks is not pooled.

| Step | Minimum / source cost | Funding/feasibility consequence |
| --- | --- | --- |
| Q04 equip | No equip fee; stage mortal draw chance .15 plus family pool → any retained legal instance | For ordinary one-draw kill model, first gear mean 6.67 kills; p95 19 kills. Boss extra draws/family weighting/settings differ; this is illustrative, not a drop resolver test or guaranteed gear within Q01..03 kills. |
| Q05/Q06 body | BodyRefinement caps 50,175,615,2150,2500,8000; gates mortal2/4/6/8/10/12; source consumes available up to cap | Total finite **13490 pham essence**, not a per-realm reset. A commit can consume all 50 first-tier units. Defining commit as any positive investment makes first commit possible with one essence; defining it as complete tier changes cost/time drastically. Need explicit semantics. |
| Body essence | `PhysiqueEssence.PHYSIQUE_ESSENCE_BAND_DROPS`: .7 chance × uniform 1..3 = 1.4 expected units/draw | Mortal drops pham, QI bao, foundation phap. No cross-grade conversion to body_refinement's pham currency. Remaining pham must come from retained stock/mortal farming; full chapter cannot satisfy post-active event. |
| Q10 qi recipe | `alchemy_tu_linh_dan_qi_refining`: 2 same-age herbs +7 bui_go +3 luyen_dan_tinh_hoa +400 stone; base 870s | Five Q09 herbs can supply 2 primary herbs, but converting remaining 3 decade qi herbs yields 0 essence. To obtain 3 essence from one decade qi stack need **12 extra herbs**; 7 dust needs **28 qi decade wood**. Alternate higher ages/lower realm stacks reduce/change acquisition costs. Extra herb need is generic admitted herb, not necessarily Tu Linh. |
| Q10 success | Decade herb base chance 50%, before building/talent bonuses | Expected two attempts absent bonuses, no deterministic success guarantee. Each attempt reserves real inputs. Q08+Q09 pay only **360 stone**, below the 400 base fee; Q10's 240 reward cannot fund its own prerequisite. Prior retained Act I stone/loot or additional farming is necessary. |
| Q11 technique | Grade1:300 mastery for rank1; Grade2:600; ceiling requires in-band grade and realmLevel≥1 | QI stage mastery 35..45 per ordinary draw: at mean40, approximately8 eligible kills settled in victories for300; seven max45 draws suffice, while nine min35 draws suffice. Defeat kills do not pay buffered mastery. Foundation mean105: approximately6 eligible kills for600. Victory buffer/ceiling controls payout. Grade catch-up to2 costs200 stone and resets rank/mastery. |
| Q11 fire node | e.g. hoa_diem_uy legal basic node 600 insight for level1; element-root prerequisite | Q08+09+10 give1600 before Q11, enough for one600 purchase if not already spent. Different skill-core nodes use their own curve, not zero just because insightCost=0. Saturated build needs policy. |
| Q12 enhance | Slot0:2 luyen_khi_tinh_hoa +400 stone for QI band, before discount/talent; L1 success100% | Q12 ore3 is insufficient: floor(3×1.5/6)=0; decade qi stack **8 ore** yields2. Need five more if exactly3 acquired. Higher slot L costs2×(L+1) essence; stone catalog base remains400 before policy/discount. |
| Q16 pill | Foundation Tu Linh recipe:2 herbs +8 dust +4 alchemy essence +2500 stone;1262s base | Decade foundation stack equivalents:24 wood for8 dust,12 extra herbs for4 essence, plus2 primary herbs. Q15 pays800, insufficient to self-fund2500. Prior rewards/loot necessary; Q10's qi pill is wrong realm. Full cultivation can reject use, so require benefit headroom or another approved usable pill. |
| Q18 enhance | Slot0 foundation band:2 essence +2500 stone; fresh L1 success100% | Six decade foundation ore →2 essence. Q15/Q16/Q17 offered3000 stone together, but Q16 craft can already spend2500. All previous balances/costs must be modeled; fresh same-slot Q12 enhancement means next level requires4 essence and success96%. |
| Q19 two body commits | Must still have legal chapter progress and correct pham currency | No finite promised completion time for already complete state. Higher realm does not magically make bao/phap essence spendable in body_refinement. Two commits cannot be assumed possible by splitting UI input; ops spends available to tier cap. |
| Q20/Q21 formation | No verified live fresh-account route under current flags | Monetary totals cannot compensate for disabled domain; modeled completion is **unreachable at baseline**. |

Enhance source semantics: insufficient materials/money fails without spend; RNG `enhance_failed` spends ordinary cost and increments fail streak, with tenth failed streak making next attempt guaranteed. Slot cap100 prevents further success. A new quest receipt must count positive level change only and must not refund the owner's normal random-failure cost as a hidden balance redesign.

## Realm pace envelope

`realmSystem.getRequiredCultivation` uses (baseCultivationMinutes + level -1)×60×10 for these realms; current base minute tables = 1/70/550. Starting level1, reaching levelN sums levels1..N-1. Executed arithmetic:

| Attainment | Required baseline active cultivation minutes at10/s |
| --- | ---: |
| Mortal3 | 3 |
| Mortal8 | 28 |
| Mortal12 | 66 |
| QI12 | 825 / 13.75h |
| Foundation12 (comparison, not Q21 requirement) | 6105 /101.75h |

Nominal ActI390 cultivation offsets at most39 seconds at10/s; ActII2560 at most256 seconds; ActIII12500 at most1250 seconds. Talents, capped gains, manual advancement, initiation/tribulation and stage power change actual elapsed time. Production, body farming and cultivation can run concurrently; these totals are not an end-to-end duration estimate. Beta creation includes a -75% cultivation-speed talent, so10/s is not universal player pace.

## Feasibility verdict and missing simulation

**SOURCE-FEASIBLE but unqualified:** required enemy/stage/material IDs and normal recipe/equip/pill operations exist. **BLOCKED:** formation/companion release gates; full finite-body event obligations; unspecified V1 cutover and historical witnesses. **BALANCE DECISION:** exact-decade five-herb wait, early funding shortfall and extra conversion inputs have to fit the intended tutorial pace. Spec statement that quest rewards are smaller than accumulated loot is unproved: ActIII11500 stone / stage mean30 is approximately383 ordinary currency draws, before other reward layers; no measured whole-arc kill budget exists here.

Required S8 simulation remains PLANNED: real configured GameManager/registries, fresh and carried saves, all21 claims, full bag/zero material, failed craft/enhance and capped builds, early realm shifts, combat power and victory loss, two UTC weeks of recurring boards when implemented. Type-check/build/Vitest/Playwright were not run for this docs-only source model; this worktree has no game/node_modules. No estimated time above proves combat win viability, cloud compatibility, reward atomicity or QA fixed-point completion.
