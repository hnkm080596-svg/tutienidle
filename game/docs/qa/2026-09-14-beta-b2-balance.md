# B2 — Beta Balance Pass (2026-09-14)

Scope per beta plan: economy sims, enemy stat curves across the 30 beta
floors, source/sink coverage, stat-cap ruling, degenerate-loop check.
Empirical "can a real player clear Phàm Nhân → Trúc Cơ" is **B3** — this
report bounds the question, it does not claim to close it.

## Method & data sources

- `tests/lab/balanceSweep.test.ts` (new, committed artifact): real
  `GameManager` + real catalogs + real `TurnBattleSystem`; runs every
  `STAGES` floor with a documented player model. Rerun: `npx vitest run
  tests/lab/balanceSweep.test.ts`.
- `ProductionBalance.simulation.test.ts` + `EconomySimulation.test.ts`
  re-run: **12/12 green** (fixed-seed invariant locks hold).
- Stat/curve reads: `EnemyStatInput.ts` (elite/boss multipliers),
  `ChapterStages.ts` (wave builder), `Armor.ts`, `RealmPressure.ts`,
  `StatCap.ts`, `realm.ts`, `EquipmentRolling.ts`, `VendorBalance.ts`,
  `RefinementBalance.ts`, `ProductionBalance.ts`.
- Live floor-1 forensic run (hit log, HP trace) — evidence inline below.

## Player models used

| Model | Definition |
|---|---|
| NAKED | realmLevel = floor gate, min-path points (12/realm prior), 50/50 vit/str, no gear/pills/nodes/talents |
| GEARED | NAKED + full 6-slot equipment, best quality of 20 real rolls/slot, unenhanced |

Deliberately pessimistic vs a real player (no talents, no enhance, no
Luyện Thể, no pills, no nodes, min realmLevel). Floors these models lose
are not proof the floor is broken — they locate where the auxiliary
power stack must carry.

## Finding B2-1 (HIGH, needs design ruling): floor 1 cannot be cleared on first entry

Real-engine evidence (`mortal_dong_1`, gate = mortal lv1):

| Player | Result | Kills before death |
|---|---|---|
| Naked + 5 creation points (all STR) | defeat, round 3 | 1/3 wave-1 enemies |
| Geared + 5 points (best-of-20/slot) | defeat, round 7 | 4/6 across wave 1→2 |

Mechanics driving it (all verified in code, none buggy):

- `totalEnemyCount = 9 + floor` in 3 concurrent waves — the player faces
  **3–4 simultaneous enemies** from the first pull.
- Enemy `attackSpeed: 5` normalizes to ~2× player gauge speed → ~6–8
  incoming actions per player action.
- Elite roll (`weight 3` + `eliteChance 0.1` per spawn) → ~37% of
  spawns are elite (×2.5 hp / ×1.35 atk).
- Damage = `attack × (1 − def/(def+K))`, K=50 at mortal — mitigation is
  real but caps the wrong way for a fresh player.

Consequence: a brand-new character **cannot bootstrap any loot from
floor 1 on first entry** (dies having killed ~1 enemy). Loot does drop
from partial kills (design: `processDefeatedEnemies` pays per kill), so
the intended ramp is presumably "cultivate a few sub-levels, then
fight" — but nothing in the first-session UX says so, and the player's
literal first combat is a guaranteed loss.

Options: (a) accept — document intent + defeat screen hint; (b) soften
floor 1–2 pools (fewer elites / weaker species) as the tutorial ramp;
(c) gate floor 1 at realmLevel 2–3 so first entry is pre-cultivated.

## Finding B2-2 (HIGH, defers to B3): difficulty rests entirely on the auxiliary power stack

Sweep result: NAKED and GEARED both lose **all 30 floors**. Round counts
(GEARED): mortal F1–F9 die round 2–7, qi/foundation die round 0–2.

Stat gap at the top of beta scope (foundation F10 boss, from sweep):
boss ~26 000 hp / ~331 atk vs GEARED player ~346 hp / ~113 atk / ~99
def. The player stack that must close this: main-stat points (cap 100
@foundation → +54 atk), enhance levels, quality affixes, talent
passives (in-fight stacking), Luyện Thể %, pills, Thuần nodes, skill
levels, companion. No validated "intended power at floor N" model
exists anywhere in the repo — **B3 must produce it empirically** or the
beta ships on an unproven curve.

