# Stat-wall ladder retune (beta floors, 2026-10-05)

Minh directive (verbatim): "moi stage can the hien ro gia tri cua minh,
can farm do + nang cap o mot muc nhat dinh de qua, khong the chi hon
nhau mot chut duoc" + "Kho la tot, kho moi can idle".

Minh ruling (same day, second pass): "Ha nhe - rot do ngau nhien cung
nen du qua" - soften the near-cap grind floors so RANDOM drops alone
suffice to pass; selective investment stays a bonus, not the gate.

## Mechanism

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
floor for drops + enhance until it won or hit the farm cap.

- Mortal: dong_2..10 free-clear for a bare-ish player (walls only at
  d1/d6 due to count, d10 boss). Chapter climbed in ~13 farm runs.
- Qi: real entry wall (forest ~16 farm runs) but no ladder afterward.
- Foundation: entry was sim-impossible - the band drop table paid
  qi_refining ore while enhance costs resolve by PLAYER realm (dead
  material), and the naked entrant could not reach the qi boss farm
  floor.

## After - final ladders + measured farm runs (3 seeds, cap 50)

Probe model = random-drop oracle: attempt the floor; on defeat, farm
the highest cleared floor once + equipAll + pour all ore into enhances
+ spend all attribute points; retry until victory or 50 farm runs.
Realm transitions use the REAL ops (ritual -> qi, runTribulation ->
settle -> talent -> drain -> companion gift for foundation), so the
entrant's stats are the true post-ascent shape, not a hand-rolled one.

Mortal  `floorStatScales: [1.0, 1.0, 1.3, 1.55, 1.85, 2.15, 2.45, 2.7, 3.0, 3.6]`
  Worst across seeds: d9=3-12f, d10=0-8f, d7=0-7f. Floors 1-2 stay the
  gentle tutorial handoff; d3 already walls a bare player (pinned in
  StatWall.test.ts - 3/3 defeats, zero equipment).

Qi      `floorStatScales: [1.0, 1.2, 1.4, 1.5, 1.6, 1.65, 1.75, 1.9, 1.95, 2.0]`
  Worst: mid-late band 14-23f (mystic_marsh 23, blade_peak 21,
  stone_range 21, sand_plain 16, mineral_pit 14, abyssal_pool 14 boss).
  Entry wall preserved at f1 (0f on carried mortal gear).

Found.  `floorStatScales: [0.6, 1.0, 1.05, 1.15, 1.15, 1.15, 1.2, 1.15, 1.3, 1.7]`
  Worst: f9=0-17f, f4=1-9f, f6=1-8f, f1=1-5f entry convergence, f7=1-5f,
  f8=0-5f. f10 king falls cheap after the band grind - still the
  chapter's hardest single engagement (x7hp x2might under 1.7 scale).

Result: ALL 3 seeds cleared ALL 30 floors with random drops alone -
no selective refine/affix curation anywhere. The walls hold: almost
every floor past the tutorial pair still costs real farm runs, and the
stall budget is now measured in tens of farm runs, not impossibility.

"Free" (0 farm runs) entries = floor won with the gear the previous
grind produced - variance from drop rolls; the band is wide by design.

## What the soften actually moved

- qi f4-f10: 1.6-2.85 -> 1.5-2.0. Each floor in the band rotated a
  30-50-run stall across seeds (thin-gear arrival + elite-roll luck);
  the tail compressed until the RNG draw converged on all seeds.
- foundation f1: 1.0 -> 0.6. Ascent strips all gear AND invalidates
  lower grades, so the entrant has zero wearable income until the
  first foundation drop lands - the entry wall must converge on pool
  farms alone. 0.7-0.9 left ~466-670 enemy hp standing on defeats
  (zero kills); at 0.6 the margin is close enough that ~2-3
  foundation-grade drops flip it (verified 1-5f on all seeds).
- foundation f4-f9: 1.15-1.7 -> 1.15-1.3. Elite chance ramps to 19-21%
  by floor and tinh_anh rolls are x2.5hp, so late floors carry the
  largest luck swings; the band compressed to where the worst-seed
  draw still converges inside the cap.
- mortal f8/f9: 2.8/3.2 -> 2.7/3.0 (earlier round); d9 worst 11-12f.

## Drop-table fix (bug, not difficulty)

`StageDropTables` foundation band material entry paid
`qi_refining_ore_decade`; enhance costs resolve by the PLAYER's realm,
so a foundation player could never spend it - literally impossible
walls. Now pays `foundation_establishment_ore_decade` (w15).

## Sim-script retunes caused by the new walls (journey budgets)

- `EarlyGameLoop` canonical mortal chain: growth_cycle 5->8/10 runs,
  stage_until maxAttempts 8->10/12, qi forest 10->16.
- `TrucCoJourney` leg before foundation_floor_10: real-player wall
  response now includes 8x floor_9 re-farms + slot enhance attempts.
- `ElementBossMatrix` builds bumped dia+5/+8 -> dia+20 + full earned
  attribute pool + technique r3g2.

## Pinned regression coverage

`StatWall.test.ts`: spawn stamping pins (dong_3 normal = 78hp /
7.8 might; dong_10 king = 390*3.6*7 hp / 216 might; registry template
unscaled) + bare-stats walls (naked mortal loses dong_3 3/3; naked qi
entrant loses qi_refining_forest). BetaJourney stays green - curated
dia+8 build clears every act end to end.

## FLAGS for Minh (resolved / remaining)

1. Element x act-boss parity - RESOLVED by F-SCOPE-1 (fire only):
   - The serpent soften (2.85 -> 2.0) already flipped fire/wood/earth
     x serpent to victory; Minh then ruled fire the only in-scope
     element and ordered a KIT-DAMAGE tune: `hoa_cau_thuat` hit value
     1 -> 1.07 (+7%), spec overrides Tụ Diễm 1.15 -> 1.23 and Tán Diễm
     0.9 -> 0.96 (same +7%, authored spec ratios preserved). Enemy
     stats untouched. Post-buff: fire x serpent victory in 26 turns,
     fire x croc victory, fire x whelp victory.
   - Remaining pinned `defeat`: wood x croc only - kept as
     OUT-OF-SCOPE documentation (beta scope is fire only; the croc
     floor at 3.6 was not softened; wood kit sustain profile still
     lands ~45-50% short inside the 60s enrage window).
2. `statScale` mechanism - APPROVED by Minh, kept.
3. Residual variance tail: with random drops the worst floor on a bad
   seed costs ~20-30 farm runs (seen: qi stone_range 31 at 1.65). All
   three seeds now fully clear within the 50-run budget; the tail is
   luck, not a wall, but it is long on the deepest floors. If Minh
   wants a tighter tail (<15f worst-case), the f7-f10 bands compress
   further toward ~1.5-1.85 - or the fix is income-side (higher
   own-grade drop weight / realm-entry starter gear), not enemy stats.
