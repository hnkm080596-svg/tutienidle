# Stat-wall ladder retune (beta floors, 2026-10-05)

Minh directive (verbatim): "moi stage can the hien ro gia tri cua minh,
can farm do + nang cap o mot muc nhat dinh de qua, khong the chi hon
nhau mot chut duoc" + "Kho la tot, kho moi can idle".

## Mechanism (new)

`Stage.statScale` + `ChapterConfig.floorStatScales[10]` - a per-floor
hp/might/defense/accuracy multiplier applied at spawn in
`StageWaveSystem.pickEnemyForSpawn` (via `applyFloorStatScale` in
`EnemyStatInput.ts`), AFTER tag transforms and `applyBossMultiplier`.
So a floor-10 king spawns at `bossMult x statScale`. Same-species
roster stays intact (BETA SCOPE LOCK v3) - deeper floors are the same
species' stronger specimens, not new ids. `undefined`/1 = authored
template stats. Evasion and attackSpeed intentionally unscaled.

BalanceMatrix fingerprints are untouched: benchmark encounters use a
synthetic stage with no statScale.

## Before (measured, seed 20261005, pinned profile hap_linh/tram/fire)

Organic climb: each floor attempted once, then farmed the previous
floor for drops + enhance until it won or hit 30 farm runs.

- Mortal: dong_2..10 free-clear for a bare-ish player (walls only at
  d1/d6 due to count, d10 boss). Chapter climbed in ~13 farm runs.
- Qi: real entry wall (forest ~16 farm runs) but no ladder afterward.
- Foundation: entry was sim-impossible - the band drop table paid
  qi_refining ore while enhance costs resolve by PLAYER realm (dead
  material), and the naked entrant could not reach the qi boss farm
  floor.

## After - ladders + measured farm runs to clear each floor

Mortal  `floorStatScales: [1.0, 1.0, 1.3, 1.55, 1.85, 2.15, 2.45, 2.8, 3.2, 3.6]`
  d1=1f  d2=0  d3=0*  d4=0  d5=0  d6=1f  d7=0  d8=0  d9=0  d10=11f
  (*bare-stats check: dong_3 is a hard wall - 3/3 defeats with zero
  equipment; floors 1-2 stay the gentle tutorial handoff.)

Qi      `floorStatScales: [1.0, 1.2, 1.4, 1.6, 1.85, 2.05, 2.25, 2.45, 2.5, 2.85]`
  f1=16f f2=0  f3=0   f4=4f  f5=12f f6=0  f7=21f f8=11f f9=2-20f f10=0-30f
  Entry wall preserved; mid-ladder walls at f4/f5/f7/f8; abyssal_pool
  boss swings 0-30f by drop luck - deep wall, beatable (BetaJourney
  dia+8 curated clears it).

Found.  `floorStatScales: [1.0, 1.05, 1.05, 1.1, 1.15, 1.25, 1.4, 1.55, 1.7, 1.95]`
  f1=15f f2=12f f3=12f f4~30f f5=5-8f f6=0 f7~30f f8=26f f9=12f f10=0f
  Entry + mid walls throughout; f10 king also falls to the f9 grind
  overshoot - boss still the floor's hardest engagement.

"Free" (0 farm runs) entries = floor won with the gear the previous
grind produced - variance from drop rolls; the band is wide by design.

## Drop-table fix (bug, not difficulty)

`StageDropTables` foundation band material entry paid
`qi_refining_ore_decade`; enhance costs resolve by the PLAYER's realm,
so a foundation player could never spend it - literally impossible
walls. Now pays `foundation_establishment_ore_decade` (w15).

## Sim-script retunes caused by the new walls (journey budgets)

- `EarlyGameLoop` canonical mortal chain: growth_cycle 5->8/10 runs,
  stage_until maxAttempts 8->10/12, qi forest 10->16. Same script,
  deeper grind - fresh linh_bao still reaches qi_refining_forest
  victory (failedAt null).
- `TrucCoJourney` leg before foundation_floor_10: real-player wall
  response now includes 8x floor_9 re-farms + slot enhance attempts
  (the new king at 1.95x boss-scale would have gated the old
  equip+alloc-only budget).
- `ElementBossMatrix` builds bumped dia+5/+8 -> dia+20 + full earned
  attribute pool (the maxed intended-point build) + technique r3g2.

## Pinned regression coverage

`StatWall.test.ts` (new): spawn stamping pins (dong_3 normal = 78hp /
7.8 might; dong_10 king = 390*3.6*7 hp / 216 might; registry template
unscaled) + bare-stats walls (naked mortal loses dong_3 3/3; naked qi
entrant loses qi_refining_forest). BetaJourney stays green - curated
dia+8 build clears every act end to end.

## FLAGS for Minh (not silently weakened)

1. Element x act-boss parity (ElementBossMatrix, maxed intended-point
   build, 60s enrage DPS gate): 11/15 cells clear. Still pinned
   `defeat`:
   - wood x croc, wood x serpent: sustain-profile kit lands ~45-55%
     short of the boss hp pool inside the enrage window - element-side
     burst gap, not an investment gap.
   - fire x serpent (~5%), earth x serpent (~11%): knife-edge defeats,
     probably winnable with lucky drops but not guaranteed.
   If every element must carry every act gate at intended point, the
   wood kit (or the enrage timer, or those two boss scales) needs a
   retune - pinned 'defeat' cells flip themselves red-visible.
2. `statScale` mechanism is a ladder inside the roster lock - Minh
   ruled species-per-chapter; scaling a floor reuses the same ids, so
   no new species were added (consistent with the ruling's text; the
   difficulty ladder is expressed through count+elite+scale).
3. Deep-grind floors: qi abyssal_pool (2.85) and foundation f4/f7 sit
   near the 30-farm cap for a random-drop climber - they demand
   curated-quality gear (dia + affix coverage + enhance), which the
   player can reach through refine. If the intent is "organic drops
   alone must always suffice", those scales are too high; if the
   intent is "idle grind + a real gear goal", they are on-spec.