Realm boundary shape is healthy: each new realm resets trash difficulty
(mortal F9 338hp → qi F1 150hp), so breakthrough feels like a power
spike before the curve climbs again.

## Finding B2-3 (MEDIUM, already roadmap-flagged): production oversupply

24h × 1-worker fixed-seed sims (green, numbers reproduced):

- Thảo chain: **855 herb produced vs 62 consumed** for 13 pills.
- Gỗ chain: mortal wood 870 vs 38 fuel needed (~23×).
- Khoáng chain: 2 046 ore fully consumed → **2 758 tinh hoa** (refine
  yields >1:1; essence is the vendor-sellable surplus).

Vendor prices (2–120/unit × realm growth 3) make production → vendor
the dominant spirit-stone faucet by an order of magnitude vs combat
drops (5–10/kill). For an idle game that may be intended — but it makes
**combat loot feel irrelevant for currency** and production the only
economy that matters.

Recommendation: accept oversupply (it feeds the vendor sink), but decide
whether combat should pay more stones or production less. Design call,
not a defect.

## Finding B2-4 (LOW): stat-cap ruling — formally resolved

The deferred 7.3 items:

- **3.5 Mortal stat cap**: `getMainStatCap()` = mortal 10 / qi 30 /
  foundation 100, base 1 → 9-point headroom per stat at mortal. Forces
  breadth (18 points can't all land in one stat), qi 30 allows focus,
  foundation 100 is unreachable anyway. Internally consistent —
  **ruling: keep values, no change**.
- **3.6 CDR cap 300%**: `cooldownReduction` was retired in the
  2026-09-04 turn-based conversion (affixes.ts comment; turn engine
  uses discrete `cooldownTurns`). **Ruling: moot — no cap needed; item
  closed.**

Separate field `RealmData.attributeCap` (10/20/100) remains the
pill-permanent-stat absorption cap — distinct mechanism, untouched.

## Finding B2-5 (LOW): unbounded/degenerate surface — bounded

- Offline production/decompose settle: capped at
  `PRODUCTION_OFFLINE_CAP_SECONDS = 10h`, anti-backdate guard present.
- Auto-farm: `isValidCycleSeconds` + `lastCheckedMs` recovery landed in
  F2; perfect-clear gating prevents reward on failed floors.
- Wash/refine: per-attempt spirit-stone + tinh-hoa costs, locked
  pending-slot (no free reroll).
- Gacha: pull token `chieu_hien_lenh`, no infinite-loop surface found.
- No mint-from-nothing loops found in the beta surface.

## Outliers & values needing attention

1. Floor 1 first-entry impossibility (B2-1) — highest product risk in
   the table: new player's first combat is a scripted loss.
2. Foundation late floors (F8–F10): enemy atk 128–331 vs plausible
   player mitigation — the wall is steep; B3 evidence decides if the
   stack closes it.
3. Production→vendor dominance (B2-3) — tuning call pending.
4. `spawnIntervalSeconds: 3` is dead in turn-based pacing but still
   displayed in StageSelectPanel (cosmetic; roadmap already tracks).

## Recommendations (priority order)

1. **Decide B2-1** before B3: if floor 1 stays as-is, B3's run must
   demonstrate the intended cultivate-then-fight ramp and the defeat
   screen must tell the player why. If softened, retune
   `poolOverrides[1]`/species for floors 1–2 only — smallest blast
   radius.
2. **B3 hard requirement**: build the intended-power reference
   (attributes + realm gear + enhance + one talent + Thể) and prove
   every floor clears; produce the missing "power at floor N" table as
   the balance baseline going forward.
3. **Defer** production rate retuning to post-beta unless B3 shows
   players starve stones — current oversupply harms pacing feel, not
   correctness.
4. Close 3.5/3.6 in the roadmap ledger with this ruling.

## Explicitly not done

- No balance values were tuned (design decisions pending).
- No claim of end-to-end clearability — that is B3's deliverable.
- Kim Đan+ material/economy placeholders remain out of scope.
