# 2026-10-05 — Reward channels: Minh rulings (insight cap / offline 50% / quest scale)

Baseline branch: `codex/hoa-cau-fireball-vfx` (pace retune landed).
Three independent rulings applied to reward-channel pacing; each is one
authored constant plus one wiring point.

## Authored constants

| Ruling | Constant | Value | Home |
|---|---|---|---|
| A — cap cảm ngộ auto-farm 1 ngày | `AUTO_FARM_DAILY_SKILL_INSIGHT_CAP_BY_REALM` | qi_refining 30,000 / foundation_establishment 40,000 (unlisted → `AUTO_FARM_DAILY_SKILL_INSIGHT_CAP_DEFAULT` 40,000) | `src/core/reward/SkillInsightBalance.ts` |
| B — offline 50% | `OFFLINE_EFFICIENCY` | 0.5 | `src/core/idle/GameClock.ts` |
| C — thưởng quest theo cảnh giới | `stoneCostRealmFactor` (reuse, no new constant) | ×1 mortal / ×8 qi_refining / ×50 foundation_establishment | `src/core/economy/EconomyRealmPace.ts` |

## RULING A — daily insight cap on the idle channel

Mechanism: `player.idleSkillInsightDaily: { dayBucket, minted }` (new
persisted field, optional + explicit-`undefined` key in
`createDefaultPlayer` + `!== undefined` shape validation — the repo's
migration-lite convention). `settleIdleSkillInsightMint()` lazily rolls
the UTC day-bucket (same `floor(ms / 24h)` convention as
`QuestSystem.dayBucket`) at mint time — no scheduler. The gate sits in
`BattleLootSystem.processDefeatedEnemies` exactly where insight lands,
and only when `channel === 'idle'` — so the same cycle roll covers both
online `tickAutoFarm` and `settleAutoFarmOffline`, while manual combat
(`channel === 'active'`) never reads `Date.now()` and stays unbounded.

Cap math (insight one max-autofarm day mints at the current 0.018 rate,
kills/day derived from the pace audit autofarm stones/h ÷ band stone
average):

| Band | Insight/kill (mastery roll × 0.018) | Kills/h (stones/h ÷ avg stones) | Mint/day | Cap |
|---|---|---|---|---|
| mortal | round(5–8 × .018) = 0 | ~1,300 | ~0 | (default 40k, non-binding) |
| qi_refining | round(35–45 × .018) = 1 | ~1,220 (12,208 ÷ 10) | ~29.3k | **30,000** |
| foundation_establishment | round(90–120 × .018) = 2 | ~770 (23,043 ÷ 30) | ~36.9k | **40,000** |

Before: unbounded — a permanently armed TC farm idled ~37k insight/day
against a ~40k-per-node tree (whole tree in ~1 day of pure idle).
After: the same farm mints at most its band's daily quota; kills past
the quota pay 0 insight until the next UTC day. Pins:
`SkillInsightBalance.test.ts` (clamp→0→rollover, band caps, stale-ledger
roll), `BattleLootSystem.idleInsight.test.ts` (idle capped / active
ungated / rollover through the real kill path), and the QI minted==4
counter pin in `GameManager.autoFarmOffline.test.ts`.

## RULING B — offline accrual at 50%

Mechanism: `settleAutoFarmOffline` multiplies the 24h-capped window by
`OFFLINE_EFFICIENCY` before flooring into reward cycles:

```ts
const elapsedMs = cappedElapsedSeconds * OFFLINE_EFFICIENCY * 1000
const completedCycles = Math.floor(elapsedMs / cycleMs)
```

Every channel the cycle mints (spiritStone / materials / equipment /
techniqueMastery / skillInsight) halves uniformly, because all of it
funnels through `rollAutoFarmCycleReward`. The re-anchor is now
unconditional (`now − effectiveRemainder`) — the unsettled remainder
also carries halved, and a 0-cycle or negative-elapsed settle can no
longer leave a stale anchor that the live tick would re-mint at full
rate. Online `tickAutoFarm` is untouched.

Before: 24h offline on a TC farm banked ~553k stones (~1.5× the TC
basket — the pace doc's own flag). After: the same offline window pays
~276k (~0.75×) and a max-day idle insight mint halves inside ruling A's
cap. Pins: `autoFarmOffline` re-pinned (120s→60s window, anchor math,
NaN elapsed guard, minted==4 exact-50% counter), `autoFarmAdversarial`
re-pinned (halved remainder, negative-elapsed re-anchor).

## RULING C — quest rewards scale by the quest's realm band

Mechanism: `scaleQuestRewardByRealm(reward, questRewardBandRealmId(quest, registry))`
in `QuestSystem.ts` — the canonical band source is the quest's own
`requiredRealmId` gate ("Gate theo canh gioi, giong Stage/Building
convention"). A quest without a realm gate still has an era through
the codebase's own progression convention: `unlocksAfterQuestId`
chain admission — `questRewardBandRealmId` walks the chain to the
nearest realm-gated ancestor (cycle-safe; an unchained/unresolvable
walk falls back to mortal). Concretely: `main_08`…`main_13` resolve
to the qi band via `main_07`'s gate, `main_15` resolves foundation
via `main_14`, and unchained ungated quests stay mortal.
Applied at `claim()` and at `betaScopeQuestDomain.rewardsFor` — one
helper + one resolver, preview ≡ payout (A9); the surface deps carry
`questRegistry` so the preview resolves the same chain.

Scaled: `spiritStone`, `cultivation` (both track era income/costs — a
TC quest paying ×50 ≈ 5,000 stone / 2,500 cultivation per flat
100/50 authored row). NOT scaled: `skillInsight` — `data/quest/quests.ts`
already re-anchored those values per era (QI 400–800 → TC 6k–40k ≈ the
same ×50 jump), so multiplying again would double-count; `itemDrops`
(material/pill counts stay authored counts).

Before: `kill_foundation_floor_10_boss_1` paid 800 stones vs a TC
farm's ~23k/h — decorative; `main_15` (foundation-era chain tail)
paid 200 flat. After: they pay 40,000 / 10,000 — real era-scale
rewards; qi-era chain members (`main_08`–`main_13`, herb/ore collect
rows) pay ×8. Pins: `QuestSystem.test.ts` realm-band block
(×1/×8/×50 claim payouts, chain-inherited band claim + resolver
contract + cycle-stop pins, insight unchanged, preview parity,
`scaleQuestRewardByRealm` unit pin).

## Verification

- `npm run type-check` — clean.
- `npx vitest run` (touched surfaces: game/reward/quest/idle/save/data + betaScopeQuestDomain) — 232 files / 2,258 tests green.
- Full `npx vitest run` — see latest run note in the report.

## Explicit non-changes

- `EnemyReward.skillInsight` per-enemy authored override honored first
  (unchanged; hidden-beast `skillInsight: 0` still blocks minting).
- Online auto-farm rate, technique-mastery accrual, quest `itemDrops`,
  mortal-equipment drop chances (sibling worker's scope).
